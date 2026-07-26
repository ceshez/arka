import type { ArkaMember } from '../../types/arka'

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

export function getRemainingPaymentAmounts(member: ArkaMember) {
  const amountFiat = roundToTwo(Math.max(member.amountDueFiat - member.amountPaidFiat, 0))
  const remainingRatio = member.amountDueFiat > 0 ? amountFiat / member.amountDueFiat : 0

  return {
    amountFiat,
    amountNim: roundToTwo(member.amountDueNim * remainingRatio),
    amountUsdt: roundToTwo((member.amountDueUsdt ?? member.amountDueFiat) * remainingRatio),
  }
}
