import {
  Check,
  CheckCircle2,
  Clock3,
  DollarSign,
  Share2,
  UsersRound,
} from 'lucide-react'
import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { SuccessCheck } from '../components/arka/SuccessCheck'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { MobileScreen } from '../components/ui/MobileScreen'
import { NimiqHexagon } from '../components/ui/NimiqIcon'
import { calculateArkaProgress } from '../lib/arka/calculateArkaProgress'
import { arkaCategoryIcons } from '../lib/arka/categoryIcons'
import { formatDate, formatNim, formatUsd } from '../lib/arka/formatMoney'
import { shareArkaReceipt } from '../lib/share/createArkaReceipt'
import { useArkaStore } from '../store/arkaStore'

function getSettlementMinutes(createdAt: string, completedAt?: string) {
  if (!completedAt) return null
  const duration = new Date(completedAt).getTime() - new Date(createdAt).getTime()
  if (!Number.isFinite(duration) || duration < 0) return null
  return Math.max(1, Math.round(duration / 60_000))
}

export function CompletedArkaSummaryScreen() {
  const { arkaId } = useParams()
  const [shareFeedback, setShareFeedback] = useState('Share card')
  const arka = useArkaStore((state) => state.getArka(arkaId))

  if (!arka) return <Navigate to="/error/arka-not-found" replace />

  const activeArka = arka
  const progress = calculateArkaProgress(activeArka)
  const completionPercent = activeArka.status === 'completed' ? 100 : progress.progressPercent
  const settlementMinutes = getSettlementMinutes(activeArka.createdAt, activeArka.completedAt)
  const CategoryIcon = arkaCategoryIcons[activeArka.metadata?.category ?? 'custom']
  const returnTo = '/'

  async function shareSummary() {
    try {
      const result = await shareArkaReceipt(activeArka)
      setShareFeedback(result === 'shared' ? 'Shared' : 'Image saved')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareFeedback('Sharing unavailable')
    }
  }

  const shareFinished = shareFeedback === 'Shared' || shareFeedback === 'Image saved'

  return (
    <MobileScreen>
      <ScreenContainer>
        <ArkaHeader title="Arka completed" subtitle={activeArka.name} backTo={returnTo} />

        <section className="space-y-5 text-center" aria-labelledby="completed-title">
          <div className="pt-2"><SuccessCheck label="Arka completed and verified" /></div>

          <div>
            <h1 id="completed-title" className="arka-page-title">
              Arka completed
            </h1>
            <p className="mt-2 text-base font-semibold text-arka-muted">{activeArka.name} settled successfully.</p>
          </div>

          <Card className="mx-auto flex max-w-[260px] items-center justify-center gap-5 p-4 text-left">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#ffdc82] text-[#271900]">
              <DollarSign size={29} strokeWidth={2.1} />
            </span>
            <div>
              <p className="text-4xl font-black leading-none tracking-[-0.03em]">{formatUsd(activeArka.totalFiat)}</p>
              <p className="mt-2 text-base font-semibold text-arka-muted">≈ {formatNim(activeArka.totalNimEstimate)}</p>
            </div>
          </Card>
        </section>

        <Card className="grid grid-cols-4 divide-x divide-[#eee3d1] p-2 text-center">
          <div className="px-1 py-2">
            <span className="mx-auto grid size-10 place-items-center rounded-full bg-[#fff4d7] text-[#c88700]">
              <UsersRound size={20} />
            </span>
            <p className="mt-2 text-lg font-black">{progress.memberCount}</p>
            <p className="text-sm font-semibold leading-4 text-arka-muted">friends</p>
          </div>
          <div className="px-1 py-2">
            <span className="mx-auto grid size-10 place-items-center rounded-full bg-[#fff4d7] text-[#c88700]">
              <NimiqHexagon size={20} />
            </span>
            <p className="mt-2 text-sm font-black">{activeArka.selectedAsset}</p>
            <p className="text-sm font-semibold leading-4 text-arka-muted">used</p>
          </div>
          <div className="px-1 py-2">
            <span className="mx-auto grid size-10 place-items-center rounded-full bg-[#fff4d7] text-[#c88700]">
              <Clock3 size={20} />
            </span>
            <p className="mt-2 text-sm font-black">{settlementMinutes ? `${settlementMinutes} min` : 'Complete'}</p>
            <p className="text-sm font-semibold leading-4 text-arka-muted">settled in</p>
          </div>
          <div className="px-1 py-2">
            <span className="mx-auto grid size-10 place-items-center rounded-full bg-[#fff4d7] text-[#c88700]">
              <CheckCircle2 size={20} />
            </span>
            <p className="mt-2 text-sm font-black">{completionPercent}%</p>
            <p className="text-sm font-semibold leading-4 text-arka-muted">
              {progress.paidMemberCount} of {progress.memberCount} paid
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-4 text-left">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#fff4d7] text-[#c88700]">
            <CategoryIcon size={27} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-black text-arka-text">{activeArka.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#e8f5e8] px-2.5 py-1 text-sm font-bold text-[#167531]">Completed</span>
              <span className="text-sm font-semibold text-arka-muted">{formatDate(activeArka.completedAt)}</span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-[1.1fr_0.9fr] gap-2 pt-1">
          <ButtonLink className="!min-h-12 px-3 text-sm" to={returnTo}>Back home</ButtonLink>
          <Button className="!min-h-12 px-3 text-sm" variant="secondary" type="button" onClick={shareSummary}>
            {shareFinished ? <Check aria-hidden="true" size={19} /> : <Share2 aria-hidden="true" size={19} />}
            <span aria-live="polite">{shareFeedback}</span>
          </Button>
        </div>
      </ScreenContainer>
    </MobileScreen>
  )
}
