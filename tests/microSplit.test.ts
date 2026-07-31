import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateArkaProgress } from '../src/lib/arka/calculateArkaProgress.ts'
import { applyEqualSplit, applyHostShareCovered } from '../src/lib/arka/splitCalculations.ts'
import { getRemainingPaymentAmounts } from '../src/lib/payments/getRemainingPaymentAmounts.ts'
import type { Arka, ArkaMember } from '../src/types/arka.ts'

function member(id: string, role: ArkaMember['role']): ArkaMember {
  return {
    id,
    userId: `user-${id}`,
    arkaId: 'arka-micro',
    displayName: id,
    role,
    amountDueFiat: 0,
    amountDueNim: 0,
    amountDueUsdt: 0,
    amountPaidFiat: 0,
    amountPaidNim: 0,
    amountPaidUsdt: 0,
    status: 'joined',
  }
}

test('preserves a one-cent equal split for two members', () => {
  const members = applyEqualSplit(
    [member('host', 'host'), member('guest', 'guest')],
    0.01,
    2,
  )

  assert.deepEqual(members.map((item) => item.amountDueFiat), [0.005, 0.005])
  assert.deepEqual(members.map((item) => item.amountDueNim), [1, 1])
  assert.equal(getRemainingPaymentAmounts(members[1]).amountNim, 1)
  assert.equal(members[1].status, 'pending')
})

test('covering the host micro-share reports 50 percent progress', () => {
  const splitMembers = applyEqualSplit(
    [member('host', 'host'), member('guest', 'guest')],
    0.01,
    2,
  )
  const coveredMembers = applyHostShareCovered(splitMembers, 'user-host')
  const arka = {
    totalFiat: 0.01,
    members: coveredMembers,
  } as Arka

  const progress = calculateArkaProgress(arka)
  assert.equal(progress.collectedFiat, 0.005)
  assert.equal(progress.progressPercent, 50)
  assert.equal(progress.paidMemberCount, 1)
})
