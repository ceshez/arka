import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils/cn'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'w-full min-w-0 rounded-2xl border border-[#eadcc8] bg-white/95 p-5 shadow-[0_6px_12px_rgba(27,28,25,0.06)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
