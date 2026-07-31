import { Address, Hash, PublicKey, Signature } from '@nimiq/core'
import type { Arka } from '../../types/arka'

const SIGNED_MESSAGE_PREFIX = '\x16Nimiq Signed Message:\n'

export function normalizeNimiqAddress(address?: string) {
  return address?.replace(/\s+/g, '').toUpperCase() ?? ''
}

export function getSharedWalletThreshold(participantCount: number) {
  if (!Number.isInteger(participantCount) || participantCount < 2) return 0
  return Math.floor(participantCount / 2) + 1
}

export function buildSharedWalletActivationMessage(arka: Arka, memberId: string) {
  return [
    'Activate Arka shared fund',
    `Arka: ${arka.id}`,
    `Member: ${memberId}`,
    'The signer group is finalized only when the shared wallet is verified.',
    'This signature does not move NIM or grant access to your wallet.',
  ].join('\n')
}

export function verifySharedWalletActivation(input: {
  message: string
  walletAddress: string
  publicKey: string
  signature: string
}) {
  const publicKey = PublicKey.fromHex(input.publicKey)
  const signature = Signature.fromHex(input.signature)
  const signedMessage = `${SIGNED_MESSAGE_PREFIX}${input.message.length}${input.message}`
  const hash = Hash.computeSha256(new TextEncoder().encode(signedMessage))
  const signatureIsValid = publicKey.verify(signature, hash)
  const addressMatches = normalizeNimiqAddress(publicKey.toAddress().toUserFriendlyAddress())
    === normalizeNimiqAddress(input.walletAddress)

  return signatureIsValid && addressMatches
}

export function computeSharedWalletAddress(publicKeys: string[], approvalThreshold: number) {
  if (publicKeys.length < 2) throw new Error('At least two activated wallets are required.')
  if (approvalThreshold < 2 || approvalThreshold > publicKeys.length) {
    throw new Error('The approval threshold does not match the activated wallets.')
  }

  return Address
    .fromPublicKeys(publicKeys.map((publicKey) => PublicKey.fromHex(publicKey)), approvalThreshold)
    .toUserFriendlyAddress()
}

export function isValidNimiqAddress(address: string) {
  try {
    Address.fromString(address.trim())
    return true
  } catch {
    return false
  }
}

export function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
