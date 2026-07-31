import assert from 'node:assert/strict'
import test from 'node:test'
import { getLockedContributionAsset } from '../src/lib/payments/contributionAsset.ts'
import type { Arka } from '../src/types/arka.ts'

function makeArka(amountPaidNim = 0, amountPaidUsdt = 0): Arka {
  return {
    id: 'arka-asset-lock',
    code: 'ARKA-LOCK',
    name: 'Asset lock',
    type: 'tab',
    status: 'collecting',
    hostId: 'host',
    currency: 'USD',
    totalFiat: 10,
    totalNimEstimate: 100,
    selectedAsset: 'NIM',
    splitMethod: 'equal',
    members: [{
      id: 'member-guest',
      userId: 'guest',
      arkaId: 'arka-asset-lock',
      displayName: 'Guest',
      role: 'guest',
      amountDueFiat: 10,
      amountDueNim: 100,
      amountDueUsdt: 10,
      amountPaidFiat: amountPaidNim > 0 || amountPaidUsdt > 0 ? 10 : 0,
      amountPaidNim,
      amountPaidUsdt,
      status: amountPaidNim > 0 || amountPaidUsdt > 0 ? 'paid' : 'pending',
    }],
    invite: {
      arkaId: 'arka-asset-lock',
      code: 'ARKA-LOCK',
      qrValue: '/join/LOCK',
      inviteLink: '/join/LOCK',
      createdAt: '2026-07-30T00:00:00.000Z',
    },
    createdAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z',
  }
}

test('locks the contribution asset after the first paid amount', () => {
  assert.equal(getLockedContributionAsset(makeArka()), undefined)
  assert.equal(getLockedContributionAsset(makeArka(100)), 'NIM')
  assert.equal(getLockedContributionAsset(makeArka(0, 10)), 'USDT')
  assert.equal(getLockedContributionAsset({ ...makeArka(), contributionAsset: 'NIM' }), 'NIM')
})
