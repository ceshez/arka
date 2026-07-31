import { init } from '@nimiq/mini-app-sdk'
import {
  getNimiqPaymentMismatch,
  nimToLuna,
  normalizeNimiqAddress,
  waitForNimiqTransaction,
} from './nimiqRpc'
import type { NimiqPaymentProvider, PaymentResult } from './types'

function isProviderError(value: unknown): value is { error: { message?: string } } {
  return typeof value === 'object'
    && value !== null
    && 'error' in value
    && typeof value.error === 'object'
    && value.error !== null
}

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
      // The SDK caches listAccounts(). Clear that cache so an account change in
      // Nimiq Pay cannot leave Arka tied to a stale wallet identity.
      provider.disconnect()
      await provider.connect()
      const accounts = await provider.listAccounts()
      if (isProviderError(accounts)) throw new Error(accounts.error.message || 'Wallet permission denied')
      const activeAddress = Array.isArray(accounts) ? accounts[0] : undefined
      if (
        request.senderWalletAddress
        && normalizeNimiqAddress(activeAddress) !== normalizeNimiqAddress(request.senderWalletAddress)
      ) {
        return { status: 'failed', errorCode: 'wallet-mismatch' }
      }
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

      const confirmed = await waitForNimiqTransaction(result)
      if (!confirmed) return { status: 'failed', transactionHash: result, errorCode: 'network-error' }

      const mismatch = getNimiqPaymentMismatch(confirmed, request)
      if (mismatch) {
        return {
          status: 'failed',
          transactionHash: result,
        // The payment already reached mainnet. Never suggest retrying, even when
        // the mismatch is the sender, because that could create a duplicate payment.
        errorCode: 'transaction-mismatch',
        }
      }

      return { status: 'confirmed', transactionHash: result, confirmedAt: new Date().toISOString() }
    } catch (error) {
      const errorCode = paymentErrorCode(error)
      return {
        status: errorCode === 'user-cancelled' ? 'cancelled' : 'failed',
        errorCode,
      }
    }
  },
}
