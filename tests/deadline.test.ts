import assert from 'node:assert/strict'
import test from 'node:test'
import type { Arka } from '../src/types/arka.ts'
import {
  isFutureDeadline,
  parseLocalDeadline,
  withArkaDeadlineStatus,
} from '../src/lib/arka/deadline.ts'

function makeArka(expiresAt: string, status: Arka['status'] = 'collecting'): Arka {
  return {
    id: 'arka-test',
    code: 'ARKA-TEST',
    name: 'Deadline test',
    type: 'tab',
    status,
    hostId: 'host',
    currency: 'USD',
    totalFiat: 10,
    totalNimEstimate: 100,
    selectedAsset: 'NIM',
    splitMethod: 'equal',
    members: [],
    invite: {
      arkaId: 'arka-test',
      code: 'ARKA-TEST',
      qrValue: 'arka://join/ARKA-TEST',
      inviteLink: 'https://arka.app/join/ARKA-TEST',
      expiresAt,
      createdAt: '2026-07-21T12:00:00.000Z',
    },
    createdAt: '2026-07-21T12:00:00.000Z',
    updatedAt: '2026-07-21T12:00:00.000Z',
    expiresAt,
  }
}

test('keeps a collecting Arka active before its deadline', () => {
  const arka = makeArka('2026-07-22T12:00:00.000Z')
  assert.equal(withArkaDeadlineStatus(arka, Date.parse('2026-07-22T11:59:59.000Z')).status, 'collecting')
})

test('expires a collecting Arka at its deadline', () => {
  const arka = makeArka('2026-07-22T12:00:00.000Z')
  assert.equal(withArkaDeadlineStatus(arka, Date.parse('2026-07-22T12:00:00.000Z')).status, 'expired')
})

test('does not replace a completed status after the deadline', () => {
  const arka = makeArka('2026-07-22T12:00:00.000Z', 'completed')
  assert.equal(withArkaDeadlineStatus(arka, Date.parse('2026-07-23T12:00:00.000Z')).status, 'completed')
})

test('validates and parses a local deadline', () => {
  const parsed = parseLocalDeadline('2026-07-22T18:30')
  assert.ok(parsed)
  assert.equal(isFutureDeadline('2026-07-22T18:30', parsed.getTime() - 1), true)
  assert.equal(isFutureDeadline('not-a-date', parsed.getTime() - 1), false)
})
