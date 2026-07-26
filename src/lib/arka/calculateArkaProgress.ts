import type { Arka, ArkaComputedState } from '../../types/arka'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function calculateArkaProgress(arka: Arka): ArkaComputedState {
  const collectedFiat = arka.members.reduce((total, member) => total + member.amountPaidFiat, 0)
  const collectedNim = arka.members.reduce((total, member) => total + member.amountPaidNim, 0)
  const collectedUsdt = arka.members.reduce((total, member) => total + (member.amountPaidUsdt ?? 0), 0)
  const paidMemberCount = arka.members.filter((member) => member.status === 'paid').length
  const pendingMemberCount = arka.members.filter((member) => member.status === 'pending').length
  const partialMemberCount = arka.members.filter((member) => member.status === 'partial').length
  const progressPercent = clamp((collectedFiat / arka.totalFiat) * 100, 0, 100)
  const isFullyPaid = collectedFiat >= arka.totalFiat

  return {
    memberCount: arka.members.length,
    paidMemberCount,
    pendingMemberCount,
    partialMemberCount,
    collectedFiat,
    collectedNim,
    collectedUsdt,
    remainingFiat: Math.max(arka.totalFiat - collectedFiat, 0),
    remainingNim: Math.max(arka.totalNimEstimate - collectedNim, 0),
    remainingUsdt: Math.max((arka.totalUsdtEstimate ?? arka.totalFiat) - collectedUsdt, 0),
    progressPercent,
    isFullyPaid,
    isReadyToSettle: isFullyPaid && arka.status === 'collecting',
  }
}
