import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { analyticsContextForArka, trackAnalyticsEvent } from '../lib/analytics/analytics'
import { estimateNimFromFiat } from '../lib/arka/amounts'
import { calculateArkaProgress } from '../lib/arka/calculateArkaProgress'
import { generateJoinCode } from '../lib/arka/generateJoinCode'
import { getSettlementReadiness } from '../lib/arka/getSettlementReadiness'
import { formatWalletAddress } from '../lib/arka/formatWalletAddress'
import { buildArkaWithLocalGuest, findLocalGuest } from '../lib/arka/localGuestMembership'
import { selectArkaById } from '../lib/arka/selectArkaById'
import {
  applyEqualSplit,
  applyHostShareCovered,
  applyPercentageSplit,
  applySponsorSplit,
  hasMemberContributions,
} from '../lib/arka/splitCalculations'
import { createMockPayment } from '../lib/payments/createMockPayment'
import { createMemberPaymentRequest, createSettlementPaymentRequest } from '../lib/payments/createPaymentRequest'
import { createSettlementPayment } from '../lib/payments/createSettlementPayment'
import { getLockedContributionAsset } from '../lib/payments/contributionAsset'
import { paymentErrors } from '../lib/payments/paymentErrors'
import { getOrCreateInviteGuestKey } from '../lib/invites/inviteIdentity'
import {
  activateSharedFundMember,
  createSharedInvite,
  confirmSharedMemberPayment,
  joinSharedInvite,
  loadSharedInvite,
  markSharedHostShareCovered,
  prepareSharedFundSettlement,
  requestSharedFundRefund,
  respondToSponsorModeRequest,
  updateSharedInvite,
  verifySharedFundContribution,
  verifySharedFundSettlement,
  verifySharedFundWallet,
} from '../lib/invites/inviteRepository'
import { getNimiqPaymentProvider } from '../lib/nimiq/nimiqClient'
import { requestSharedWalletActivation } from '../lib/nimiq/sharedWalletActivation'
import {
  buildSharedWalletActivationMessage,
  computeSharedWalletAddress,
  getSharedWalletThreshold,
  normalizeNimiqAddress,
  verifySharedWalletActivation,
} from '../lib/nimiq/sharedWalletCrypto'
import { isWalletConnected, requireConnectedWallet } from '../lib/nimiq/walletAccess'
import type { PaymentResult } from '../lib/nimiq/types'
import { createRandomId } from '../lib/utils/createRandomId'
import { useProfileStore } from './profileStore'
import { useWalletStore } from './walletStore'
import type { Arka, ArkaMember, ArkaSummary, AssetSymbol, CreateArkaInput, SplitMethodType } from '../types/arka'
import type { Payment } from '../types/payment'

const hostMemberId = 'member-host-local'
const durableInviteExpiry = '2099-12-31T23:59:59.999Z'

export function paymentAssetSelectionKey(arkaId: string, memberId: string) {
  return `${arkaId}:${memberId}`
}

function makeSummary(arka: Arka): ArkaSummary {
  const progress = calculateArkaProgress(arka)

  return {
    id: arka.id,
    name: arka.name,
    status: arka.status,
    category: arka.metadata?.category ?? 'custom',
    totalFiat: arka.totalFiat,
    totalNimEstimate: arka.totalNimEstimate,
    collectedFiat: progress.collectedFiat,
    collectedNim: progress.collectedNim,
    memberCount: progress.memberCount,
    paidMemberCount: progress.paidMemberCount,
    selectedAsset: arka.selectedAsset,
    createdAt: arka.createdAt,
    completedAt: arka.completedAt,
  }
}

function normalizeHostWalletFunding(arka: Arka): Arka {
  return {
    ...arka,
    fundingMode: 'host-wallet',
    sharedWalletAddress: undefined,
    sharedWalletStatus: undefined,
    recipientWalletAddress: undefined,
    recipientLabel: undefined,
    recipientLockedAt: undefined,
    approvalThreshold: undefined,
    membershipLockedAt: undefined,
    fundEvents: undefined,
    settlementProposal: undefined,
    refundPlan: undefined,
    members: arka.members.map((member) => ({
      ...member,
      activationStatus: undefined,
      activationPublicKey: undefined,
      activationSignature: undefined,
      activationMessage: undefined,
      activatedAt: undefined,
    })),
  }
}

function upsertArka(arkas: Arka[], arka: Arka) {
  const normalizedArka = normalizeHostWalletFunding(arka)
  const existingIndex = arkas.findIndex((item) => item.id === normalizedArka.id)
  if (existingIndex === -1) return [normalizedArka, ...arkas]

  return arkas.map((item, index) => index === existingIndex ? normalizedArka : item)
}

function updateArkaStatus(arka: Arka): Arka {
  const progress = calculateArkaProgress(arka)

  if (arka.status === 'completed') return arka

  return {
    ...arka,
    status: progress.isFullyPaid ? 'ready-to-settle' : 'collecting',
    updatedAt: new Date().toISOString(),
  }
}

function analyticsContextForPayment(arka: Arka, payment: Payment, actorRole: 'host' | 'guest') {
  return {
    ...analyticsContextForArka(arka),
    actorRole,
    asset: payment.asset,
    paymentType: payment.type,
    paymentStatus: payment.status === 'idle' ? undefined : payment.status,
    errorCode: payment.error?.code,
    amountFiat: payment.amountFiat,
    amountNim: payment.amountNim,
    amountUsdt: payment.amountUsdt,
  }
}

export type ArkaStore = {
  arkas: Arka[]
  currentArkaId: string
  currentGuestMemberId: string | null
  guestMemberIdsByArka: Record<string, string>
  recentArkas: ArkaSummary[]
  payments: Payment[]
  activePayment: Payment | null
  paymentAssetSelections: Record<string, AssetSymbol>
  pendingSharedPaymentSyncs: Record<string, {
    reference: string
    asset: AssetSymbol
    memberId?: string
    transactionHash?: string
  }>
  remoteHostSecrets: Record<string, string>
  createArka: (input: CreateArkaInput) => Promise<Arka>
  getArka: (arkaId?: string) => Arka | undefined
  findArkaByCode: (code?: string) => Arka | undefined
  loadArkaInvite: (reference: string) => Promise<Arka | null>
  joinArka: (reference: string) => Promise<Arka | null>
  refreshSharedArka: (arkaId: string) => Promise<Arka | null>
  syncSharedArka: (arkaId: string) => Promise<void>
  activateSharedWalletMember: (arkaId: string, memberId: string) => Promise<Arka>
  verifySharedWallet: (arkaId: string, sharedWalletAddress: string) => Promise<Arka>
  prepareSharedSettlement: (
    arkaId: string,
    recipient: { recipientWalletAddress: string; recipientLabel?: string },
  ) => Promise<Arka>
  checkSharedSettlement: (arkaId: string) => Promise<Arka>
  requestSharedRefund: (arkaId: string) => Promise<Arka>
  respondToSponsorMode: (arkaId: string, accepted: boolean) => Promise<Arka>
  simulateGuestPayment: (arkaId: string, memberId: string, asset: AssetSymbol) => Promise<Payment>
  simulateHostSettlement: (arkaId: string, asset: AssetSymbol) => Promise<Payment>
  coverHostShare: (arkaId: string) => Promise<Arka>
  setPaymentAsset: (arkaId: string, memberId: string, asset: AssetSymbol) => void
  updateArkaName: (arkaId: string, name: string) => void
  updateArkaTotal: (arkaId: string, totalFiat: number) => void
  updateArkaDeadline: (arkaId: string, expiresAt: string) => void
  updateArkaSplitMethod: (arkaId: string, splitMethod: SplitMethodType) => void
  updateArkaCustomSplit: (arkaId: string, percentages: number[]) => void
  updateArkaSponsor: (arkaId: string, sponsorMemberId: string) => void
  updateCurrentWalletDisplayName: (walletAddress: string, displayName: string) => Promise<void>
  updateSettlementDetails: (arkaId: string, details: { merchantWalletAddress: string; merchantName?: string; note?: string }) => void
}

export const useArkaStore = create<ArkaStore>()(persist((set, get) => ({
  arkas: [],
  currentArkaId: '',
  currentGuestMemberId: null,
  guestMemberIdsByArka: {},
  recentArkas: [],
  payments: [],
  activePayment: null,
  paymentAssetSelections: {},
  pendingSharedPaymentSyncs: {},
  remoteHostSecrets: {},

  async createArka(input) {
    const connectedWallet = requireConnectedWallet(useWalletStore.getState().wallet)

    const now = new Date().toISOString()
    const code = generateJoinCode()
    const id = `arka-${code.toLowerCase()}`
    const hostShareFiat = input.totalFiat
    const totalNimEstimate = input.totalNim && input.totalNim > 0
      ? Number(input.totalNim.toFixed(5))
      : Number((input.totalFiat / (input.nimUsdPrice || 0.00052)).toFixed(5))
    const hostShareNim = estimateNimFromFiat(hostShareFiat, input.totalFiat, totalNimEstimate)
    const fundingMode = 'host-wallet' as const
    const profileName = useProfileStore.getState().displayName.trim()
    const inviteExpiry = input.expiresAt ?? durableInviteExpiry

    const host: ArkaMember = {
      id: hostMemberId,
      userId: 'user-host-local',
      arkaId: id,
      displayName: profileName || formatWalletAddress(connectedWallet.address),
      role: 'host',
      walletAddress: connectedWallet.address,
      amountDueFiat: hostShareFiat,
      amountDueNim: hostShareNim,
      amountDueUsdt: hostShareFiat,
      amountPaidFiat: 0,
      amountPaidNim: 0,
      amountPaidUsdt: 0,
      status: 'pending',
      joinedAt: now,
    }

    const arka: Arka = {
      id,
      code,
      name: input.name,
      description: input.description,
      type: input.type,
      status: 'collecting',
      hostId: host.userId,
      fundingMode,
      hostWalletAddress: connectedWallet.address,
      currency: 'USD',
      totalFiat: input.totalFiat,
      totalNimEstimate,
      totalUsdtEstimate: input.totalFiat,
      selectedAsset: input.selectedAsset,
      splitMethod: input.splitMethod,
      members: [host],
      invite: {
        arkaId: id,
        code,
        qrValue: `arka://join/${code}`,
        inviteLink: `https://arka.app/join/${code}`,
        expiresAt: inviteExpiry,
        createdAt: now,
      },
      createdAt: now,
      updatedAt: now,
      expiresAt: inviteExpiry,
      metadata: {
        category: input.category,
        isDemo: false,
      },
    }

    const sharedInvite = await createSharedInvite(arka)
    const sharedArka = normalizeHostWalletFunding(sharedInvite.arka)

    set((state) => ({
      arkas: upsertArka(state.arkas, sharedArka),
      currentArkaId: sharedArka.id,
      currentGuestMemberId: null,
      recentArkas: [makeSummary(sharedArka), ...state.recentArkas.filter((item) => item.id !== sharedArka.id)],
      remoteHostSecrets: {
        ...state.remoteHostSecrets,
        [sharedArka.id]: sharedInvite.hostSecret,
      },
    }))

    return sharedArka
  },

  getArka(arkaId) {
    if (!isWalletConnected(useWalletStore.getState().wallet)) return undefined
    const state = get()
    return selectArkaById(state.arkas, arkaId, state.currentArkaId)
  },

  findArkaByCode(code) {
    if (!isWalletConnected(useWalletStore.getState().wallet)) return undefined
    const reference = code?.trim()
    const normalized = reference?.toUpperCase()
    return get().arkas
      .find((arka) => (
        (arka.code === normalized || arka.invite.publicToken === reference?.toLowerCase())
        && (arka.status === 'open' || arka.status === 'collecting')
      ))
  },

  async loadArkaInvite(reference) {
    requireConnectedWallet(useWalletStore.getState().wallet)
    const localArka = get().findArkaByCode(reference)
    if (localArka && !localArka.invite.publicToken) return localArka

    const arka = await loadSharedInvite(reference)
    if (!arka) return null

    set((state) => ({
      arkas: upsertArka(state.arkas, arka),
      recentArkas: state.recentArkas.some((item) => item.id === arka.id)
        ? state.recentArkas.map((item) => item.id === arka.id ? makeSummary(arka) : item)
        : [makeSummary(arka), ...state.recentArkas],
    }))
    return arka
  },

  async joinArka(reference) {
    const connectedWallet = requireConnectedWallet(useWalletStore.getState().wallet)
    const arka = get().findArkaByCode(reference) ?? await get().loadArkaInvite(reference)
    if (!arka) return null
    const profileName = useProfileStore.getState().displayName.trim()

    if (arka.invite.publicToken) {
      const joined = await joinSharedInvite(reference, {
        guestKey: getOrCreateInviteGuestKey(),
        displayName: profileName || formatWalletAddress(connectedWallet.address),
        walletAddress: connectedWallet.isDemo ? undefined : connectedWallet.address,
      })
      const joinedArka = normalizeHostWalletFunding(joined.arka)

      set((state) => ({
        arkas: upsertArka(state.arkas, joinedArka),
        currentArkaId: joinedArka.id,
        currentGuestMemberId: joined.memberId,
        guestMemberIdsByArka: {
          ...state.guestMemberIdsByArka,
          [joinedArka.id]: joined.memberId,
        },
        recentArkas: state.recentArkas.some((item) => item.id === joinedArka.id)
          ? state.recentArkas.map((item) => item.id === joinedArka.id ? makeSummary(joinedArka) : item)
          : [makeSummary(joinedArka), ...state.recentArkas],
      }))
      return joinedArka
    }

    const existingGuest = findLocalGuest(arka)

    if (existingGuest) {
      set({
        currentArkaId: arka.id,
        currentGuestMemberId: existingGuest.id,
        guestMemberIdsByArka: {
          ...get().guestMemberIdsByArka,
          [arka.id]: existingGuest.id,
        },
      })
      return arka
    }

    const membership = buildArkaWithLocalGuest(arka, new Date().toISOString(), {
      displayName: profileName || formatWalletAddress(connectedWallet.address),
      walletAddress: connectedWallet.isDemo ? undefined : connectedWallet.address,
    })
    const joinedArka = updateArkaStatus(membership.arka)
    set((state) => ({
      arkas: state.arkas.map((item) => item.id === joinedArka.id ? joinedArka : item),
      currentArkaId: joinedArka.id,
      currentGuestMemberId: membership.guest.id,
      guestMemberIdsByArka: {
        ...state.guestMemberIdsByArka,
        [joinedArka.id]: membership.guest.id,
      },
      recentArkas: state.recentArkas.some((item) => item.id === joinedArka.id)
        ? state.recentArkas.map((item) => item.id === joinedArka.id ? makeSummary(joinedArka) : item)
        : [makeSummary(joinedArka), ...state.recentArkas],
    }))

    return joinedArka
  },

  async refreshSharedArka(arkaId) {
    if (!isWalletConnected(useWalletStore.getState().wallet)) return null
    const localArka = get().getArka(arkaId)
    const reference = localArka?.invite.publicToken
    if (!localArka || !reference) return localArka ?? null

    const pendingPayment = get().pendingSharedPaymentSyncs[arkaId]
    if (pendingPayment) {
      try {
        const confirmed = pendingPayment.transactionHash && pendingPayment.memberId
          ? {
              arka: await verifySharedFundContribution({
                reference: pendingPayment.reference,
                guestKey: localArka.members.find((member) => member.id === pendingPayment.memberId)?.role === 'guest'
                  ? getOrCreateInviteGuestKey()
                  : undefined,
                hostSecret: localArka.members.find((member) => member.id === pendingPayment.memberId)?.role === 'host'
                  ? get().remoteHostSecrets[arkaId]
                  : undefined,
                memberId: pendingPayment.memberId,
                transactionHash: pendingPayment.transactionHash,
              }),
            }
          : await confirmSharedMemberPayment({
              reference: pendingPayment.reference,
              guestKey: getOrCreateInviteGuestKey(),
              asset: pendingPayment.asset,
            })
        set((state) => {
          const pendingSharedPaymentSyncs = { ...state.pendingSharedPaymentSyncs }
          delete pendingSharedPaymentSyncs[arkaId]
          return {
            arkas: upsertArka(state.arkas, confirmed.arka),
            recentArkas: state.recentArkas.map((item) => (
              item.id === confirmed.arka.id ? makeSummary(confirmed.arka) : item
            )),
            pendingSharedPaymentSyncs,
          }
        })
        return confirmed.arka
      } catch {
        return localArka
      }
    }

    const arka = await loadSharedInvite(reference)
    if (!arka) return null

    set((state) => ({
      arkas: upsertArka(state.arkas, arka),
      recentArkas: state.recentArkas.map((item) => item.id === arka.id ? makeSummary(arka) : item),
    }))
    return arka
  },

  async syncSharedArka(arkaId) {
    if (!isWalletConnected(useWalletStore.getState().wallet)) return
    const arka = get().getArka(arkaId)
    const hostSecret = get().remoteHostSecrets[arkaId]
    if (!arka?.invite.publicToken || !hostSecret) return

    const syncedArka = await updateSharedInvite(arka, hostSecret)
    set((state) => ({
      arkas: upsertArka(state.arkas, syncedArka),
      recentArkas: state.recentArkas.map((item) => item.id === syncedArka.id ? makeSummary(syncedArka) : item),
    }))
  },

  async activateSharedWalletMember(arkaId, memberId) {
    const arka = get().getArka(arkaId)
    const member = arka?.members.find((candidate) => candidate.id === memberId)
    const wallet = requireConnectedWallet(useWalletStore.getState().wallet)
    if (!arka || !member || arka.fundingMode !== 'shared-wallet' || !arka.invite.publicToken) {
      throw new Error('The shared fund activation could not be loaded.')
    }
    if (normalizeNimiqAddress(member.walletAddress) !== normalizeNimiqAddress(wallet.address)) {
      throw new Error('Reconnect the wallet assigned to this participant.')
    }
    if (member.activationStatus === 'verified') return arka

    const message = buildSharedWalletActivationMessage(arka, member.id)
    const signed = await requestSharedWalletActivation(message, wallet.address)
    if (signed.signer && normalizeNimiqAddress(signed.signer) !== normalizeNimiqAddress(wallet.address)) {
      throw new Error('The selected signer does not match this Arka member.')
    }
    if (!verifySharedWalletActivation({
      message,
      walletAddress: wallet.address,
      publicKey: signed.publicKey,
      signature: signed.signature,
    })) {
      throw new Error('The wallet activation signature could not be verified.')
    }

    const updatedArka = await activateSharedFundMember({
      reference: arka.invite.publicToken,
      memberId: member.id,
      guestKey: member.role === 'guest' ? getOrCreateInviteGuestKey() : undefined,
      hostSecret: member.role === 'host' ? get().remoteHostSecrets[arka.id] : undefined,
      walletAddress: wallet.address,
      message,
      publicKey: signed.publicKey,
      signature: signed.signature,
    })
    set((state) => ({
      arkas: upsertArka(state.arkas, updatedArka),
      recentArkas: state.recentArkas.map((item) => (
        item.id === updatedArka.id ? makeSummary(updatedArka) : item
      )),
    }))
    return updatedArka
  },

  async verifySharedWallet(arkaId, sharedWalletAddress) {
    const arka = get().getArka(arkaId)
    const hostSecret = get().remoteHostSecrets[arkaId]
    if (!arka?.invite.publicToken || !hostSecret || arka.fundingMode !== 'shared-wallet') {
      throw new Error('Host authorization is required to verify the shared wallet.')
    }
    const publicKeys = arka.members.map((member) => member.activationPublicKey).filter(Boolean) as string[]
    if (arka.members.length < 2 || arka.members.length > 16) {
      throw new Error('A shared wallet needs between 2 and 16 current participants.')
    }
    if (publicKeys.length !== arka.members.length) {
      throw new Error('Every participant must activate their wallet first.')
    }
    const expected = computeSharedWalletAddress(
      publicKeys,
      getSharedWalletThreshold(arka.members.length),
    )
    if (normalizeNimiqAddress(expected) !== normalizeNimiqAddress(sharedWalletAddress)) {
      throw new Error('This address does not match the activated members.')
    }
    const updatedArka = await verifySharedFundWallet({
      reference: arka.invite.publicToken,
      hostSecret,
      sharedWalletAddress: expected,
    })
    set((state) => ({
      arkas: upsertArka(state.arkas, updatedArka),
      recentArkas: state.recentArkas.map((item) => (
        item.id === updatedArka.id ? makeSummary(updatedArka) : item
      )),
    }))
    return updatedArka
  },

  async prepareSharedSettlement(arkaId, recipient) {
    const arka = get().getArka(arkaId)
    const hostSecret = get().remoteHostSecrets[arkaId]
    if (!arka?.invite.publicToken || !hostSecret) throw new Error('Host authorization is required.')
    const updatedArka = await prepareSharedFundSettlement({
      reference: arka.invite.publicToken,
      hostSecret,
      recipientWalletAddress: recipient.recipientWalletAddress,
      recipientLabel: recipient.recipientLabel,
    })
    set((state) => ({
      arkas: upsertArka(state.arkas, updatedArka),
      recentArkas: state.recentArkas.map((item) => (
        item.id === updatedArka.id ? makeSummary(updatedArka) : item
      )),
    }))
    return updatedArka
  },

  async checkSharedSettlement(arkaId) {
    const arka = get().getArka(arkaId)
    const hostSecret = get().remoteHostSecrets[arkaId]
    if (!arka?.invite.publicToken || !hostSecret) throw new Error('Host authorization is required.')
    const updatedArka = await verifySharedFundSettlement({
      reference: arka.invite.publicToken,
      hostSecret,
    })
    set((state) => ({
      arkas: upsertArka(state.arkas, updatedArka),
      recentArkas: state.recentArkas.map((item) => (
        item.id === updatedArka.id ? makeSummary(updatedArka) : item
      )),
    }))
    return updatedArka
  },

  async requestSharedRefund(arkaId) {
    const arka = get().getArka(arkaId)
    const hostSecret = get().remoteHostSecrets[arkaId]
    if (!arka?.invite.publicToken || !hostSecret) throw new Error('Host authorization is required.')
    const updatedArka = await requestSharedFundRefund({
      reference: arka.invite.publicToken,
      hostSecret,
    })
    set((state) => ({
      arkas: upsertArka(state.arkas, updatedArka),
      recentArkas: state.recentArkas.map((item) => (
        item.id === updatedArka.id ? makeSummary(updatedArka) : item
      )),
    }))
    return updatedArka
  },

  async respondToSponsorMode(arkaId, accepted) {
    const arka = get().getArka(arkaId)
    const request = arka?.sponsorModeRequest
    if (!arka || !request) {
      throw new Error('The treating request could not be loaded.')
    }

    if (arka.invite.publicToken) {
      const updatedArka = await respondToSponsorModeRequest({
        reference: arka.invite.publicToken,
        guestKey: getOrCreateInviteGuestKey(),
        requestId: request.id,
        accepted,
      })
      set((state) => ({
        arkas: upsertArka(state.arkas, updatedArka),
        recentArkas: state.recentArkas.map((item) => (
          item.id === updatedArka.id ? makeSummary(updatedArka) : item
        )),
      }))
      return updatedArka
    }

    const memberId = get().guestMemberIdsByArka[arkaId]
      ?? (get().currentArkaId === arkaId ? get().currentGuestMemberId : null)
    if (!memberId) {
      throw new Error('The treating request could not be matched to this guest.')
    }

    const respondedAt = new Date().toISOString()
    const updatedArka: Arka = {
      ...arka,
      sponsorModeRequest: {
        ...request,
        responses: {
          ...request.responses,
          [memberId]: {
            status: accepted ? 'accepted' : 'declined',
            respondedAt,
          },
        },
      },
      updatedAt: respondedAt,
    }
    set((state) => ({
      arkas: upsertArka(state.arkas, updatedArka),
      recentArkas: state.recentArkas.map((item) => (
        item.id === updatedArka.id ? makeSummary(updatedArka) : item
      )),
    }))
    return updatedArka
  },

  async simulateGuestPayment(arkaId, memberId, asset) {
    const arka = get().getArka(arkaId)
    const member = arka?.members.find((item) => item.id === memberId)

    if (!arka || !member) {
      throw new Error('Arka or member not found')
    }

    const usesSharedFund = arka.fundingMode === 'shared-wallet'
    if (usesSharedFund) {
      if (asset !== 'NIM') throw new Error('Shared funds accept NIM only.')
      if (arka.sharedWalletStatus !== 'verified' || !arka.sharedWalletAddress) {
        throw new Error('The shared wallet must be verified before anyone contributes.')
      }
    }

    const lockedAsset = getLockedContributionAsset(arka)
    if (lockedAsset && lockedAsset !== asset) {
      throw new Error(`This Arka is already collecting ${lockedAsset}.`)
    }

    const basePayment = createMockPayment(arka, member, asset)

    if (arka.status === 'expired') {
      const expiredPayment: Payment = {
        ...basePayment,
        status: 'failed',
        updatedAt: new Date().toISOString(),
        error: paymentErrors['arka-expired'],
      }
      set((state) => ({
        activePayment: expiredPayment,
        payments: [expiredPayment, ...state.payments],
      }))
      void trackAnalyticsEvent('payment_failed', analyticsContextForPayment(
        arka,
        expiredPayment,
        member.role,
      ))
      return expiredPayment
    }

    set({ activePayment: basePayment })

    const awaitingPayment: Payment = {
      ...basePayment,
      status: 'awaiting-user-confirmation',
      updatedAt: new Date().toISOString(),
    }
    set({ activePayment: awaitingPayment })

    void trackAnalyticsEvent('payment_started', analyticsContextForPayment(
      arka,
      awaitingPayment,
      member.role,
    ))

    let result: PaymentResult
    try {
      const provider = await getNimiqPaymentProvider()
      result = await provider.requestPayment(createMemberPaymentRequest(arka, member, asset))
    } catch (error) {
      void trackAnalyticsEvent('payment_failed', {
        ...analyticsContextForPayment(arka, awaitingPayment, member.role),
        paymentStatus: 'failed',
        errorCode: 'unknown-error',
      })
      throw error
    }

    let verifiedSharedArka: Arka | undefined
    let sharedVerificationPending = false
    if (usesSharedFund && result.status === 'confirmed') {
      if (!result.transactionHash || !arka.invite.publicToken) {
        throw new Error('The confirmed contribution is missing its mainnet reference.')
      }
      try {
        verifiedSharedArka = await verifySharedFundContribution({
          reference: arka.invite.publicToken,
          guestKey: member.role === 'guest' ? getOrCreateInviteGuestKey() : undefined,
          hostSecret: member.role === 'host' ? get().remoteHostSecrets[arka.id] : undefined,
          memberId: member.id,
          transactionHash: result.transactionHash,
        })
      } catch {
        sharedVerificationPending = true
      }
    }

    const submittedPayment: Payment = {
      ...awaitingPayment,
      status: sharedVerificationPending
        ? 'submitted'
        : result.status === 'confirmed' ? 'confirmed' : result.status,
      transactionHash: result.transactionHash,
      confirmedAt: sharedVerificationPending ? undefined : result.confirmedAt,
      updatedAt: new Date().toISOString(),
      error: sharedVerificationPending
        ? undefined
        : result.errorCode ? paymentErrors[result.errorCode] : undefined,
    }

    set((state) => {
      const shouldQueueSharedPayment = submittedPayment.status === 'confirmed'
        && member.role === 'guest'
        && Boolean(arka.invite.publicToken)
        && !usesSharedFund
      const updatedArkas = verifiedSharedArka
        ? upsertArka(state.arkas, verifiedSharedArka)
        : state.arkas.map((item) => {
        if (
          item.id !== arkaId
          || submittedPayment.status !== 'confirmed'
          || usesSharedFund
        ) return item

        const paidAt = submittedPayment.confirmedAt ?? new Date().toISOString()
        const updated = {
          ...item,
          contributionAsset: item.contributionAsset ?? submittedPayment.asset,
          members: item.members.map((itemMember) =>
            itemMember.id === memberId
              ? {
                  ...itemMember,
                  status: 'paid' as const,
                  amountPaidFiat: Math.min(
                    itemMember.amountDueFiat,
                    itemMember.amountPaidFiat + submittedPayment.amountFiat,
                  ),
                  amountPaidNim: submittedPayment.asset === 'NIM'
                    ? Math.min(
                        itemMember.amountDueNim,
                        itemMember.amountPaidNim + (submittedPayment.amountNim ?? 0),
                      )
                    : itemMember.amountPaidNim,
                  amountPaidUsdt: submittedPayment.asset === 'USDT'
                    ? Math.min(
                        itemMember.amountDueUsdt ?? itemMember.amountDueFiat,
                        (itemMember.amountPaidUsdt ?? 0) + (submittedPayment.amountUsdt ?? 0),
                      )
                    : itemMember.amountPaidUsdt,
                  paidAt,
                }
              : itemMember,
          ),
        }

        return updateArkaStatus(updated)
      })

      return {
        arkas: updatedArkas,
        payments: [submittedPayment, ...state.payments],
        activePayment: submittedPayment,
        recentArkas: updatedArkas.map(makeSummary),
        pendingSharedPaymentSyncs: sharedVerificationPending && arka.invite.publicToken
          ? {
              ...state.pendingSharedPaymentSyncs,
              [arkaId]: {
                reference: arka.invite.publicToken,
                asset: 'NIM',
                memberId: member.id,
                transactionHash: result.transactionHash,
              },
            }
          : shouldQueueSharedPayment
          ? {
              ...state.pendingSharedPaymentSyncs,
              [arkaId]: {
                reference: arka.invite.publicToken!,
                asset: submittedPayment.asset,
              },
            }
          : state.pendingSharedPaymentSyncs,
      }
    })

    if (
      submittedPayment.status === 'confirmed'
      && member.role === 'guest'
      && arka.invite.publicToken
      && !usesSharedFund
    ) {
      try {
        const confirmed = await confirmSharedMemberPayment({
          reference: arka.invite.publicToken,
          guestKey: getOrCreateInviteGuestKey(),
          asset: submittedPayment.asset,
        })
        set((state) => {
          const pendingSharedPaymentSyncs = { ...state.pendingSharedPaymentSyncs }
          delete pendingSharedPaymentSyncs[arkaId]
          return {
            arkas: upsertArka(state.arkas, confirmed.arka),
            recentArkas: state.recentArkas.map((item) => (
              item.id === confirmed.arka.id ? makeSummary(confirmed.arka) : item
            )),
            pendingSharedPaymentSyncs,
          }
        })
      } catch {
        // The confirmed payment remains visible locally. SharedArkaSync retries
        // the scoped update on the next refresh without replaying the payment.
      }
    } else if (
      submittedPayment.status === 'confirmed'
      && member.role === 'host'
      && arka.invite.publicToken
      && get().remoteHostSecrets[arkaId]
      && !usesSharedFund
    ) {
      try {
        await get().syncSharedArka(arkaId)
      } catch {
        // Host dashboards continue to show the confirmed local state and can
        // retry their normal optimistic snapshot sync.
      }
    }

    if (submittedPayment.status !== 'submitted') {
      const paymentEventName = submittedPayment.status === 'confirmed'
        ? 'payment_confirmed'
        : submittedPayment.status === 'cancelled'
          ? 'payment_cancelled'
          : 'payment_failed'
      void trackAnalyticsEvent(
        paymentEventName,
        analyticsContextForPayment(arka, submittedPayment, member.role),
      )
    }

    const updatedArka = get().getArka(arkaId)
    if (submittedPayment.status === 'confirmed' && updatedArka?.status === 'ready-to-settle') {
      void trackAnalyticsEvent('arka_ready_to_settle', {
        ...analyticsContextForArka(updatedArka),
        actorRole: member.role,
      })
    }

    return submittedPayment
  },

  async coverHostShare(arkaId) {
    const arka = get().getArka(arkaId)
    if (!arka) throw new Error('Arka not found.')

    const hostMember = arka.members.find((member) => (
      member.role === 'host' || member.userId === arka.hostId
    ))
    if (!hostMember || hostMember.amountPaidNim >= hostMember.amountDueNim) return arka

    let updatedArka: Arka
    if (arka.invite.publicToken) {
      const hostSecret = get().remoteHostSecrets[arkaId]
      if (!hostSecret) throw new Error('Reconnect this Arka as its host before continuing.')
      updatedArka = await markSharedHostShareCovered({
        publicToken: arka.invite.publicToken,
        hostSecret,
      })
    } else {
      const now = new Date().toISOString()
      updatedArka = updateArkaStatus({
        ...arka,
        members: applyHostShareCovered(arka.members, arka.hostId, now),
        updatedAt: now,
      })
    }

    set((state) => {
      const updatedArkas = upsertArka(state.arkas, updatedArka)
      return {
        arkas: updatedArkas,
        recentArkas: updatedArkas.map(makeSummary),
      }
    })
    return updatedArka
  },

  async simulateHostSettlement(arkaId, asset) {
    const arka = get().getArka(arkaId)

    if (!arka) {
      throw new Error('Arka not found')
    }

    const readiness = getSettlementReadiness(arka)
    if (!readiness.canSettle || readiness.asset !== asset) {
      throw new Error('Arka is not ready to settle with this asset')
    }

    const basePayment = createSettlementPayment(arka, asset)
    const awaitingPayment: Payment = {
      ...basePayment,
      status: 'awaiting-user-confirmation',
      updatedAt: new Date().toISOString(),
    }
    set({ activePayment: awaitingPayment })

    void trackAnalyticsEvent('settlement_started', analyticsContextForPayment(
      arka,
      awaitingPayment,
      'host',
    ))

    let result: PaymentResult
    try {
      const provider = await getNimiqPaymentProvider()
      result = await provider.requestPayment(createSettlementPaymentRequest(arka, asset))
    } catch (error) {
      void trackAnalyticsEvent('settlement_failed', {
        ...analyticsContextForPayment(arka, awaitingPayment, 'host'),
        paymentStatus: 'failed',
        errorCode: 'unknown-error',
      })
      throw error
    }
    const submittedPayment: Payment = {
      ...awaitingPayment,
      status: result.status === 'confirmed' ? 'confirmed' : result.status,
      transactionHash: result.transactionHash,
      confirmedAt: result.confirmedAt,
      updatedAt: new Date().toISOString(),
      error: result.errorCode ? paymentErrors[result.errorCode] : undefined,
    }

    set((state) => {
      const updatedArkas = state.arkas.map((item) => (
        item.id === arkaId && submittedPayment.status === 'confirmed'
          ? {
              ...item,
              status: 'completed' as const,
              selectedAsset: asset,
              completedAt: submittedPayment.confirmedAt ?? new Date().toISOString(),
              updatedAt: submittedPayment.confirmedAt ?? new Date().toISOString(),
            }
          : item
      ))

      return {
        arkas: updatedArkas,
        payments: [submittedPayment, ...state.payments],
        activePayment: submittedPayment,
        recentArkas: updatedArkas.map(makeSummary),
      }
    })

    const settlementEventName = submittedPayment.status === 'confirmed'
      ? 'settlement_confirmed'
      : submittedPayment.status === 'cancelled'
        ? 'settlement_cancelled'
        : 'settlement_failed'
    void trackAnalyticsEvent(
      settlementEventName,
      analyticsContextForPayment(arka, submittedPayment, 'host'),
    )

    if (submittedPayment.status === 'confirmed') {
      const completedArka = get().getArka(arkaId)
      if (completedArka) {
        void trackAnalyticsEvent('arka_completed', {
          ...analyticsContextForArka(completedArka),
          actorRole: 'host',
          asset,
          paymentType: submittedPayment.type,
          paymentStatus: 'confirmed',
          amountFiat: submittedPayment.amountFiat,
          amountNim: submittedPayment.amountNim,
          amountUsdt: submittedPayment.amountUsdt,
        })
      }
    }

    return submittedPayment
  },

  setPaymentAsset(arkaId, memberId, asset) {
    set((state) => {
      const arka = state.arkas.find((item) => item.id === arkaId)
      const lockedAsset = arka ? getLockedContributionAsset(arka) : undefined
      if (lockedAsset && lockedAsset !== asset) return state

      return {
        paymentAssetSelections: {
          ...state.paymentAssetSelections,
          [paymentAssetSelectionKey(arkaId, memberId)]: asset,
        },
      }
    })
  },

  updateArkaName(arkaId, name) {
    set((state) => {
      const updatedArkas = state.arkas.map((arka) => {
        if (arka.id !== arkaId) return arka
        return { ...arka, name: name.trim(), updatedAt: new Date().toISOString() }
      })

      return {
        arkas: updatedArkas,
        recentArkas: updatedArkas.map(makeSummary),
      }
    })
  },

  updateArkaTotal(arkaId, rawTotalFiat) {
    set((state) => {
      const updatedArkas = state.arkas.map((arka) => {
        if (arka.id !== arkaId) return arka

        const totalFiat = Number(rawTotalFiat.toFixed(2))
        const nimRate = arka.totalFiat > 0 ? arka.totalNimEstimate / arka.totalFiat : 0.00052
        const totalNimEstimate = Number((totalFiat * nimRate).toFixed(2))
        const hasContributions = hasMemberContributions(arka.members)
        if (arka.fundingMode === 'shared-wallet' && hasContributions) return arka
        let members = arka.members

        if (!hasContributions) {
          const percentages = arka.members.length > 0
            ? arka.members.map((member) => (member.amountDueFiat / Math.max(arka.totalFiat, 0.01)) * 100)
            : []

          if (arka.splitMethod === 'equal') {
            members = applyEqualSplit(arka.members, totalFiat, totalNimEstimate)
          } else if (arka.splitMethod === 'custom' || arka.splitMethod === 'by-consumption') {
            members = applyPercentageSplit(arka.members, totalFiat, totalNimEstimate, percentages)
          } else {
            const sponsor = arka.members.find((member) => member.amountDueFiat >= arka.totalFiat - 0.01)
              ?? arka.members.find((member) => member.role === 'host')
              ?? arka.members[0]
            if (sponsor) members = applySponsorSplit(arka.members, totalFiat, totalNimEstimate, sponsor.id)
          }
        }

        return updateArkaStatus({
          ...arka,
          totalFiat,
          totalNimEstimate,
          totalUsdtEstimate: totalFiat,
          members,
          updatedAt: new Date().toISOString(),
        })
      })

      return {
        arkas: updatedArkas,
        recentArkas: updatedArkas.map(makeSummary),
      }
    })
  },

  updateArkaDeadline(arkaId, expiresAt) {
    set((state) => {
      const updatedArkas = state.arkas.map((arka) => arka.id !== arkaId ? arka : updateArkaStatus({
        ...arka,
        expiresAt,
        invite: { ...arka.invite, expiresAt },
        updatedAt: new Date().toISOString(),
      }))
      return { arkas: updatedArkas, recentArkas: updatedArkas.map(makeSummary) }
    })
  },

  updateArkaSplitMethod(arkaId, splitMethod) {
    set((state) => {
      const updatedArkas = state.arkas.map((arka) => {
        if (arka.id !== arkaId) return arka
        if (hasMemberContributions(arka.members)) return arka

        const now = new Date().toISOString()
        const host = arka.members.find(
          (member) => member.role === 'host' || member.userId === arka.hostId,
        )
        const sponsorModeRequest = splitMethod === 'sponsor' && host
          ? {
              id: createRandomId(),
              requestedAt: now,
              requestedByMemberId: host.id,
              responses: Object.fromEntries(arka.members.map((member) => [
                member.id,
                member.id === host.id
                  ? { status: 'accepted' as const, respondedAt: now }
                  : { status: 'pending' as const },
              ])),
            }
          : undefined

        return updateArkaStatus({
          ...arka,
          splitMethod,
          sponsorModeRequest,
          members:
            splitMethod === 'equal' || splitMethod === 'sponsor'
              ? applyEqualSplit(arka.members, arka.totalFiat, arka.totalNimEstimate)
              : arka.members,
          updatedAt: now,
        })
      })

      return {
        arkas: updatedArkas,
        recentArkas: updatedArkas.map(makeSummary),
      }
    })
  },

  updateArkaCustomSplit(arkaId, percentages) {
    set((state) => {
      const updatedArkas = state.arkas.map((arka) => {
        if (arka.id !== arkaId) return arka
        if (hasMemberContributions(arka.members)) return arka

        return updateArkaStatus({
          ...arka,
          splitMethod: 'custom',
          sponsorModeRequest: undefined,
          members: applyPercentageSplit(
            arka.members,
            arka.totalFiat,
            arka.totalNimEstimate,
            percentages,
          ),
          updatedAt: new Date().toISOString(),
        })
      })

      return {
        arkas: updatedArkas,
        recentArkas: updatedArkas.map(makeSummary),
      }
    })
  },

  updateArkaSponsor(arkaId, sponsorMemberId) {
    set((state) => {
      const updatedArkas = state.arkas.map((arka) => {
        if (arka.id !== arkaId) return arka
        if (hasMemberContributions(arka.members)) return arka
        const allMembersAccepted = Boolean(arka.sponsorModeRequest)
          && arka.members.every((member) => (
            arka.sponsorModeRequest?.responses[member.id]?.status === 'accepted'
          ))
        if (!allMembersAccepted) return arka

        return updateArkaStatus({
          ...arka,
          splitMethod: 'sponsor',
          members: applySponsorSplit(
            arka.members,
            arka.totalFiat,
            arka.totalNimEstimate,
            sponsorMemberId,
          ),
          updatedAt: new Date().toISOString(),
        })
      })

      return {
        arkas: updatedArkas,
        recentArkas: updatedArkas.map(makeSummary),
      }
    })
  },

  async updateCurrentWalletDisplayName(walletAddress, rawDisplayName) {
    const displayName = rawDisplayName.trim()
    if (!displayName) return

    const normalizedWallet = normalizeNimiqAddress(walletAddress)
    const updatedArkas = get().arkas.map((arka) => {
      const hasMatchingMember = arka.members.some((member) => (
        member.walletAddress
        && normalizeNimiqAddress(member.walletAddress) === normalizedWallet
      ))
      if (!hasMatchingMember) return arka

      return normalizeHostWalletFunding({
        ...arka,
        members: arka.members.map((member) => (
          member.walletAddress && normalizeNimiqAddress(member.walletAddress) === normalizedWallet
            ? { ...member, displayName }
            : member
        )),
        updatedAt: new Date().toISOString(),
      })
    })

    set({
      arkas: updatedArkas,
      recentArkas: updatedArkas.map(makeSummary),
    })

    const syncResults = await Promise.allSettled(updatedArkas.map(async (arka) => {
      const member = arka.members.find((candidate) => (
        candidate.walletAddress
        && normalizeNimiqAddress(candidate.walletAddress) === normalizedWallet
      ))
      if (!member || !arka.invite.publicToken) return

      const hostSecret = get().remoteHostSecrets[arka.id]
      if (member.role === 'host' && hostSecret) {
        const syncedArka = normalizeHostWalletFunding(await updateSharedInvite(arka, hostSecret))
        set((state) => ({
          arkas: upsertArka(state.arkas, syncedArka),
          recentArkas: state.recentArkas.map((item) => (
            item.id === syncedArka.id ? makeSummary(syncedArka) : item
          )),
        }))
        return
      }

      if (member.role === 'guest' && get().guestMemberIdsByArka[arka.id] === member.id) {
        const joined = await joinSharedInvite(arka.invite.publicToken, {
          guestKey: getOrCreateInviteGuestKey(),
          displayName,
          walletAddress,
        })
        const syncedArka = normalizeHostWalletFunding(joined.arka)
        set((state) => ({
          arkas: upsertArka(state.arkas, syncedArka),
          recentArkas: state.recentArkas.map((item) => (
            item.id === syncedArka.id ? makeSummary(syncedArka) : item
          )),
        }))
      }
    }))

    if (syncResults.some((result) => result.status === 'rejected')) {
      throw new Error('Your name was saved on this device, but some shared Arkas could not sync yet.')
    }
  },

  updateSettlementDetails(arkaId, details) {
    set((state) => {
      const updatedArkas = state.arkas.map((arka) => arka.id !== arkaId ? arka : {
        ...arka,
        merchantWalletAddress: details.merchantWalletAddress,
        metadata: { ...arka.metadata, locationName: details.merchantName?.trim() || undefined, note: details.note?.trim() || undefined },
        updatedAt: new Date().toISOString(),
      })
      return { arkas: updatedArkas, recentArkas: updatedArkas.map(makeSummary) }
    })
  },
}), {
  name: 'arka-app-state-v4',
  version: 3,
  migrate: (persistedState) => {
    const state = persistedState as Partial<ArkaStore>
    const arkas = (state.arkas ?? [])
      .filter((arka) => !arka.metadata?.isDemo)
      .map(normalizeHostWalletFunding)
    const demoIds = new Set(
      (state.arkas ?? []).filter((arka) => arka.metadata?.isDemo).map((arka) => arka.id),
    )
    const currentArkaId = state.currentArkaId && demoIds.has(state.currentArkaId)
      ? ''
      : state.currentArkaId ?? ''
    const currentGuestMemberId = state.currentGuestMemberId ?? null
    const guestMemberIdsByArka = {
      ...(state.guestMemberIdsByArka ?? {}),
      ...(currentArkaId && currentGuestMemberId
        ? { [currentArkaId]: currentGuestMemberId }
        : {}),
    }

    return {
      ...state,
      arkas,
      recentArkas: (state.recentArkas ?? []).filter((arka) => !demoIds.has(arka.id)),
      payments: (state.payments ?? []).filter((payment) => !demoIds.has(payment.arkaId)),
      activePayment: state.activePayment && demoIds.has(state.activePayment.arkaId)
        ? null
        : state.activePayment,
      currentArkaId,
      currentGuestMemberId,
      guestMemberIdsByArka,
      pendingSharedPaymentSyncs: state.pendingSharedPaymentSyncs ?? {},
      paymentAssetSelections: Object.fromEntries(
        Object.entries(state.paymentAssetSelections ?? {})
          .filter(([key]) => ![...demoIds].some((id) => key.startsWith(`${id}:`))),
      ),
    }
  },
}))
