import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '../../lib/utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  children: ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-linear-to-b from-[#F4CB4F] to-[#E9B213] text-[#271900] shadow-[0_8px_12px_rgba(125,87,0,0.18)]',
  secondary: 'border border-[#e0c99f] bg-white text-arka-text shadow-[0_4px_8px_rgba(27,28,25,0.05)]',
  ghost: 'bg-transparent text-arka-muted',
  danger: 'bg-[#ffdad6] text-arka-error',
}

const baseClasses =
  'inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-arka-gold-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'

export function Button({ className, variant = 'primary', children, ...props }: ButtonProps) {
  return (
    <button className={cn(baseClasses, variants[variant], className)} {...props}>
      {children}
    </button>
  )
}

export function ButtonLink({
  className,
  variant = 'primary',
  children,
  ...props
}: Omit<LinkProps, 'children'> & {
  variant?: ButtonVariant
  children: ReactNode
}) {
  return (
    <Link className={cn(baseClasses, variants[variant], className)} {...props}>
      {children}
    </Link>
  )
}
