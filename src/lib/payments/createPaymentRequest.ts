import type { Arka, ArkaMember, AssetSymbol } from '../../types/arka'
import type { PaymentRequest } from '../nimiq/types'
import { getSettlementReadiness } from '../arka/getSettlementReadiness'
import { getRemainingPaymentAmounts } from './getRemainingPaymentAmounts'

export function createMemberPaymentRequest(
  arka: Arka,
  member: ArkaMember,
  asset: AssetSymbol,
): PaymentRequest {
  const remaining = getRemainingPaymentAmounts(member)

  return {
    arkaId: arka.id,
    payerUserId: member.userId,
    recipientWalletAddress: arka.hostWalletAddress ?? 'NQXX HOST WALLET',
    recipientLabel: 'Host wallet',
    asset,
    amountFiat: remaining.amountFiat,
    amountNim: asset === 'NIM' ? remaining.amountNim : undefined,
    amountUsdt: asset === 'USDT' ? remaining.amountUsdt : undefined,
    memo: `Arka ${arka.code}`,
    isDemo: arka.metadata?.isDemo,
  }
}

export function createSettlementPaymentRequest(arka: Arka, asset: AssetSymbol): PaymentRequest {
  const readiness = getSettlementReadiness(arka)
  if (!arka.merchantWalletAddress) throw new Error('Merchant wallet is required before settlement')

  return {
    arkaId: arka.id,
    payerUserId: arka.hostId,
    recipientWalletAddress: arka.merchantWalletAddress,
    recipientLabel: arka.metadata?.locationName ?? 'Merchant wallet',
    asset,
    amountFiat: arka.totalFiat,
    amountNim: asset === 'NIM' ? readiness.nimTarget : undefined,
    amountUsdt: asset === 'USDT' ? readiness.usdtTarget : undefined,
    memo: `Settle Arka ${arka.code}`,
    isDemo: arka.metadata?.isDemo,
  }
}
