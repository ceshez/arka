import type { PaymentRequest, PaymentResult } from './types'
import {
  fetchNimBalance,
  getNimiqPaymentMismatch,
  nimToLuna,
  waitForNimiqTransaction,
} from './nimiqRpc'

const HUB_URL = import.meta.env.VITE_NIMIQ_HUB_URL?.trim() || 'https://hub.nimiq.com'

function paymentErrorCode(error: unknown): PaymentResult['errorCode'] {
  const message = error instanceof Error ? error.message : String(error)
  if (/cancel|denied|reject|closed/i.test(message)) return 'user-cancelled'
  if (/balance|funds/i.test(message)) return 'insufficient-balance'
  if (/network|fetch|timeout|offline/i.test(message)) return 'network-error'
  return 'payment-failed'
}

export async function connectNimiqHubWallet() {
  const { default: HubApi } = await import('@nimiq/hub-api')
  const hub = new HubApi(HUB_URL)
  const selected = await hub.chooseAddress({
    appName: 'Arka',
    disableContracts: true,
  })

  let balanceNim: number | null = null
  try {
    balanceNim = await fetchNimBalance(selected.address)
  } catch {
    // Address access succeeded; an optional balance lookup must not disconnect it.
  }

  return {
    address: selected.address,
    label: selected.label,
    balanceNim,
    isDemo: false,
    source: 'nimiq-hub' as const,
  }
}

export async function requestHubPayment(request: PaymentRequest): Promise<PaymentResult> {
  if (request.asset !== 'NIM' || !request.amountNim || request.amountNim <= 0) {
    return { status: 'failed', errorCode: 'provider-unavailable' }
  }

  try {
    const { default: HubApi } = await import('@nimiq/hub-api')
    const hub = new HubApi(HUB_URL)
    const result = await hub.checkout({
      appName: 'Arka',
      sender: request.senderWalletAddress,
      forceSender: Boolean(request.senderWalletAddress),
      recipient: request.recipientWalletAddress,
      value: nimToLuna(request.amountNim),
      extraData: request.memo,
    })
    const confirmed = await waitForNimiqTransaction(result.hash)
    if (!confirmed) return { status: 'failed', transactionHash: result.hash, errorCode: 'network-error' }

    const mismatch = getNimiqPaymentMismatch(confirmed, request)
    if (mismatch) {
      return {
        status: 'failed',
        transactionHash: result.hash,
        // The payment already reached mainnet. Never suggest retrying, even when
        // the mismatch is the sender, because that could create a duplicate payment.
        errorCode: 'transaction-mismatch',
      }
    }

    return { status: 'confirmed', transactionHash: result.hash, confirmedAt: new Date().toISOString() }
  } catch (error) {
    const errorCode = paymentErrorCode(error)
    return {
      status: errorCode === 'user-cancelled' ? 'cancelled' : 'failed',
      errorCode,
    }
  }
}
