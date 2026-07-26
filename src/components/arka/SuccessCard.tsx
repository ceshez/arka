import {
  CheckCircle2,
  FileCheck2,
  UsersRound,
} from 'lucide-react'
import { calculateArkaProgress } from '../../lib/arka/calculateArkaProgress'
import { arkaCategoryIcons } from '../../lib/arka/categoryIcons'
import { formatNim, formatUsd, formatUsdt } from '../../lib/arka/formatMoney'
import type { Arka, ArkaMember, AssetSymbol } from '../../types/arka'
import type { Payment } from '../../types/payment'
import { Card } from '../ui/Card'
import { SuccessCheck } from './SuccessCheck'

function ProgressRing({ value }: { value: number }) {
  const radius = 17
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference

  return (
    <svg aria-hidden="true" className="size-10 -rotate-90" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r={radius} fill="none" stroke="#eee8dc" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        stroke="#e9a713"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth="4"
      />
    </svg>
  )
}

export function SuccessCard({
  arka,
  member,
  asset,
  payment,
}: {
  arka: Arka
  member: ArkaMember
  asset: AssetSymbol
  payment?: Payment
}) {
  const progress = calculateArkaProgress(arka)
  const CategoryIcon = arkaCategoryIcons[arka.metadata?.category ?? 'custom']
  const paidFiat = payment?.amountFiat ?? member.amountDueFiat
  const assetAmount = asset === 'NIM'
    ? formatNim(payment?.amountNim ?? member.amountDueNim)
    : formatUsdt(payment?.amountUsdt ?? member.amountDueUsdt ?? member.amountDueFiat)

  return (
    <div className="space-y-5 text-center" role="status" aria-live="polite">
      <div className="pt-2"><SuccessCheck label="Payment confirmed" /></div>

      <div>
        <h1 className="arka-page-title">Payment sent</h1>
        <p className="mt-2 text-base font-semibold text-arka-muted">Your share was paid successfully.</p>
      </div>

      <div>
        <p className="text-5xl font-black leading-none tracking-[-0.03em] text-arka-text">
          {formatUsd(paidFiat)}
        </p>
        <p className="mt-3 text-lg font-bold text-arka-muted">≈ {assetAmount}</p>
      </div>

      <Card className="p-4 text-left">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#fff0c8] text-[#7d5700]">
            <CategoryIcon size={27} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-black text-arka-text">{arka.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-arka-muted">
              <span className="inline-flex items-center gap-1.5">
                <UsersRound size={17} className="text-[#e9a713]" />
                {progress.paidMemberCount} of {progress.memberCount} paid
              </span>
              <span className="inline-flex items-center gap-2">
                <ProgressRing value={progress.progressPercent} />
                {Math.round(progress.progressPercent)}% settled
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="flex items-center gap-3 p-4 text-left">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#f5f2ec] text-arka-text">
          <FileCheck2 size={22} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-arka-text">Payment confirmed</p>
          <p className="text-sm font-semibold text-arka-muted">Saved to this Arka through Nimiq Pay.</p>
        </div>
        <CheckCircle2 aria-hidden="true" className="shrink-0 text-[#168039]" size={21} />
      </Card>
    </div>
  )
}
