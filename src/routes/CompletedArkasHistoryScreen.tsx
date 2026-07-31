import { useState } from 'react'
import { ChevronRight, Inbox, TrendingUp, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { HomeArkasHeader } from '../components/arka/HomeArkasHeader'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { MobileScreen } from '../components/ui/MobileScreen'
import { arkaCategoryIcons } from '../lib/arka/categoryIcons'
import { formatNim, formatUsd } from '../lib/arka/formatMoney'
import { useArkaStore } from '../store/arkaStore'
import { useWalletStore } from '../store/walletStore'
import type { ArkaStatus, ArkaSummary } from '../types/arka'
import { getArkaDestination } from './routeUtils'

type HistoryFilter = 'all' | 'active' | 'pending' | 'completed'

const filters: Array<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
]

function getHistoryBucket(status: ArkaStatus): Exclude<HistoryFilter, 'all'> | 'closed' {
  if (status === 'completed') return 'completed'
  if (status === 'draft') return 'pending'
  if (status === 'cancelled' || status === 'expired') return 'closed'
  return 'active'
}

function getStatusPresentation(arka: ArkaSummary) {
  const pendingCount = Math.max(arka.memberCount - arka.paidMemberCount, 0)
  const progress = arka.totalFiat > 0 ? Math.round((arka.collectedFiat / arka.totalFiat) * 100) : 0
  if (arka.status === 'completed') return { label: 'Completed', detail: 'Settled', classes: 'bg-[#e7f7e8] text-[#197334]' }
  if (arka.status === 'ready-to-settle') return { label: 'Ready', detail: 'Ready to settle', classes: 'bg-[#e7f7e8] text-[#197334]' }
  if (arka.status === 'collecting') return { label: 'Active', detail: arka.collectedFiat > 0 ? `${progress}% funded` : `${pendingCount} pending`, classes: 'bg-[#fff1cf] text-[#765000]' }
  if (arka.status === 'settling' || arka.status === 'paid-to-merchant') return { label: 'Settling', detail: 'In progress', classes: 'bg-[#eceef5] text-[#46516e]' }
  if (arka.status === 'cancelled' || arka.status === 'expired') return { label: 'Closed', detail: 'Closed', classes: 'bg-[#efeee9] text-[#625c54]' }
  return { label: arka.status === 'draft' ? 'Pending' : 'Active', detail: arka.status === 'draft' ? 'Draft' : `${pendingCount} pending`, classes: 'bg-[#fff1cf] text-[#765000]' }
}

export function CompletedArkasHistoryScreen() {
  const recentArkas = useArkaStore((state) => state.recentArkas)
  const arkas = useArkaStore((state) => state.arkas)
  const guestMemberIdsByArka = useArkaStore((state) => state.guestMemberIdsByArka)
  const remoteHostSecrets = useArkaStore((state) => state.remoteHostSecrets)
  const walletAddress = useWalletStore((state) => state.wallet?.address)
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all')
  const totalMoved = recentArkas.reduce((total, arka) => total + arka.collectedFiat, 0)
  const totalNimMoved = recentArkas.reduce((total, arka) => total + arka.collectedNim, 0)
  const completedCount = recentArkas.filter((arka) => arka.status === 'completed').length
  const activeCount = recentArkas.filter((arka) => getHistoryBucket(arka.status) === 'active').length
  const filteredArkas = recentArkas.filter((arka) => activeFilter === 'all' || getHistoryBucket(arka.status) === activeFilter)

  return (
    <MobileScreen>
      <ScreenContainer className="gap-6">
        <HomeArkasHeader />

        <section aria-labelledby="recent-arkas-title"><h1 id="recent-arkas-title" className="arka-page-title">Your Arkas</h1><p className="mt-2 text-sm font-semibold leading-5 text-arka-muted">Follow active collections and completed shared payments.</p></section>

        <section
          className="relative overflow-hidden rounded-xl bg-[#111214] bg-cover bg-right-bottom bg-no-repeat p-5 text-white shadow-[0_8px_20px_rgba(27,28,25,0.15)]"
          style={{ backgroundImage: "linear-gradient(90deg, rgba(11,12,13,0.96) 0%, rgba(11,12,13,0.72) 52%, rgba(11,12,13,0.08) 100%), url('/brand/arka-card-texture-cropped.png')" }}
          aria-label="Arka totals"
        >
          <div className="relative flex items-center gap-4">
            <span className="arka-hex grid size-14 shrink-0 place-items-center bg-[#f7c842] text-[#271900]"><TrendingUp size={25} /></span>
            <div><p className="text-sm font-semibold text-white/65">Total moved with Arka</p><p className="mt-1 text-[38px] font-black leading-none tracking-[-0.035em] text-white tabular-nums">{formatUsd(totalMoved)}</p><p className="mt-2 text-sm font-semibold text-[#f7c842]">≈ {formatNim(totalNimMoved)} moved</p></div>
          </div>
          <div className="relative mt-5 grid grid-cols-3 border-t border-white/10 pt-4 text-center">
            {[{ value: recentArkas.length, label: 'Arkas' }, { value: completedCount, label: 'Completed' }, { value: activeCount, label: 'Active' }].map((metric, index) => <div key={metric.label} className={index ? 'border-l border-white/10' : undefined}><p className="text-xl font-black text-white">{metric.value}</p><p className="mt-1 text-xs font-semibold text-white/60">{metric.label}</p></div>)}
          </div>
        </section>

        <div className="grid grid-cols-4 gap-1 rounded-xl bg-[#ebe7df] p-1" role="tablist" aria-label="Filter Arkas">
          {filters.map((filter) => <button key={filter.id} id={`history-filter-${filter.id}`} type="button" role="tab" aria-selected={activeFilter === filter.id} aria-controls="history-results" onClick={() => setActiveFilter(filter.id)} className={`min-h-11 rounded-lg px-1 text-xs font-black transition-colors ${activeFilter === filter.id ? 'bg-white text-[#654200]' : 'text-[#5f6473]'}`}>{filter.label}</button>)}
        </div>

        <section id="history-results" role="tabpanel" aria-labelledby={`history-filter-${activeFilter}`} className="space-y-3">
          {filteredArkas.length ? filteredArkas.map((arka) => {
            const CategoryIcon = arkaCategoryIcons[arka.category]
            const status = getStatusPresentation(arka)
            const progress = arka.totalFiat > 0 ? Math.min(100, Math.round((arka.collectedFiat / arka.totalFiat) * 100)) : 0
            const fullArka = arkas.find((candidate) => candidate.id === arka.id)
            const destination = fullArka
              ? getArkaDestination(fullArka, {
                  walletAddress,
                  guestMemberId: guestMemberIdsByArka[arka.id],
                  hasHostSecret: Boolean(remoteHostSecrets[arka.id]),
                })
              : arka.status === 'completed' ? `/arka/${arka.id}/completed` : '/join'
            return (
              <Link key={arka.id} to={destination} className="block overflow-hidden rounded-xl border border-[#e5d9c8] bg-white p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7d5700] active:bg-[#fffaf0]" aria-label={`Open ${arka.name}, ${status.label}`}>
                <span className="flex items-center gap-3">
                  <span className="arka-hex grid size-12 shrink-0 place-items-center bg-[#fff0bd] text-[#7d5700]"><CategoryIcon size={22} /></span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-base font-black">{arka.name}</strong><span className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-arka-muted"><UsersRound size={15} />{arka.memberCount} {arka.memberCount === 1 ? 'member' : 'members'} · {status.detail}</span></span>
                  <span className="shrink-0 text-right"><strong className="block text-base font-black tabular-nums">{formatUsd(arka.totalFiat)}</strong><span className="mt-1 block text-xs font-semibold text-arka-muted">≈ {formatNim(arka.totalNimEstimate)}</span><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status.classes}`}>{status.label}</span></span>
                  <ChevronRight size={19} className="shrink-0 text-[#9b9da5]" />
                </span>
                <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-[#eee9df]" aria-hidden="true"><span className="block h-full rounded-full bg-[#e9b213]" style={{ width: `${progress}%` }} /></span>
              </Link>
            )
          }) : <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-[#decbae] bg-white/60 p-6 text-center" role="status"><div><Inbox className="mx-auto text-[#a26d00]" size={28} /><p className="mt-3 text-base font-black">No {activeFilter} Arkas yet</p><p className="mt-1 text-sm font-semibold text-arka-muted">Matching Arkas will appear here.</p></div></div>}
        </section>
      </ScreenContainer>
    </MobileScreen>
  )
}
