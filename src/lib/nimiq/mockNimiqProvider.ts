import type { NimiqPaymentProvider, PaymentRequest, PaymentResult } from './types'

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export const mockNimiqProvider: NimiqPaymentProvider = {
  async isAvailable() {
    return true
  },

  async requestPayment(request: PaymentRequest): Promise<PaymentResult> {
    await wait(650)

    if (request.amountFiat > 200) {
      return {
        status: 'failed',
        errorCode: 'insufficient-balance',
      }
    }

    await wait(450)

    return {
      status: 'confirmed',
      transactionHash: `mock-${request.arkaId}-${request.payerUserId}`,
      confirmedAt: new Date().toISOString(),
    }
  },
}
