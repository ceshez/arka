/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase JSON snapshot boundary. */
import {
  activationMessage,
  assertMember,
  handleOptions,
  json,
  loadInvite,
  saveArka,
  verifyActivation,
} from '../_shared/shared-fund.ts'

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  try {
    const body = await request.json()
    const { client, row } = await loadInvite(String(body.reference ?? ''))
    if (row.arka.fundingMode !== 'shared-wallet') throw new Error('This Arka does not use a shared fund.')
    const member = await assertMember(row, body.memberId, body.guestKey, body.hostSecret)
    const expectedMessage = activationMessage(row.arka, member.id)
    if (body.message !== expectedMessage) throw new Error('The wallet activation challenge is invalid.')
    if (!verifyActivation(expectedMessage, member.walletAddress, body.publicKey, body.signature)) {
      throw new Error('The wallet signature could not be verified.')
    }

    const members = row.arka.members.map((candidate: Record<string, any>) => candidate.id === member.id
      ? {
          ...candidate,
          activationStatus: 'verified',
          activationPublicKey: body.publicKey,
          activationSignature: body.signature,
          activationMessage: expectedMessage,
          activatedAt: new Date().toISOString(),
        }
      : candidate)
    const arka = await saveArka(client, row, { ...row.arka, members })
    return json({ arka, memberId: member.id, verified: true })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Activation failed.' }, 400)
  }
})
