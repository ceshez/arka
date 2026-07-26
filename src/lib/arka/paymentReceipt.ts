import { calculateArkaProgress } from './calculateArkaProgress'
import { formatNim, formatUsd, formatUsdt } from './formatMoney'
import type { Arka, ArkaMember, AssetSymbol } from '../../types/arka'
import type { Payment } from '../../types/payment'

export function buildPaymentReceiptShareText({
  arka,
  member,
  asset,
  payment,
}: {
  arka: Arka
  member: ArkaMember
  asset: AssetSymbol
  payment?: Payment
}) {
  const paidFiat = payment?.amountFiat ?? member.amountDueFiat
  const nimAmount = payment?.amountNim ?? member.amountDueNim
  const paidAssetAmount = asset === 'NIM'
    ? payment?.amountNim ?? member.amountDueNim
    : payment?.amountUsdt ?? member.amountDueUsdt ?? member.amountDueFiat
  const assetLine = asset === 'NIM' ? formatNim(paidAssetAmount) : formatUsdt(paidAssetAmount)
  const progress = calculateArkaProgress(arka)

  return `Payment confirmed: ${formatUsd(paidFiat)} (≈ ${formatNim(nimAmount)}) paid with ${assetLine} toward ${arka.name}. ${progress.paidMemberCount} of ${progress.memberCount} friends have paid.`
}
