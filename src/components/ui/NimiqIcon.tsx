/* eslint-disable react-refresh/only-export-components */
import type { SVGProps } from 'react'
import { cn } from '../../lib/utils/cn'

const spriteHref = `${import.meta.env.BASE_URL}nimiq/nimiq-style.icons.svg`

export type NimiqIconName =
  | 'nq-alert-circle'
  | 'nq-alert-triangle'
  | 'nq-arrow-left'
  | 'nq-arrow-right'
  | 'nq-checkmark'
  | 'nq-checkmark-small'
  | 'nq-copy'
  | 'nq-hexagon'
  | 'nq-info-circle-small'
  | 'nq-lock-locked'
  | 'nq-plus-circle'
  | 'nq-questionmark'
  | 'nq-qr-code'
  | 'nq-scan-qr-code'
  | 'nq-transfer'

export type NimiqIconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  icon: NimiqIconName
  size?: number
  title?: string
}

export function NimiqIcon({ icon, size = 24, title, className, ...props }: NimiqIconProps) {
  const labelled = Boolean(title)

  return (
    <svg
      aria-hidden={labelled ? undefined : true}
      aria-label={title}
      focusable="false"
      role={labelled ? 'img' : 'presentation'}
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <use href={`${spriteHref}#${icon}`} xlinkHref={`${spriteHref}#${icon}`} />
    </svg>
  )
}

function createNimiqIcon(icon: NimiqIconName) {
  return function NamedNimiqIcon(props: Omit<NimiqIconProps, 'icon'>) {
    return <NimiqIcon icon={icon} {...props} />
  }
}

export const NimiqArrowLeft = createNimiqIcon('nq-arrow-left')
export const NimiqArrowRight = createNimiqIcon('nq-arrow-right')
export const NimiqAlertCircle = createNimiqIcon('nq-alert-circle')
export const NimiqCheckmark = createNimiqIcon('nq-checkmark')
export const NimiqCheckmarkSmall = createNimiqIcon('nq-checkmark-small')
export const NimiqCopy = createNimiqIcon('nq-copy')
export const NimiqHexagon = createNimiqIcon('nq-hexagon')
export const NimiqInfoCircleSmall = createNimiqIcon('nq-info-circle-small')
export const NimiqLockLocked = createNimiqIcon('nq-lock-locked')
export const NimiqPlusCircle = createNimiqIcon('nq-plus-circle')
export const NimiqQuestionmark = createNimiqIcon('nq-questionmark')
export const NimiqQrCode = createNimiqIcon('nq-qr-code')
export const NimiqScanQrCode = createNimiqIcon('nq-scan-qr-code')
export const NimiqTransfer = createNimiqIcon('nq-transfer')
