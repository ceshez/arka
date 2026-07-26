import { Clock3, Gift } from 'lucide-react'
import type { Arka } from '../../types/arka'
import { calculateArkaProgress } from '../../lib/arka/calculateArkaProgress'
import { formatNim, formatUsd } from '../../lib/arka/formatMoney'
import { cn } from '../../lib/utils/cn'
import { ArkaCoreHexagon } from './ArkaCoreHexagon'
import { ArkaMark } from './ArkaMark'
import { MemberIdenticon } from './MemberIdenticon'
import { NimiqCheckmarkSmall, NimiqTransfer } from '../ui/NimiqIcon'

const positions = [
  'host-honeycomb-node--top',
  'host-honeycomb-node--upper-left',
  'host-honeycomb-node--upper-right',
  'host-honeycomb-node--lower-left',
  'host-honeycomb-node--lower-right',
  'host-honeycomb-node--bottom',
]

const positionsByMemberCount: Record<number, string[]> = {
  1: ['host-honeycomb-node--top'],
  2: ['host-honeycomb-node--upper-left', 'host-honeycomb-node--upper-right'],
  3: ['host-honeycomb-node--top', 'host-honeycomb-node--lower-left', 'host-honeycomb-node--lower-right'],
  4: [
    'host-honeycomb-node--upper-left',
    'host-honeycomb-node--upper-right',
    'host-honeycomb-node--lower-left',
    'host-honeycomb-node--lower-right',
  ],
  5: positions.slice(0, 5),
  6: positions,
}

export function HoneycombProgress({ arka, center = 'total' }: { arka: Arka; center?: 'total' | 'collected' }) {
  const progress = calculateArkaProgress(arka)
  const centerFiat = center === 'collected' ? progress.collectedFiat : arka.totalFiat
  const centerNim = center === 'collected' ? progress.collectedNim : arka.totalNimEstimate
  const visibleMembers = arka.members.slice(0, 6)
  const visibleMemberCount = visibleMembers.length
  const hiddenMemberCount = Math.max(0, arka.members.length - visibleMemberCount)
  const memberPositions = positionsByMemberCount[visibleMemberCount] ?? positions

  return (
    <section
      className={cn(
        'host-honeycomb',
        hiddenMemberCount > 0 && 'host-honeycomb--has-overflow',
        `host-honeycomb--count-${visibleMemberCount}`,
      )}
      aria-label={`Arka member payment status, ${arka.members.length} ${arka.members.length === 1 ? 'member' : 'members'}`}
    >
      <ArkaCoreHexagon
        className="host-honeycomb-center-hexagon"
        elevation="hero"
        orientation="horizontal"
        showPattern
        ariaLabel={`${center === 'collected' ? 'Collected' : 'Total Arka'} ${formatUsd(centerFiat)}, approximately ${formatNim(centerNim)}`}
      >
        <p className="host-honeycomb-center-label">{center === 'collected' ? 'Collected' : 'Total Arka'}</p>
        <p className="host-honeycomb-center-amount">{formatUsd(centerFiat).replace('.00', '')}</p>
        <p className="host-honeycomb-center-nim">~ {formatNim(centerNim)}</p>
        <ArkaMark className="host-honeycomb-center-mark" />
      </ArkaCoreHexagon>

      {visibleMembers.map((member, index) => {
        const status = member.status === 'paid' ? 'paid' : member.status === 'partial' ? 'partial' : 'pending'
        const isTreating = arka.splitMethod === 'sponsor' && member.amountDueFiat === arka.totalFiat
        const isCovered = arka.splitMethod === 'sponsor' && member.amountDueFiat === 0
        const displayStatus = isTreating ? 'treating' : isCovered ? 'covered' : status
        const displayAmount = isTreating ? member.amountDueFiat : member.amountPaidFiat

        return (
          <div key={member.id} className={cn('host-honeycomb-node', `is-${displayStatus}`, memberPositions[index])}>
            <div className="host-honeycomb-member">
              <MemberIdenticon
                seed={member.walletAddress ?? member.userId}
                className="host-honeycomb-avatar"
              />
              <p className="host-honeycomb-handle">@{member.displayName.toLowerCase().replaceAll(' ', '')}</p>
              <p className="host-honeycomb-member-amount">{formatUsd(displayAmount)}</p>
              <span className="host-honeycomb-status">
                {isTreating ? (
                  <><Gift size={12} /> Treating</>
                ) : isCovered ? (
                  <><NimiqCheckmarkSmall size={12} /> Covered</>
                ) : member.status === 'paid' ? (
                  <><NimiqCheckmarkSmall size={12} /> Paid</>
                ) : member.status === 'partial' ? (
                  <><NimiqTransfer size={12} /> Partial</>
                ) : (
                  <><Clock3 size={12} /> Pending</>
                )}
              </span>
            </div>
          </div>
        )
      })}

      {hiddenMemberCount > 0 ? (
        <p className="host-honeycomb-overflow">+{hiddenMemberCount} more guests in the list below</p>
      ) : null}
    </section>
  )
}
