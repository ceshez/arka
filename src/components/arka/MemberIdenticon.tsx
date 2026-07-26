import { createIdenticon } from 'identicons-esm'
import { useMemo } from 'react'
import { cn } from '../../lib/utils/cn'

function normalizeIdenticonSeed(seed: string) {
  const compact = seed.replace(/\s+/g, '').toUpperCase()
  if (!/^NQ[A-Z0-9]{34}$/.test(compact)) return seed
  return compact.match(/.{1,4}/g)?.join(' ') ?? seed
}

export function MemberIdenticon({ seed, className }: { seed: string; className?: string }) {
  const src = useMemo(
    () => createIdenticon(normalizeIdenticonSeed(seed), { shouldValidateAddress: false, format: 'image/svg+xml' }),
    [seed],
  )

  return (
    <img
      src={src}
      alt=""
      className={cn('size-11 rounded-full bg-arka-surface-low object-cover', className)}
    />
  )
}
