import { CalendarDays, Check, UsersRound } from 'lucide-react'
import { calculateArkaProgress } from '../../lib/arka/calculateArkaProgress'
import { arkaCategoryIcons } from '../../lib/arka/categoryIcons'
import { formatDate, formatNim, formatUsd } from '../../lib/arka/formatMoney'
import type { Arka, ArkaMember, AssetSymbol } from '../../types/arka'
import type { Payment } from '../../types/payment'
import { ArkaBrandMark } from './ArkaBrandMark'

type PaymentReceiptCardProps = {
  arka: Arka
  member: ArkaMember
  asset: AssetSymbol
  payment?: Payment
}

export function PaymentReceiptCard({ arka, member, asset, payment }: PaymentReceiptCardProps) {
  const progress = calculateArkaProgress(arka)
  const CategoryIcon = arkaCategoryIcons[arka.metadata?.category ?? 'custom']
  const paidFiat = payment?.amountFiat ?? member.amountDueFiat
  const nimAmount = payment?.amountNim ?? member.amountDueNim
  const paidAt = payment?.confirmedAt ?? member.paidAt
  const contextLabel = arka.metadata?.locationName ?? arka.description ?? 'Shared payment with friends.'

  return (
    <article className="relative overflow-hidden rounded-[1.75rem] border border-[#e5c98f] bg-[#fffdf8] text-left shadow-[0_18px_40px_rgba(125,87,0,0.16)]" aria-label={`Payment receipt for ${arka.name}`}>
      <div className="absolute -right-12 -top-16 size-36 rounded-full bg-[#fff0c8] opacity-80" aria-hidden="true" />
      <div className="absolute -bottom-20 -left-14 size-40 rounded-full border-[18px] border-[#fff5dc]" aria-hidden="true" />

      <div className="relative bg-[#1b1c19] px-5 pb-5 pt-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-xl bg-[#f7b52d] text-[#1b1c19]">
              <ArkaBrandMark className="size-8" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#f7d77e]">Arka receipt</p>
              <p className="mt-0.5 text-xs font-semibold text-white/70">Shared payments, made simple</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e6f7e9] px-2.5 py-1 text-[10px] font-black text-[#176b32]">
            <Check size={12} strokeWidth={3} /> Paid
          </span>
        </div>
      </div>

      <div className="relative px-5 pb-5 pt-6">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-arka-muted">Payment confirmed</p>
        <p className="mt-2 text-[2.75rem] font-black leading-none tracking-[-0.06em] text-arka-text">{formatUsd(paidFiat)}</p>
        <p className="mt-2 text-base font-extrabold text-[#7d5700]">≈ {formatNim(nimAmount)}</p>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#eee1c8] bg-[#fff7e7] p-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#ffe7ad] text-[#7d5700]"><CategoryIcon size={23} strokeWidth={2} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9b762b]">Arka</p>
            <p className="truncate text-base font-black text-arka-text">{arka.name}</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-arka-muted">{contextLabel}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 divide-x divide-[#eadfce] rounded-2xl border border-[#eee6d9] bg-white/70 py-3">
          <div className="min-w-0 px-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-arka-muted">Paid by</p>
            <p className="mt-1 truncate text-sm font-black text-arka-text">{member.displayName}</p>
          </div>
          <div className="min-w-0 px-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-arka-muted">Group status</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-black text-arka-text"><UsersRound size={15} className="text-[#e9a713]" /> {progress.paidMemberCount} of {progress.memberCount} paid</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-dashed border-[#e5d7bd] pt-4 text-xs font-bold text-arka-muted">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {formatDate(paidAt)}</span>
          <span className="rounded-full bg-[#f5f2ec] px-2.5 py-1 text-[10px] font-black text-arka-muted">Paid with {asset}</span>
        </div>
      </div>
    </article>
  )
}
