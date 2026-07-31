import type { ArkaMember } from '../../types/arka'

function round(value: number, fractionDigits: number) {
  const factor = 10 ** fractionDigits
  return Math.round(value * factor) / factor
}

export function getRemainingPaymentAmounts(member: ArkaMember) {
  const amountFiat = round(Math.max(member.amountDueFiat - member.amountPaidFiat, 0), 5)
  const remainingRatio = member.amountDueFiat > 0 ? amountFiat / member.amountDueFiat : 0

  return {
    amountFiat,
    amountNim: round(member.amountDueNim * remainingRatio, 5),
    amountUsdt: round((member.amountDueUsdt ?? member.amountDueFiat) * remainingRatio, 6),
  }
}
