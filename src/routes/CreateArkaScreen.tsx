import {
  Crown,
  SlidersHorizontal,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { HomeArkasHeader } from '../components/arka/HomeArkasHeader'
import { ScreenContainer } from '../components/layout/ScreenContainer'
import { Button } from '../components/ui/Button'
import { MobileScreen } from '../components/ui/MobileScreen'
import { NimiqArrowRight, NimiqCheckmarkSmall, NimiqInfoCircleSmall } from '../components/ui/NimiqIcon'
import { useNimPrice } from '../hooks/useNimPrice'
import { arkaCategoryIcons } from '../lib/arka/categoryIcons'
import { formatNimEstimate, normalizeUsdInput } from '../lib/arka/formatMoney'
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
  const [nameIsCustom, setNameIsCustom] = useState(false)
  const [touched, setTouched] = useState({ name: false, total: false })
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const selectedAsset: AssetSymbol = 'NIM'
  const numericTotalFiat = Number(totalFiat)
  const validTotal = Number.isFinite(numericTotalFiat) && numericTotalFiat > 0
  const totalNimEstimate = Number((
    validTotal && nimPrice.usd > 0 ? numericTotalFiat / nimPrice.usd : 0
  ).toFixed(5))
  const SelectedCategoryIcon = arkaCategoryIcons[category]
  const suggestedName = categorySuggestions[category]
  const nameError = name.trim().length === 0 ? 'Give your Arka a name.' : null
  const totalError = !validTotal ? 'Enter a USD goal greater than 0.' : null
  const showNameError = Boolean(nameError && (touched.name || submitAttempted))
  const showTotalError = Boolean(totalError && (touched.total || submitAttempted))

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitAttempted(true)
    if (nameError || totalError) return

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
        totalFiat: numericTotalFiat,
        totalNim: totalNimEstimate,
        selectedAsset,
        splitMethod,
        nimUsdPrice: nimPrice.usd,
        fundingMode: 'host-wallet',
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
    <MobileScreen className="create-arka-screen !bg-[#fffaf5]">
      <motion.form
        onSubmit={handleCreate}
        className="relative z-10 flex min-h-full w-full flex-col bg-[#fffaf5]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
      <ScreenContainer className="!flex-none px-5 pb-6">
        <HomeArkasHeader title="Create Arka" subtitle="Set up a shared tab in seconds." />
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
                data-tour="create-arka-name"
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
            <span className="text-sm font-extrabold text-[#111b25]">Funding goal</span>
            <div
              className={cn(
                'flex min-h-[88px] items-center rounded-2xl border bg-white px-5 shadow-[0_7px_14px_rgba(233,178,19,0.09)] transition-colors focus-within:ring-2 focus-within:ring-[#E9B213]/15',
                showTotalError ? 'border-arka-error' : 'border-[#E9B213]',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline gap-1">
                  <span className="shrink-0 text-[34px] font-extrabold leading-none text-[#0f1b27]" aria-hidden="true">$</span>
                  <input
                    id="arka-total"
                    className="min-h-11 w-0 min-w-0 flex-1 bg-transparent text-[34px] font-extrabold leading-none text-[#0f1b27] outline-none"
                    inputMode="decimal"
                    enterKeyHint="go"
                    placeholder="0"
                    value={totalFiat}
                    aria-invalid={showTotalError}
                    aria-describedby={showTotalError ? 'arka-total-error' : 'arka-total-help'}
                    onBlur={() => {
                      setTouched((current) => ({ ...current, total: true }))
                      if (validTotal) setTotalFiat(numericTotalFiat.toFixed(2))
                    }}
                    onChange={(event) => setTotalFiat(normalizeUsdInput(event.target.value))}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      event.currentTarget.blur()
                    }}
                  />
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm font-semibold text-[#68727c]">
                  <span>≈ {formatNimEstimate(totalNimEstimate)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{nimPrice.source === 'coingecko' ? 'CoinGecko live rate' : nimPrice.source === 'cached' ? 'last live rate' : 'temporary estimate'}</span>
                </p>
              </div>
            </div>
            {showTotalError ? (
              <p id="arka-total-error" className="text-sm font-semibold text-arka-error">{totalError}</p>
            ) : (
              <p id="arka-total-help" className="flex gap-2 text-sm font-medium leading-5 text-[#68727c]">
                <NimiqInfoCircleSmall size={17} className="mt-0.5 shrink-0" />
                <span>The USD goal stays fixed. NIM is shown as an estimate for the group.</span>
              </p>
            )}
          </label>

          <section className="flex items-start gap-3 rounded-2xl bg-[#eef7ee] p-4" aria-label="Host wallet information">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#d8efdc] text-[#176832]" aria-hidden="true"><WalletCards size={20} /></span>
            <div>
              <h2 className="text-sm font-black text-[#174f29]">Collected by the host</h2>
              <p className="mt-1 text-sm font-semibold leading-5 text-[#3f6049]">Invite people after creating the Arka. Contributions go to the host wallet, and the host settles the final payment through Nimiq Pay.</p>
            </div>
          </section>

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
          <div className="pt-1">
            {createError ? <p className="mb-2 text-center text-sm font-semibold text-arka-error" role="alert">{createError}</p> : null}
            <Button type="submit" className="relative grid min-h-14 grid-cols-[22px_1fr_22px] text-base" disabled={isCreating}>
              <span aria-hidden="true" />
              <span className="text-center">{isCreating ? 'Creating shared Arka…' : 'Create Arka'}</span>
              <NimiqArrowRight size={22} />
            </Button>
          </div>
        </div>

      </ScreenContainer>
      </motion.form>
    </MobileScreen>
  )
}
