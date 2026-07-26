import { Activity, Hexagon, Home, Layers3, Plus, UserRound, type LucideIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { getArkaActivity } from '../../lib/arka/getArkaActivity'
import { useArkaStore } from '../../store/arkaStore'
import { useActivityStore } from '../../store/activityStore'
import { cn } from '../../lib/utils/cn'

const navItems: Array<{ to: string; label: string; icon: LucideIcon; center?: boolean }> = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/arkas', label: 'Arkas', icon: Layers3 },
  { to: '/create', label: 'Create', icon: Plus, center: true },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

function isActivePath(pathname: string, to: string) {
  if (to === '/arkas' && pathname.startsWith('/arka/')) return true
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)
}

export function BottomNav() {
  const { pathname } = useLocation()
  const arkas = useArkaStore((state) => state.arkas)
  const lastSeenAt = useActivityStore((state) => state.lastSeenAt)
  const unreadActivityCount = arkas.flatMap(getArkaActivity).filter((event) => !lastSeenAt || Date.parse(event.occurredAt) > Date.parse(lastSeenAt)).length

  return (
    <nav aria-label="Primary" className="arka-primary-nav absolute inset-x-0 bottom-[var(--arka-safe-bottom)] z-30 mx-auto w-full max-w-[430px] px-3">
      <div className="arka-primary-nav__surface rounded-[1.45rem] border border-[#e5ddd0] bg-[rgba(255,255,252,0.95)] px-1.5 py-1.5 shadow-[0_14px_34px_rgba(27,28,25,0.13)] backdrop-blur-xl">
        <div className="arka-primary-nav__brand" aria-hidden="true">
          <img src="/brand/arka-wordmark-v2-cropped.png" alt="" />
          <span>Shared moments, paid together.</span>
        </div>
        <div className="arka-primary-nav__items grid grid-cols-5 items-end">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.to)
            const Icon = item.icon

            if (item.center) {
              return (
                <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} aria-label="Create Arka" className="arka-primary-nav__item arka-primary-nav__item--create relative -mt-6 flex flex-col items-center gap-0.5">
                  <span className="arka-primary-nav__create-icon relative grid size-[52px] place-items-center rounded-[1.05rem] border-[5px] border-arka-bg bg-[#1b1c19] text-[#f7c842] shadow-[0_8px_20px_rgba(27,28,25,0.24)] transition active:scale-95">
                    <Hexagon size={27} strokeWidth={1.8} />
                    <Icon className="absolute" size={15} strokeWidth={3} />
                  </span>
                  <span className="text-[10px] font-bold text-arka-muted">{item.label}</span>
                </Link>
              )
            }

            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn('arka-primary-nav__item flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-center transition active:scale-95', active ? 'bg-[#fff2ca] text-[#7d5700]' : 'text-[#77766f]')}
              >
                <span className="relative"><Icon size={19} strokeWidth={active ? 2.5 : 1.9} />{item.to === '/activity' && unreadActivityCount > 0 ? <span className="absolute -right-2 -top-1 grid min-w-4 place-items-center rounded-full border-2 border-white bg-[#c7362f] px-0.5 text-[9px] font-black leading-4 text-white">{unreadActivityCount > 9 ? '9+' : unreadActivityCount}</span> : null}</span>
                <span className="text-[10px] font-bold">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
