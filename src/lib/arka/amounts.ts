export const LUNA_PER_NIM = 100_000

export function nimToLuna(nim: number) {
  return Math.round(nim * LUNA_PER_NIM)
}

export function lunaToNim(luna: number) {
  return luna / LUNA_PER_NIM
}

export function estimateNimFromFiat(amountFiat: number, totalFiat: number, totalNim: number) {
  if (totalFiat <= 0) return 0
  return Number(((amountFiat / totalFiat) * totalNim).toFixed(2))
}
