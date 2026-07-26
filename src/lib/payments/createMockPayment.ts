import type { Arka, ArkaMember, AssetSymbol } from '../../types/arka'
import type { Payment } from '../../types/payment'
import { getRemainingPaymentAmounts } from './getRemainingPaymentAmounts'

export function createMockPayment(arka: Arka, member: ArkaMember, asset: AssetSymbol): Payment {
  const now = new Date().toISOString()
  const remaining = getRemainingPaymentAmounts(member)

  return {
    id: `payment-${arka.id}-${member.id}-${Date.now()}`,
    arkaId: arka.id,
    payerUserId: member.userId,
    type: 'member-contribution',
    status: 'preparing',
    asset,
    amountFiat: remaining.amountFiat,
    amountNim: asset === 'NIM' ? remaining.amountNim : undefined,
    amountUsdt: asset === 'USDT' ? remaining.amountUsdt : undefined,
    recipientWalletAddress: arka.hostWalletAddress ?? 'NQXX HOST WALLET',
    recipientLabel: 'Host wallet',
    createdAt: now,
    updatedAt: now,
  }
}
