import { Check, Gift, LockKeyhole, PencilLine, Percent, PieChart, RefreshCcw, UsersRound, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { calculatePercentageAmounts, createEqualPercentages, redistributeManualPercentages } from '../../lib/arka/percentageSplits'
import { formatNim, formatUsd } from '../../lib/arka/formatMoney'
import { hasMemberContributions } from '../../lib/arka/splitCalculations'
import { playSuccessChime } from '../../lib/ui/sounds'
import { cn } from '../../lib/utils/cn'
import { splitMethods, type Arka, type SplitMethodType } from '../../types/arka'
import type { ToastNotice } from '../ui/ArkaToast'
import { Button } from '../ui/Button'
import { MemberIdenticon } from './MemberIdenticon'

const splitMethodIcons: Partial<Record<SplitMethodType, LucideIcon>> = { equal: UsersRound, custom: PieChart, sponsor: Gift }
const visibleSplitMethods = splitMethods.filter((method) => ['equal', 'custom', 'sponsor'].includes(method.type))
const splitMethodDescriptions: Partial<Record<SplitMethodType, string>> = { equal: 'Everyone pays the same', custom: 'Set percentages', sponsor: 'One person is chosen' }
type SponsorStage = 'ready' | 'spinning' | 'winner'
const wheelSpinDuration = 6500
const wheelWinnerHoldDuration = 3200

function createStoredPercentages(arka: Arka) {
  if (arka.totalFiat <= 0 || arka.members.length === 0) return createEqualPercentages(arka.members.length)
  let allocated = 0
  return arka.members.map((member, index) => {
    if (index === arka.members.length - 1) return Math.max(0, Number((100 - allocated).toFixed(2)))
    const percentage = Number(((member.amountDueFiat / arka.totalFiat) * 100).toFixed(2))
    allocated = Number((allocated + percentage).toFixed(2))
    return percentage
  })
}

function buildWheelBackground(count: number) {
  const colors = ['#F6C95F', '#F3A58E', '#A9D9C8', '#BFC8F1', '#E8B8D2', '#F5E5A8']
  const segment = 360 / Math.max(1, count)
  return `conic-gradient(${Array.from({ length: count }, (_, index) => `${colors[index % colors.length]} ${index * segment}deg ${(index + 1) * segment}deg`).join(',')})`
}

type HostSplitMethodPanelProps = {
  arka: Arka
  onMethodChange: (method: SplitMethodType) => void
  onCustomApply: (percentages: number[]) => void
  onSponsorSelected: (memberId?: string) => void
  onNotify: (notice: Omit<ToastNotice, 'id'>) => void
}

export function HostSplitMethodPanel({ arka, onMethodChange, onCustomApply, onSponsorSelected, onNotify }: HostSplitMethodPanelProps) {
  const persistedSponsor = arka.splitMethod === 'sponsor' ? arka.members.find((member) => member.amountDueFiat >= arka.totalFiat - 0.01) : undefined
  const [percentages, setPercentages] = useState(() => createStoredPercentages(arka))
  const [manualMemberIds, setManualMemberIds] = useState<Set<string>>(() => new Set())
  const [isCustomFormOpen, setIsCustomFormOpen] = useState(() => arka.splitMethod === 'custom')
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>(persistedSponsor?.id)
  const [candidateMemberId, setCandidateMemberId] = useState<string | undefined>(persistedSponsor?.id)
  const [sponsorStage, setSponsorStage] = useState<SponsorStage>('ready')
  const [wheelRotation, setWheelRotation] = useState(0)
  const revealTimerRef = useRef<number | undefined>(undefined)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const splitIsLocked = hasMemberContributions(arka.members)
  const effectivePercentages = percentages.length === arka.members.length ? percentages : createEqualPercentages(arka.members.length)
  const fiatAmounts = calculatePercentageAmounts(arka.totalFiat, effectivePercentages)
  const nimAmounts = calculatePercentageAmounts(arka.totalNimEstimate, effectivePercentages)
  const selectedMember = arka.members.find((member) => member.id === selectedMemberId)
  const candidateMember = arka.members.find((member) => member.id === candidateMemberId)
  const wheelBackground = buildWheelBackground(arka.members.length)

  useEffect(() => {
    const overlayOpen = sponsorStage === 'spinning' || sponsorStage === 'winner'
    if (!overlayOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      window.clearTimeout(revealTimerRef.current)
      window.clearTimeout(closeTimerRef.current)
      setSponsorStage('ready')
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [sponsorStage])

  useEffect(() => () => {
    window.clearTimeout(revealTimerRef.current)
    window.clearTimeout(closeTimerRef.current)
  }, [])

  function handleMethodSelect(method: SplitMethodType) {
    if (splitIsLocked) return
    onMethodChange(method)
    setCandidateMemberId(undefined)
    if (method === 'equal') {
      setPercentages(createEqualPercentages(arka.members.length))
      setManualMemberIds(new Set())
      setIsCustomFormOpen(false)
      setSelectedMemberId(undefined)
      onSponsorSelected(undefined)
      onNotify({ tone: 'success', title: 'Split equally applied', message: 'Everyone in this Arka will pay the same amount.' })
    } else if (method === 'custom') {
      setPercentages(createEqualPercentages(arka.members.length))
      setManualMemberIds(new Set())
      setIsCustomFormOpen(true)
      setSelectedMemberId(undefined)
      onSponsorSelected(undefined)
    } else {
      setIsCustomFormOpen(false)
      setManualMemberIds(new Set())
      setSelectedMemberId(undefined)
      setSponsorStage('ready')
      onSponsorSelected(undefined)
      onNotify({ tone: 'info', title: 'Everyone is included', message: 'Spin once to choose who will treat this Arka.' })
    }
  }

  function handleApplyCustomSplit() {
    if (splitIsLocked) return
    playSuccessChime()
    onCustomApply(effectivePercentages)
    setIsCustomFormOpen(false)
    onNotify({ tone: 'success', title: 'Payment split updated', message: 'Guests will see their updated share.' })
  }

  function handlePercentageChange(index: number, rawValue: string) {
    const member = arka.members[index]
    if (!member) return

    const normalizedValue = rawValue.replace(',', '.').replace(/[^\d.]/g, '')
    const requestedValue = normalizedValue.length === 0 ? 0 : Number(normalizedValue)
    const nextManualMemberIds = new Set(manualMemberIds)
    nextManualMemberIds.add(member.id)
    const manualIndexes = arka.members
      .map((candidate, candidateIndex) => nextManualMemberIds.has(candidate.id) ? candidateIndex : -1)
      .filter((candidateIndex) => candidateIndex >= 0)

    setManualMemberIds(nextManualMemberIds)
    setPercentages(redistributeManualPercentages(effectivePercentages, index, requestedValue, manualIndexes))
  }

  function handleSpinWheel() {
    if (splitIsLocked || sponsorStage !== 'ready' || arka.members.length === 0) return
    const winnerIndex = Math.floor(Math.random() * arka.members.length)
    const winner = arka.members[winnerIndex]
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const spinDuration = reducedMotion ? 180 : wheelSpinDuration
    setCandidateMemberId(winner.id)
    setSponsorStage('spinning')
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      setWheelRotation((current) => current + 1800 + (360 - winnerIndex * (360 / arka.members.length)))
    }))
    revealTimerRef.current = window.setTimeout(() => {
      setSelectedMemberId(winner.id)
      onSponsorSelected(winner.id)
      setSponsorStage('winner')
      playSuccessChime()
      onNotify({ tone: 'success', title: `${winner.displayName} will treat`, message: 'Their share now covers the full Arka total.' })
    }, spinDuration)
    closeTimerRef.current = window.setTimeout(
      () => setSponsorStage('ready'),
      spinDuration + (reducedMotion ? 900 : wheelWinnerHoldDuration),
    )
  }

  function renderWheelLabels(counterRotate = false) {
    return arka.members.map((member, index) => {
      const angle = index * (360 / arka.members.length) + (180 / arka.members.length)
      const labelRadius = arka.members.length <= 3 ? 28 : arka.members.length <= 5 ? 31 : 34
      const radians = (angle * Math.PI) / 180
      const left = 50 + Math.sin(radians) * labelRadius
      const top = 50 - Math.cos(radians) * labelRadius
      return <span key={member.id} className="host-wheel-label" style={{ left: `${left}%`, top: `${top}%` }}><span className="host-wheel-label-content" style={counterRotate ? { transform: `rotate(${-wheelRotation}deg)`, transitionDuration: sponsorStage === 'spinning' ? `${wheelSpinDuration}ms` : '1ms' } : undefined}>{member.displayName}</span></span>
    })
  }

  const wheelLabels = renderWheelLabels()
  const overlayWheelLabels = renderWheelLabels(true)

  const wheelOverlay = sponsorStage === 'spinning' || sponsorStage === 'winner' ? createPortal(
    <div className="host-wheel-overlay" role="dialog" aria-modal="true" aria-label="Payer selection wheel">
      <div className={cn('host-wheel-overlay-content', sponsorStage === 'winner' && 'is-revealed')}>
        <p>{sponsorStage === 'spinning' ? 'Choosing who treats this Arka…' : `${candidateMember?.displayName ?? 'Payer'} selected`}</p>
        <div className="host-wheel-overlay-disc">
          <span className="host-wheel-overlay-pointer" aria-hidden="true">▼</span>
          <div className="host-treating-wheel host-treating-wheel--overlay" style={{ background: wheelBackground, transform: `rotate(${wheelRotation}deg)`, transitionDuration: sponsorStage === 'spinning' ? `${wheelSpinDuration}ms` : '1ms' }}>
            {overlayWheelLabels}
            <span className="host-wheel-center host-wheel-center--overlay"><Gift size={24} /></span>
          </div>
        </div>
        {sponsorStage === 'winner' && candidateMember ? <div className="host-wheel-winner" role="status" aria-live="assertive"><MemberIdenticon seed={candidateMember.walletAddress ?? candidateMember.userId} className="size-20" /><p>{candidateMember.displayName}</p><strong>will treat this Arka</strong><span>{candidateMember.displayName} will cover {formatUsd(arka.totalFiat)} and confirm the payment in Nimiq Pay.</span></div> : null}
      </div>
    </div>,
    document.body,
  ) : null

  return (
    <>
      <section className="host-split-panel" aria-labelledby="host-split-title">
        <h2 id="host-split-title">Choose a split method</h2>
        {splitIsLocked ? <p className="mb-3 flex items-start gap-2 rounded-xl border border-[#efdcae] bg-[#fff8e8] px-3 py-2.5 text-sm font-semibold leading-5 text-[#765000]" role="status"><LockKeyhole className="mt-0.5 shrink-0" size={17} />The split is locked because contributions have started.</p> : null}
        <div className="host-split-options">
          {visibleSplitMethods.map((method) => {
            const Icon = splitMethodIcons[method.type] ?? PieChart
            return <button key={method.type} type="button" className={cn('host-split-option', arka.splitMethod === method.type && 'is-selected')} aria-pressed={arka.splitMethod === method.type} disabled={splitIsLocked} onClick={() => handleMethodSelect(method.type)}><Icon size={21} /><span><strong>{method.label}</strong><small>{splitMethodDescriptions[method.type] ?? method.description}</small></span></button>
          })}
        </div>

        {arka.splitMethod === 'custom' ? <div className="host-custom-split">{isCustomFormOpen ? <><div className="host-split-subheading"><div><strong>Custom percentages</strong><span>Set each share. The remaining balance updates as you go.</span></div><span className="host-percentage-total"><Percent size={14} /> 100</span></div><div className="host-custom-members">{arka.members.map((member, index) => <label key={member.id} className="host-custom-member"><MemberIdenticon seed={member.walletAddress ?? member.userId} className="size-10" /><span className="host-custom-member-copy"><strong>{member.displayName}</strong><small>{formatUsd(fiatAmounts[index])} · ≈ {formatNim(nimAmounts[index])}</small></span><span className="host-percentage-input"><input type="text" inputMode="decimal" value={effectivePercentages[index] ?? 0} readOnly={splitIsLocked} aria-label={`${member.displayName} share percentage`} onFocus={(event) => event.currentTarget.select()} onChange={(event) => handlePercentageChange(index, event.target.value)} /><span>%</span></span></label>)}</div><Button type="button" className="host-apply-split" disabled={splitIsLocked} onClick={handleApplyCustomSplit}><Check size={18} />Apply custom split</Button></> : <div className="host-custom-summary"><span className="host-custom-summary-icon"><Check size={17} /></span><div><strong>Custom split applied</strong><span>100% shared across {arka.members.length} people</span></div><button type="button" disabled={splitIsLocked} onClick={() => setIsCustomFormOpen(true)}><PencilLine size={16} />Edit</button></div>}</div> : null}

        {arka.splitMethod === 'sponsor' ? <div className="host-treating-flow">
          <div className="host-split-subheading"><div><strong>Everyone is in</strong><span>Spin once to choose who treats the Arka</span></div><Gift size={20} /></div>
          <div className="host-wheel-area"><span className="host-wheel-pointer" aria-hidden="true">▼</span><div className="host-treating-wheel" style={{ background: wheelBackground }} aria-label="Payer selection wheel">{wheelLabels}<span className={cn('host-wheel-center', candidateMember && 'has-winner')}>{candidateMember ? <><MemberIdenticon seed={candidateMember.walletAddress ?? candidateMember.userId} className="host-wheel-winner-avatar" /><small>{candidateMember.displayName}</small></> : <Gift size={22} />}</span></div><Button type="button" className="host-spin-button" disabled={splitIsLocked || sponsorStage !== 'ready' || Boolean(selectedMember)} onClick={handleSpinWheel}>{selectedMember ? <><Check size={18} />Payer selected</> : <><RefreshCcw size={18} />Spin the wheel</>}</Button></div>
          {selectedMember ? <div className="host-custom-summary" role="status"><span className="host-custom-summary-icon"><Check size={17} /></span><div><strong>{selectedMember.displayName} is treating this Arka</strong><span>They cover {formatUsd(arka.totalFiat)} and confirm it in Nimiq Pay.</span></div></div> : null}
        </div> : null}
      </section>
      {wheelOverlay}
    </>
  )
}
