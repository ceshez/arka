import type { Arka, ArkaMember } from '../types/arka'
import { findLocalGuest } from '../lib/arka/localGuestMembership'
import { formatPublicIdentity } from '../lib/arka/formatWalletAddress'

function normalizeWalletAddress(address?: string) {
  return address?.replace(/\s+/g, '').toUpperCase()
}

export function getGuestMember(arka: Arka, preferredMemberId?: string | null): ArkaMember | undefined {
  if (preferredMemberId) {
    const preferredMember = arka.members.find((member) => member.role === 'guest' && member.id === preferredMemberId)
    if (preferredMember) return preferredMember
  }

  const localGuest = findLocalGuest(arka)
  if (localGuest) return localGuest

  return undefined
}

export function getHostMember(arka: Arka): ArkaMember {
  return arka.members.find((member) => member.role === 'host' || member.userId === arka.hostId) ?? arka.members[0]
}

export function getHostName(arka: Arka) {
  const host = arka.members.find((member) => member.userId === arka.hostId)
  return host ? formatPublicIdentity(host.displayName, host.walletAddress ?? arka.hostWalletAddress) : 'Host'
}

export function getCurrentArkaMember(
  arka: Arka,
  identity: {
    walletAddress?: string
    guestMemberId?: string | null
    hasHostSecret?: boolean
  },
) {
  if (identity.guestMemberId) {
    const guest = arka.members.find(
      (member) => member.role === 'guest' && member.id === identity.guestMemberId,
    )
    if (guest) return guest
  }

  if (identity.hasHostSecret) return getHostMember(arka)

  const walletAddress = normalizeWalletAddress(identity.walletAddress)
  if (walletAddress) {
    const walletMember = arka.members.find(
      (member) => normalizeWalletAddress(member.walletAddress) === walletAddress,
    )
    if (walletMember) return walletMember
  }

  return undefined
}

export function getArkaDestination(
  arka: Arka,
  identity: {
    walletAddress?: string
    guestMemberId?: string | null
    hasHostSecret?: boolean
  },
) {
  if (arka.status === 'completed') return `/arka/${arka.id}/completed`
  const member = getCurrentArkaMember(arka, identity)
  return member?.role === 'host'
    ? `/arka/${arka.id}/host/summary`
    : `/arka/${arka.id}/guest`
}
