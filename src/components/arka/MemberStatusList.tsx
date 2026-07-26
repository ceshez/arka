import type { ArkaMember } from '../../types/arka'
import { formatNim, formatUsd } from '../../lib/arka/formatMoney'
import { MemberIdenticon } from './MemberIdenticon'
import { Badge } from '../ui/Badge'
import { StatusPill } from '../ui/StatusPill'

export function MemberStatusList({ members }: { members: ArkaMember[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black">Members ({members.length})</p>
        <p className="text-sm font-bold text-arka-muted">
          {members.filter((member) => member.status === 'paid').length} paid
        </p>
      </div>
      {members.map((member) => (
        <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-[#eadcc8] bg-white/95 p-3 shadow-[0_4px_8px_rgba(27,28,25,0.04)]">
          <MemberIdenticon seed={member.walletAddress ?? member.userId} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-black">{member.displayName}</p>
              {member.role === 'host' ? <span className="text-sm font-bold text-arka-muted">Host</span> : null}
            </div>
            <p className="text-sm font-semibold text-arka-muted">
              {formatUsd(member.amountPaidFiat)} of {formatUsd(member.amountDueFiat)} | {formatNim(member.amountDueNim)}
            </p>
          </div>
          {member.amountDueFiat === 0 ? <Badge tone="green">Covered</Badge> : <StatusPill status={member.status} />}
        </div>
      ))}
    </div>
  )
}
