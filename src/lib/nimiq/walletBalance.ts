import { init } from '@nimiq/mini-app-sdk'
import { isNimiqPayEnvironment } from './detectNimiqEnvironment'
import { connectNimiqHubWallet } from './hubClient'
import { fetchNimBalance } from './nimiqRpc'

export type WalletSnapshot = {
  address: string
  label?: string
  balanceNim: number | null
  isDemo: boolean
  source: 'nimiq-pay' | 'nimiq-hub'
}

function isProviderError(value: unknown): value is { error: { message?: string } } {
  return typeof value === 'object'
    && value !== null
    && 'error' in value
    && typeof value.error === 'object'
    && value.error !== null
}

export function getWalletConnectionMessage(error: unknown) {
  if (error instanceof Error && /cancel|denied|reject|permission/i.test(error.message)) {
    return 'Wallet connection was cancelled. You can try again when ready.'
  }

  if (error instanceof Error && /popup|blocked/i.test(error.message)) {
    return 'Allow the Nimiq wallet window, then try again.'
  }

  return 'We could not connect your wallet. Please try again.'
}

export async function connectWallet(): Promise<WalletSnapshot> {
  if (!isNimiqPayEnvironment()) {
    return connectNimiqHubWallet()
  }

  const provider = await init({ timeout: 8_000 })
  await provider.connect()
  const accounts = await provider.listAccounts()
  if (isProviderError(accounts)) throw new Error(accounts.error.message || 'Wallet permission denied')
  if (!Array.isArray(accounts) || accounts.length === 0) throw new Error('No wallet account available')
  const address = accounts[0]

  try {
    return { address, balanceNim: await fetchNimBalance(address), isDemo: false, source: 'nimiq-pay' }
  } catch {
    // Account access succeeded. Keep the wallet connected even when the
    // read-only RPC is temporarily unavailable.
    return { address, balanceNim: null, isDemo: false, source: 'nimiq-pay' }
  }
}
