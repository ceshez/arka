import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getNimiqPaymentMismatch,
  nimiqTransactionMemo,
  normalizeNimiqAddress,
  type NimiqTransaction,
} from '../src/lib/nimiq/nimiqRpc.ts'
import type { PaymentRequest } from '../src/lib/nimiq/types.ts'

const request: PaymentRequest = {
  arkaId: 'arka-payment-check',
  payerUserId: 'guest-payment-check',
  senderWalletAddress: 'NQ09 AAAA BBBB CCCC DDDD EEEE FFFF GGGG HHHH',
  recipientWalletAddress: 'NQ34 1111 2222 3333 4444 5555 6666 7777 8888',
  recipientLabel: 'Host wallet',
  asset: 'NIM',
  amountFiat: 0.01,
  amountNim: 10.7188,
  memo: 'Arka ARKA-TEST1234',
}

function transaction(overrides: Partial<NimiqTransaction> = {}): NimiqTransaction {
  return {
    blockNumber: 123,
    networkId: 24,
    executionResult: true,
    from: request.senderWalletAddress,
    to: request.recipientWalletAddress,
    value: 1_071_880,
    recipientData: Buffer.from(request.memo ?? '', 'utf8').toString('hex'),
    ...overrides,
  }
}

test('accepts a confirmed mainnet payment only when every contribution field matches', () => {
  assert.equal(getNimiqPaymentMismatch(transaction(), request), null)
})

test('rejects the wallet mismatch that previously allowed a cashback-ineligible contribution', () => {
  assert.equal(getNimiqPaymentMismatch(transaction({
    from: 'NQ49 XXXX YYYY ZZZZ 1111 2222 3333 4444 5555',
  }), request), 'sender')
})

test('rejects mismatched recipient, amount, memo, or network', () => {
  assert.equal(getNimiqPaymentMismatch(transaction({ to: 'NQ77 OTHER' }), request), 'recipient')
  assert.equal(getNimiqPaymentMismatch(transaction({ value: 1_071_879 }), request), 'amount')
  assert.equal(getNimiqPaymentMismatch(transaction({ recipientData: '77726f6e67' }), request), 'memo')
  assert.equal(getNimiqPaymentMismatch(transaction({ networkId: 5 }), request), 'network')
})

test('normalizes addresses and decodes the transaction memo', () => {
  assert.equal(normalizeNimiqAddress('nq09 aaaa bbbb'), 'NQ09AAAABBBB')
  assert.equal(nimiqTransactionMemo(transaction()), request.memo)
})
