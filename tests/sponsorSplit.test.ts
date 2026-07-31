import assert from 'node:assert/strict'
import test from 'node:test'
import { applySponsorSplit } from '../src/lib/arka/splitCalculations.ts'
import type { ArkaMember } from '../src/types/arka.ts'

function makeMember(id: string, role: ArkaMember['role']): ArkaMember {
  return {
    id,
    userId: `user-${id}`,
    arkaId: 'arka-sponsor-test',
    displayName: id,
    role,
    amountDueFiat: 5,
    amountDueNim: 50,
    amountDueUsdt: 5,
    amountPaidFiat: 0,
    amountPaidNim: 0,
    amountPaidUsdt: 0,
    status: 'pending',
  }
}

test('marks the host total as covered without requiring a self-payment', () => {
  const members = applySponsorSplit(
    [makeMember('host', 'host'), makeMember('guest', 'guest')],
    10,
    100,
    'host',
  )

  assert.deepEqual(
    members.map(({ id, amountDueFiat, amountPaidFiat, amountPaidNim, status }) => ({
      id,
      amountDueFiat,
      amountPaidFiat,
      amountPaidNim,
      status,
    })),
    [
      {
        id: 'host',
        amountDueFiat: 10,
        amountPaidFiat: 10,
        amountPaidNim: 100,
        status: 'paid',
      },
      {
        id: 'guest',
        amountDueFiat: 0,
        amountPaidFiat: 0,
        amountPaidNim: 0,
        status: 'joined',
      },
    ],
  )
})

test('keeps a selected guest pending until Nimiq Pay confirms the contribution', () => {
  const members = applySponsorSplit(
    [makeMember('host', 'host'), makeMember('guest', 'guest')],
    10,
    100,
    'guest',
  )

  const guest = members.find((member) => member.id === 'guest')
  assert.equal(guest?.amountDueFiat, 10)
  assert.equal(guest?.amountPaidFiat, 0)
  assert.equal(guest?.status, 'pending')
})
