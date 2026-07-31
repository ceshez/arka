import assert from 'node:assert/strict'
import test from 'node:test'
import { getActivityByArka } from '../src/lib/arka/getActivityByArka.ts'
import type { Arka } from '../src/types/arka.ts'

function makeArka(id: string, createdAt: string, guestPaidAt?: string): Arka {
  return {
    id,
    code: `ARKA-${id.toUpperCase()}`,
    name: id,
    type: 'tab',
    status: 'collecting',
    hostId: `host-${id}`,
    currency: 'USD',
    totalFiat: 10,
    totalNimEstimate: 100,
    selectedAsset: 'NIM',
    splitMethod: 'equal',
    members: [{
      id: `host-${id}`,
      userId: `host-${id}`,
      arkaId: id,
      displayName: 'Host',
      role: 'host',
      amountDueFiat: 5,
      amountDueNim: 50,
      amountPaidFiat: 0,
      amountPaidNim: 0,
      status: 'pending',
    }, {
      id: `guest-${id}`,
      userId: `guest-${id}`,
      arkaId: id,
      displayName: 'Guest',
      role: 'guest',
      amountDueFiat: 5,
      amountDueNim: 50,
      amountPaidFiat: guestPaidAt ? 5 : 0,
      amountPaidNim: guestPaidAt ? 50 : 0,
      status: guestPaidAt ? 'paid' : 'pending',
      paidAt: guestPaidAt,
      joinedAt: createdAt,
    }],
    invite: {
      arkaId: id,
      code: `ARKA-${id.toUpperCase()}`,
      qrValue: id,
      inviteLink: id,
      createdAt,
    },
    createdAt,
    updatedAt: guestPaidAt ?? createdAt,
  }
}

test('keeps activity groups ordered by their real latest event regardless of store refresh order', () => {
  const older = makeArka('older', '2026-07-30T10:00:00.000Z')
  const newer = makeArka('newer', '2026-07-30T11:00:00.000Z')

  assert.deepEqual(
    getActivityByArka([older, newer]).map(({ arka }) => arka.id),
    ['newer', 'older'],
  )
  assert.deepEqual(
    getActivityByArka([newer, older]).map(({ arka }) => arka.id),
    ['newer', 'older'],
  )
})

test('promotes an Arka only when it receives a genuinely newer activity event', () => {
  const recentlyCreated = makeArka('recent', '2026-07-30T11:00:00.000Z')
  const olderWithPayment = makeArka(
    'paid',
    '2026-07-30T09:00:00.000Z',
    '2026-07-30T12:00:00.000Z',
  )

  assert.deepEqual(
    getActivityByArka([recentlyCreated, olderWithPayment]).map(({ arka }) => arka.id),
    ['paid', 'recent'],
  )
})
