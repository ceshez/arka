export type AssetSymbol = 'NIM' | 'USDT'

export type ArkaType = 'tab' | 'vault' | 'demo'

export type FundingMode = 'host-wallet' | 'shared-wallet'

export type SharedWalletStatus = 'pending' | 'verified'

export type MemberActivationStatus = 'pending' | 'verified'

export type SharedFundEventType =
  | 'contribution'
  | 'goal-reached'
  | 'settlement-prepared'
  | 'approvals-collected'
  | 'settlement-confirmed'
  | 'refund-requested'
  | 'refund-confirmed'

export type SharedFundEventStatus = 'pending' | 'confirmed' | 'rejected'

export type SharedFundEvent = {
  id: string
  type: SharedFundEventType
  status: SharedFundEventStatus
  memberId?: string
  label: string
  amountNim?: number
  createdAt: string
}

export type SettlementProposalStatus =
  | 'prepared'
  | 'awaiting-approvals'
  | 'confirmed'
  | 'expired'
  | 'rejected'

export type SettlementProposal = {
  id: string
  sourceWalletAddress: string
  recipientWalletAddress: string
  recipientLabel?: string
  amountNim: number
  memo: string
  approvalThreshold: number
  status: SettlementProposalStatus
  createdAt: string
  confirmedAt?: string
}

export type RefundPlanStatus = 'requested' | 'awaiting-approvals' | 'confirmed'

export type RefundPlan = {
  id: string
  status: RefundPlanStatus
  requestedAt: string
  approvalThreshold: number
  confirmedRefunds: number
  totalRefunds: number
}

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

export type SponsorConsentStatus = 'pending' | 'accepted' | 'declined'

export type SponsorModeRequest = {
  id: string
  requestedAt: string
  requestedByMemberId: string
  responses: Record<string, {
    status: SponsorConsentStatus
    respondedAt?: string
  }>
}

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
  cashbackEarnedNim?: number
  cashbackPaidAt?: string
  status: ArkaMemberStatus
  activationStatus?: MemberActivationStatus
  activationPublicKey?: string
  activationSignature?: string
  activationMessage?: string
  activatedAt?: string
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
  fundingMode?: FundingMode
  hostWalletAddress?: string
  merchantWalletAddress?: string
  sharedWalletAddress?: string
  sharedWalletStatus?: SharedWalletStatus
  recipientWalletAddress?: string
  recipientLabel?: string
  recipientLockedAt?: string
  approvalThreshold?: number
  membershipLockedAt?: string
  /** Legacy fixed-size beta field. New Arkas derive membership from members. */
  participantLimit?: number
  fundEvents?: SharedFundEvent[]
  settlementProposal?: SettlementProposal
  refundPlan?: RefundPlan
  currency: 'USD'
  totalFiat: number
  totalNimEstimate: number
  totalUsdtEstimate?: number
  selectedAsset: AssetSymbol
  contributionAsset?: AssetSymbol
  splitMethod: SplitMethodType
  sponsorModeRequest?: SponsorModeRequest
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
  expiresAt?: string
  nimUsdPrice?: number
  totalNim?: number
  fundingMode?: FundingMode
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
