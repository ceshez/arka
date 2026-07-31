import type { Arka } from '../../types/arka'
import { formatPublicIdentity } from './formatWalletAddress'

export type ArkaActivityEvent = {
  id: string
  kind: 'paid' | 'partial' | 'ready' | 'completed' | 'created' | 'shared' | 'joined' | 'sponsor' | 'sponsor-request' | 'sponsor-response'
  title: string
  detail: string
  occurredAt: string
  memberId?: string
}

export function getArkaActivity(arka: Arka): ArkaActivityEvent[] {
  const events: ArkaActivityEvent[] = [
    {
      id: `${arka.id}:created`,
      kind: 'created',
      title: 'Arka opened',
      detail: 'The invite is ready to share.',
      occurredAt: arka.createdAt,
    },
  ]

  const host = arka.members.find((member) => member.userId === arka.hostId || member.id === arka.hostId)
  if (host) {
    events.push({
      id: `${arka.id}:shared`,
      kind: 'shared',
      title: `${formatPublicIdentity(host.displayName, host.walletAddress)} shared this Arka`,
      detail: 'The group invite is ready to join.',
      occurredAt: arka.invite.createdAt,
      memberId: host.id,
    })
  }

  for (const member of arka.members) {
    if (member.role === 'guest' && member.joinedAt) {
      events.push({
        id: `${arka.id}:${member.id}:joined`,
        kind: 'joined',
        title: `${formatPublicIdentity(member.displayName, member.walletAddress)} joined`,
        detail: `They are now part of ${arka.name}.`,
        occurredAt: member.joinedAt,
        memberId: member.id,
      })
    }

    const isTreating = arka.splitMethod === 'sponsor' && member.amountDueFiat >= arka.totalFiat - 0.01
    if (member.status === 'paid') {
      events.push({
        id: `${arka.id}:${member.id}:paid`,
        kind: isTreating ? 'sponsor' : 'paid',
        title: isTreating ? `${formatPublicIdentity(member.displayName, member.walletAddress)} is treating this Arka` : `${formatPublicIdentity(member.displayName, member.walletAddress)} paid their share`,
        detail: isTreating ? 'They were selected to cover the group payment.' : 'Their contribution is confirmed.',
        occurredAt: member.paidAt ?? arka.updatedAt,
        memberId: member.id,
      })
    } else if (member.status === 'partial') {
      events.push({
        id: `${arka.id}:${member.id}:partial`,
        kind: 'partial',
        title: `${formatPublicIdentity(member.displayName, member.walletAddress)} made a partial payment`,
        detail: 'There is still an amount remaining.',
        occurredAt: member.paidAt ?? arka.updatedAt,
        memberId: member.id,
      })
    }
  }

  if (arka.sponsorModeRequest) {
    events.push({
      id: `${arka.id}:${arka.sponsorModeRequest.id}:requested`,
      kind: 'sponsor-request',
      title: `Who's treating? approval requested`,
      detail: 'Everyone must opt in before the wheel can choose who covers the Arka.',
      occurredAt: arka.sponsorModeRequest.requestedAt,
      memberId: arka.sponsorModeRequest.requestedByMemberId,
    })

    for (const member of arka.members) {
      const response = arka.sponsorModeRequest.responses[member.id]
      if (!response?.respondedAt || member.id === arka.sponsorModeRequest.requestedByMemberId) continue
      events.push({
        id: `${arka.id}:${arka.sponsorModeRequest.id}:${member.id}:${response.status}`,
        kind: 'sponsor-response',
        title: `${formatPublicIdentity(member.displayName, member.walletAddress)} ${response.status}`,
        detail: response.status === 'accepted'
          ? 'They agreed to be included in the treating wheel.'
          : 'The treating wheel will stay paused.',
        occurredAt: response.respondedAt,
        memberId: member.id,
      })
    }
  }

  if (arka.status === 'ready-to-settle') {
    events.push({ id: `${arka.id}:ready`, kind: 'ready', title: 'Ready to settle', detail: 'Everyone has paid. The host can settle the final payment.', occurredAt: arka.updatedAt })
  }

  if (arka.status === 'completed') {
    events.push({ id: `${arka.id}:completed`, kind: 'completed', title: 'Arka settled', detail: 'The final payment has been completed.', occurredAt: arka.completedAt ?? arka.updatedAt })
  }

  return events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => {
      const timeDifference = Date.parse(right.event.occurredAt) - Date.parse(left.event.occurredAt)

      // Render the timeline newest-first so the oldest event sits at the bottom.
      // Reverse insertion order for equal timestamps to keep creation at the bottom
      // when the initial events share the Arka's creation time.
      return timeDifference || right.index - left.index
    })
    .map(({ event }) => event)
}
