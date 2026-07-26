import type { ReactNode } from 'react'
import { cn } from '../../lib/utils/cn'

type BadgeTone = 'gold' | 'green' | 'blue' | 'neutral' | 'error'

const tones: Record<BadgeTone, string> = {
  gold: 'bg-[#F7E1B3] text-[#6b4a00]',
  green: 'bg-[#dcfce7] text-[#166534]',
  blue: 'bg-[#dae2fd] text-[#3f465c]',
  neutral: 'bg-arka-surface-low text-arka-muted',
  error: 'bg-[#ffdad6] text-arka-error',
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-sm font-bold', tones[tone], className)}>
      {children}
    </span>
  )
}

