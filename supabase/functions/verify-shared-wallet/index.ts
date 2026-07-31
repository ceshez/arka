/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase JSON snapshot boundary. */
import {
  assertHost,
  computeSharedAddress,
  handleOptions,
  json,
  loadInvite,
  normalizeAddress,
  saveArka,
} from '../_shared/shared-fund.ts'

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  try {
    const body = await request.json()
    const { client, row } = await loadInvite(String(body.reference ?? ''))
    await assertHost(row, body.hostSecret)
    const members = row.arka.members ?? []
    const participantCount = members.length
    if (participantCount < 2 || participantCount > 16) {
      throw new Error('A shared wallet needs between 2 and 16 current participants.')
    }
    if (members.some((member: Record<string, any>) => member.activationStatus !== 'verified' || !member.activationPublicKey)) {
      throw new Error('Every participant must activate their wallet first.')
    }
    const approvals = Math.floor(participantCount / 2) + 1
    const expected = computeSharedAddress(members.map((member: Record<string, any>) => member.activationPublicKey), approvals)
    if (normalizeAddress(expected) !== normalizeAddress(body.sharedWalletAddress)) {
      throw new Error('This address does not match the activated members and approval threshold.')
    }
    const arka = await saveArka(client, row, {
      ...row.arka,
      sharedWalletAddress: expected,
      sharedWalletStatus: 'verified',
      approvalThreshold: approvals,
      membershipLockedAt: new Date().toISOString(),
      status: 'collecting',
    })
    return json({ arka, verified: true })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Shared wallet verification failed.' }, 400)
  }
})
