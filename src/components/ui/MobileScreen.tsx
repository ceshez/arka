import { useLayoutEffect, useRef, useState, type FocusEvent, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils/cn'
import { isNimiqPayEnvironment } from '../../lib/nimiq/detectNimiqEnvironment'
import { BottomNav } from '../layout/BottomNav'
import { MobileScreenOverlayContext } from './MobileScreenOverlayContext'

function isTextEntryTarget(target: EventTarget | null) {
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'color', 'file', 'hidden', 'radio', 'range', 'reset', 'submit'].includes(target.type)
  }
  return target instanceof HTMLElement && target.isContentEditable
}

export function MobileScreen({
  children,
  className,
  withBottomAction = false,
  showBottomNav = true,
  scrollable = true,
  appearance = 'default',
}: {
  children: ReactNode
  className?: string
  withBottomAction?: boolean
  showBottomNav?: boolean
  scrollable?: boolean
  appearance?: 'default' | 'home'
}) {
  const usesHomeAppearance = appearance === 'home'
  const isEmbeddedInNimiqPay = isNimiqPayEnvironment()
  const { pathname } = useLocation()
  const viewportRef = useRef<HTMLElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [overlayRoot, setOverlayRoot] = useState<HTMLDivElement | null>(null)
  const [isEditingText, setIsEditingText] = useState(false)

  const bottomPaddingClass = isEditingText
    ? 'pb-[var(--arka-safe-bottom)]'
    : withBottomAction && showBottomNav
      ? 'pb-[calc(12rem+var(--arka-safe-bottom))]'
      : withBottomAction
        ? 'pb-[calc(6.5rem+var(--arka-safe-bottom))]'
        : showBottomNav
          ? 'pb-[calc(5.4rem+var(--arka-safe-bottom))]'
          : 'pb-[var(--arka-safe-bottom)]'

  useLayoutEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0
  }, [pathname])

  useLayoutEffect(() => {
    const visualViewport = window.visualViewport
    const syncViewportHeight = () => {
      const height = visualViewport?.height ?? window.innerHeight
      if (height > 0) viewportRef.current?.style.setProperty('--arka-viewport-height', `${Math.round(height)}px`)
    }

    syncViewportHeight()
    window.addEventListener('resize', syncViewportHeight)
    visualViewport?.addEventListener('resize', syncViewportHeight)
    visualViewport?.addEventListener('scroll', syncViewportHeight)

    return () => {
      window.removeEventListener('resize', syncViewportHeight)
      visualViewport?.removeEventListener('resize', syncViewportHeight)
      visualViewport?.removeEventListener('scroll', syncViewportHeight)
    }
  }, [])

  function handleFocusCapture(event: FocusEvent<HTMLElement>) {
    if (isTextEntryTarget(event.target)) setIsEditingText(true)
  }

  function handleBlurCapture() {
    setIsEditingText(false)
  }

  return (
    <MobileScreenOverlayContext.Provider value={overlayRoot}>
      <main
        ref={viewportRef}
        data-editing={isEditingText ? 'true' : undefined}
        data-nimiq-pay={isEmbeddedInNimiqPay ? 'true' : undefined}
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
        className={cn(
          'arka-mobile-viewport arka-app-viewport relative isolate w-screen max-w-full overflow-hidden px-0 text-arka-text',
          usesHomeAppearance ? 'bg-arka-bg' : 'bg-arka-bg sm:bg-[#e9e8e3]',
        )}
      >
        <div
          ref={scrollContainerRef}
          className={cn(
            'arka-screen-scroll relative mx-auto flex h-full max-h-full min-h-0 w-full max-w-[430px] flex-col overflow-x-hidden bg-arka-bg',
            scrollable
              ? 'touch-pan-y overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]'
              : 'touch-auto overflow-y-hidden',
            !usesHomeAppearance && 'sm:border-x sm:border-[#ded8cd] sm:shadow-[0_0_24px_rgba(27,28,25,0.08)]',
            bottomPaddingClass,
            className,
          )}
        >
          <div className="arka-hex-pattern pointer-events-none absolute -right-14 top-10 size-52 opacity-35" />
          <div className="arka-hex-pattern pointer-events-none absolute bottom-0 -left-14 size-40 opacity-30" />
          {!usesHomeAppearance ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_50%_0%,rgba(247,181,45,0.18),transparent_68%)]" />
          ) : null}
          {children}
        </div>
        <div ref={setOverlayRoot} className="pointer-events-none absolute inset-0 z-40" data-arka-overlay-root />
        {showBottomNav ? <BottomNav /> : null}
      </main>
    </MobileScreenOverlayContext.Provider>
  )
}
