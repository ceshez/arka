/* eslint-disable @typescript-eslint/no-explicit-any -- Nimiq RPC and Supabase JSON boundaries. */
import {
  assertMember,
  event,
  handleOptions,
  json,
  loadInvite,
  nimiqRpc,
  normalizeAddress,
  saveArka,
  transactionMemo,
  withEvent,
} from '../_shared/shared-fund.ts'

const LUNAS_PER_NIM = 100_000

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  try {
    const body = await request.json()
    const { client, row } = await loadInvite(String(body.reference ?? ''))
    const member = await assertMember(row, body.memberId, body.guestKey, body.hostSecret)
    if (row.arka.fundingMode !== 'shared-wallet' || row.arka.sharedWalletStatus !== 'verified') {
      throw new Error('The shared wallet is not open for contributions.')
    }
    const hash = String(body.transactionHash ?? '').toLowerCase()
    if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('Invalid transaction reference.')
    const existing = await client.from('arka_contributions').select('id').eq('transaction_hash', hash).maybeSingle()
    if (existing.data) throw new Error('This contribution was already recorded.')

    const transaction = await nimiqRpc<Record<string, any>>('getTransactionByHash', [hash])
    const expectedValue = Math.round(Number(member.amountDueNim) * LUNAS_PER_NIM)
    const expectedMemo = `ARKA:${row.arka.id}:${member.id}`
    if (!transaction
      || typeof transaction.blockNumber !== 'number'
      || transaction.networkId !== 24
      || transaction.executionResult === false
      || normalizeAddress(transaction.from) !== normalizeAddress(member.walletAddress)
      || normalizeAddress(transaction.to) !== normalizeAddress(row.arka.sharedWalletAddress)
      || Number(transaction.value) !== expectedValue
      || transactionMemo(transaction) !== expectedMemo) {
      throw new Error('The mainnet transaction does not match this contribution.')
    }

    const paidAt = new Date().toISOString()
    const members = row.arka.members.map((candidate: Record<string, any>) => candidate.id === member.id
      ? {
          ...candidate,
          status: 'paid',
          amountPaidFiat: candidate.amountDueFiat,
          amountPaidNim: candidate.amountDueNim,
          paidAt,
        }
      : candidate)
    const allPaid = members.every((candidate: Record<string, any>) => (
      Number(candidate.amountPaidNim ?? 0) + 0.00001 >= Number(candidate.amountDueNim ?? 0)
    ))
    const nextEvent = event({
      type: 'contribution',
      status: 'confirmed',
      memberId: member.id,
      label: member.displayName,
      amountNim: Number(member.amountDueNim),
    })
    let nextArka = withEvent(row.arka, nextEvent)
    if (allPaid) {
      nextArka = withEvent(nextArka, event({
        type: 'goal-reached',
        status: 'confirmed',
        label: 'Funding goal reached',
        amountNim: Number(row.arka.totalNimEstimate),
      }))
    }
    nextArka = {
      ...nextArka,
      members,
      contributionAsset: 'NIM',
      status: allPaid ? 'ready-to-settle' : 'collecting',
    }

    const inserted = await client.from('arka_contributions').insert({
      invite_id: row.id,
      arka_id: row.arka.id,
      member_id: member.id,
      sender_address: transaction.from,
      shared_wallet_address: transaction.to,
      amount_luna: expectedValue,
      memo: expectedMemo,
      transaction_hash: hash,
      network_id: 24,
      block_number: transaction.blockNumber,
      status: 'confirmed',
      confirmed_at: paidAt,
    })
    if (inserted.error) throw inserted.error
    const arka = await saveArka(client, row, nextArka)
    return json({ arka, memberId: member.id, verified: true })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Contribution verification failed.' }, 400)
  }
})
