import type { Arka, ArkaMember } from '../../types/arka'
import type { Payment } from '../../types/payment'
import { formatPublicIdentity } from '../arka/formatWalletAddress'

export const NIM_CASHBACK_RATE = 0.03

export function calculateCashbackReward(member: ArkaMember) {
  const amountFiat = Number((member.amountPaidFiat * NIM_CASHBACK_RATE).toFixed(2))
  const amountNim = Number((member.amountPaidNim * NIM_CASHBACK_RATE).toFixed(5))
  return { amountFiat, amountNim }
}

export function calculateCashbackPreview(amountFiat: number, amountNim: number) {
  return {
    amountFiat: Number((amountFiat * NIM_CASHBACK_RATE).toFixed(2)),
    amountNim: Number((amountNim * NIM_CASHBACK_RATE).toFixed(5)),
  }
}

export function isCashbackEligible(member: ArkaMember) {
  return member.role === 'guest'
    && member.status === 'paid'
    && member.amountPaidNim > 0
    && Boolean(member.walletAddress)
}

export function findConfirmedCashback(payments: Payment[], arkaId: string, memberId: string) {
  return payments.find((payment) => (
    payment.arkaId === arkaId
    && payment.type === 'cashback-reward'
    && payment.beneficiaryMemberId === memberId
    && payment.status === 'confirmed'
  ))
}

export function createCashbackPayment(arka: Arka, member: ArkaMember): Payment {
  if (!isCashbackEligible(member) || !member.walletAddress) {
    throw new Error('This member is not ready for a cashback payment.')
  }

  const now = new Date().toISOString()
  const reward = calculateCashbackReward(member)

  return {
    id: `cashback-${arka.id}-${member.id}-${Date.now()}`,
    arkaId: arka.id,
    payerUserId: arka.hostId,
    beneficiaryMemberId: member.id,
    type: 'cashback-reward',
    status: 'preparing',
    asset: 'NIM',
    amountFiat: reward.amountFiat,
    amountNim: reward.amountNim,
    recipientWalletAddress: member.walletAddress,
    recipientLabel: `${formatPublicIdentity(member.displayName, member.walletAddress) || 'Guest'} cashback`,
    createdAt: now,
    updatedAt: now,
  }
}
