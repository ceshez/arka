import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { ArrowRight, CircleHelp, ChevronRight, Gift, Hexagon, LoaderCircle, Plus, QrCode, ShieldCheck, UsersRound, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MemberIdenticon } from '../components/arka/MemberIdenticon'
import { HomeArkasHeader } from '../components/arka/HomeArkasHeader'
import { YourPeopleSheet } from '../components/arka/YourPeopleSheet'
import { Button } from '../components/ui/Button'
import { MobileScreen } from '../components/ui/MobileScreen'
import { arkaCategoryIcons } from '../lib/arka/categoryIcons'
import { formatNimEstimate } from '../lib/arka/formatMoney'
import { formatWalletAddress } from '../lib/arka/formatWalletAddress'
import { getSharedContacts } from '../lib/arka/getSharedContacts'
import { calculateArkaProgress } from '../lib/arka/calculateArkaProgress'
import { getConfirmedCashbackSummary } from '../lib/payments/cashback'
import { useArkaStore } from '../store/arkaStore'
import { useProfileStore } from '../store/profileStore'
import { useWalletStore } from '../store/walletStore'
import { getArkaDestination } from './routeUtils'
import { useArkaWalkthrough } from '../components/arka/ArkaWalkthroughContext'

export function HomeScreen() {
  const [peopleOpen, setPeopleOpen] = useState(false)
  const arkas = useArkaStore((state) => state.arkas)
  const currentGuestMemberId = useArkaStore((state) => state.currentGuestMemberId)
  const guestMemberIdsByArka = useArkaStore((state) => state.guestMemberIdsByArka)
  const remoteHostSecrets = useArkaStore((state) => state.remoteHostSecrets)
  const payments = useArkaStore((state) => state.payments)
  const wallet = useWalletStore((state) => state.wallet)
  const displayName = useProfileStore((state) => state.displayName)
  const walletStatus = useWalletStore((state) => state.status)
  const walletError = useWalletStore((state) => state.error)
  const connectWallet = useWalletStore((state) => state.connect)
  const { openWalkthrough } = useArkaWalkthrough()
  const walletAddress = wallet?.address
  const visibleArkas = useMemo(() => wallet ? arkas : [], [arkas, wallet])
  const confirmedCashback = useMemo(
    () => getConfirmedCashbackSummary(visibleArkas, payments, walletAddress),
    [payments, visibleArkas, walletAddress],
  )
  const sharedContacts = useMemo(
    () => getSharedContacts(walletAddress ? arkas : [], {
      walletAddress,
      memberId: currentGuestMemberId,
    }),
    [arkas, currentGuestMemberId, walletAddress],
  )
  const activeArkaRecord = [...visibleArkas].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0]
  const activeArka = activeArkaRecord
    ? {
        ...activeArkaRecord,
        paidMemberCount: calculateArkaProgress(activeArkaRecord).paidMemberCount,
        memberCount: calculateArkaProgress(activeArkaRecord).memberCount,
      }
    : undefined
  const ActiveArkaIcon = arkaCategoryIcons[activeArka?.metadata?.category ?? 'custom']
  const activeArkaLink = activeArka
    ? getArkaDestination(activeArka, {
        walletAddress,
        guestMemberId: guestMemberIdsByArka[activeArka.id],
        hasHostSecret: Boolean(remoteHostSecrets[activeArka.id]),
      })
    : '/'
  const activeProgress = activeArka ? calculateArkaProgress(activeArka) : undefined
  const progress = activeProgress ? Math.round(activeProgress.progressPercent) : 0
  const treasuryAddress = import.meta.env.VITE_CASHBACK_TREASURY_ADDRESS?.trim()
  const isTreasuryWallet = Boolean(walletAddress && treasuryAddress)
    && walletAddress?.replace(/\s+/g, '').toUpperCase() === treasuryAddress?.replace(/\s+/g, '').toUpperCase()
  return (
    <MobileScreen className="bg-[#faf9f4]">
      <motion.div
        className="arka-home-content relative z-10 px-5 pb-5 pt-[calc(1rem+var(--arka-safe-top))]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        <HomeArkasHeader />

        <div className="arka-home-hero-grid">
        <section className="mt-7" data-tour="arka-intro">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.17em] text-arka-muted">Hello, {displayName || (walletAddress ? formatWalletAddress(walletAddress) : 'there')}</p>
          <h1 className="mt-1 max-w-[330px] text-balance text-[32px] font-black leading-[1.08] tracking-[-0.035em]">Shared moments, paid together.</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-arka-muted">Create a shared tab, invite your people, and settle with NIM.</p>
        </section>

        <section
          className="relative mt-6 w-full overflow-hidden rounded-2xl bg-[#111214] bg-cover bg-right-bottom bg-no-repeat p-5 text-white shadow-[0_8px_20px_rgba(27,28,25,0.15)]"
          style={{ backgroundImage: "linear-gradient(90deg, rgba(11,12,13,0.97) 0%, rgba(11,12,13,0.78) 58%, rgba(11,12,13,0.18) 100%), url('/brand/arka-card-texture-cropped.png')" }}
          aria-labelledby="nim-earn-title"
          data-tour="nim-earn-card"
        >
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p id="nim-earn-title" className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#f7c842]">NIM earn</p>
              <p className="mt-3 text-[38px] font-black leading-none tracking-[-0.035em] text-white tabular-nums">
                {formatNimEstimate(confirmedCashback.amountNim)}
              </p>
              <p className="mt-1 text-[11px] font-bold text-white/55">Cashback received</p>
              <p className="mt-2 max-w-[250px] text-xs font-semibold leading-5 text-white/70">
                {!wallet
                  ? 'Connect your wallet to see confirmed rewards.'
                  : confirmedCashback.rewardCount > 0
                    ? `${confirmedCashback.rewardCount} ${confirmedCashback.rewardCount === 1 ? 'reward' : 'rewards'} confirmed in Nimiq Pay.`
                    : 'Confirmed cashback from your Arkas appears here.'}
              </p>
            </div>
            {wallet
              ? <MemberIdenticon seed={wallet.address} className="size-12 shrink-0 bg-transparent shadow-none" />
              : <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-[#f7c842]"><Gift size={23} /></span>}
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

        {!wallet ? <section className="mt-6 rounded-2xl border border-[#e7cf95] bg-[#fff8e6] p-4 shadow-[0_6px_16px_rgba(125,87,0,0.07)]" aria-labelledby="home-connect-wallet-title">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f7c842] text-[#422b00]"><WalletCards size={21} /></span>
            <div className="min-w-0"><h2 id="home-connect-wallet-title" className="text-base font-black">Connect your wallet</h2><p className="mt-1 text-sm font-semibold leading-5 text-arka-muted">Connect to see your Arkas and start a shared tab.</p></div>
          </div>
          {walletError ? <p className="mt-3 text-sm font-semibold text-arka-error" role="alert">{walletError}</p> : null}
          <Button type="button" className="mt-4 !min-h-12" onClick={() => void connectWallet()} disabled={walletStatus === 'connecting'}>{walletStatus === 'connecting' ? <LoaderCircle className="animate-spin" size={19} /> : <WalletCards size={19} />}{walletStatus === 'connecting' ? 'Connecting wallet...' : 'Connect wallet'}</Button>
        </section> : null}

        <section className="mt-3 grid grid-cols-2 gap-3" aria-label="Main actions">
          <Link to="/create" data-tour="create-arka-action" className="flex min-h-[78px] items-center gap-3 rounded-xl bg-[#f7c842] p-3.5 text-[#271900] shadow-[0_4px_8px_rgba(125,87,0,0.15)] active:scale-[0.98]">
            <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-white/55"><Hexagon size={24} /><Plus className="absolute" size={13} strokeWidth={3} /></span>
            <span><strong className="block text-sm font-black">Create Arka</strong><span className="text-[11px] font-semibold opacity-70">Start together</span></span>
          </Link>
          <Link to="/join" data-tour="join-arka-action" className="flex min-h-[78px] items-center gap-3 rounded-xl border border-[#e4ddd2] bg-white p-3.5 active:scale-[0.98]">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff2ca] text-[#7d5700]"><QrCode size={21} /></span>
            <span><strong className="block text-sm font-black">Join Arka</strong><span className="text-[11px] font-semibold text-arka-muted">Code or QR</span></span>
          </Link>
        </section>
        {isTreasuryWallet ? (
          <Link
            to="/cashback/treasury"
            className="mt-3 flex min-h-14 items-center gap-3 rounded-2xl border border-[#e7c95e] bg-[#fff8e7] px-4 text-sm font-black text-[#6d4b00]"
          >
            <ShieldCheck size={19} />
            Review cashback treasury
            <ChevronRight className="ml-auto" size={18} />
          </Link>
        ) : null}
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

        {wallet ? <button type="button" onClick={openWalkthrough} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#e5d5bb] bg-white/75 px-4 text-sm font-extrabold text-[#7d5700] transition active:scale-[0.98]">
          <CircleHelp size={19} /> See how Arka works again
        </button> : null}

          </div>
        </div>
      </motion.div>
      <YourPeopleSheet open={peopleOpen} onClose={() => setPeopleOpen(false)} />
    </MobileScreen>
  )
}
