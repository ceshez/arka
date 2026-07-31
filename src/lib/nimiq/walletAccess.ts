export const walletConnectionRequiredMessage = 'Connect your Nimiq wallet before loading an Arka.'

type WalletIdentity = {
  address?: string
}

export function isWalletConnected(wallet?: WalletIdentity | null) {
  return Boolean(wallet?.address?.trim())
}

export function requireConnectedWallet<T extends WalletIdentity>(wallet?: T | null): T {
  if (!isWalletConnected(wallet)) throw new Error(walletConnectionRequiredMessage)
  return wallet as T
}
