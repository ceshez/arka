import { init } from '@nimiq/mini-app-sdk'
import { nimToLuna, waitForNimiqConfirmation } from './nimiqRpc'
import type { NimiqPaymentProvider, PaymentResult } from './types'

function paymentErrorCode(error: unknown): PaymentResult['errorCode'] {
  const message = error instanceof Error ? error.message : String(error)
  if (/cancel|denied|reject|permission/i.test(message)) return 'user-cancelled'
  if (/balance|funds/i.test(message)) return 'insufficient-balance'
  if (/network|fetch|timeout|offline/i.test(message)) return 'network-error'
  return 'payment-failed'
}

export const miniAppNimiqProvider: NimiqPaymentProvider = {
  async isAvailable() {
    try {
      await init({ timeout: 8_000 })
      return true
    } catch {
      return false
    }
  },

  async requestPayment(request) {
    if (request.asset !== 'NIM' || !request.amountNim || request.amountNim <= 0) {
      return { status: 'failed', errorCode: 'provider-unavailable' }
    }

    try {
      const provider = await init({ timeout: 8_000 })
      await provider.connect()
      const hasConsensus = await provider.isConsensusEstablished()
      if (!hasConsensus) throw new Error('Nimiq network consensus is not established')
      const transaction = {
        recipient: request.recipientWalletAddress,
        value: nimToLuna(request.amountNim),
      }
      const result = request.memo
        ? await provider.sendBasicTransactionWithData({ ...transaction, data: request.memo })
        : await provider.sendBasicTransaction(transaction)

      if (typeof result !== 'string') {
        throw new Error(result.error.message || 'Payment failed')
      }

      const confirmed = await waitForNimiqConfirmation(result)
      return confirmed
        ? { status: 'confirmed', transactionHash: result, confirmedAt: new Date().toISOString() }
        : { status: 'failed', transactionHash: result, errorCode: 'network-error' }
    } catch (error) {
      const errorCode = paymentErrorCode(error)
      return {
        status: errorCode === 'user-cancelled' ? 'cancelled' : 'failed',
        errorCode,
      }
    }
  },
}
