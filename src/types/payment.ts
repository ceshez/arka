import type { AssetSymbol } from './arka'

export type PaymentType =
  | 'member-contribution'
  | 'host-merchant-settlement'
  | 'cashback-reward'
  | 'refund'

export type PaymentStatus =
  | 'idle'
  | 'preparing'
  | 'awaiting-user-confirmation'
  | 'submitted'
  | 'confirmed'
  | 'failed'
  | 'cancelled'

export type PaymentErrorCode =
  | 'insufficient-balance'
  | 'payment-failed'
  | 'user-cancelled'
  | 'provider-unavailable'
  | 'network-error'
  | 'arka-expired'
  | 'unknown-error'

export type PaymentError = {
  code: PaymentErrorCode
  title: string
  message: string
  recoverable: boolean
}

export type Payment = {
  id: string
  arkaId: string
  payerUserId: string
  beneficiaryMemberId?: string
  relatedPaymentId?: string
  type: PaymentType
  status: PaymentStatus
  asset: AssetSymbol
  amountFiat: number
  amountNim?: number
  amountUsdt?: number
  recipientWalletAddress: string
  recipientLabel: string
  transactionHash?: string
  createdAt: string
  updatedAt: string
  confirmedAt?: string
  error?: PaymentError
}
