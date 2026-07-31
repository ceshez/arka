export function compactWalletAddress(address: string) {
  return address.trim().replace(/\s+/g, '').toUpperCase()
}

export function formatWalletAddress(address: string) {
  const compact = compactWalletAddress(address)
  if (compact.length <= 8) return compact
  return `${compact.slice(0, 4)}***${compact.slice(-4)}`
}

export function looksLikeWalletAddress(value?: string) {
  if (!value) return false
  return /^NQ[0-9A-Z]{10,}$/i.test(compactWalletAddress(value))
}

export function formatPublicIdentity(displayName?: string, walletAddress?: string) {
  const name = displayName?.trim()
  const compactName = name ? compactWalletAddress(name) : ''
  const compactWallet = walletAddress ? compactWalletAddress(walletAddress) : ''
  const isGenericName = /^(guest|new guest|you)(\s+\d+)?$/i.test(name ?? '')

  if (name && !isGenericName && !looksLikeWalletAddress(name) && compactName !== compactWallet) return name
  if (walletAddress) return formatWalletAddress(walletAddress)
  if (name) return formatWalletAddress(name)
  return 'Guest'
}
