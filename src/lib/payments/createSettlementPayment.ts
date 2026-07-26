import type { Arka, AssetSymbol } from '../../types/arka'
import type { Payment } from '../../types/payment'
import { getSettlementReadiness } from '../arka/getSettlementReadiness'

export function createSettlementPayment(arka: Arka, asset: AssetSymbol): Payment {
  const now = new Date().toISOString()
  const readiness = getSettlementReadiness(arka)

  return {
    id: `settlement-${arka.id}-${Date.now()}`,
    arkaId: arka.id,
    payerUserId: arka.hostId,
    type: 'host-merchant-settlement',
    status: 'preparing',
    asset,
    amountFiat: arka.totalFiat,
    amountNim: asset === 'NIM' ? readiness.nimTarget : undefined,
    amountUsdt: asset === 'USDT' ? readiness.usdtTarget : undefined,
    recipientWalletAddress: arka.merchantWalletAddress ?? 'NQXX MERCHANT WALLET',
    recipientLabel: arka.metadata?.locationName ?? 'Merchant wallet',
    createdAt: now,
    updatedAt: now,
  }
}
