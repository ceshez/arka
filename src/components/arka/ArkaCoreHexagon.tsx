import type { ReactNode } from 'react'
import { cn } from '../../lib/utils/cn'

type ArkaHexagonTone = 'brand' | 'surface'
type ArkaHexagonElevation = 'none' | 'soft' | 'hero'
type ArkaHexagonOrientation = 'vertical' | 'horizontal'

export function ArkaCoreHexagon({
  children,
  className,
  tone = 'brand',
  elevation = 'soft',
  orientation = 'vertical',
  showPattern = false,
  decorative = false,
  ariaLabel,
}: {
  children: ReactNode
  className?: string
  tone?: ArkaHexagonTone
  elevation?: ArkaHexagonElevation
  orientation?: ArkaHexagonOrientation
  showPattern?: boolean
  decorative?: boolean
  ariaLabel?: string
}) {
  return (
    <div
      className={cn(
        'arka-core-hexagon',
        `arka-core-hexagon--${tone}`,
        `arka-core-hexagon--elevation-${elevation}`,
        `arka-core-hexagon--${orientation}`,
        className,
      )}
      role={!decorative && ariaLabel ? 'img' : undefined}
      aria-label={!decorative ? ariaLabel : undefined}
      aria-hidden={decorative || undefined}
    >
      <div className="arka-core-hexagon__surface">
        {showPattern ? (
          <span className="arka-hex-pattern arka-core-hexagon__pattern" aria-hidden="true" />
        ) : null}
        <div className="arka-core-hexagon__content">{children}</div>
      </div>
    </div>
  )
}
