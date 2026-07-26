import type { Arka, ArkaMember } from '../types/arka'
import { findLocalGuest } from '../lib/arka/localGuestMembership'

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
  return arka.members.find((member) => member.userId === arka.hostId)?.displayName ?? 'Host'
}
