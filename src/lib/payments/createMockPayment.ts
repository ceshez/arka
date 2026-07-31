import type { Arka, ArkaMember, AssetSymbol } from '../../types/arka'
import type { Payment } from '../../types/payment'
import { getRemainingPaymentAmounts } from './getRemainingPaymentAmounts'

export function createMockPayment(arka: Arka, member: ArkaMember, asset: AssetSymbol): Payment {
  const now = new Date().toISOString()
  const remaining = getRemainingPaymentAmounts(member)
  const usesSharedFund = arka.fundingMode === 'shared-wallet'
  const recipientWalletAddress = usesSharedFund ? arka.sharedWalletAddress : arka.hostWalletAddress
  if (!recipientWalletAddress) {
    throw new Error(usesSharedFund
      ? 'The shared wallet must be verified before contributing.'
      : 'The host wallet is unavailable.')
  }

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
    recipientWalletAddress,
    recipientLabel: usesSharedFund ? `Shared fund · ${arka.name}` : 'Host wallet',
    createdAt: now,
    updatedAt: now,
  }
}
