/* eslint-disable @typescript-eslint/no-explicit-any -- Nimiq RPC and Supabase JSON boundaries. */
import {
  assertHost,
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

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  try {
    const body = await request.json()
    const { client, row } = await loadInvite(String(body.reference ?? ''))
    await assertHost(row, body.hostSecret)
    const proposal = row.arka.settlementProposal
    if (!proposal) throw new Error('Prepare the final payment before checking mainnet.')
    if (proposal.status === 'confirmed') return json({ arka: row.arka, verified: true })

    const transactions = await nimiqRpc<Record<string, any>[]>('getTransactionsByAddress', [
      proposal.sourceWalletAddress,
      100,
      null,
    ])
    const expectedValue = Math.round(Number(proposal.amountNim) * 100_000)
    const transaction = transactions?.find((candidate) => (
      typeof candidate.blockNumber === 'number'
      && candidate.networkId === 24
      && candidate.executionResult !== false
      && normalizeAddress(candidate.from) === normalizeAddress(proposal.sourceWalletAddress)
      && normalizeAddress(candidate.to) === normalizeAddress(proposal.recipientWalletAddress)
      && Number(candidate.value) === expectedValue
      && (!transactionMemo(candidate) || transactionMemo(candidate) === proposal.memo)
    ))
    if (!transaction) throw new Error('The matching final payment is not confirmed on mainnet yet.')

    const confirmedAt = new Date().toISOString()
    const inserted = await client.from('arka_settlements').insert({
      proposal_id: proposal.id,
      invite_id: row.id,
      arka_id: row.arka.id,
      source_wallet_address: transaction.from,
      recipient_wallet_address: transaction.to,
      amount_luna: expectedValue,
      memo: transactionMemo(transaction),
      transaction_hash: transaction.hash,
      network_id: 24,
      block_number: transaction.blockNumber,
      status: 'confirmed',
      confirmed_at: confirmedAt,
    })
    if (inserted.error && !String(inserted.error.message).toLowerCase().includes('duplicate')) {
      throw inserted.error
    }
    await client.from('arka_settlement_proposals').update({
      status: 'confirmed',
      updated_at: confirmedAt,
    }).eq('id', proposal.id)

    const arka = await saveArka(client, row, withEvent({
      ...row.arka,
      status: 'completed',
      completedAt: confirmedAt,
      settlementProposal: { ...proposal, status: 'confirmed', confirmedAt },
    }, event({
      type: 'settlement-confirmed',
      status: 'confirmed',
      label: 'Final payment confirmed',
      amountNim: Number(proposal.amountNim),
    })))
    return json({ arka, verified: true })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Settlement verification failed.' }, 400)
  }
})
