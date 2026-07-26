import type { ReactNode } from 'react'
import { Card } from '../ui/Card'
import { NimiqAlertCircle } from '../ui/NimiqIcon'

type ErrorTone = 'error' | 'warning' | 'neutral'

const toneStyles: Record<ErrorTone, { halo: string; icon: string }> = {
  error: {
    halo: 'border-[#efb7b1] bg-[#ffdad6]',
    icon: 'text-[#a81212]',
  },
  warning: {
    halo: 'border-[#f3cf70] bg-[#fff0c9]',
    icon: 'text-[#8b6100]',
  },
  neutral: {
    halo: 'border-[#d8c9b5] bg-[#f5f2ec]',
    icon: 'text-[#504534]',
  },
}

export function ErrorState({
  title,
  message,
  icon,
  tone = 'error',
  details,
  primary,
  secondary,
}: {
  title: string
  message: string
  icon?: ReactNode
  tone?: ErrorTone
  details?: ReactNode
  primary: ReactNode
  secondary?: ReactNode
}) {
  const styles = toneStyles[tone]

  return (
    <section className="mx-auto w-full max-w-sm space-y-6 text-center" role="alert" aria-live="assertive">
      <div className={`mx-auto grid size-24 place-items-center rounded-full border ${styles.halo} ${styles.icon}`}>
        {icon ?? <NimiqAlertCircle size={42} />}
      </div>

      <div className="mx-auto max-w-xs">
        <h1 className="arka-page-title">{title}</h1>
        <p className="mt-3 text-base font-semibold leading-6 text-arka-muted">{message}</p>
      </div>

      {details ? <Card className="p-4 text-left">{details}</Card> : null}

      <div className="space-y-2.5 pt-1">
        {primary}
        {secondary}
      </div>
    </section>
  )
}
