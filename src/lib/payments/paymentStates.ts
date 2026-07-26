import type { PaymentStatus } from '../../types/payment'

export const paymentStates: PaymentStatus[] = [
  'idle',
  'preparing',
  'awaiting-user-confirmation',
  'submitted',
  'confirmed',
  'failed',
  'cancelled',
]

export function isFinalPaymentState(status: PaymentStatus) {
  return status === 'confirmed' || status === 'failed' || status === 'cancelled'
}
