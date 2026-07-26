import type { Arka } from '../../types/arka'

export type ArkaActivityEvent = {
  id: string
  kind: 'paid' | 'partial' | 'ready' | 'completed' | 'created' | 'shared' | 'sponsor'
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
      title: `${host.displayName} shared this Arka`,
      detail: 'The group invite is ready to join.',
      occurredAt: arka.invite.createdAt,
      memberId: host.id,
    })
  }

  for (const member of arka.members) {
    const isTreating = arka.splitMethod === 'sponsor' && member.amountDueFiat >= arka.totalFiat - 0.01
    if (member.status === 'paid') {
      events.push({
        id: `${arka.id}:${member.id}:paid`,
        kind: isTreating ? 'sponsor' : 'paid',
        title: isTreating ? `${member.displayName} is treating this Arka` : `${member.displayName} paid their share`,
        detail: isTreating ? 'They were selected to cover the group payment.' : 'Their contribution is confirmed.',
        occurredAt: member.paidAt ?? arka.updatedAt,
        memberId: member.id,
      })
    } else if (member.status === 'partial') {
      events.push({
        id: `${arka.id}:${member.id}:partial`,
        kind: 'partial',
        title: `${member.displayName} made a partial payment`,
        detail: 'There is still an amount remaining.',
        occurredAt: member.paidAt ?? arka.updatedAt,
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
