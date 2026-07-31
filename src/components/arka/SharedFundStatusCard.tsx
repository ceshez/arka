import { CheckCircle2, LockKeyhole, UsersRound } from 'lucide-react'
import type { Arka } from '../../types/arka'
import { getSharedWalletThreshold } from '../../lib/nimiq/sharedWalletCrypto'
import { ButtonLink } from '../ui/Button'
import { Card } from '../ui/Card'

export function SharedFundStatusCard({ arka }: { arka: Arka }) {
  if (arka.fundingMode !== 'shared-wallet') return null
  const activated = arka.members.filter((member) => member.activationStatus === 'verified').length
  const ready = arka.sharedWalletStatus === 'verified'
  const threshold = arka.approvalThreshold ?? getSharedWalletThreshold(arka.members.length)

  return (
    <Card className="mt-3 border-[#ead28c] bg-[#fffaf0] p-4">
      <div className="flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${ready ? 'bg-[#dff3e4] text-[#176832]' : 'bg-[#fff0c2] text-[#7d5700]'}`}>
          {ready ? <CheckCircle2 size={22} /> : <LockKeyhole size={21} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">{ready ? 'Shared fund verified' : 'Shared fund setup'}</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-arka-muted">
            {ready
              ? `No one person can move the fund alone. ${arka.approvalThreshold} approvals are required.`
              : `${arka.members.length} joined · ${activated} wallets activated.`}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs font-bold text-[#6f5530]">
            <UsersRound size={15} />
            <span>{threshold > 0 ? `${threshold} approvals required now` : 'Invite at least one more person'}</span>
          </div>
        </div>
      </div>
      <ButtonLink
        to={`/arka/${arka.id}/fund-setup`}
        variant={ready ? 'secondary' : 'primary'}
        className="mt-4 min-h-12"
      >
        {ready ? 'View shared fund' : 'Continue setup'}
      </ButtonLink>
    </Card>
  )
}
