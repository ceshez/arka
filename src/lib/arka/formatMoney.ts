export function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatNim(value: number) {
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 5,
  }).format(value)} NIM`
}

export function formatUsdt(value: number) {
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6,
  }).format(value)} USDT`
}

export function formatDate(value?: string) {
  if (!value) return 'In progress'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}
