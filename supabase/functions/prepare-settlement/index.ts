import {
  assertHost,
  canonicalAddress,
  event,
  handleOptions,
  json,
  loadInvite,
  saveArka,
  withEvent,
} from '../_shared/shared-fund.ts'

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  try {
    const body = await request.json()
    const { client, row } = await loadInvite(String(body.reference ?? ''))
    await assertHost(row, body.hostSecret)
    if (row.arka.status !== 'ready-to-settle' || row.arka.sharedWalletStatus !== 'verified') {
      throw new Error('The shared fund is not ready for its final payment.')
    }
    if (row.arka.settlementProposal?.status === 'confirmed') return json({ arka: row.arka, verified: true })

    let recipientWalletAddress: string
    try {
      recipientWalletAddress = canonicalAddress(String(body.recipientWalletAddress ?? ''))
    } catch {
      throw new Error('Enter a valid Nimiq recipient wallet.')
    }
    const recipientLabel = String(body.recipientLabel ?? '').trim().slice(0, 80) || undefined

    const proposal = row.arka.settlementProposal ?? {
      id: crypto.randomUUID(),
      sourceWalletAddress: row.arka.sharedWalletAddress,
      recipientWalletAddress,
      recipientLabel,
      amountNim: Number(row.arka.totalNimEstimate),
      memo: `ARKA-SETTLE:${row.arka.id}`,
      approvalThreshold: Number(row.arka.approvalThreshold),
      status: 'prepared',
      createdAt: new Date().toISOString(),
    }
    const inserted = await client.from('arka_settlement_proposals').upsert({
      id: proposal.id,
      invite_id: row.id,
      arka_id: row.arka.id,
      source_wallet_address: proposal.sourceWalletAddress,
      recipient_wallet_address: proposal.recipientWalletAddress,
      amount_luna: Math.round(proposal.amountNim * 100_000),
      memo: proposal.memo,
      approval_threshold: proposal.approvalThreshold,
      status: proposal.status,
      created_at: proposal.createdAt,
    }, { onConflict: 'invite_id' })
    if (inserted.error) throw inserted.error
    const arka = await saveArka(client, row, withEvent({
      ...row.arka,
      recipientWalletAddress: proposal.recipientWalletAddress,
      recipientLabel: proposal.recipientLabel,
      recipientLockedAt: proposal.createdAt,
      settlementProposal: proposal,
      status: 'settling',
    }, event({
      type: 'settlement-prepared',
      status: 'pending',
      label: 'Final payment prepared',
      amountNim: proposal.amountNim,
    })))
    return json({ arka })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Settlement preparation failed.' }, 400)
  }
})
