import { Banknote, CheckCircle2, ChevronDown, CirclePlus, Clock3, CreditCard, Crown, Send, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { MemberIdenticon } from '../components/arka/MemberIdenticon'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { Card } from '../components/ui/Card'
import { MobileScreen } from '../components/ui/MobileScreen'
import { arkaCategoryIcons } from '../lib/arka/categoryIcons'
import { formatDate, formatNim, formatUsd } from '../lib/arka/formatMoney'
import { getArkaActivity } from '../lib/arka/getArkaActivity'
import { useArkaStore } from '../store/arkaStore'
import { useActivityStore } from '../store/activityStore'

export function ActivityScreen() {
  const arkas = useArkaStore((state) => state.arkas)
  const lastSeenAt = useActivityStore((state) => state.lastSeenAt)
  const markAllSeen = useActivityStore((state) => state.markAllSeen)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const totalCollected = arkas.reduce((total, arka) => total + arka.members.reduce((memberTotal, member) => memberTotal + member.amountPaidFiat, 0), 0)
  const totalTrackedNim = arkas.reduce((total, arka) => total + arka.totalNimEstimate, 0)
  const activityByArka = useMemo(() => arkas.map((arka) => ({ arka, events: getArkaActivity(arka) })), [arkas])
  const unreadCount = activityByArka.flatMap(({ events }) => events).filter((event) => !lastSeenAt || Date.parse(event.occurredAt) > Date.parse(lastSeenAt)).length

  useEffect(() => {
    markAllSeen()
  }, [markAllSeen])

  return (
    <MobileScreen>
      <ScreenContainer>
        <ArkaHeader title="Activity" subtitle="What is happening in your Arkas" backTo="/" />

        <Card className="bg-[#fff8e7]">
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-arka-gold-dark">Live summary</p><p className="mt-1 text-4xl font-black tracking-[-0.03em]">{arkas.filter((arka) => arka.status === 'collecting').length} collecting</p></div>{unreadCount > 0 ? <span className="rounded-full bg-[#c7362f] px-2.5 py-1 text-xs font-black text-white">{unreadCount} new</span> : null}</div>
          <p className="mt-2 text-sm font-semibold text-arka-muted">{formatUsd(totalCollected)} moved so far · {formatNim(totalTrackedNim)} tracked</p>
        </Card>

        <section className="space-y-4" aria-label="Activity by Arka">
          {activityByArka.map(({ arka, events }) => {
            const CategoryIcon = arkaCategoryIcons[arka.metadata?.category ?? 'custom']
            const isCollapsed = Boolean(collapsed[arka.id])
            const arkaUnread = events.filter((event) => !lastSeenAt || Date.parse(event.occurredAt) > Date.parse(lastSeenAt)).length

            return (
              <Card key={arka.id} className="overflow-hidden p-0">
                <button type="button" onClick={() => setCollapsed((current) => ({ ...current, [arka.id]: !isCollapsed }))} className="flex w-full items-center gap-3 px-4 py-4 text-left active:bg-[#faf6ec]" aria-expanded={!isCollapsed}>
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fff4d7] text-[#7d5700]"><CategoryIcon size={21} /></span>
                  <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="truncate text-sm font-black">{arka.name}</strong>{arkaUnread ? <span className="grid size-2 shrink-0 rounded-full bg-[#c7362f]" aria-label={`${arkaUnread} new updates`} /> : null}</span><span className="mt-0.5 block text-xs font-semibold text-arka-muted">{events.length} updates · {arka.members.length} members</span></span>
                  <span className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-arka-muted"><span>{formatDate(events[0]?.occurredAt ?? arka.createdAt)}</span><ChevronDown className={`transition ${isCollapsed ? '-rotate-90' : ''}`} size={17} /></span>
                </button>

                {!isCollapsed ? <div className="border-t border-[#eee8df] px-4 py-1">
                  <div className="max-h-[292px] overflow-y-auto overscroll-contain pr-1" aria-label={`Full activity history for ${arka.name}`}>
                    {events.map((event) => {
                      const member = event.memberId ? arka.members.find((candidate) => candidate.id === event.memberId) : undefined
                      const EventIcon = event.kind === 'completed' ? CheckCircle2 : event.kind === 'sponsor' ? Crown : event.kind === 'paid' ? Banknote : event.kind === 'partial' ? CreditCard : event.kind === 'ready' ? Sparkles : event.kind === 'shared' ? Send : event.kind === 'created' ? CirclePlus : Clock3
                      const isSpecialEvent = event.kind === 'shared' || event.kind === 'sponsor'
                      const overlayTone = event.kind === 'paid' || event.kind === 'completed' ? 'bg-[#287b39] text-white' : event.kind === 'partial' ? 'bg-[#7d5700] text-white' : isSpecialEvent ? 'bg-[#f7c842] text-[#3d2a00]' : 'bg-[#f7c842] text-[#3d2a00]'
                      const isUnread = !lastSeenAt || Date.parse(event.occurredAt) > Date.parse(lastSeenAt)
                      return <div key={event.id} className={`flex min-h-[71px] gap-3 py-3 ${isSpecialEvent ? '-mx-2 rounded-xl bg-[#fff7dd] px-2' : ''}`}><span className="mt-0.5 size-10 shrink-0">{member ? <span className="relative block size-10"><MemberIdenticon seed={member.walletAddress ?? member.userId} className="size-10 border-2 border-white shadow-none" /><span className={`absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border-2 border-white ${overlayTone}`}><EventIcon size={10} strokeWidth={2.8} /></span></span> : <span className="relative grid size-10 place-items-center rounded-xl bg-[#fff4d7] text-[#7d5700]"><CategoryIcon size={19} /><span className={`absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border-2 border-white ${overlayTone}`}><EventIcon size={10} strokeWidth={2.8} /></span></span>}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold">{event.title}</p><p className="mt-0.5 text-xs font-semibold leading-5 text-arka-muted">{event.detail}</p></div>{isUnread ? <span className="mt-1 size-2 shrink-0 rounded-full bg-[#c7362f]" aria-label="New" /> : <time className="shrink-0 pt-0.5 text-[10px] font-bold text-arka-muted">{formatDate(event.occurredAt)}</time>}</div>
                    })}
                  </div>
                  {events.length > 4 ? <p className="border-t border-[#f0ebe3] py-2 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-arka-muted">Scroll for full history</p> : null}
                </div> : null}
              </Card>
            )
          })}
        </section>

        <Card className="flex items-center gap-3 bg-[#fcf6e9]"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#fff1c7] text-[#7d5700]"><Sparkles size={20} strokeWidth={2.1} /></span><div><p className="text-sm font-black">Your full history lives in each Arka</p><p className="text-sm font-semibold text-arka-muted">Open an Arka, then scroll its timeline from creation to settlement.</p></div></Card>
      </ScreenContainer>
    </MobileScreen>
  )
}
