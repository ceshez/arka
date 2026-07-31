import type { Arka, AssetSymbol } from '../../types/arka'

export function getLockedContributionAsset(arka: Arka): AssetSymbol | undefined {
  if (arka.contributionAsset) return arka.contributionAsset

  const hasNimContribution = arka.members.some((member) => member.amountPaidNim > 0)
  const hasUsdtContribution = arka.members.some((member) => (member.amountPaidUsdt ?? 0) > 0)

  if (hasNimContribution && !hasUsdtContribution) return 'NIM'
  if (hasUsdtContribution && !hasNimContribution) return 'USDT'
  return hasNimContribution || hasUsdtContribution ? arka.selectedAsset : undefined
}
