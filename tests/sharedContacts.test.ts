import assert from 'node:assert/strict'
import test from 'node:test'
import { getSharedContacts } from '../src/lib/arka/getSharedContacts.ts'
import type { Arka, ArkaMember } from '../src/types/arka.ts'

function member(
  id: string,
  displayName: string,
  walletAddress: string,
  amountDueNim: number,
): ArkaMember {
  return {
    id,
    userId: `user-${id}`,
    arkaId: 'arka-test',
    displayName,
    role: 'guest',
    walletAddress,
    amountDueFiat: 1,
    amountDueNim,
    amountPaidFiat: 0,
    amountPaidNim: 0,
    status: 'pending',
    joinedAt: '2026-07-20T12:00:00.000Z',
  }
}

function arka(id: string, name: string, updatedAt: string, members: ArkaMember[]): Arka {
  return {
    id,
    code: `ARKA-${id}`,
    name,
    type: 'tab',
    status: 'collecting',
    hostId: members[0]?.userId ?? 'host',
    currency: 'USD',
    totalFiat: 10,
    totalNimEstimate: 100,
    selectedAsset: 'NIM',
    splitMethod: 'equal',
    members,
    invite: {
      arkaId: id,
      code: `ARKA-${id}`,
      qrValue: `/join/${id}`,
      inviteLink: `/join/${id}`,
      createdAt: updatedAt,
    },
    createdAt: updatedAt,
    updatedAt,
  }
}

test('derives real contacts, excludes the current wallet, and aggregates shared Arkas', () => {
  const own = member('self', 'Carlos', 'NQ SELF', 50)
  const mariaFirst = member('maria-1', 'Maria', 'NQ MARIA', 25)
  const mariaLatest = {
    ...member('maria-2', 'María', 'NQMARIA', 40),
    joinedAt: '2026-07-22T12:00:00.000Z',
  }

  const contacts = getSharedContacts([
    arka('one', 'Dinner', '2026-07-20T12:00:00.000Z', [own, mariaFirst]),
    arka('two', 'Trip', '2026-07-22T12:00:00.000Z', [own, mariaLatest]),
  ], { walletAddress: 'NQSELF' })

  assert.deepEqual(contacts, [{
    id: 'wallet:NQMARIA',
    name: 'María',
    arkaCount: 2,
    lastArkaName: 'Trip',
    lastSharedAt: '2026-07-22T12:00:00.000Z',
    totalSharedNim: 65,
  }])
})
