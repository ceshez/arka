import { CalendarDays, Check, Clock3 } from 'lucide-react'
import { parseLocalDeadline, toLocalDateTimeInputValue } from '../../lib/arka/deadline'
import { cn } from '../../lib/utils/cn'

type DeadlinePreset = 'tonight' | 'tomorrow' | 'three-days'

const presetLabels: Record<DeadlinePreset, string> = {
  tonight: 'Tonight',
  tomorrow: 'Tomorrow',
  'three-days': 'In 3 days',
}

function makePreset(preset: DeadlinePreset, now = new Date()) {
  const target = new Date(now)
  target.setSeconds(0, 0)

  if (preset === 'tonight') {
    target.setHours(20, 0, 0, 0)
    if (target.getTime() <= now.getTime() + 60 * 60 * 1_000) target.setDate(target.getDate() + 1)
  } else if (preset === 'tomorrow') {
    target.setDate(target.getDate() + 1)
    target.setHours(20, 0, 0, 0)
  } else {
    target.setDate(target.getDate() + 3)
    target.setHours(20, 0, 0, 0)
  }

  return toLocalDateTimeInputValue(target)
}

function deadlineParts(value: string) {
  const [date = '', time = ''] = value.split('T')
  return { date, time: time.slice(0, 5) }
}

function formatDeadlineSummary(value: string) {
  const deadline = parseLocalDeadline(value)
  if (!deadline) return 'Choose a date and time'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(deadline)
}

export function ArkaDeadlinePicker({
  id,
  value,
  minimum,
  disabled = false,
  invalid = false,
  describedBy,
  onBlur,
  onChange,
}: {
  id: string
  value: string
  minimum: Date
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  onBlur?: () => void
  onChange: (value: string) => void
}) {
  const parts = deadlineParts(value)
  const minimumValue = toLocalDateTimeInputValue(minimum)
  const minimumDate = minimumValue.slice(0, 10)
  const activePreset = (Object.keys(presetLabels) as DeadlinePreset[])
    .find((preset) => makePreset(preset) === value)

  function updatePart(nextDate: string, nextTime: string) {
    onChange(nextDate && nextTime ? `${nextDate}T${nextTime}` : '')
  }

  return (
    <fieldset className="grid gap-3" disabled={disabled} onBlur={onBlur} aria-describedby={describedBy}>
      <legend className="text-sm font-extrabold text-[#111b25]">Payment deadline</legend>

      <div className={cn(
        'rounded-2xl border bg-[#fffdf8] p-3 transition-colors focus-within:border-[#E9B213] focus-within:ring-2 focus-within:ring-[#E9B213]/20',
        invalid ? 'border-arka-error' : 'border-[#ddcba9]',
        disabled && 'opacity-65',
      )}>
        <div className="flex items-center gap-3 px-1 pb-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff0bd] text-[#7d5700]" aria-hidden="true"><CalendarDays size={22} /></span>
          <div className="min-w-0"><p className="text-xs font-bold text-[#6d604e]">Contributions close</p><p className="truncate text-base font-black text-[#111b25]">{formatDeadlineSummary(value)}</p></div>
        </div>

        <div className="grid grid-cols-3 gap-2" aria-label="Deadline shortcuts">
          {(Object.keys(presetLabels) as DeadlinePreset[]).map((preset) => {
            const selected = activePreset === preset
            return (
              <button
                key={preset}
                type="button"
                className={cn(
                  'flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-extrabold transition active:scale-[0.98]',
                  selected ? 'border-[#E9B213] bg-[#fff3c8] text-[#6b4900]' : 'border-[#e6ded1] bg-white text-[#51483b]',
                )}
                aria-pressed={selected}
                onClick={() => onChange(makePreset(preset))}
              >
                {selected ? <Check size={14} strokeWidth={3} /> : null}{presetLabels[preset]}
              </button>
            )
          })}
        </div>

        <div className="mt-3 grid grid-cols-[1fr_0.72fr] gap-2">
          <label className="min-w-0 rounded-xl border border-[#e6ded1] bg-white px-3 py-2 focus-within:border-[#E9B213]" htmlFor={`${id}-date`}>
            <span className="block text-[11px] font-extrabold text-[#6d604e]">Date</span>
            <input
              id={`${id}-date`}
              type="date"
              className="min-h-8 w-full min-w-0 bg-transparent text-sm font-extrabold text-[#111b25] outline-none"
              min={minimumDate}
              value={parts.date}
              aria-invalid={invalid}
              onChange={(event) => updatePart(event.target.value, parts.time || '20:00')}
            />
          </label>
          <label className="min-w-0 rounded-xl border border-[#e6ded1] bg-white px-3 py-2 focus-within:border-[#E9B213]" htmlFor={`${id}-time`}>
            <span className="flex items-center gap-1 text-[11px] font-extrabold text-[#6d604e]"><Clock3 size={12} /> Time</span>
            <input
              id={`${id}-time`}
              type="time"
              className="min-h-8 w-full min-w-0 bg-transparent text-sm font-extrabold text-[#111b25] outline-none"
              step={300}
              value={parts.time}
              aria-invalid={invalid}
              onChange={(event) => updatePart(parts.date || minimumDate, event.target.value)}
            />
          </label>
        </div>
      </div>
    </fieldset>
  )
}
