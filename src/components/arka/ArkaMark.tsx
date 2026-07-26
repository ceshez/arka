import { cn } from '../../lib/utils/cn'

export function ArkaMark({
  className,
  ariaLabel,
}: {
  className?: string
  ariaLabel?: string
}) {
  return (
    <svg
      className={cn('arka-mark', className)}
      viewBox="0 0 48 46"
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <polygon points="24,17 29.2,20 29.2,26 24,29 18.8,26 18.8,20" />
      <polygon points="24,5 29.2,8 29.2,14 24,17 18.8,14 18.8,8" />
      <polygon points="34.4,11 39.6,14 39.6,20 34.4,23 29.2,20 29.2,14" />
      <polygon points="34.4,23 39.6,26 39.6,32 34.4,35 29.2,32 29.2,26" />
      <polygon points="24,29 29.2,32 29.2,38 24,41 18.8,38 18.8,32" />
      <polygon points="13.6,23 18.8,26 18.8,32 13.6,35 8.4,32 8.4,26" />
      <polygon points="13.6,11 18.8,14 18.8,20 13.6,23 8.4,20 8.4,14" />
    </svg>
  )
}
