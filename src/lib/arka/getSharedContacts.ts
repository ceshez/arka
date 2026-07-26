import type { Arka, ArkaMember } from '../../types/arka'

export type SharedContact = {
  id: string
  name: string
  arkaCount: number
  lastArkaName: string
  lastSharedAt: string
  totalSharedNim: number
}

type ContactAccumulator = SharedContact & {
  arkaIds: Set<string>
}

function normalizedWalletAddress(address?: string) {
  return address?.replace(/\s+/g, '').toUpperCase()
}

export function getSharedContactId(member: ArkaMember) {
  const walletAddress = normalizedWalletAddress(member.walletAddress)
  return walletAddress ? `wallet:${walletAddress}` : `user:${member.userId}`
}

export function getSharedContacts(
  arkas: Arka[],
  identity: { walletAddress?: string; memberId?: string | null } = {},
): SharedContact[] {
  const ownWalletAddress = normalizedWalletAddress(identity.walletAddress)
  const contacts = new Map<string, ContactAccumulator>()

  for (const arka of arkas) {
    for (const member of arka.members) {
      const memberWalletAddress = normalizedWalletAddress(member.walletAddress)
      const isCurrentUser = (
        (ownWalletAddress && memberWalletAddress === ownWalletAddress)
        || (identity.memberId && member.id === identity.memberId)
        || member.displayName === 'You'
      )
      if (isCurrentUser) continue

      const id = getSharedContactId(member)
      const sharedAt = member.paidAt ?? member.joinedAt ?? arka.updatedAt
      const existing = contacts.get(id)

      if (!existing) {
        contacts.set(id, {
          id,
          name: member.displayName || 'Guest',
          arkaCount: 1,
          lastArkaName: arka.name,
          lastSharedAt: sharedAt,
          totalSharedNim: member.amountPaidNim || member.amountDueNim,
          arkaIds: new Set([arka.id]),
        })
        continue
      }

      if (!existing.arkaIds.has(arka.id)) {
        existing.arkaIds.add(arka.id)
        existing.arkaCount += 1
        existing.totalSharedNim += member.amountPaidNim || member.amountDueNim
      }

      if (Date.parse(sharedAt) > Date.parse(existing.lastSharedAt)) {
        existing.name = member.displayName || existing.name
        existing.lastArkaName = arka.name
        existing.lastSharedAt = sharedAt
      }
    }
  }

  return [...contacts.values()].map((contact) => ({
    id: contact.id,
    name: contact.name,
    arkaCount: contact.arkaCount,
    lastArkaName: contact.lastArkaName,
    lastSharedAt: contact.lastSharedAt,
    totalSharedNim: contact.totalSharedNim,
  }))
}
