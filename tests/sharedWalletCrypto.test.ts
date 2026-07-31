import assert from 'node:assert/strict'
import test from 'node:test'
import { Hash, KeyPair } from '@nimiq/core'
import {
  buildSharedWalletActivationMessage,
  computeSharedWalletAddress,
  getSharedWalletThreshold,
  normalizeNimiqAddress,
  verifySharedWalletActivation,
} from '../src/lib/nimiq/sharedWalletCrypto'
import type { Arka } from '../src/types/arka'

test('uses a strict majority for shared fund approvals', () => {
  assert.equal(getSharedWalletThreshold(1), 0)
  assert.equal(getSharedWalletThreshold(2), 2)
  assert.equal(getSharedWalletThreshold(3), 2)
  assert.equal(getSharedWalletThreshold(4), 3)
  assert.equal(getSharedWalletThreshold(5), 3)
  assert.equal(getSharedWalletThreshold(16), 9)
})

test('keeps activation consent stable while the open group grows', () => {
  const base = {
    id: 'arka-dynamic',
    members: [{ id: 'member-host' }],
  } as Arka
  const expanded = {
    ...base,
    members: [
      ...base.members,
      { id: 'member-guest' },
    ],
    recipientWalletAddress: KeyPair.generate().publicKey.toAddress().toUserFriendlyAddress(),
    approvalThreshold: 2,
  } as Arka

  assert.equal(
    buildSharedWalletActivationMessage(base, 'member-host'),
    buildSharedWalletActivationMessage(expanded, 'member-host'),
  )
})

test('computes the same multisig address for the same activated keys', () => {
  const publicKeys = [KeyPair.generate().publicKey.toHex(), KeyPair.generate().publicKey.toHex()]
  const first = computeSharedWalletAddress(publicKeys, 2)
  const second = computeSharedWalletAddress(publicKeys, 2)
  assert.equal(normalizeNimiqAddress(first), normalizeNimiqAddress(second))
})

test('verifies a prefixed Nimiq wallet activation signature and address ownership', () => {
  const keyPair = KeyPair.generate()
  const message = 'Activate Arka shared fund'
  const prefixed = `\x16Nimiq Signed Message:\n${message.length}${message}`
  const signature = keyPair.sign(Hash.computeSha256(new TextEncoder().encode(prefixed)))
  const walletAddress = keyPair.publicKey.toAddress().toUserFriendlyAddress()

  assert.equal(verifySharedWalletActivation({
    message,
    walletAddress,
    publicKey: keyPair.publicKey.toHex(),
    signature: signature.toHex(),
  }), true)
  assert.equal(verifySharedWalletActivation({
    message: `${message}!`,
    walletAddress,
    publicKey: keyPair.publicKey.toHex(),
    signature: signature.toHex(),
  }), false)
})
