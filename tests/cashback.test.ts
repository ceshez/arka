import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateCashbackReward, getConfirmedCashbackSummary, isCashbackEligible } from '../src/lib/payments/cashback.ts'
import type { Arka } from '../src/types/arka.ts'
import type { Payment } from '../src/types/payment.ts'

const walletAddress = 'NQ09 LPSL EXFL 4XAP YQEB 6VUU MQC0 433F HHXY'

function makeArka(cashbackEarnedNim = 0): Arka {
  return {
    id: 'arka-one',
    code: 'ARKA-ONE',
    name: 'Dinner',
    type: 'tab',
    status: 'collecting',
    hostId: 'host-user',
    fundingMode: 'host-wallet',
    hostWalletAddress: 'NQ34 HOST WALLET',
    currency: 'USD',
    totalFiat: 10,
    totalNimEstimate: 100,
    selectedAsset: 'NIM',
    splitMethod: 'equal',
    members: [{
      id: 'guest-one',
      userId: 'guest-user',
      arkaId: 'arka-one',
      displayName: 'Guest',
      role: 'guest',
      walletAddress,
      amountDueFiat: 10,
      amountDueNim: 100,
      amountPaidFiat: 10,
      amountPaidNim: 100,
      cashbackEarnedNim,
      cashbackPaidAt: cashbackEarnedNim > 0 ? '2026-07-30T12:00:00.000Z' : undefined,
      status: 'paid',
    }],
    invite: {
      arkaId: 'arka-one',
      code: 'ARKA-ONE',
      qrValue: 'arka://join/ARKA-ONE',
      inviteLink: 'https://arka.app/join/ARKA-ONE',
      createdAt: '2026-07-30T10:00:00.000Z',
    },
    createdAt: '2026-07-30T10:00:00.000Z',
    updatedAt: '2026-07-30T12:00:00.000Z',
  }
}

function makeReward(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'reward-one',
    arkaId: 'arka-one',
    payerUserId: 'host-user',
    beneficiaryMemberId: 'guest-one',
    type: 'cashback-reward',
    status: 'confirmed',
    asset: 'NIM',
    amountFiat: 0.3,
    amountNim: 3,
    recipientWalletAddress: walletAddress,
    recipientLabel: 'Guest cashback',
    createdAt: '2026-07-30T12:00:00.000Z',
    updatedAt: '2026-07-30T12:00:00.000Z',
    confirmedAt: '2026-07-30T12:00:00.000Z',
    ...overrides,
  }
}

test('shows only cashback confirmed for the connected wallet', () => {
  const summary = getConfirmedCashbackSummary(
    [makeArka()],
    [
      makeReward(),
      makeReward({ id: 'pending', status: 'submitted', amountNim: 20 }),
      makeReward({ id: 'other-wallet', recipientWalletAddress: 'NQ00 OTHER', amountNim: 40 }),
    ],
    walletAddress,
  )

  assert.deepEqual(summary, { amountNim: 3, rewardCount: 1 })
})

test('does not double count a reward synchronized into the shared Arka', () => {
  const summary = getConfirmedCashbackSummary(
    [makeArka(3)],
    [makeReward()],
    walletAddress,
  )

  assert.deepEqual(summary, { amountNim: 3, rewardCount: 1 })
})

test('makes a paid NIM guest eligible for a 3% reward', () => {
  const guest = makeArka().members[0]

  assert.equal(isCashbackEligible(guest), true)
  assert.deepEqual(calculateCashbackReward(guest), { amountFiat: 0.3, amountNim: 3 })
})

test('caps an individual Arka reward to 3% of the first ten dollars', () => {
  const guest = {
    ...makeArka().members[0],
    amountPaidFiat: 25,
    amountPaidNim: 5_000,
  }

  assert.deepEqual(calculateCashbackReward(guest), { amountFiat: 0.3, amountNim: 60 })
})
