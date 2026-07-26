import type { Arka } from '../../types/arka'
import { calculateArkaProgress } from '../../lib/arka/calculateArkaProgress'
import { formatNim, formatUsd } from '../../lib/arka/formatMoney'
import { Card } from '../ui/Card'

export function ArkaAmountHero({ arka, mode = 'total' }: { arka: Arka; mode?: 'total' | 'collected' }) {
  const progress = calculateArkaProgress(arka)
  const fiat = mode === 'collected' ? progress.collectedFiat : arka.totalFiat
  const nim = mode === 'collected' ? progress.collectedNim : arka.totalNimEstimate

  return (
    <Card className="relative overflow-hidden bg-[#fffdf7]">
      <div className="arka-hex-pattern absolute -right-10 -top-8 size-40 opacity-35" />
      <div className="relative space-y-3">
        <p className="text-sm font-bold text-arka-muted">{mode === 'collected' ? 'Collected by host' : 'Arka total'}</p>
        <div>
          <p className="text-5xl font-black leading-none tracking-[-0.02em] text-arka-text">{formatUsd(fiat)}</p>
          <p className="mt-2 text-sm font-bold text-arka-gold-dark">~ {formatNim(nim)}</p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[#efeee9]" aria-label={`${progress.progressPercent}% collected`}>
          <div className="h-full rounded-full bg-linear-to-r from-[#E9B213] to-[#43db71]" style={{ width: `${progress.progressPercent}%` }} />
        </div>
        <p className="text-sm font-semibold text-arka-muted">
          {progress.paidMemberCount} of {progress.memberCount} paid
        </p>
      </div>
    </Card>
  )
}

