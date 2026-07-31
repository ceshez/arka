export function formatUsd(value: number) {
  const usesMicroAmount = Math.abs(value) > 0 && Math.abs(value) < 0.01
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: usesMicroAmount ? 5 : 2,
  }).format(value)
}

export function normalizeUsdInput(value: string) {
  const normalized = value.replaceAll(',', '.').replace(/[^\d.]/g, '')
  const [whole = '', ...fractionParts] = normalized.split('.')
  const fraction = fractionParts.join('').slice(0, 2)
  const wholeWithoutExtraZeros = whole.replace(/^0+(?=\d)/, '')
  return normalized.includes('.')
    ? `${wholeWithoutExtraZeros || '0'}.${fraction}`
    : wholeWithoutExtraZeros
}

export function formatNim(value: number) {
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value)} NIM`
}

export function formatNimEstimate(value: number) {
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
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
