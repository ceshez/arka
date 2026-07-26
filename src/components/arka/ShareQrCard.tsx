import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Share2, ShieldCheck } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Link } from 'react-router-dom'
import { analyticsContextForArka, trackAnalyticsEvent } from '../../lib/analytics/analytics'
import { arkaCategoryIcons } from '../../lib/arka/categoryIcons'
import type { Arka } from '../../types/arka'
import { Button } from '../ui/Button'
import { ArkaBrandMark } from './ArkaBrandMark'

const transparentQrExcavation = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E'

export function ShareQrCard({ arka, hostName, returnTo }: { arka: Arka; hostName?: string; returnTo: string }) {
  const [feedback, setFeedback] = useState('')
  const feedbackTimer = useRef<number | undefined>(undefined)
  const displayHostName = hostName ?? arka.members.find((member) => member.role === 'host')?.displayName ?? 'Host'
  const CategoryIcon = arkaCategoryIcons[arka.metadata?.category ?? 'custom']
  const memberLabel = `${arka.members.length} ${arka.members.length === 1 ? 'member' : 'members'}`
  const invitePath = `/join/${arka.invite.publicToken ?? arka.code}/preview`
  const inviteUrl = typeof window !== 'undefined'
    ? new URL(invitePath, window.location.origin).toString()
    : arka.invite.inviteLink

  useEffect(() => () => window.clearTimeout(feedbackTimer.current), [])

  const showFeedback = (message: string) => {
    setFeedback(message)
    window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setFeedback(''), 2200)
  }

  const shareInvite = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Join ${arka.name} on Arka`, text: `${displayHostName} invited you to join an Arka.`, url: inviteUrl })
        void trackAnalyticsEvent('invite_shared', {
          ...analyticsContextForArka(arka),
          actorRole: 'host',
          inviteMethod: 'native-share',
        })
        showFeedback('Invite shared')
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = inviteUrl
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.append(textArea)
        textArea.select()
        const copied = document.execCommand('copy')
        textArea.remove()
        if (!copied) throw new Error('Copy unavailable')
      }

      void trackAnalyticsEvent('invite_shared', {
        ...analyticsContextForArka(arka),
        actorRole: 'host',
        inviteMethod: 'clipboard',
      })
      showFeedback('Invite link copied')
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        void trackAnalyticsEvent('error_occurred', {
          ...analyticsContextForArka(arka),
          actorRole: 'host',
          errorCode: 'invite-share-failed',
          route: `/arka/${arka.id}/share`,
        })
        showFeedback('Could not share the invite')
      }
    }
  }

  return (
    <section aria-label={`Invite people to ${arka.name}`}>
      <div className="flex items-center gap-3 rounded-[1.25rem] bg-[#efede7] p-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-[#b57a00]"><CategoryIcon size={22} /></span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{arka.name}</p><p className="mt-0.5 text-[11px] font-semibold text-arka-muted">{memberLabel} · hosted by {displayHostName}</p></div>
        <span className="rounded-full bg-[#fff8e7] px-2.5 py-1 text-[10px] font-black tracking-[0.06em] text-[#7d5700]">Invite</span>
      </div>

      <div className="relative mx-auto mt-4 grid aspect-square w-full max-w-[240px] place-items-center rounded-[1.5rem] bg-white p-3 shadow-[0_8px_18px_rgba(27,28,25,0.08)]" role="img" aria-label={`QR code to join ${arka.name}`}>
        <QRCodeSVG aria-hidden="true" className="h-auto w-full rounded-xl" value={inviteUrl} size={216} bgColor="#ffffff" fgColor="#171814" level="H" marginSize={4} boostLevel imageSettings={{ src: transparentQrExcavation, width: 42, height: 42, excavate: true }} />
        <span className="absolute grid size-12 place-items-center rounded-xl border-[4px] border-white bg-[#1b1c19] text-[#f7c842] shadow-[0_4px_12px_rgba(27,28,25,0.2)]"><ArkaBrandMark className="size-8" /></span>
      </div>

      <p className="mx-auto mt-3 max-w-[310px] text-center text-xs font-semibold leading-5 text-arka-muted">Friends can scan this to open the Arka invite in Nimiq Pay.</p>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#e6ddcf] bg-[#efede7] px-4 py-2.5" aria-label={`Join code ${arka.code}`}>
        <div><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-arka-muted">Join with code</p><strong className="mt-1 block text-[22px] font-black leading-none tracking-[0.08em] text-[#3c2900]">{arka.code}</strong></div>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff0c5] text-[#8a5c00]" aria-hidden="true"><ArkaBrandMark className="size-7" /></span>
      </div>

      <Button type="button" className="mt-4" onClick={shareInvite}><Share2 size={19} /> Share invite</Button>

      <Link to={returnTo} className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#e2dcd2] bg-white px-3 text-sm font-black active:scale-[0.98]">Go to Arka <ArrowRight size={17} /></Link>

      <div className="mt-3 min-h-5 text-center" aria-live="polite">{feedback ? <p className="text-xs font-bold text-[#7d5700]">{feedback}</p> : <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-arka-muted"><ShieldCheck size={13} /> Only this invite is shared. You stay in control.</p>}</div>
    </section>
  )
}
