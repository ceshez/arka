import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { ArrowRight, ChevronRight, Hexagon, Plus, QrCode, Sparkles, UsersRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { MemberIdenticon } from '../components/arka/MemberIdenticon'
import { HomeArkasHeader } from '../components/arka/HomeArkasHeader'
import { YourPeopleSheet } from '../components/arka/YourPeopleSheet'
import { MobileScreen } from '../components/ui/MobileScreen'
import { arkaCategoryIcons } from '../lib/arka/categoryIcons'
import { formatNim } from '../lib/arka/formatMoney'
import { getSharedContacts } from '../lib/arka/getSharedContacts'
import { useArkaStore } from '../store/arkaStore'
import { useProfileStore } from '../store/profileStore'
import { useWalletStore } from '../store/walletStore'

export function HomeScreen() {
  const navigate = useNavigate()
  const [peopleOpen, setPeopleOpen] = useState(false)
  const startDemoArka = useArkaStore((state) => state.useDemoArka)
  const arkas = useArkaStore((state) => state.arkas)
  const currentGuestMemberId = useArkaStore((state) => state.currentGuestMemberId)
  const recentArkas = useArkaStore((state) => state.recentArkas)
  const payments = useArkaStore((state) => state.payments)
  const displayName = useProfileStore((state) => state.displayName)
  const wallet = useWalletStore((state) => state.wallet)
  const sharedContacts = useMemo(
    () => getSharedContacts(arkas, {
      walletAddress: wallet?.address,
      memberId: currentGuestMemberId,
    }),
    [arkas, currentGuestMemberId, wallet?.address],
  )
  const activeArka = [...recentArkas].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0]
  const ActiveArkaIcon = arkaCategoryIcons[activeArka?.category ?? 'custom']
  const activeArkaLink = activeArka?.status === 'completed'
    ? `/arka/${activeArka.id}/completed`
    : `/arka/${activeArka?.id}/host/summary`
  const progress = activeArka
    ? Math.min(100, Math.round((activeArka.collectedFiat / activeArka.totalFiat) * 100))
    : 0
  const cashbackNim = payments
    .filter((payment) => payment.status === 'confirmed' && payment.type === 'member-contribution' && payment.asset === 'NIM')
    .reduce((total, payment) => {
      if (!payment.amountNim || payment.amountFiat <= 0) return total
      return total + payment.amountNim * (Math.min(payment.amountFiat, 10) * 0.01 / payment.amountFiat)
    }, 0)

  const openDemo = () => {
    const arka = startDemoArka()
    navigate(`/arka/${arka.id}/guest`)
  }

  return (
    <MobileScreen className="bg-[#faf9f4]">
      <motion.div
        className="arka-home-content relative z-10 px-5 pb-5 pt-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        <HomeArkasHeader />

        <div className="arka-home-hero-grid">
        <section className="mt-7">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.17em] text-arka-muted">Hello, {displayName || 'there'}</p>
          <h1 className="mt-1 max-w-[330px] text-balance text-[32px] font-black leading-[1.08] tracking-[-0.035em]">Shared moments, paid together.</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-arka-muted">Create a shared tab, invite your people, and settle with NIM.</p>
        </section>

        <section
          className="relative mt-6 overflow-hidden rounded-2xl bg-[#111214] bg-cover bg-right-bottom bg-no-repeat p-5 text-white shadow-[0_8px_20px_rgba(27,28,25,0.15)]"
          style={{ backgroundImage: "linear-gradient(90deg, rgba(11,12,13,0.96) 0%, rgba(11,12,13,0.72) 52%, rgba(11,12,13,0.08) 100%), url('/brand/arka-card-texture-cropped.png')" }}
          aria-label="Total cashback gained"
        >
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#f7c842]">
                {wallet ? 'Your total cashback gained' : 'Your Nimiq wallet'}
              </p>
              <h2 className="mt-3 text-[38px] font-black leading-none tracking-[-0.035em] !text-white">
                {wallet ? formatNim(cashbackNim) : 'Connect wallet'}
              </h2>
              <p className="mt-2 text-xs font-semibold text-white/65">
                {wallet
                  ? cashbackNim > 0
                    ? 'Demo cashback from confirmed NIM shares.'
                    : 'Pay with NIM to see cashback earned here.'
                  : 'See your Nimiq identicon and cashback total.'}
              </p>
            </div>
            {wallet
              ? <MemberIdenticon seed={wallet.address} className="size-12 shrink-0 bg-transparent shadow-none" />
              : <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-[#f7c842]"><Hexagon size={23} /></span>}
          </div>
        </section>
        </div>

        <div className="arka-home-dashboard-grid">
          <div className="arka-home-dashboard-primary">
        {activeArka ? (
          <section className="mt-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-arka-muted">Your Arkas</p>
                <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">Continue together</h2>
              </div>
              <Link to="/arkas" className="text-xs font-black text-[#7d5700]">See all</Link>
            </div>
            <Link to={activeArkaLink} className="mt-3 flex items-center gap-3 rounded-xl border border-[#e7dfd4] bg-white p-4 active:bg-[#fffaf0]">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff2ca] text-[#7d5700]"><ActiveArkaIcon size={20} /></span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm font-black">{activeArka.name}</strong>
                <span className="mt-1 block text-xs font-semibold text-arka-muted">{activeArka.paidMemberCount} of {activeArka.memberCount} paid · {progress}% settled</span>
              </span>
              <ArrowRight size={18} className="shrink-0 text-arka-muted" />
            </Link>
          </section>
        ) : null}

        <section className="mt-3 grid grid-cols-2 gap-3" aria-label="Main actions">
          <Link to="/create" className="flex min-h-[78px] items-center gap-3 rounded-xl bg-[#f7c842] p-3.5 text-[#271900] shadow-[0_4px_8px_rgba(125,87,0,0.15)] active:scale-[0.98]">
            <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-white/55"><Hexagon size={24} /><Plus className="absolute" size={13} strokeWidth={3} /></span>
            <span><strong className="block text-sm font-black">Create Arka</strong><span className="text-[11px] font-semibold opacity-70">Start together</span></span>
          </Link>
          <Link to="/join" className="flex min-h-[78px] items-center gap-3 rounded-xl border border-[#e4ddd2] bg-white p-3.5 active:scale-[0.98]">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff2ca] text-[#7d5700]"><QrCode size={21} /></span>
            <span><strong className="block text-sm font-black">Join Arka</strong><span className="text-[11px] font-semibold text-arka-muted">Code or QR</span></span>
          </Link>
        </section>
          </div>

          <div className="arka-home-dashboard-secondary">
        <section className="mt-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-arka-muted">Your circle</p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">People you share with</h2>
            </div>
            <button type="button" onClick={() => setPeopleOpen(true)} className="text-xs font-black text-[#7d5700]">See all</button>
          </div>
          <button type="button" onClick={() => setPeopleOpen(true)} className="mt-3 block w-full rounded-xl border border-[#e7dfd4] bg-white p-4 text-left active:bg-[#fffaf0]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex -space-x-2">
                {sharedContacts.slice(0, 5).map((contact) => <MemberIdenticon key={contact.id} seed={contact.id} className="size-11 border-[3px] border-white shadow-none" />)}
              </div>
              <span className="grid size-10 place-items-center rounded-xl bg-[#f5f1e9] text-arka-muted"><UsersRound size={19} /></span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm font-bold">{sharedContacts.length} {sharedContacts.length === 1 ? 'person' : 'people'} across your Arkas</p>
              <ChevronRight size={18} className="text-arka-muted" />
            </div>
          </button>
        </section>

        <button type="button" onClick={openDemo} className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#e5ddd0] bg-[#f5f1e9] px-4 text-sm font-black text-arka-text active:scale-[0.98]">
          <Sparkles size={17} className="text-[#a46f00]" /> Try the guided demo
        </button>
          </div>
        </div>
      </motion.div>
      <YourPeopleSheet open={peopleOpen} onClose={() => setPeopleOpen(false)} />
    </MobileScreen>
  )
}
