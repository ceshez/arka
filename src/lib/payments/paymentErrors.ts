import type { PaymentError, PaymentErrorCode } from '../../types/payment'

export const paymentErrors: Record<PaymentErrorCode, PaymentError> = {
  'insufficient-balance': {
    code: 'insufficient-balance',
    title: 'Not enough NIM',
    message: 'You need more NIM to complete this payment.',
    recoverable: true,
  },
  'payment-failed': {
    code: 'payment-failed',
    title: 'Payment failed',
    message: 'Your payment could not be completed. Please try again.',
    recoverable: true,
  },
  'user-cancelled': {
    code: 'user-cancelled',
    title: 'Payment cancelled',
    message: 'No payment was sent. You can try again when ready.',
    recoverable: true,
  },
  'provider-unavailable': {
    code: 'provider-unavailable',
    title: 'Wallet unavailable',
    message: 'The Nimiq wallet connection is not ready. Please try again.',
    recoverable: true,
  },
  'network-error': {
    code: 'network-error',
    title: 'Connection issue',
    message: 'The payment could not be reached. Please try again.',
    recoverable: true,
  },
  'wallet-mismatch': {
    code: 'wallet-mismatch',
    title: 'Reconnect the payment wallet',
    message: 'Nimiq Pay is using a different wallet. Reconnect the wallet assigned to this Arka before continuing.',
    recoverable: true,
  },
  'transaction-mismatch': {
    code: 'transaction-mismatch',
    title: 'Payment needs review',
    message: 'A mainnet transfer was found, but it did not match this Arka. Do not send the payment again.',
    recoverable: false,
  },
  'arka-expired': {
    code: 'arka-expired',
    title: 'This Arka expired',
    message: 'Its payment deadline has passed, so no new contribution can be started.',
    recoverable: false,
  },
  'unknown-error': {
    code: 'unknown-error',
    title: 'Something went wrong',
    message: 'Your payment could not be completed. Please try again.',
    recoverable: true,
  },
}
