import { formatNim, formatUsd } from '../../lib/arka/formatMoney'
import { cn } from '../../lib/utils/cn'

export function Amount({
  fiat,
  nim,
  label,
  className,
}: {
  fiat: number
  nim?: number
  label?: string
  className?: string
}) {
  return (
    <div className={cn('space-y-1', className)}>
      {label ? <p className="text-xs font-bold uppercase tracking-[0.08em] text-arka-muted">{label}</p> : null}
      <p className="text-4xl font-black leading-tight text-arka-text">{formatUsd(fiat)}</p>
      {nim !== undefined ? <p className="text-sm font-bold text-arka-gold-dark">~ {formatNim(nim)}</p> : null}
    </div>
  )
}
