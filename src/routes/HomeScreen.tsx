import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { ArrowRight, ChevronRight, Gift, Hexagon, Plus, QrCode, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MemberIdenticon } from '../components/arka/MemberIdenticon'
import { HomeArkasHeader } from '../components/arka/HomeArkasHeader'
import { YourPeopleSheet } from '../components/arka/YourPeopleSheet'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Button } from '../components/ui/Button'
import { MobileScreen } from '../components/ui/MobileScreen'
import { arkaCategoryIcons } from '../lib/arka/categoryIcons'
import { formatWalletAddress } from '../lib/arka/formatWalletAddress'
import { getSharedContacts } from '../lib/arka/getSharedContacts'
import { useArkaStore } from '../store/arkaStore'
import { useWalletStore } from '../store/walletStore'
import { getArkaDestination } from './routeUtils'

export function HomeScreen() {
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [nimEarnOpen, setNimEarnOpen] = useState(false)
  const arkas = useArkaStore((state) => state.arkas)
  const currentGuestMemberId = useArkaStore((state) => state.currentGuestMemberId)
  const guestMemberIdsByArka = useArkaStore((state) => state.guestMemberIdsByArka)
  const remoteHostSecrets = useArkaStore((state) => state.remoteHostSecrets)
  const recentArkas = useArkaStore((state) => state.recentArkas)
  const wallet = useWalletStore((state) => state.wallet)
  const walletAddress = wallet?.address
  const visibleArkas = wallet ? arkas : []
  const visibleRecentArkas = wallet ? recentArkas : []
  const sharedContacts = useMemo(
    () => getSharedContacts(walletAddress ? arkas : [], {
      walletAddress,
      memberId: currentGuestMemberId,
    }),
    [arkas, currentGuestMemberId, walletAddress],
  )
  const activeArka = [...visibleRecentArkas].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0]
  const ActiveArkaIcon = arkaCategoryIcons[activeArka?.category ?? 'custom']
  const activeArkaRecord = activeArka ? visibleArkas.find((arka) => arka.id === activeArka.id) : undefined
  const activeArkaLink = activeArkaRecord
    ? getArkaDestination(activeArkaRecord, {
        walletAddress,
        guestMemberId: guestMemberIdsByArka[activeArkaRecord.id],
        hasHostSecret: Boolean(remoteHostSecrets[activeArkaRecord.id]),
      })
    : '/'
  const progress = activeArka
    ? Math.min(100, Math.round((activeArka.collectedFiat / activeArka.totalFiat) * 100))
    : 0
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
          <p className="text-[11px] font-extrabold uppercase tracking-[0.17em] text-arka-muted">Hello, {walletAddress ? formatWalletAddress(walletAddress) : 'there'}</p>
          <h1 className="mt-1 max-w-[330px] text-balance text-[32px] font-black leading-[1.08] tracking-[-0.035em]">Shared moments, paid together.</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-arka-muted">Create a shared tab, invite your people, and settle with NIM.</p>
        </section>

        <button
          type="button"
          className="relative mt-6 w-full overflow-hidden rounded-2xl bg-[#111214] bg-cover bg-right-bottom bg-no-repeat p-5 text-left text-white shadow-[0_8px_20px_rgba(27,28,25,0.15)] transition active:scale-[0.99]"
          style={{ backgroundImage: "linear-gradient(90deg, rgba(11,12,13,0.96) 0%, rgba(11,12,13,0.72) 52%, rgba(11,12,13,0.08) 100%), url('/brand/arka-card-texture-cropped.png')" }}
          aria-label="Open NIM earn details"
          onClick={() => setNimEarnOpen(true)}
        >
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#f7c842]">NIM rewards</p>
              <h2 className="mt-3 text-[38px] font-black leading-none tracking-[-0.035em] !text-white">
                NIM earn
              </h2>
              <p className="mt-2 text-xs font-semibold text-white/65">Pay with NIM, earn 3% cashback.</p>
            </div>
            {wallet
              ? <MemberIdenticon seed={wallet.address} className="size-12 shrink-0 bg-transparent shadow-none" />
              : <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-[#f7c842]"><Gift size={23} /></span>}
          </div>
        </button>
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
                {sharedContacts.slice(0, 5).map((contact) => <MemberIdenticon key={contact.id} seed={contact.avatarSeed} className="size-11 border-[3px] border-white shadow-none" />)}
              </div>
              <span className="grid size-10 place-items-center rounded-xl bg-[#f5f1e9] text-arka-muted"><UsersRound size={19} /></span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm font-bold">{sharedContacts.length} {sharedContacts.length === 1 ? 'person' : 'people'} across your Arkas</p>
              <ChevronRight size={18} className="text-arka-muted" />
            </div>
          </button>
        </section>

          </div>
        </div>
      </motion.div>
      <YourPeopleSheet open={peopleOpen} onClose={() => setPeopleOpen(false)} />
      <BottomSheet open={nimEarnOpen} onClose={() => setNimEarnOpen(false)} eyebrow="NIM earn" title="Pay with NIM, earn 3% cashback">
        <div className="rounded-2xl border border-[#e7c95e] bg-[#fff3c7] p-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#1b1c19] text-[#f7c842]"><Gift size={23} /></span>
          <p className="mt-4 text-base font-black text-[#111b25]">A reward for paying together</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-arka-muted">
            Eligible confirmed NIM contributions earn 3% cashback. The host sends the reward as a separate payment that you confirm in Nimiq Pay.
          </p>
        </div>
        <Button type="button" className="mt-4" onClick={() => setNimEarnOpen(false)}>Got it</Button>
      </BottomSheet>
    </MobileScreen>
  )
}
