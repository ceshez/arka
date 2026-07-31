import { CalendarDays, DollarSign, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatNim, formatUsd, formatUsdt } from '../../lib/arka/formatMoney'
import { formatPublicIdentity } from '../../lib/arka/formatWalletAddress'
import { getRemainingPaymentAmounts } from '../../lib/payments/getRemainingPaymentAmounts'
import type { Arka, ArkaMember, AssetSymbol } from '../../types/arka'
import { Card } from '../ui/Card'
import { NimiqHexagon } from '../ui/NimiqIcon'

function SummaryIcon({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#fff0c8] text-[#7d5700]">
      {children}
    </span>
  )
}

function SummaryRow({
  icon,
  label,
  children,
  last = false,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
  last?: boolean
}) {
  return (
    <div className={`flex items-center gap-4 px-4 py-4 ${last ? '' : 'border-b border-[#eee3d1]'}`}>
      <SummaryIcon>{icon}</SummaryIcon>
      <div className="min-w-0 flex-1">
        <dt className="text-sm font-semibold text-arka-muted">{label}</dt>
        <dd className="mt-0.5 min-w-0 text-lg font-extrabold leading-tight text-arka-text">{children}</dd>
      </div>
    </div>
  )
}

export function PaymentSummaryCard({
  arka,
  member,
  asset,
}: {
  arka: Arka
  member: ArkaMember
  asset: AssetSymbol
}) {
  const host = arka.members.find((candidate) => candidate.role === 'host' || candidate.userId === arka.hostId)
  const usesSharedFund = arka.fundingMode === 'shared-wallet'
  const recipient = usesSharedFund
    ? `Shared fund · ${arka.name}`
    : host
      ? formatPublicIdentity(host.displayName, host.walletAddress ?? arka.hostWalletAddress)
      : 'Host wallet'
  const remaining = getRemainingPaymentAmounts(member)
  const assetAmount = asset === 'NIM'
    ? formatNim(remaining.amountNim)
    : formatUsdt(remaining.amountUsdt)

  return (
    <Card className="overflow-hidden p-0">
      <dl>
        <SummaryRow icon={<DollarSign size={24} strokeWidth={2.1} />} label="Amount">
          <span className="block text-3xl font-black tracking-[-0.03em]">{formatUsd(remaining.amountFiat)}</span>
          <span className="mt-1 block text-base font-semibold tracking-normal text-arka-muted">
            ≈ {assetAmount}
          </span>
        </SummaryRow>

        <SummaryRow icon={<UserRound size={23} strokeWidth={2.1} />} label="Recipient">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate">{recipient}</span>
            <span className="rounded-full bg-[#fff4d7] px-2.5 py-1 text-sm font-bold text-[#7d5700]">
              {usesSharedFund ? 'Shared wallet' : 'Host wallet'}
            </span>
          </span>
        </SummaryRow>

        <SummaryRow icon={<NimiqHexagon size={23} />} label="Asset">
          {asset}
        </SummaryRow>

        <SummaryRow icon={<CalendarDays size={23} strokeWidth={2.1} />} label="For" last>
          <span className="block truncate">{arka.name}</span>
        </SummaryRow>
      </dl>
    </Card>
  )
}
