import type { Arka, ArkaMember } from '../../types/arka'
import { applyEqualSplit, applySponsorSplit } from './splitCalculations'

export const localGuestUserId = 'user-guest-local'

export function findLocalGuest(arka: Arka) {
  return arka.members.find((member) => (
    member.role === 'guest'
    && member.userId === localGuestUserId
  ))
}

type LocalGuestIdentity = {
  displayName?: string
  walletAddress?: string
}

function createLocalGuest(arka: Arka, joinedAt: string, identity: LocalGuestIdentity): ArkaMember {
  return {
    id: `member-guest-${arka.code.toLowerCase()}`,
    userId: localGuestUserId,
    arkaId: arka.id,
    displayName: identity.displayName?.trim() || 'You',
    role: 'guest',
    walletAddress: identity.walletAddress || 'NQXX GUEST WALLET',
    amountDueFiat: 0,
    amountDueNim: 0,
    amountDueUsdt: 0,
    amountPaidFiat: 0,
    amountPaidNim: 0,
    amountPaidUsdt: 0,
    status: 'joined',
    activationStatus: arka.fundingMode === 'shared-wallet' ? 'pending' : undefined,
    joinedAt,
  }
}

export function buildArkaWithLocalGuest(
  arka: Arka,
  joinedAt: string,
  identity: LocalGuestIdentity = {},
) {
  const guest = createLocalGuest(arka, joinedAt, identity)
  const members = [...arka.members, guest]
  const currentSponsor = arka.members.find((member) => member.amountDueFiat >= arka.totalFiat - 0.01)
  const host = arka.members.find((member) => member.role === 'host' || member.userId === arka.hostId)
  const sponsor = currentSponsor ?? host

  const allocatedMembers = arka.splitMethod === 'equal'
    ? applyEqualSplit(members, arka.totalFiat, arka.totalNimEstimate)
    : arka.splitMethod === 'sponsor' && sponsor
      ? applySponsorSplit(
          members,
          arka.totalFiat,
          arka.totalNimEstimate,
          sponsor.id,
        )
      : members

  return {
    arka: {
      ...arka,
      members: allocatedMembers,
      updatedAt: joinedAt,
    },
    guest: allocatedMembers.find((member) => member.id === guest.id) ?? guest,
  }
}
