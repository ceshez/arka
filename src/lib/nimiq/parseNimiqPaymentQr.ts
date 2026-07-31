import { isValidNimiqAddress } from './sharedWalletCrypto'

function formatNimiqAddress(address: string) {
  return address.match(/.{1,4}/g)?.join(' ') ?? address
}

export function parseNimiqPaymentQr(value: string) {
  let decoded = value

  try {
    decoded = decodeURIComponent(value)
  } catch {
    // Some wallet QR payloads are already decoded or contain literal percent signs.
  }

  const matches = decoded.toUpperCase().match(/NQ(?:[\s-]*[0-9A-Z]){34}/g) ?? []

  for (const match of matches) {
    const compactAddress = match.replace(/[\s-]+/g, '')
    if (isValidNimiqAddress(compactAddress)) return formatNimiqAddress(compactAddress)
  }

  return undefined
}
