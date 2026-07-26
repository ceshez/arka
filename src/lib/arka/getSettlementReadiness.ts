import type { Arka, AssetSymbol } from '../../types/arka'
import { calculateArkaProgress } from './calculateArkaProgress'

export type SettlementReadiness = {
  asset?: AssetSymbol
  canSettle: boolean
  hasPaymentInconsistency: boolean
  nimTarget: number
  requiresRefund: boolean
  requiresConversion: boolean
  usdtTarget: number
}

export function getSettlementReadiness(arka: Arka): SettlementReadiness {
  const progress = calculateArkaProgress(arka)
  const nimTarget = Number(arka.members
    .reduce((total, member) => total + member.amountDueNim, 0)
    .toFixed(2))
  const usdtTarget = Number(arka.members
    .reduce((total, member) => total + (member.amountDueUsdt ?? member.amountDueFiat), 0)
    .toFixed(2))
  const requiresRefund = arka.members.some((member) => (
    member.status === 'refund-needed'
    || member.amountPaidFiat > member.amountDueFiat
  ))
  const allocationsMatchTotal = Math.abs(
    arka.members.reduce((total, member) => total + member.amountDueFiat, 0) - arka.totalFiat,
  ) <= 0.01
  const everyShareIsSatisfied = arka.members.every(
    (member) => member.amountPaidFiat >= member.amountDueFiat - 0.005,
  )
  const hasPaymentInconsistency = !allocationsMatchTotal
    || (progress.isFullyPaid && !everyShareIsSatisfied)
  const nimReady = progress.collectedNim >= nimTarget - 0.01
  const usdtReady = progress.collectedUsdt >= usdtTarget - 0.01
  const asset: AssetSymbol | undefined = nimReady ? 'NIM' : usdtReady ? 'USDT' : undefined
  const balancesAreValid = !requiresRefund && !hasPaymentInconsistency && everyShareIsSatisfied

  return {
    asset,
    canSettle: progress.isFullyPaid && balancesAreValid && Boolean(asset),
    hasPaymentInconsistency,
    nimTarget,
    requiresRefund,
    requiresConversion: progress.isFullyPaid && balancesAreValid && !asset,
    usdtTarget,
  }
}
