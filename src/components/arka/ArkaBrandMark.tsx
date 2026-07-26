import { cn } from '../../lib/utils/cn'

export function ArkaBrandMark({ className }: { className?: string }) {
  return (
    <img
      className={cn('block object-contain', className)}
      src="/brand/arka-logo-mark.png"
      alt=""
      aria-hidden="true"
    />
  )
}
