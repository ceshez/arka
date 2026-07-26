import { isNimiqPayEnvironment } from './detectNimiqEnvironment'
import { requestHubPayment } from './hubClient'
import { miniAppNimiqProvider } from './miniAppNimiqProvider'
import { mockNimiqProvider } from './mockNimiqProvider'
import type { NimiqPaymentProvider } from './types'

const browserNimiqProvider: NimiqPaymentProvider = {
  async isAvailable() {
    return true
  },
  async requestPayment(request) {
    return requestHubPayment(request)
  },
}

export async function getNimiqPaymentProvider(): Promise<NimiqPaymentProvider> {
  const realProvider = isNimiqPayEnvironment() ? miniAppNimiqProvider : browserNimiqProvider

  return {
    isAvailable: () => realProvider.isAvailable(),
    requestPayment: (request) => request.isDemo
      ? mockNimiqProvider.requestPayment(request)
      : realProvider.requestPayment(request),
  }
}
