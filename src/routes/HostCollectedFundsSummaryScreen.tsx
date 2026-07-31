import { Check, CircleCheck, Clock3, LockKeyhole, PencilLine, UsersRound, X } from 'lucide-react'
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { HoneycombProgress } from '../components/arka/HoneycombProgress'
import { CashbackRewardsPanel } from '../components/arka/CashbackRewardsPanel'
import { HostSplitMethodPanel } from '../components/arka/HostSplitMethodPanel'
import { MemberStatusList } from '../components/arka/MemberStatusList'
import { WalletStatus } from '../components/arka/WalletStatus'
import { BottomActionBar } from '../components/layout/BottomActionBar'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { ArkaToast, type ToastNotice } from '../components/ui/ArkaToast'
import { Badge } from '../components/ui/Badge'
import { Button, ButtonLink } from '../components/ui/Button'
import { MobileScreen } from '../components/ui/MobileScreen'
import { NimiqHexagon, NimiqQrCode, NimiqTransfer } from '../components/ui/NimiqIcon'
import { calculateArkaProgress } from '../lib/arka/calculateArkaProgress'
import { formatNim, formatUsd } from '../lib/arka/formatMoney'
import { getSharedContactId } from '../lib/arka/getSharedContacts'
import { getSettlementReadiness } from '../lib/arka/getSettlementReadiness'
import { formatPublicIdentity } from '../lib/arka/formatWalletAddress'
import { useSharedArkaRefresh } from '../hooks/useSharedArkaRefresh'
import { useArkaStore } from '../store/arkaStore'
import { useProfileStore } from '../store/profileStore'
import type { ArkaMember } from '../types/arka'
import type { SplitMethodType } from '../types/arka'

function joinedMemberLabel(member: ArkaMember, nicknames: Record<string, string>) {
  const nickname = nicknames[getSharedContactId(member)]?.trim()
  if (nickname) return nickname

  const displayName = formatPublicIdentity(member.displayName, member.walletAddress)
  const isGenericName = /^(guest|new guest)(\s+\d+)?$/i.test(displayName)
  if (displayName && !isGenericName) return displayName
  return displayName || 'A new member'
}

export function HostCollectedFundsSummaryScreen() {
  const { arkaId } = useParams()
  const arka = useArkaStore((state) => state.getArka(arkaId))
  const updateArkaName = useArkaStore((state) => state.updateArkaName)
  const updateArkaTotal = useArkaStore((state) => state.updateArkaTotal)
  const updateArkaSplitMethod = useArkaStore((state) => state.updateArkaSplitMethod)
  const updateArkaCustomSplit = useArkaStore((state) => state.updateArkaCustomSplit)
  const updateArkaSponsor = useArkaStore((state) => state.updateArkaSponsor)
  const payments = useArkaStore((state) => state.payments)
  const payCashbackReward = useArkaStore((state) => state.payCashbackReward)
  const refreshSharedArka = useArkaStore((state) => state.refreshSharedArka)
  const syncSharedArka = useArkaStore((state) => state.syncSharedArka)
  const contactNicknames = useProfileStore((state) => state.contactNicknames)
  const [toast, setToast] = useState<ToastNotice>()
  const [editingHeroField, setEditingHeroField] = useState<'name' | 'total' | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [totalDraft, setTotalDraft] = useState('')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const memberTrackerRef = useRef({
    arkaId: arka?.id,
    memberIds: new Set(arka?.members.map((member) => member.id) ?? []),
  })

  const showToast = useCallback((notice: Omit<ToastNotice, 'id'>) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ ...notice, id: Date.now() })
    toastTimerRef.current = setTimeout(() => setToast(undefined), 4200)
  }, [])

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  useEffect(() => {
    if (!arka) return

    if (memberTrackerRef.current.arkaId !== arka.id) {
      memberTrackerRef.current = {
        arkaId: arka.id,
        memberIds: new Set(arka.members.map((member) => member.id)),
      }
      return
    }

    const newMembers = arka.members.filter((member) => !memberTrackerRef.current.memberIds.has(member.id))
    memberTrackerRef.current.memberIds = new Set(arka.members.map((member) => member.id))
    if (!newMembers.length) return

    const latestMember = [...newMembers].sort((left, right) => (
      Date.parse(right.joinedAt ?? '') - Date.parse(left.joinedAt ?? '')
    ))[0]
    const label = joinedMemberLabel(latestMember, contactNicknames)
    showToast({
      tone: 'success',
      title: newMembers.length === 1 ? `${label} joined` : `${newMembers.length} people joined`,
      message: newMembers.length === 1
        ? `They are now part of ${arka.name}.`
        : `Your Arka now has ${arka.members.length} members.`,
    })
  }, [arka, contactNicknames, showToast])

  const handleRefreshError = useCallback(() => {
    showToast({
      tone: 'info',
      title: 'Waiting to reconnect',
      message: 'New members will appear as soon as the shared Arka is reachable.',
    })
  }, [showToast])

  useSharedArkaRefresh({
    arkaId,
    enabled: Boolean(arka?.invite.publicToken),
    refresh: refreshSharedArka,
    onError: handleRefreshError,
  })

  if (!arka) return <Navigate to="/error/arka-not-found" replace />

  const activeArka = arka
  const progress = calculateArkaProgress(activeArka)
  const settlementReadiness = getSettlementReadiness(activeArka)
  const syncChanges = () => {
    void syncSharedArka(activeArka.id).catch(() => {
      showToast({
        tone: 'info',
        title: 'Saved on this phone',
        message: 'Shared invite details will retry when the connection is available.',
      })
    })
  }
  const settlementIsBlocked = settlementReadiness.requiresRefund
    || settlementReadiness.hasPaymentInconsistency
  const selectedSponsor = activeArka.splitMethod === 'sponsor'
    ? activeArka.members.find((member) => member.amountDueFiat >= activeArka.totalFiat - 0.01)
    : undefined
  const hasSelectedSponsor = Boolean(selectedSponsor)
  const paidDisplayCount = hasSelectedSponsor
    ? selectedSponsor?.status === 'paid' ? 1 : 0
    : progress.paidMemberCount
  const paymentMemberCount = hasSelectedSponsor ? 1 : progress.memberCount
  const pendingCount = hasSelectedSponsor
    ? selectedSponsor?.status === 'paid' ? 0 : 1
    : progress.pendingMemberCount + progress.partialMemberCount
  const hostMember = activeArka.members.find((member) => member.role === 'host' || member.userId === activeArka.hostId)
  const hostNeedsPayment = Boolean(
    hostMember && hostMember.amountDueFiat > hostMember.amountPaidFiat && hostMember.status !== 'paid',
  )
  const showHostPaymentAction = hostNeedsPayment
    && !(activeArka.splitMethod === 'sponsor' && !hasSelectedSponsor)

  function beginNameEdit() {
    setNameDraft(activeArka.name)
    setEditingHeroField('name')
  }

  function saveNameEdit() {
    const nextName = nameDraft.trim()
    if (!nextName) {
      showToast({ tone: 'info', title: 'Add an Arka name', message: 'The name cannot be empty.' })
      return
    }
    updateArkaName(activeArka.id, nextName)
    syncChanges()
    setEditingHeroField(null)
  }

  function beginTotalEdit() {
    setTotalDraft(activeArka.totalFiat.toFixed(2))
    setEditingHeroField('total')
  }

  function saveTotalEdit() {
    const nextTotal = Number(totalDraft.replace(',', '.'))
    if (!Number.isFinite(nextTotal) || nextTotal <= 0) {
      showToast({ tone: 'info', title: 'Add a valid amount', message: 'The total must be greater than $0.' })
      return
    }
    updateArkaTotal(activeArka.id, nextTotal)
    syncChanges()
    setEditingHeroField(null)
  }

  function cancelHeroEdit() {
    setEditingHeroField(null)
  }

  function handleInlineEditKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    save: () => void,
  ) {
    if (event.key === 'Enter') {
      event.preventDefault()
      save()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelHeroEdit()
    }
  }

  function handleSplitMethodChange(method: SplitMethodType) {
    updateArkaSplitMethod(activeArka.id, method)
    syncChanges()
  }

  return (
    <MobileScreen className="host-dashboard-screen" withBottomAction={progress.isFullyPaid || showHostPaymentAction}>
      {toast ? <ArkaToast notice={toast} onDismiss={() => setToast(undefined)} /> : null}
      <ScreenContainer className="host-dashboard-shell gap-0">
        <header className="host-dashboard-header">
          <div className="host-dashboard-brand">
            <p>Arka</p>
            <NimiqHexagon size={25} aria-hidden="true" />
            <Badge tone="gold" className="host-dashboard-role">Host</Badge>
          </div>

          <div className="host-dashboard-actions">
            <ButtonLink
              variant="secondary"
              to={`/arka/${activeArka.id}/share`}
              className="host-invite-button"
            >
              <NimiqQrCode size={18} />
              <span>Share invite</span>
            </ButtonLink>
            <WalletStatus className="size-11" />
          </div>
        </header>

        <section className="host-dashboard-hero" aria-labelledby="host-arka-name">
          {editingHeroField === 'name' ? (
            <div className="host-inline-editor host-inline-name-editor">
              <input
                autoFocus
                aria-label="Arka name"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onKeyDown={(event) => handleInlineEditKeyDown(event, saveNameEdit)}
              />
              <button type="button" aria-label="Save Arka name" onClick={saveNameEdit}><Check size={18} /></button>
              <button type="button" aria-label="Cancel Arka name edit" onClick={cancelHeroEdit}><X size={18} /></button>
            </div>
          ) : (
            <button type="button" id="host-arka-name" className="host-inline-display host-inline-name" onClick={beginNameEdit} aria-label={`Edit Arka name, ${activeArka.name}`}>
              <span>{activeArka.name}</span>
              <PencilLine size={15} aria-hidden="true" />
            </button>
          )}
          {editingHeroField === 'total' ? (
            <div className="host-inline-editor host-inline-total-editor">
              <span>$</span>
              <input
                autoFocus
                aria-label="Arka total amount"
                inputMode="decimal"
                value={totalDraft}
                onChange={(event) => setTotalDraft(event.target.value)}
                onKeyDown={(event) => handleInlineEditKeyDown(event, saveTotalEdit)}
              />
              <button type="button" aria-label="Save Arka total" onClick={saveTotalEdit}><Check size={18} /></button>
              <button type="button" aria-label="Cancel Arka total edit" onClick={cancelHeroEdit}><X size={18} /></button>
            </div>
          ) : (
            <button type="button" className="host-inline-display host-inline-total" onClick={beginTotalEdit} aria-label={`Edit Arka total, ${formatUsd(activeArka.totalFiat)}`}>
              <span className="host-dashboard-total">{formatUsd(activeArka.totalFiat)}</span>
              <PencilLine size={16} aria-hidden="true" />
            </button>
          )}
          <p className="host-dashboard-nim">~ {formatNim(activeArka.totalNimEstimate)}</p>
        </section>

        <section className="host-progress-strip" aria-label="Arka payment progress">
          <div className="host-progress-stat">
            <UsersRound size={17} strokeWidth={1.8} />
            <span>{paidDisplayCount} of {paymentMemberCount} paid</span>
          </div>
          <span className="host-progress-divider" aria-hidden="true" />
          <div className="host-progress-stat">
            <span
              className="host-progress-ring"
              style={{ background: `conic-gradient(#eda900 ${progress.progressPercent}%, #e3e3de 0)` }}
              aria-hidden="true"
            >
              <span />
            </span>
            <span>{Math.round(progress.progressPercent)}% settled</span>
          </div>
        </section>

        <div className="host-dashboard-desktop-grid">
          <div className="host-dashboard-visual-column">
            <HoneycombProgress arka={activeArka} />
          </div>

          <div className="host-dashboard-details-column">
            <HostSplitMethodPanel
              key={activeArka.id}
              arka={activeArka}
              onMethodChange={handleSplitMethodChange}
              onCustomApply={(percentages) => {
                updateArkaCustomSplit(activeArka.id, percentages)
                syncChanges()
              }}
              onSponsorSelected={(memberId) => {
                if (memberId) {
                  updateArkaSponsor(activeArka.id, memberId)
                  syncChanges()
                }
              }}
              onNotify={showToast}
            />

            <section className="host-collection-panel" aria-label="Host collection summary">
              <div>
                <p>Collected</p>
                <strong>{formatUsd(progress.collectedFiat)}</strong>
                <span>~ {formatNim(progress.collectedNim)}</span>
              </div>
              <span className="host-collection-divider" aria-hidden="true" />
              <div>
                <p>Settlement status</p>
                <strong className="host-collection-status">
                  {settlementReadiness.canSettle ? <CircleCheck size={18} /> : <Clock3 size={18} />}
                  {settlementReadiness.canSettle
                    ? 'Ready to settle'
                    : settlementReadiness.requiresRefund
                      ? 'Refund required'
                      : settlementReadiness.hasPaymentInconsistency
                        ? 'Review member balances'
                        : settlementReadiness.requiresConversion ? 'Review assets' : 'Still collecting'}
                </strong>
                <span>
                  {settlementIsBlocked
                    ? 'Resolve balances before settlement'
                    : `${pendingCount} ${pendingCount === 1 ? 'member' : 'members'} remaining`}
                </span>
              </div>
            </section>

            <p className="flex items-center justify-center gap-2 text-center text-xs font-bold leading-5 text-arka-muted">
              <NimiqTransfer size={17} aria-hidden="true" />
              Collected by the host, settled with Nimiq Pay.
            </p>

            <MemberStatusList members={activeArka.members} />
            <CashbackRewardsPanel
              arka={activeArka}
              payments={payments}
              onPay={(memberId) => payCashbackReward(activeArka.id, memberId)}
              onNotice={showToast}
            />
          </div>
        </div>
      </ScreenContainer>

      {progress.isFullyPaid ? (
        <BottomActionBar aboveBottomNav>
          {settlementIsBlocked ? (
            <Button type="button" disabled>
              <LockKeyhole size={18} /> Resolve balances before settling
            </Button>
          ) : (
            <ButtonLink to={`/arka/${activeArka.id}/settle`}>
              <NimiqTransfer size={18} />
              {settlementReadiness.asset
                ? `Pay merchant with collected ${settlementReadiness.asset}`
                : 'Review collected assets'}
            </ButtonLink>
          )}
        </BottomActionBar>
      ) : showHostPaymentAction ? (
        <BottomActionBar aboveBottomNav>
          <ButtonLink to={`/arka/${activeArka.id}/host/pay`}>
            <NimiqTransfer size={18} /> Continue to pay
          </ButtonLink>
        </BottomActionBar>
      ) : null}
    </MobileScreen>
  )
}
