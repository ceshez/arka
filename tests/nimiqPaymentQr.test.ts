import assert from 'node:assert/strict'
import test from 'node:test'
import { parseNimiqPaymentQr } from '../src/lib/nimiq/parseNimiqPaymentQr.ts'

const recipient = 'NQ09 LPSL EXFL 4XAP YQEB 6VUU MQC0 433F HHXY'

test('reads a Nimiq recipient from a wallet QR payload', () => {
  assert.equal(parseNimiqPaymentQr(`nimiq://pay/${recipient}?amount=10`), recipient)
})

test('reads a compact Nimiq recipient from an encoded payment link', () => {
  const compactRecipient = recipient.replaceAll(' ', '')
  assert.equal(
    parseNimiqPaymentQr(`https://wallet.example/pay?recipient=${encodeURIComponent(compactRecipient)}`),
    recipient,
  )
})

test('rejects a QR payload without a valid Nimiq address', () => {
  assert.equal(parseNimiqPaymentQr('https://example.com/not-a-wallet'), undefined)
})
