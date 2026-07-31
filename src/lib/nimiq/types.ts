import type { AssetSymbol } from '../../types/arka'
import type { PaymentErrorCode } from '../../types/payment'

export type PaymentAsset = AssetSymbol

export type PaymentRequest = {
  arkaId: string
  payerUserId: string
  senderWalletAddress?: string
  recipientWalletAddress: string
  recipientLabel: string
  asset: PaymentAsset
  amountFiat: number
  amountNim?: number
  amountUsdt?: number
  memo?: string
  isDemo?: boolean
}

export type PaymentResult = {
  status: 'confirmed' | 'failed' | 'cancelled'
  transactionHash?: string
  errorCode?: PaymentErrorCode
  confirmedAt?: string
}

export type NimiqPaymentProvider = {
  isAvailable: () => Promise<boolean>
  requestPayment: (request: PaymentRequest) => Promise<PaymentResult>
}
