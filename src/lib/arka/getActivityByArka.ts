import type { Arka } from '../../types/arka'
import { getArkaActivity, type ArkaActivityEvent } from './getArkaActivity'

export type ArkaActivityGroup = {
  arka: Arka
  events: ArkaActivityEvent[]
}

function timestamp(value?: string) {
  const parsed = Date.parse(value ?? '')
  return Number.isFinite(parsed) ? parsed : 0
}

function latestActivityTimestamp(group: ArkaActivityGroup) {
  return group.events.reduce(
    (latest, event) => Math.max(latest, timestamp(event.occurredAt)),
    timestamp(group.arka.createdAt),
  )
}

export function getActivityByArka(arkas: Arka[]): ArkaActivityGroup[] {
  return arkas
    .map((arka) => ({ arka, events: getArkaActivity(arka) }))
    .sort((left, right) => (
      latestActivityTimestamp(right) - latestActivityTimestamp(left)
      || timestamp(right.arka.createdAt) - timestamp(left.arka.createdAt)
      || left.arka.id.localeCompare(right.arka.id)
    ))
}
