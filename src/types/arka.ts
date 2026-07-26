export type AssetSymbol = 'NIM' | 'USDT'

export type ArkaType = 'tab' | 'vault' | 'demo'

export type ArkaCategory =
  | 'dinner'
  | 'cafe'
  | 'trip'
  | 'gift'
  | 'event'
  | 'roommates'
  | 'custom'

export type ArkaStatus =
  | 'draft'
  | 'open'
  | 'collecting'
  | 'ready-to-settle'
  | 'settling'
  | 'paid-to-merchant'
  | 'completed'
  | 'cancelled'
  | 'expired'

export type ArkaRole = 'host' | 'guest'

export type ArkaMemberStatus =
  | 'invited'
  | 'joined'
  | 'pending'
  | 'partial'
  | 'paid'
  | 'refund-needed'
  | 'settled'
  | 'cancelled'

export type SplitMethodType = 'equal' | 'custom' | 'by-consumption' | 'sponsor'

export type Asset = {
  symbol: AssetSymbol
  name: string
  decimals: number
}

export type SplitMethod = {
  type: SplitMethodType
  label: string
  description: string
}

export type User = {
  id: string
  displayName: string
  avatarUrl?: string
  walletAddress?: string
  walletLabel?: string
  preferredAsset?: AssetSymbol
}

export type ArkaMember = {
  id: string
  userId: string
  arkaId: string
  displayName: string
  avatarUrl?: string
  role: ArkaRole
  walletAddress?: string
  amountDueFiat: number
  amountDueNim: number
  amountDueUsdt?: number
  amountPaidFiat: number
  amountPaidNim: number
  amountPaidUsdt?: number
  status: ArkaMemberStatus
  joinedAt?: string
  paidAt?: string
}

export type ArkaInvite = {
  arkaId: string
  code: string
  qrValue: string
  inviteLink: string
  publicToken?: string
  version?: number
  expiresAt?: string
  createdAt: string
}

export type Arka = {
  id: string
  code: string
  name: string
  description?: string
  type: ArkaType
  status: ArkaStatus
  hostId: string
  hostWalletAddress?: string
  merchantWalletAddress?: string
  currency: 'USD'
  totalFiat: number
  totalNimEstimate: number
  totalUsdtEstimate?: number
  selectedAsset: AssetSymbol
  splitMethod: SplitMethodType
  members: ArkaMember[]
  invite: ArkaInvite
  createdAt: string
  updatedAt: string
  expiresAt?: string
  completedAt?: string
  metadata?: {
    locationName?: string
    category?: ArkaCategory
    note?: string
    isDemo?: boolean
  }
}

export type ArkaSummary = {
  id: string
  name: string
  status: ArkaStatus
  category: ArkaCategory
  totalFiat: number
  totalNimEstimate: number
  collectedFiat: number
  collectedNim: number
  memberCount: number
  paidMemberCount: number
  selectedAsset: AssetSymbol
  createdAt: string
  completedAt?: string
}

export type ArkaComputedState = {
  memberCount: number
  paidMemberCount: number
  pendingMemberCount: number
  partialMemberCount: number
  collectedFiat: number
  collectedNim: number
  collectedUsdt: number
  remainingFiat: number
  remainingNim: number
  remainingUsdt: number
  progressPercent: number
  isFullyPaid: boolean
  isReadyToSettle: boolean
}

export type CreateArkaInput = {
  name: string
  description?: string
  type: ArkaType
  category: ArkaCategory
  totalFiat: number
  selectedAsset: AssetSymbol
  splitMethod: SplitMethodType
  expiresAt: string
  nimUsdPrice?: number
}

export const supportedAssets: Asset[] = [
  {
    symbol: 'NIM',
    name: 'Nimiq',
    decimals: 5,
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
  },
]

export const splitMethods: SplitMethod[] = [
  {
    type: 'equal',
    label: 'Split equally',
    description: 'Everyone pays the same amount.',
  },
  {
    type: 'custom',
    label: 'Custom split',
    description: 'Set a custom amount for each member.',
  },
  {
    type: 'by-consumption',
    label: 'By consumption',
    description: 'Members pay based on what they ordered.',
  },
  {
    type: 'sponsor',
    label: "Who's treating?",
    description: 'One member voluntarily covers this Arka.',
  },
]
