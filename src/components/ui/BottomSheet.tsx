import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useId, type ReactNode } from 'react'

export function BottomSheet({
  open,
  title,
  eyebrow,
  onClose,
  children,
  dismissible = true,
}: {
  open: boolean
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  dismissible?: boolean
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (dismissible && event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismissible, onClose, open])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#171814]/50 backdrop-blur-[5px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(event) => {
            if (dismissible && event.currentTarget === event.target) onClose()
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[90dvh] w-full max-w-[430px] overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-[2rem] bg-arka-bg px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-20px_60px_rgba(0,0,0,0.2)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#cbc8bf]" />
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {eyebrow ? <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-arka-muted">{eyebrow}</p> : null}
                <h2 id={titleId} className="mt-1 break-words text-2xl font-black tracking-[-0.03em]">{title}</h2>
              </div>
              {dismissible ? <button
                type="button"
                className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#e4ded3] bg-white text-arka-text transition active:scale-95"
                aria-label="Close"
                onClick={onClose}
              >
                <X size={20} />
              </button> : null}
            </header>
            <div className="mt-5">{children}</div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
