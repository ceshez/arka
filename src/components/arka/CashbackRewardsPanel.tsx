import { CheckCircle2, Gift, Loader2, WalletCards } from 'lucide-react'
import { useState } from 'react'
import { formatNim } from '../../lib/arka/formatMoney'
import { formatPublicIdentity, formatWalletAddress } from '../../lib/arka/formatWalletAddress'
import {
  calculateCashbackReward,
  findConfirmedCashback,
  isCashbackEligible,
} from '../../lib/payments/cashback'
import type { Arka } from '../../types/arka'
import type { Payment } from '../../types/payment'
import { Button } from '../ui/Button'

export function CashbackRewardsPanel({
  arka,
  payments,
  onPay,
  onNotice,
}: {
  arka: Arka
  payments: Payment[]
  onPay: (memberId: string) => Promise<Payment>
  onNotice: (notice: { tone: 'success' | 'info'; title: string; message: string }) => void
}) {
  const [payingMemberId, setPayingMemberId] = useState<string | null>(null)
  const eligibleMembers = arka.members.filter(isCashbackEligible)

  async function pay(memberId: string) {
    if (payingMemberId) return
    setPayingMemberId(memberId)
    try {
      const payment = await onPay(memberId)
      if (payment.status === 'confirmed') {
        onNotice({ tone: 'success', title: 'Cashback sent', message: 'The 3% NIM reward is confirmed.' })
      } else if (payment.status === 'cancelled') {
        onNotice({ tone: 'info', title: 'Cashback cancelled', message: 'No reward was sent.' })
      } else {
        onNotice({ tone: 'info', title: 'Cashback not sent', message: payment.error?.message ?? 'Please try again.' })
      }
    } catch (error) {
      onNotice({
        tone: 'info',
        title: 'Cashback needs the host wallet',
        message: error instanceof Error ? error.message : 'Reconnect the host wallet and try again.',
      })
    } finally {
      setPayingMemberId(null)
    }
  }

  return (
    <section className="rounded-[1.3rem] border border-[#e7c95e] bg-[#fff8e7] p-4 shadow-[0_8px_20px_rgba(125,87,0,0.06)]" aria-labelledby="cashback-rewards-title">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#1b1c19] text-[#f7c842]"><Gift size={20} /></span>
        <div><h2 id="cashback-rewards-title" className="text-sm font-black">3% NIM cashback</h2><p className="mt-1 text-xs font-semibold leading-5 text-arka-muted">Paid guests receive a separate reward from the host wallet. Every payout is confirmed in Nimiq Pay.</p></div>
      </div>

      {eligibleMembers.length ? <div className="mt-3 space-y-2">
        {eligibleMembers.map((member) => {
          const reward = calculateCashbackReward(member)
          const confirmed = findConfirmedCashback(payments, arka.id, member.id)
          return <div key={member.id} className="rounded-2xl border border-[#ead9ad] bg-white p-3"><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff1c5] text-[#7d5700]"><WalletCards size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{formatPublicIdentity(member.displayName, member.walletAddress)}</p><p className="mt-0.5 truncate font-mono text-[11px] font-semibold text-arka-muted">{formatWalletAddress(member.walletAddress ?? '')}</p></div><strong className="shrink-0 text-sm font-black text-[#5f4100]">{formatNim(reward.amountNim)}</strong></div>{confirmed ? <p className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-[#eaf7ed] px-3 py-2 text-xs font-black text-[#1d6b31]"><CheckCircle2 size={15} />Cashback confirmed</p> : <Button type="button" className="mt-2 min-h-11 rounded-xl py-2 text-sm" disabled={Boolean(payingMemberId)} onClick={() => void pay(member.id)}>{payingMemberId === member.id ? <Loader2 className="animate-spin" size={16} /> : <Gift size={16} />}{payingMemberId === member.id ? 'Opening Nimiq Pay…' : 'Send 3% cashback'}</Button>}</div>
        })}
      </div> : <p className="mt-3 rounded-xl bg-white/75 px-3 py-2.5 text-xs font-semibold leading-5 text-arka-muted">Cashback payouts appear here after a guest pays with NIM.</p>}
    </section>
  )
}
