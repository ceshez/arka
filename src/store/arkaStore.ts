import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { analyticsContextForArka, trackAnalyticsEvent } from '../lib/analytics/analytics'
import { estimateNimFromFiat } from '../lib/arka/amounts'
import { calculateArkaProgress } from '../lib/arka/calculateArkaProgress'
import { generateJoinCode } from '../lib/arka/generateJoinCode'
import { withArkaDeadlineStatus } from '../lib/arka/deadline'
import { getSettlementReadiness } from '../lib/arka/getSettlementReadiness'
import { formatWalletAddress } from '../lib/arka/formatWalletAddress'
import { buildArkaWithLocalGuest, findLocalGuest } from '../lib/arka/localGuestMembership'
import {
  applyEqualSplit,
  applyPercentageSplit,
  applySponsorSplit,
  hasMemberContributions,
} from '../lib/arka/splitCalculations'
import { createMockPayment } from '../lib/payments/createMockPayment'
import { createMemberPaymentRequest, createSettlementPaymentRequest } from '../lib/payments/createPaymentRequest'
import { createSettlementPayment } from '../lib/payments/createSettlementPayment'
import { createCashbackPayment, findConfirmedCashback } from '../lib/payments/cashback'
import { getLockedContributionAsset } from '../lib/payments/contributionAsset'
import { paymentErrors } from '../lib/payments/paymentErrors'
import { getOrCreateInviteGuestKey } from '../lib/invites/inviteIdentity'
import {
  createSharedInvite,
  confirmSharedMemberPayment,
  joinSharedInvite,
  loadSharedInvite,
  respondToSponsorModeRequest,
  updateSharedInvite,
} from '../lib/invites/inviteRepository'
import { getNimiqPaymentProvider } from '../lib/nimiq/nimiqClient'
import { isWalletConnected, requireConnectedWallet } from '../lib/nimiq/walletAccess'
import type { PaymentResult } from '../lib/nimiq/types'
import { createRandomId } from '../lib/utils/createRandomId'
import { useWalletStore } from './walletStore'
import type { Arka, ArkaMember, ArkaSummary, AssetSymbol, CreateArkaInput, SplitMethodType } from '../types/arka'
import type { Payment } from '../types/payment'

const hostMemberId = 'member-host-local'

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

function upsertArka(arkas: Arka[], arka: Arka) {
  return [arka, ...arkas.filter((item) => item.id !== arka.id)]
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
  pendingSharedPaymentSyncs: Record<string, { reference: string; asset: AssetSymbol }>
  remoteHostSecrets: Record<string, string>
  createArka: (input: CreateArkaInput) => Promise<Arka>
  getArka: (arkaId?: string) => Arka | undefined
  findArkaByCode: (code?: string) => Arka | undefined
  loadArkaInvite: (reference: string) => Promise<Arka | null>
  joinArka: (reference: string) => Promise<Arka | null>
  refreshSharedArka: (arkaId: string) => Promise<Arka | null>
  syncSharedArka: (arkaId: string) => Promise<void>
  respondToSponsorMode: (arkaId: string, accepted: boolean) => Promise<Arka>
  simulateGuestPayment: (arkaId: string, memberId: string, asset: AssetSymbol) => Promise<Payment>
  simulateHostSettlement: (arkaId: string, asset: AssetSymbol) => Promise<Payment>
  payCashbackReward: (arkaId: string, memberId: string) => Promise<Payment>
  setPaymentAsset: (arkaId: string, memberId: string, asset: AssetSymbol) => void
  updateArkaName: (arkaId: string, name: string) => void
  updateArkaTotal: (arkaId: string, totalFiat: number) => void
  updateArkaDeadline: (arkaId: string, expiresAt: string) => void
  updateArkaSplitMethod: (arkaId: string, splitMethod: SplitMethodType) => void
  updateArkaCustomSplit: (arkaId: string, percentages: number[]) => void
  updateArkaSponsor: (arkaId: string, sponsorMemberId: string) => void
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
    const totalNimEstimate = Number((input.totalFiat / (input.nimUsdPrice || 0.00052)).toFixed(5))
    const hostShareNim = estimateNimFromFiat(hostShareFiat, input.totalFiat, totalNimEstimate)

    const host: ArkaMember = {
      id: hostMemberId,
      userId: 'user-host-local',
      arkaId: id,
      displayName: formatWalletAddress(connectedWallet.address),
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
        expiresAt: input.expiresAt,
        createdAt: now,
      },
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt,
      metadata: {
        category: input.category,
        isDemo: false,
      },
    }

    const sharedInvite = await createSharedInvite(arka)
    const sharedArka = sharedInvite.arka

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
    const arka = get().arkas.find((item) => item.id === (arkaId ?? get().currentArkaId))
    return arka ? withArkaDeadlineStatus(arka) : undefined
  },

  findArkaByCode(code) {
    if (!isWalletConnected(useWalletStore.getState().wallet)) return undefined
    const reference = code?.trim()
    const normalized = reference?.toUpperCase()
    return get().arkas
      .map((arka) => withArkaDeadlineStatus(arka))
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

    if (arka.invite.publicToken) {
      const joined = await joinSharedInvite(reference, {
        guestKey: getOrCreateInviteGuestKey(),
        displayName: formatWalletAddress(connectedWallet.address),
        walletAddress: connectedWallet.isDemo ? undefined : connectedWallet.address,
      })

      set((state) => ({
        arkas: upsertArka(state.arkas, joined.arka),
        currentArkaId: joined.arka.id,
        currentGuestMemberId: joined.memberId,
        guestMemberIdsByArka: {
          ...state.guestMemberIdsByArka,
          [joined.arka.id]: joined.memberId,
        },
        recentArkas: state.recentArkas.some((item) => item.id === joined.arka.id)
          ? state.recentArkas.map((item) => item.id === joined.arka.id ? makeSummary(joined.arka) : item)
          : [makeSummary(joined.arka), ...state.recentArkas],
      }))
      return joined.arka
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
      displayName: formatWalletAddress(connectedWallet.address),
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
        const confirmed = await confirmSharedMemberPayment({
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

  async respondToSponsorMode(arkaId, accepted) {
    const arka = get().getArka(arkaId)
    const request = arka?.sponsorModeRequest
    const memberId = get().guestMemberIdsByArka[arkaId]
    if (!arka || !request || !memberId) {
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

    const submittedPayment: Payment = {
      ...awaitingPayment,
      status: result.status === 'confirmed' ? 'confirmed' : result.status,
      transactionHash: result.transactionHash,
      confirmedAt: result.confirmedAt,
      updatedAt: new Date().toISOString(),
      error: result.errorCode ? paymentErrors[result.errorCode] : undefined,
    }

    set((state) => {
      const shouldQueueSharedPayment = submittedPayment.status === 'confirmed'
        && member.role === 'guest'
        && Boolean(arka.invite.publicToken)
      const updatedArkas = state.arkas.map((item) => {
        if (item.id !== arkaId || submittedPayment.status !== 'confirmed') return item

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
        pendingSharedPaymentSyncs: shouldQueueSharedPayment
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
    ) {
      try {
        await get().syncSharedArka(arkaId)
      } catch {
        // Host dashboards continue to show the confirmed local state and can
        // retry their normal optimistic snapshot sync.
      }
    }

    const paymentEventName = submittedPayment.status === 'confirmed'
      ? 'payment_confirmed'
      : submittedPayment.status === 'cancelled'
        ? 'payment_cancelled'
        : 'payment_failed'
    void trackAnalyticsEvent(
      paymentEventName,
      analyticsContextForPayment(arka, submittedPayment, member.role),
    )

    const updatedArka = get().getArka(arkaId)
    if (submittedPayment.status === 'confirmed' && updatedArka?.status === 'ready-to-settle') {
      void trackAnalyticsEvent('arka_ready_to_settle', {
        ...analyticsContextForArka(updatedArka),
        actorRole: member.role,
      })
    }

    return submittedPayment
  },

  async payCashbackReward(arkaId, memberId) {
    const arka = get().getArka(arkaId)
    const member = arka?.members.find((candidate) => candidate.id === memberId)
    if (!arka || !member) throw new Error('Arka member not found.')

    const existing = findConfirmedCashback(get().payments, arkaId, memberId)
    if (existing) return existing

    const connectedWallet = useWalletStore.getState().wallet
    const connectedAddress = connectedWallet?.address.replace(/\s+/g, '').toUpperCase()
    const hostAddress = arka.hostWalletAddress?.replace(/\s+/g, '').toUpperCase()
    if (!arka.metadata?.isDemo && (!connectedWallet || !hostAddress || connectedAddress !== hostAddress)) {
      throw new Error('Reconnect the host wallet before sending cashback.')
    }

    const basePayment = createCashbackPayment(arka, member)
    const awaitingPayment: Payment = {
      ...basePayment,
      status: 'awaiting-user-confirmation',
      updatedAt: new Date().toISOString(),
    }
    set({ activePayment: awaitingPayment })

    void trackAnalyticsEvent('payment_started', analyticsContextForPayment(arka, awaitingPayment, 'host'))

    let result: PaymentResult
    try {
      const provider = await getNimiqPaymentProvider()
      result = await provider.requestPayment({
        arkaId: arka.id,
        payerUserId: arka.hostId,
        recipientWalletAddress: basePayment.recipientWalletAddress,
        recipientLabel: basePayment.recipientLabel,
        asset: 'NIM',
        amountFiat: basePayment.amountFiat,
        amountNim: basePayment.amountNim,
        memo: `Arka ${arka.code} 3% cashback`,
        isDemo: arka.metadata?.isDemo,
      })
    } catch {
      const failedPayment: Payment = {
        ...awaitingPayment,
        status: 'failed',
        updatedAt: new Date().toISOString(),
        error: paymentErrors['unknown-error'],
      }
      set((state) => ({
        activePayment: failedPayment,
        payments: [failedPayment, ...state.payments],
      }))
      void trackAnalyticsEvent('payment_failed', analyticsContextForPayment(arka, failedPayment, 'host'))
      return failedPayment
    }

    const payment: Payment = {
      ...awaitingPayment,
      status: result.status,
      transactionHash: result.transactionHash,
      confirmedAt: result.confirmedAt,
      updatedAt: new Date().toISOString(),
      error: result.errorCode ? paymentErrors[result.errorCode] : undefined,
    }
    set((state) => ({
      activePayment: payment,
      payments: [payment, ...state.payments],
    }))

    void trackAnalyticsEvent(
      payment.status === 'confirmed' ? 'payment_confirmed' : payment.status === 'cancelled' ? 'payment_cancelled' : 'payment_failed',
      analyticsContextForPayment(arka, payment, 'host'),
    )
    return payment
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
  version: 2,
  migrate: (persistedState) => {
    const state = persistedState as Partial<ArkaStore>
    const arkas = (state.arkas ?? []).filter((arka) => !arka.metadata?.isDemo)
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
