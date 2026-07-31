import {
  Crown,
  DollarSign,
  SlidersHorizontal,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArkaHeader } from '../components/arka/ArkaHeader'
import { ArkaDeadlinePicker } from '../components/arka/ArkaDeadlinePicker'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { Button } from '../components/ui/Button'
import { MobileScreen } from '../components/ui/MobileScreen'
import { NimiqArrowRight, NimiqCheckmarkSmall, NimiqInfoCircleSmall } from '../components/ui/NimiqIcon'
import { useNimPrice } from '../hooks/useNimPrice'
import { arkaCategoryIcons } from '../lib/arka/categoryIcons'
import {
  createDefaultArkaDeadline,
  isFutureDeadline,
  parseLocalDeadline,
  toLocalDateTimeInputValue,
} from '../lib/arka/deadline'
import { formatNim } from '../lib/arka/formatMoney'
import { getNimiqWalletSurfaceName } from '../lib/nimiq/detectNimiqEnvironment'
import { cn } from '../lib/utils/cn'
import { useArkaStore } from '../store/arkaStore'
import { useWalletStore } from '../store/walletStore'
import { splitMethods, type ArkaCategory, type AssetSymbol, type SplitMethodType } from '../types/arka'

const categories: Array<{ value: ArkaCategory; label: string; Icon: LucideIcon }> = [
  { value: 'dinner', label: 'Dinner', Icon: arkaCategoryIcons.dinner },
  { value: 'cafe', label: 'Coffee', Icon: arkaCategoryIcons.cafe },
  { value: 'trip', label: 'Trip', Icon: arkaCategoryIcons.trip },
  { value: 'gift', label: 'Gift', Icon: arkaCategoryIcons.gift },
  { value: 'custom', label: 'Custom', Icon: arkaCategoryIcons.custom },
]

const splitMethodIcons: Partial<Record<SplitMethodType, LucideIcon>> = {
  equal: UsersRound,
  custom: SlidersHorizontal,
  sponsor: Crown,
}

const createSplitMethods = splitMethods.filter((method) => ['equal', 'custom', 'sponsor'].includes(method.type))

const categorySuggestions: Record<ArkaCategory, string> = {
  dinner: 'Friday Dinner',
  cafe: 'Afternoon Coffee',
  trip: 'Business Trip',
  gift: 'Birthday Gift',
  event: 'Group Event',
  roommates: 'Roommates Fund',
  custom: 'Custom Arka',
}

export function CreateArkaScreen() {
  const navigate = useNavigate()
  const createArka = useArkaStore((state) => state.createArka)
  const wallet = useWalletStore((state) => state.wallet)
  const connectWallet = useWalletStore((state) => state.connect)
  const nimPrice = useNimPrice()
  const [name, setName] = useState('Friday Dinner')
  const [category, setCategory] = useState<ArkaCategory>('dinner')
  const [totalFiat, setTotalFiat] = useState('')
  const [splitMethod, setSplitMethod] = useState<SplitMethodType>('equal')
  const [deadline, setDeadline] = useState(() => toLocalDateTimeInputValue(createDefaultArkaDeadline()))
  const [minimumDeadline] = useState(() => Date.now() + 60_000)
  const [nameIsCustom, setNameIsCustom] = useState(false)
  const [touched, setTouched] = useState({ name: false, total: false, deadline: false })
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const selectedAsset: AssetSymbol = 'NIM'
  const numericTotal = Number(totalFiat)
  const validTotal = Number.isFinite(numericTotal) && numericTotal > 0
  const nimEstimate = Number(((validTotal ? numericTotal : 0) / nimPrice.usd).toFixed(2))
  const SelectedCategoryIcon = arkaCategoryIcons[category]
  const walletSurfaceName = getNimiqWalletSurfaceName()
  const suggestedName = categorySuggestions[category]
  const nameError = name.trim().length === 0 ? 'Give your Arka a name.' : null
  const totalError = validTotal ? null : 'Enter an amount greater than $0.'
  const deadlineError = isFutureDeadline(deadline, minimumDeadline - 60_000) ? null : 'Choose a deadline in the future.'
  const showNameError = Boolean(nameError && (touched.name || submitAttempted))
  const showTotalError = Boolean(totalError && (touched.total || submitAttempted))
  const showDeadlineError = Boolean(deadlineError && (touched.deadline || submitAttempted))

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitAttempted(true)
    if (nameError || totalError || deadlineError) return

    const parsedDeadline = parseLocalDeadline(deadline)
    if (!parsedDeadline) return

    setIsCreating(true)
    setCreateError('')
    try {
      if (!wallet) {
        await connectWallet()
        if (!useWalletStore.getState().wallet) {
          throw new Error(useWalletStore.getState().error || 'Connect your Nimiq wallet to continue.')
        }
      }

      const arka = await createArka({
        name: name.trim(),
        type: 'tab',
        category,
        totalFiat: numericTotal,
        selectedAsset,
        splitMethod,
        expiresAt: parsedDeadline.toISOString(),
        nimUsdPrice: nimPrice.usd,
      })
      navigate(`/arka/${arka.id}/share`)
    } catch (error) {
      setCreateError(error instanceof Error
        ? error.message
        : 'This Arka could not be created. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <MobileScreen className="create-arka-screen flex justify-end !bg-[#fffaf5]" scrollable={false}>
      <motion.form
        onSubmit={handleCreate}
        className="relative z-10 flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#fffaf5]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
      <ScreenContainer className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <ArkaHeader title="Create Arka" subtitle="Set up a shared tab or group fund in seconds." backTo="/" />
        <div className="grid gap-5">
          <label className="grid gap-2" htmlFor="arka-name">
            <span className="text-sm font-extrabold text-[#111b25]">Arka name</span>
            <div
              className={cn(
                'flex min-h-14 items-center gap-3 rounded-2xl border bg-white px-4 shadow-[0_6px_12px_rgba(27,28,25,0.04)] transition-colors focus-within:border-[#E9B213] focus-within:ring-2 focus-within:ring-[#E9B213]/15',
                showNameError ? 'border-arka-error' : 'border-[#e7d7c5]',
              )}
            >
              <SelectedCategoryIcon size={25} className="shrink-0 text-[#0f1b27]" strokeWidth={1.9} />
              <input
                id="arka-name"
                maxLength={80}
                className="min-h-11 min-w-0 flex-1 bg-transparent text-lg font-semibold text-[#0f1b27] outline-none"
                value={name}
                aria-invalid={showNameError}
                aria-describedby={showNameError ? 'arka-name-error' : undefined}
                onBlur={() => setTouched((current) => ({ ...current, name: true }))}
                onChange={(event) => {
                  const nextName = event.target.value
                  setName(nextName)
                  setNameIsCustom(nextName.trim() !== '' && nextName !== suggestedName)
                }}
              />
            </div>
            {showNameError ? <p id="arka-name-error" className="text-sm font-semibold text-arka-error">{nameError}</p> : null}
          </label>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-extrabold text-[#111b25]">Type</legend>
            <div className="grid grid-cols-5 gap-2">
              {categories.map(({ value, label, Icon }) => {
                const selected = category === value

                return (
                  <button
                    key={value}
                    type="button"
                    className={cn(
                      'relative grid min-h-[78px] place-items-center rounded-2xl border bg-white px-1 py-3 text-sm font-semibold leading-none text-[#111b25] shadow-[0_5px_10px_rgba(27,28,25,0.035)] transition duration-150 active:scale-[0.97]',
                      selected ? 'border-[#E9B213] bg-[#fff9ea] text-[#8d5f00] shadow-[0_7px_14px_rgba(233,178,19,0.12)]' : 'border-[#e9dcca]',
                    )}
                    aria-pressed={selected}
                    onClick={() => {
                      setCategory(value)
                      if (!nameIsCustom) setName(categorySuggestions[value])
                    }}
                  >
                    {selected ? (
                      <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-[#E9B213] text-white" aria-hidden="true">
                        <NimiqCheckmarkSmall size={13} />
                      </span>
                    ) : null}
                    <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <label className="grid gap-2" htmlFor="arka-total">
            <span className="text-sm font-extrabold text-[#111b25]">Total amount</span>
            <div
              className={cn(
                'flex min-h-[82px] items-center gap-4 rounded-2xl border bg-white px-4 shadow-[0_7px_14px_rgba(233,178,19,0.09)] transition-colors focus-within:ring-2 focus-within:ring-[#E9B213]/15',
                showTotalError ? 'border-arka-error' : 'border-[#E9B213]',
              )}
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-linear-to-b from-[#F8DD7B] to-[#E9B213] text-[#120d04]" aria-hidden="true">
                <DollarSign size={32} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline">
                  <span className="text-[34px] font-extrabold leading-none text-[#0f1b27]">$</span>
                  <input
                    id="arka-total"
                    className="min-h-11 w-0 min-w-0 flex-1 bg-transparent text-[34px] font-extrabold leading-none text-[#0f1b27] outline-none"
                    inputMode="decimal"
                    enterKeyHint="go"
                    placeholder="0.00"
                    value={totalFiat}
                    aria-invalid={showTotalError}
                    aria-describedby={showTotalError ? 'arka-total-error' : 'arka-total-help'}
                    onBlur={() => setTouched((current) => ({ ...current, total: true }))}
                    onChange={(event) => setTotalFiat(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      event.currentTarget.blur()
                    }}
                  />
                </div>
                <p className="mt-1 text-sm font-semibold text-[#68727c]">~ {formatNim(nimEstimate)} · {nimPrice.isLive ? 'live rate' : 'estimated rate'}</p>
              </div>
            </div>
            {showTotalError ? (
              <p id="arka-total-error" className="text-sm font-semibold text-arka-error">{totalError}</p>
            ) : (
              <p id="arka-total-help" className="flex gap-2 text-sm font-medium leading-5 text-[#68727c]">
                <NimiqInfoCircleSmall size={17} className="mt-0.5 shrink-0" />
                <span>Tap the name, total, split method, or deadline inside your Arka to edit them later.</span>
              </p>
            )}
          </label>

          <section className="flex items-start gap-3 rounded-2xl bg-[#eef7ee] p-4" aria-label="NIM payment information">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#d8efdc] text-[#176832]" aria-hidden="true"><Wallet size={20} /></span>
            <div><h2 className="text-sm font-black text-[#174f29]">Collected by the host</h2><p className="mt-1 text-sm font-semibold leading-5 text-[#3f6049]">Contributions are sent to the host wallet and confirmed in {walletSurfaceName}.</p></div>
          </section>

          <div>
            <ArkaDeadlinePicker
              id="arka-deadline"
              value={deadline}
              minimum={new Date(minimumDeadline)}
              invalid={showDeadlineError}
              describedBy={showDeadlineError ? 'arka-deadline-error' : 'arka-deadline-help'}
              onBlur={() => setTouched((current) => ({ ...current, deadline: true }))}
              onChange={setDeadline}
            />
            {showDeadlineError ? (
              <p id="arka-deadline-error" className="mt-2 text-sm font-semibold text-arka-error">{deadlineError}</p>
            ) : (
              <p id="arka-deadline-help" className="mt-2 flex gap-2 text-sm font-medium leading-5 text-[#68727c]">
                <NimiqInfoCircleSmall size={17} className="mt-0.5 shrink-0" />
                <span>New payments stop after this time. You can change it until the first contribution.</span>
              </p>
            )}
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-extrabold text-[#111b25]">Split method</legend>
            <div className="grid gap-2">
              {createSplitMethods.map((method) => {
                const selected = splitMethod === method.type
                const Icon = splitMethodIcons[method.type] ?? SlidersHorizontal

                return (
                  <button
                    key={method.type}
                    type="button"
                    className={cn(
                      'relative flex min-h-[68px] items-center gap-3 rounded-xl border bg-white px-3 py-3 text-left text-sm font-semibold leading-4 text-[#111b25] transition duration-150 active:scale-[0.98]',
                      selected ? 'border-[#E9B213] bg-[#fff9ea] text-[#8d5f00] shadow-[0_7px_14px_rgba(233,178,19,0.12)]' : 'border-[#e9dcca]',
                    )}
                    aria-pressed={selected}
                    onClick={() => setSplitMethod(method.type)}
                  >
                    {selected ? (
                      <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-[#E9B213] text-white" aria-hidden="true">
                        <NimiqCheckmarkSmall size={13} />
                      </span>
                    ) : null}
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f5f1e9]"><Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
                    <span><strong className="block">{method.label}</strong><small className="mt-1 block font-medium leading-4 text-arka-muted">{method.description}</small></span>
                  </button>
                )
              })}
            </div>
            <p className="flex gap-2 text-sm font-medium leading-5 text-[#68727c]">
              <NimiqInfoCircleSmall size={17} className="mt-0.5 shrink-0" />
              <span>You can edit member amounts later.</span>
            </p>
          </fieldset>
        </div>

      </ScreenContainer>
      <footer className="arka-bottom-action create-arka-footer relative z-30 shrink-0 border-t border-[#e8dfd1] bg-[#fffaf5] px-5 pb-2 pt-2">
        {createError ? <p className="mb-2 text-center text-sm font-semibold text-arka-error" role="alert">{createError}</p> : null}
        <Button type="submit" className="relative min-h-14 text-base" disabled={isCreating}>
          <span>{isCreating ? 'Creating shared Arka…' : 'Create Arka'}</span>
          <NimiqArrowRight className="absolute right-6" size={22} />
        </Button>
      </footer>
      </motion.form>
    </MobileScreen>
  )
}
