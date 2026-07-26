import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils/cn'
import { MobileScreenOverlayContext } from '../ui/MobileScreenOverlayContext'

export function BottomActionBar({ children, aboveBottomNav = false }: { children: ReactNode; aboveBottomNav?: boolean }) {
  const overlayRoot = useContext(MobileScreenOverlayContext)
  if (!overlayRoot) return null

  return createPortal(
    <div className={cn(
      'arka-bottom-action pointer-events-none absolute inset-x-0 z-40 mx-auto w-full max-w-[430px] bg-linear-to-t from-arka-bg via-arka-bg/96 to-transparent px-5 pt-5',
      aboveBottomNav ? 'bottom-[calc(5.4rem+var(--arka-safe-bottom))] pb-2' : 'bottom-0 pb-[var(--arka-safe-bottom)]',
    )}>
      <div className="pointer-events-auto space-y-2">{children}</div>
    </div>,
    overlayRoot,
  )
}
