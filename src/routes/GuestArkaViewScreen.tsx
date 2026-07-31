import { Clock3, Gift, ListChecks, Loader2, ShieldCheck, UsersRound } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { HoneycombProgress } from '../components/arka/HoneycombProgress'
import { MemberIdenticon } from '../components/arka/MemberIdenticon'
import { BottomActionBar } from '../components/layout/BottomActionBar'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Button, ButtonLink } from '../components/ui/Button'
import { MobileScreen } from '../components/ui/MobileScreen'
import { NimiqCheckmarkSmall, NimiqQrCode, NimiqTransfer } from '../components/ui/NimiqIcon'
import { calculateArkaProgress } from '../lib/arka/calculateArkaProgress'
import { formatNim, formatUsd } from '../lib/arka/formatMoney'
import { formatPublicIdentity } from '../lib/arka/formatWalletAddress'
import { useSharedArkaRefresh } from '../hooks/useSharedArkaRefresh'
import { getRemainingPaymentAmounts } from '../lib/payments/getRemainingPaymentAmounts'
import { useArkaStore } from '../store/arkaStore'
import { getGuestMember, getHostName } from './routeUtils'

export function GuestArkaViewScreen() {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [respondingToSponsor, setRespondingToSponsor] = useState<'accept' | 'decline' | null>(null)
  const [sponsorResponseError, setSponsorResponseError] = useState('')
  const { arkaId } = useParams()
  const arka = useArkaStore((state) => state.getArka(arkaId))
  const currentGuestMemberId = useArkaStore((state) => (
    arkaId ? state.guestMemberIdsByArka[arkaId] : state.currentGuestMemberId
  ))
  const refreshSharedArka = useArkaStore((state) => state.refreshSharedArka)
  const respondToSponsorMode = useArkaStore((state) => state.respondToSponsorMode)

  const handleSponsorResponse = useCallback(async (accepted: boolean) => {
    if (!arkaId || respondingToSponsor) return
    setRespondingToSponsor(accepted ? 'accept' : 'decline')
    setSponsorResponseError('')
    try {
      await respondToSponsorMode(arkaId, accepted)
    } catch {
      setSponsorResponseError('Your response could not be saved. Check your connection and try again.')
    } finally {
      setRespondingToSponsor(null)
    }
  }, [arkaId, respondToSponsorMode, respondingToSponsor])

  useSharedArkaRefresh({
    arkaId,
    enabled: Boolean(arka?.invite.publicToken),
    refresh: refreshSharedArka,
  })

  if (!arka) return <Navigate to="/error/arka-not-found" replace />

  const guest = getGuestMember(arka, currentGuestMemberId)
  if (!guest) return <Navigate to="/join" replace />

  const progress = calculateArkaProgress(arka)
  const sponsorResponse = arka.sponsorModeRequest?.responses[guest.id]
  const sponsorConsentOpen = arka.splitMethod === 'sponsor'
    && Boolean(arka.sponsorModeRequest)
    && (!sponsorResponse || sponsorResponse.status === 'pending')
  const selectedSponsor = arka.splitMethod === 'sponsor'
    ? arka.members.find((member) => member.amountDueFiat >= arka.totalFiat - 0.01)
    : undefined
  const sponsorSelectionPending = arka.splitMethod === 'sponsor' && !selectedSponsor
  const guestHasAmountDue = getRemainingPaymentAmounts(guest).amountNim >= 0.00001

  return (
    <MobileScreen className="host-dashboard-screen" withBottomAction>
      <ScreenContainer className="host-dashboard-shell gap-0 pb-6">
        <ArkaHeader title="Your Arka" subtitle="Your group payment" badge="Guest" backTo="/" />
        <div className="mt-3 flex justify-end">
          <ButtonLink variant="secondary" to={`/arka/${arka.id}/share?return=guest`} className="host-invite-button"><NimiqQrCode size={18} /><span>View invite</span></ButtonLink>
        </div>

        <section className="host-dashboard-hero" aria-labelledby="guest-arka-name">
          <h1 id="guest-arka-name">{arka.name}</h1>
          <p className="host-dashboard-total">{formatUsd(arka.totalFiat)}</p>
          <p className="host-dashboard-nim">~ {formatNim(arka.totalNimEstimate)}</p>
        </section>

        <section className="host-progress-strip" aria-label="Arka payment progress">
          <div className="host-progress-stat">
            <UsersRound size={18} strokeWidth={1.8} />
            <span>{progress.paidMemberCount} of {progress.memberCount} paid</span>
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

        <HoneycombProgress arka={arka} />

        <section className="mt-3 rounded-[1.25rem] border border-[#e5d6c1] bg-white/92 p-4 shadow-[0_8px_20px_rgba(50,35,10,0.05)]">
          <div>
            <p className="text-sm font-semibold text-arka-muted">Your share</p>
            <p className="mt-1 text-[2.2rem] font-black leading-none tracking-[-0.035em] text-[#111b25]">{formatUsd(guest.amountDueFiat)}</p>
            <p className="mt-2 text-sm font-bold text-[#8d6200]">~ {formatNim(guest.amountDueNim)}</p>
          </div>
        </section>

        <section className="mt-3 rounded-[1.25rem] border border-[#e5d6c1] bg-white/92 p-4 shadow-[0_8px_20px_rgba(50,35,10,0.04)]" aria-labelledby="guest-members-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="guest-members-title" className="text-sm font-extrabold text-[#111b25]">Members ({arka.members.length})</h2>
            <p className="text-sm font-semibold text-arka-muted">{progress.paidMemberCount} paid · {progress.pendingMemberCount + progress.partialMemberCount} pending</p>
          </div>
          <div className="flex items-start gap-3 overflow-x-auto pb-1">
            {arka.members.map((member) => (
              <div key={member.id} className="w-[4.75rem] shrink-0 text-center">
                <span className="relative mx-auto block size-10">
                  <MemberIdenticon seed={member.walletAddress ?? member.userId} className="size-10" />
                  <span className={`absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full text-white ${member.status === 'paid' ? 'bg-[#48ad4e]' : member.status === 'partial' ? 'bg-[#e99b00]' : 'bg-[#9ba0a4]'}`}>
                    {member.status === 'paid' ? <NimiqCheckmarkSmall size={11} /> : <Clock3 size={10} />}
                  </span>
                </span>
                <span className="mt-1.5 block truncate text-[11px] font-bold text-[#111b25]">{formatPublicIdentity(member.displayName, member.walletAddress)}</span>
              </div>
            ))}
          </div>
        </section>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm font-semibold text-[#68727c]">
          <ShieldCheck size={17} className="shrink-0 text-[#c48700]" />
          You’ll confirm the payment in Nimiq Pay.
        </p>
      </ScreenContainer>

      <BottomActionBar aboveBottomNav>
        {arka.status === 'expired' && guest.status !== 'paid' ? (
          <Button type="button" disabled>
            <Clock3 size={19} /> Payment deadline passed
          </Button>
        ) : sponsorSelectionPending ? (
          <Button type="button" disabled>
            <Clock3 size={19} /> Waiting for treating selection
          </Button>
        ) : guest.status === 'paid' ? (
          <ButtonLink variant="secondary" to={`/arka/${arka.id}/payment-success`}>
            <ListChecks size={19} /> View receipt
          </ButtonLink>
        ) : !guestHasAmountDue ? (
          <Button type="button" variant="secondary" disabled>
            <ShieldCheck size={19} /> No payment due from you
          </Button>
        ) : (
          <div className="grid grid-cols-[0.78fr_1.22fr] gap-2">
            <Button variant="ghost" type="button" onClick={() => setDetailsOpen(true)} className="px-3 text-sm shadow-none">
              <ListChecks size={18} /> View details
            </Button>
            <ButtonLink to={`/arka/${arka.id}/pay`} className="px-3 shadow-none">
              <NimiqTransfer size={19} /> Pay with NIM
            </ButtonLink>
          </div>
        )}
      </BottomActionBar>

      <BottomSheet open={detailsOpen} onClose={() => setDetailsOpen(false)} eyebrow="Arka details" title={arka.name}>
        <div className="rounded-2xl border border-[#eadcc8] bg-white p-4"><p className="text-sm font-semibold text-arka-muted">Your share</p><p className="mt-1 text-3xl font-black tracking-[-0.03em]">{formatUsd(guest.amountDueFiat)}</p><p className="mt-1 text-sm font-bold text-[#8d6200]">~ {formatNim(guest.amountDueNim)}</p></div>
        <div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-[#eadcc8] bg-white p-4"><p className="text-xs font-bold text-arka-muted">Total Arka</p><p className="mt-2 text-xl font-black">{formatUsd(arka.totalFiat)}</p></div><div className="rounded-2xl border border-[#eadcc8] bg-white p-4"><p className="text-xs font-bold text-arka-muted">Members</p><p className="mt-2 text-xl font-black">{arka.members.length}</p></div></div>
        <div className="mt-3 rounded-2xl border border-[#eadcc8] bg-white p-4"><p className="text-sm font-black">Split equally</p><p className="mt-1 text-sm font-semibold text-arka-muted">{progress.paidMemberCount} of {progress.memberCount} members have paid.</p></div>
      </BottomSheet>

      <BottomSheet
        open={sponsorConsentOpen}
        onClose={() => undefined}
        dismissible={false}
        eyebrow="Group approval"
        title={`${getHostName(arka)} wants to activate Who's treating?`}
      >
        <div className="rounded-2xl border border-[#ead28c] bg-[#fff8e7] p-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#f7c842] text-[#3d2a00]"><Gift size={23} /></span>
          <p className="mt-4 text-base font-black text-[#111b25]">Do you agree to be included?</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-arka-muted">
            If the wheel selects you, you will cover the full {formatUsd(arka.totalFiat)} Arka. You will still review and confirm the payment yourself in Nimiq Pay.
          </p>
        </div>
        {sponsorResponseError ? <p className="mt-3 text-sm font-semibold text-arka-error" role="alert">{sponsorResponseError}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={Boolean(respondingToSponsor)}
            onClick={() => void handleSponsorResponse(false)}
          >
            {respondingToSponsor === 'decline' ? <Loader2 className="animate-spin" size={18} /> : null}
            Decline
          </Button>
          <Button
            type="button"
            disabled={Boolean(respondingToSponsor)}
            onClick={() => void handleSponsorResponse(true)}
          >
            {respondingToSponsor === 'accept' ? <Loader2 className="animate-spin" size={18} /> : <Gift size={18} />}
            Accept
          </Button>
        </div>
      </BottomSheet>
    </MobileScreen>
  )
}
