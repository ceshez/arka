/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase JSON snapshot boundary. */
import {
  assertHost,
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
    if (row.arka.fundingMode !== 'shared-wallet' || row.arka.status === 'completed') {
      throw new Error('This shared fund cannot be refunded.')
    }
    const refundable = (row.arka.members ?? []).filter((member: Record<string, any>) => (
      Number(member.amountPaidNim ?? 0) > 0 && member.walletAddress
    ))
    if (!refundable.length) throw new Error('There are no confirmed contributions to refund.')
    const plan = row.arka.refundPlan ?? {
      id: crypto.randomUUID(),
      status: 'requested',
      requestedAt: new Date().toISOString(),
      approvalThreshold: Number(row.arka.approvalThreshold),
      confirmedRefunds: 0,
      totalRefunds: refundable.length,
    }
    const rows = refundable.map((member: Record<string, any>) => ({
      plan_id: plan.id,
      invite_id: row.id,
      arka_id: row.arka.id,
      member_id: member.id,
      recipient_wallet_address: member.walletAddress,
      amount_luna: Math.round(Number(member.amountPaidNim) * 100_000),
      status: 'requested',
    }))
    const inserted = await client.from('arka_refunds').upsert(rows, { onConflict: 'plan_id,member_id' })
    if (inserted.error) throw inserted.error
    const arka = await saveArka(client, row, withEvent({
      ...row.arka,
      refundPlan: plan,
    }, event({
      type: 'refund-requested',
      status: 'pending',
      label: 'Refund plan requested',
    })))
    return json({ arka })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Refund request failed.' }, 400)
  }
})
