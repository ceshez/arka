import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils/cn'

export function ScreenContainer({ children, className }: { children: ReactNode; className?: string }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      className={cn(
        'arka-screen-container relative z-10 flex min-w-0 flex-1 flex-col gap-5 px-5 pb-5 pt-[var(--arka-content-top)]',
        className,
      )}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
