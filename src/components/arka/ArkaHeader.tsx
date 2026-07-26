import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils/cn'
import { Badge } from '../ui/Badge'
import { NimiqArrowLeft, NimiqHexagon } from '../ui/NimiqIcon'
import { WalletStatus } from './WalletStatus'

export function ArkaHeader({
  title,
  subtitle,
  backTo,
  badge,
  brandWordmark = false,
  subtitleClassName,
  subtitleTruncate = false,
}: {
  title: string
  subtitle?: string
  backTo?: string
  badge?: string
  brandWordmark?: boolean
  subtitleClassName?: string
  subtitleTruncate?: boolean
}) {
  return (
    <header className="relative z-10 flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {backTo ? (
          <Link className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[#eadcc8] bg-white/90 text-arka-text shadow-[0_4px_8px_rgba(27,28,25,0.05)]" to={backTo} aria-label="Go back">
            <NimiqArrowLeft size={20} />
          </Link>
        ) : (
          <div className="arka-hex grid size-12 shrink-0 place-items-center bg-linear-to-b from-[#F4CB4F] to-[#E9B213] text-white shadow-[0_8px_12px_rgba(125,87,0,0.16)]">
            <NimiqHexagon size={21} fill="currentColor" />
          </div>
        )}
        <div className="min-w-0">
          {brandWordmark ? <img src="/brand/arka-wordmark-v2-cropped.png" alt="Arka" className="mb-1 h-5 w-auto max-w-[88px] object-contain" /> : null}
          <h1 className="arka-page-title truncate">{title}</h1>
          {subtitle ? (
            <p
              className={cn(
                subtitleTruncate ? 'truncate' : 'whitespace-normal leading-5',
                'text-sm font-semibold text-arka-muted',
                subtitleClassName,
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge ? <Badge tone="gold">{badge}</Badge> : null}
        <WalletStatus hideWhenDisconnected />
      </div>
    </header>
  )
}
