import {
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Crown,
  Scale,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { MemberIdenticon } from '../components/arka/MemberIdenticon'
import { ArkaBrandMark } from '../components/arka/ArkaBrandMark'
import { BottomActionBar } from '../components/layout/BottomActionBar'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { MobileScreen } from '../components/ui/MobileScreen'
import { NimiqArrowRight, NimiqLockLocked } from '../components/ui/NimiqIcon'
import { calculateArkaProgress } from '../lib/arka/calculateArkaProgress'
import { arkaCategoryIcons } from '../lib/arka/categoryIcons'
import { formatNim, formatUsd } from '../lib/arka/formatMoney'
import { formatPublicIdentity } from '../lib/arka/formatWalletAddress'
import { buildArkaWithLocalGuest, findLocalGuest } from '../lib/arka/localGuestMembership'
import { useArkaStore } from '../store/arkaStore'
import { useProfileStore } from '../store/profileStore'
import { useWalletStore } from '../store/walletStore'
import type { SplitMethodType } from '../types/arka'
import { getHostName } from './routeUtils'

const splitMethodLabels: Record<SplitMethodType, string> = {
  equal: 'Split equally',
  custom: 'Custom split',
  sponsor: "Who's treating?",
  'by-consumption': 'By consumption',
}

export function ArkaPreviewGuestScreen() {
  const { code } = useParams()
  const navigate = useNavigate()
  const arka = useArkaStore((state) => state.findArkaByCode(code))
  const currentGuestMemberId = useArkaStore((state) => (
    arka ? state.guestMemberIdsByArka[arka.id] : state.currentGuestMemberId
  ))
  const loadArkaInvite = useArkaStore((state) => state.loadArkaInvite)
  const joinArka = useArkaStore((state) => state.joinArka)
  const walletAddress = useWalletStore((state) => state.wallet?.address)
  const publicUsername = useProfileStore((state) => state.displayName.trim())
  const [failedReference, setFailedReference] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  useEffect(() => {
    if (!code) return
    const localArka = useArkaStore.getState().findArkaByCode(code)
    if (localArka && !localArka.invite.publicToken) return

    let active = true
    void loadArkaInvite(code)
      .then((loadedArka) => {
        if (active && !loadedArka) setFailedReference(code)
      })
      .catch(() => {
        if (active) setFailedReference(code)
      })

    return () => {
      active = false
    }
  }, [code, loadArkaInvite])

  if (!code || failedReference === code) return <Navigate to="/error/arka-not-found" replace />
  if (!arka) {
    return (
      <MobileScreen className="bg-[#fffaf5]">
        <ScreenContainer className="grid place-items-center px-5 text-center">
          <div>
            <ArkaBrandMark className="mx-auto size-16 animate-pulse" />
            <h1 className="arka-page-title mt-5">Opening invite…</h1>
            <p className="mt-2 text-sm font-semibold text-[#68727c]">Loading the Arka details.</p>
          </div>
        </ScreenContainer>
      </MobileScreen>
    )
  }

  const existingGuest = arka.members.find((member) => member.id === currentGuestMemberId) ?? findLocalGuest(arka)
  const prospectiveMembership = !existingGuest
    ? buildArkaWithLocalGuest(arka, arka.updatedAt, {
        displayName: publicUsername || (walletAddress ? formatPublicIdentity(undefined, walletAddress) : undefined),
        walletAddress,
      })
    : undefined
  const activeArka = prospectiveMembership?.arka ?? arka
  const guest = existingGuest ?? prospectiveMembership?.guest
  if (!guest) return <Navigate to="/error/arka-not-found" replace />

  const hostMember = activeArka.members.find((member) => member.role === 'host' || member.userId === activeArka.hostId)
  const hostName = getHostName(activeArka)
  const hostHandle = `@${hostName.toLowerCase().replaceAll(' ', '')}`
  const progress = calculateArkaProgress(activeArka)
  const CategoryIcon = arkaCategoryIcons[activeArka.metadata?.category ?? 'custom']

  async function handleJoin() {
    setIsJoining(true)
    setJoinError('')
    try {
      const joined = await joinArka(code ?? activeArka.code)
      navigate(joined ? `/arka/${joined.id}/guest` : '/error/arka-not-found')
    } catch {
      setJoinError('This Arka could not be joined. Check your connection and try again.')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <MobileScreen className="bg-[#fffaf5]" withBottomAction>
      <ScreenContainer className="!flex-none gap-6 px-5 pb-[calc(9.25rem+var(--arka-safe-bottom))]">
        <ArkaHeader title="Preview Arka" subtitle="See the details before you join." backTo="/join" />

        <section aria-labelledby="preview-arka-name">
          <div className="flex items-center gap-4">
            <span className="grid size-[58px] shrink-0 place-items-center bg-[#fff7e3] text-[#d99300] [clip-path:var(--arka-vertical-hex-soft)]" aria-hidden="true">
              <CategoryIcon size={27} strokeWidth={1.8} />
            </span>
            <h2 id="preview-arka-name" className="min-w-0 text-wrap-balance text-[32px] font-extrabold leading-tight tracking-[-0.035em] text-[#111b25]">{activeArka.name}</h2>
          </div>

          <div className="mt-5 flex min-h-[82px] items-center gap-4 rounded-[1.4rem] border border-[#eadcc8] bg-white/88 p-4 shadow-[0_5px_12px_rgba(27,28,25,0.05)]">
            <MemberIdenticon seed={hostMember?.walletAddress ?? hostMember?.userId ?? hostName} className="size-14 shrink-0 shadow-none" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-extrabold text-[#111b25]">Hosted by {hostHandle}</p>
              <Badge tone="gold" className="mt-1 min-h-7 px-3 text-sm">
                <Crown size={15} /> Host
              </Badge>
            </div>
          </div>
        </section>

        {!existingGuest && walletAddress ? (
          <p className="mt-5 rounded-[1.4rem] border border-[#e6cf94] bg-[#fff8e7] p-4 text-sm font-semibold leading-5 text-[#5f4a18] shadow-[0_5px_12px_rgba(125,87,0,0.06)]">
            You will join as <strong>{formatPublicIdentity(publicUsername, walletAddress)}</strong>. This public username will be visible to everyone in the Arka.
          </p>
        ) : null}

        <section className="mt-5 grid grid-cols-2 gap-3" aria-label="Arka details">
          <article className="min-h-[128px] rounded-[1.35rem] border border-[#eadcc8] bg-white/88 p-4 shadow-[0_5px_12px_rgba(27,28,25,0.045)]">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#5f6871]"><CircleDollarSign size={19} className="text-[#d99300]" /> Total amount</p>
            <p className="mt-5 text-[27px] font-extrabold leading-none text-[#111b25]">{formatUsd(activeArka.totalFiat)}</p>
            <p className="mt-2 text-sm font-semibold text-[#68727c]">~ {formatNim(activeArka.totalNimEstimate)}</p>
          </article>

          <article className="min-h-[128px] rounded-[1.35rem] border border-[#eadcc8] bg-white/88 p-4 shadow-[0_5px_12px_rgba(27,28,25,0.045)]">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#5f6871]"><BarChart3 size={19} className="text-[#d99300]" /> Settled</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#E9B213 ${progress.progressPercent}%, #f2e8d3 0)` }} aria-hidden="true">
                <span className="grid size-9 place-items-center rounded-full bg-white text-sm font-extrabold">{Math.round(progress.progressPercent)}%</span>
              </span>
              <div>
                <p className="text-base font-extrabold text-[#111b25]">{Math.round(progress.progressPercent)}% settled</p>
                <p className="mt-1 text-sm font-medium text-[#68727c]">{progress.paidMemberCount} paid</p>
              </div>
            </div>
          </article>

          <article className="min-h-[128px] rounded-[1.35rem] border border-[#eadcc8] bg-white/88 p-4 shadow-[0_5px_12px_rgba(27,28,25,0.045)]">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#5f6871]"><UserRound size={19} className="text-[#d99300]" /> Your share</p>
            {prospectiveMembership && (
              activeArka.splitMethod === 'custom' || activeArka.splitMethod === 'by-consumption'
            ) ? (
              <>
                <p className="mt-5 text-lg font-extrabold leading-tight text-[#111b25]">Assigned after joining</p>
                <p className="mt-2 text-sm font-semibold text-[#68727c]">The host will set your share.</p>
              </>
            ) : (
              <>
                <p className="mt-5 text-[27px] font-extrabold leading-none text-[#111b25]">{formatUsd(guest.amountDueFiat)}</p>
                <p className="mt-2 text-sm font-semibold text-[#68727c]">~ {formatNim(guest.amountDueNim)}</p>
              </>
            )}
          </article>

          <article className="min-h-[128px] rounded-[1.35rem] border border-[#eadcc8] bg-white/88 p-4 shadow-[0_5px_12px_rgba(27,28,25,0.045)]">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#5f6871]"><Scale size={19} className="text-[#d99300]" /> Split method</p>
            <p className="mt-7 text-lg font-extrabold leading-tight text-[#111b25]">{splitMethodLabels[activeArka.splitMethod]}</p>
          </article>
        </section>

        <section className="mt-5 rounded-[1.4rem] border border-[#eadcc8] bg-white/88 p-4 shadow-[0_5px_12px_rgba(27,28,25,0.045)]" aria-label={`${activeArka.members.length} members`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-extrabold text-[#111b25]">Members ({activeArka.members.length})</p>
            <p className="text-sm font-semibold text-[#68727c]"><span className="text-arka-green">{progress.paidMemberCount} paid</span> · {progress.pendingMemberCount + progress.partialMemberCount} pending</p>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {activeArka.members.map((member) => {
              const isPaid = member.status === 'paid'
              return (
                <div key={member.id} className="w-16 shrink-0 text-center">
                  <div className="relative mx-auto w-fit">
                    <MemberIdenticon seed={member.walletAddress ?? member.userId} className="size-12 shadow-none" />
                    <span className={`absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full text-white ring-2 ring-white ${isPaid ? 'bg-arka-green' : 'bg-[#E9B213]'}`} aria-hidden="true">
                      {isPaid ? <CheckCircle2 size={14} /> : <Clock3 size={13} />}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-[#111b25]">{formatPublicIdentity(member.displayName, member.walletAddress)}</p>
                </div>
              )
            })}
          </div>
        </section>

        <p className="mt-5 flex items-start justify-center gap-2 text-center text-sm font-medium leading-5 text-[#68727c]">
          <NimiqLockLocked size={18} className="mt-0.5 shrink-0 text-[#d99300]" />
          You’ll review and confirm your payment after joining.
        </p>
        {joinError ? <p className="mt-3 text-center text-sm font-semibold text-arka-error" role="alert">{joinError}</p> : null}

      </ScreenContainer>

      <BottomActionBar aboveBottomNav>
          <Button type="button" className="relative" onClick={() => void handleJoin()} disabled={isJoining}>
            {isJoining ? 'Joining Arka…' : 'Join Arka'}
            <NimiqArrowRight className="absolute right-6" size={25} />
          </Button>
      </BottomActionBar>
    </MobileScreen>
  )
}
