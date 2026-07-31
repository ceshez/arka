import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatNim,
  formatNimEstimate,
  normalizeUsdInput,
} from '../src/lib/arka/formatMoney.ts'

test('formats the NIM estimate with two decimals and no grouping separator', () => {
  assert.equal(formatNimEstimate(216_972.245745), '216972.25 NIM')
  assert.equal(formatNim(216_972.245745), '216972.25 NIM')
})

test('normalizes USD input to a dot decimal and two fractional digits', () => {
  assert.equal(normalizeUsdInput('100'), '100')
  assert.equal(normalizeUsdInput('0,3'), '0.3')
  assert.equal(normalizeUsdInput('$001.239'), '1.23')
  assert.equal(normalizeUsdInput('.1'), '0.1')
})
