import type { Arka } from '../../types/arka'

const activeDeadlineStatuses = new Set<Arka['status']>([
  'draft',
  'open',
  'collecting',
  'ready-to-settle',
])

export function createDefaultArkaDeadline(now = new Date()) {
  const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  deadline.setSeconds(0, 0)
  deadline.setMinutes(Math.ceil(deadline.getMinutes() / 5) * 5)
  return deadline
}

export function toLocalDateTimeInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function parseLocalDeadline(value: string) {
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? new Date(timestamp) : null
}

export function isFutureDeadline(value: string, now = Date.now()) {
  const deadline = parseLocalDeadline(value)
  return Boolean(deadline && deadline.getTime() > now)
}

export function withArkaDeadlineStatus(arka: Arka, now = Date.now()): Arka {
  if (!arka.expiresAt || !activeDeadlineStatuses.has(arka.status)) return arka
  if (new Date(arka.expiresAt).getTime() > now) return arka

  return {
    ...arka,
    status: 'expired',
  }
}

export function formatArkaDeadline(value: string, locale?: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
