import { getHostLanguage } from '@nimiq/mini-app-sdk'

export function isNimiqPayEnvironment() {
  return typeof window !== 'undefined' && Boolean(window.nimiqPay || window.nimiq)
}

export function getNimiqPayLanguage() {
  return getHostLanguage() ?? navigator.language.slice(0, 2)
}

export function getNimiqWalletSurfaceName() {
  return isNimiqPayEnvironment() ? 'Nimiq Pay' : 'Nimiq Wallet'
}
