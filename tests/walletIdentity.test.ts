import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPublicIdentity, formatWalletAddress } from '../src/lib/arka/formatWalletAddress.ts'
import { buildArkaWithLocalGuest } from '../src/lib/arka/localGuestMembership.ts'
import { isWalletConnected, requireConnectedWallet, walletConnectionRequiredMessage } from '../src/lib/nimiq/walletAccess.ts'
import { getCurrentArkaMember } from '../src/routes/routeUtils.ts'
import type { Arka } from '../src/types/arka.ts'

const walletAddress = 'NQ12 3456 7890 ABCD EFGH IJKL MNOP QRST UVWX YZ89'

function makeArka(): Arka {
  return {
    id: 'arka-wallet-test',
    code: 'ARKA-WALL',
    name: 'Wallet test',
    type: 'tab',
    status: 'collecting',
    hostId: 'host',
    hostWalletAddress: 'NQ00 HOST',
    currency: 'USD',
    totalFiat: 20,
    totalNimEstimate: 200,
    selectedAsset: 'NIM',
    splitMethod: 'equal',
    members: [],
    invite: {
      arkaId: 'arka-wallet-test',
      code: 'ARKA-WALL',
      qrValue: 'arka://join/ARKA-WALL',
      inviteLink: 'https://arka.app/join/ARKA-WALL',
      createdAt: '2026-07-26T00:00:00.000Z',
    },
    createdAt: '2026-07-26T00:00:00.000Z',
    updatedAt: '2026-07-26T00:00:00.000Z',
  }
}

test('masks wallet identities with the first four and last four characters', () => {
  assert.equal(formatWalletAddress(walletAddress), 'NQ12***YZ89')
  assert.equal(formatPublicIdentity(undefined, walletAddress), 'NQ12***YZ89')
})

test('shows a public username before the wallet fallback', () => {
  assert.equal(formatPublicIdentity('Ana', walletAddress), 'Ana')
})

test('creates a guest from the masked wallet identity without a handle', () => {
  const membership = buildArkaWithLocalGuest(makeArka(), '2026-07-26T01:00:00.000Z', {
    displayName: formatWalletAddress(walletAddress),
    walletAddress,
  })

  assert.equal(membership.guest.displayName, 'NQ12***YZ89')
  assert.equal(membership.guest.walletAddress, walletAddress)
})

test('blocks Arka access until a wallet address is connected', () => {
  assert.equal(isWalletConnected(null), false)
  assert.equal(isWalletConnected({ address: '   ' }), false)
  assert.throws(() => requireConnectedWallet(null), new RegExp(walletConnectionRequiredMessage))
  assert.equal(requireConnectedWallet({ address: walletAddress }).address, walletAddress)
})

test('keeps an explicitly joined guest in guest mode even when the device also has the host secret', () => {
  const base = makeArka()
  const host = {
    ...buildArkaWithLocalGuest(base, '2026-07-26T01:00:00.000Z', {
      displayName: 'Host',
      walletAddress: 'NQ00 HOST',
    }).guest,
    id: 'member-host',
    userId: base.hostId,
    role: 'host' as const,
  }
  const guest = {
    ...buildArkaWithLocalGuest(base, '2026-07-26T01:05:00.000Z', {
      displayName: 'Guest',
      walletAddress,
    }).guest,
    id: 'member-guest',
  }
  const arka = { ...base, members: [host, guest] }

  assert.equal(getCurrentArkaMember(arka, {
    walletAddress: 'NQ00 HOST',
    guestMemberId: guest.id,
    hasHostSecret: true,
  })?.role, 'guest')
})
