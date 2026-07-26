import { CalendarClock, Check, PencilLine, X } from 'lucide-react'
import { useState } from 'react'
import { formatArkaDeadline, isFutureDeadline, parseLocalDeadline, toLocalDateTimeInputValue } from '../../lib/arka/deadline'
import type { Arka } from '../../types/arka'

export function ArkaDeadlineCard({ arka, onSave }: { arka: Arka; onSave?: (expiresAt: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(arka.expiresAt ? toLocalDateTimeInputValue(new Date(arka.expiresAt)) : '')
  const [showError, setShowError] = useState(false)

  if (!arka.expiresAt && !onSave) return null

  const expired = arka.status === 'expired'
  const editable = Boolean(onSave)

  function beginEdit() {
    setDraft(arka.expiresAt
      ? toLocalDateTimeInputValue(new Date(arka.expiresAt))
      : toLocalDateTimeInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)))
    setShowError(false)
    setIsEditing(true)
  }

  function cancelEdit() {
    if (arka.expiresAt) setDraft(toLocalDateTimeInputValue(new Date(arka.expiresAt)))
    setShowError(false)
    setIsEditing(false)
  }

  function saveEdit() {
    if (!onSave || !isFutureDeadline(draft)) {
      setShowError(true)
      return
    }
    const parsedDeadline = parseLocalDeadline(draft)
    if (!parsedDeadline) {
      setShowError(true)
      return
    }
    onSave(parsedDeadline.toISOString())
    setShowError(false)
    setIsEditing(false)
  }

  return (
    <section
      className={`mt-3 flex items-center gap-3 rounded-[1.25rem] border p-4 ${expired ? 'border-[#efb0a8] bg-[#fff0ee]' : 'border-[#ead28c] bg-[#fff8e7]'}`}
      aria-label="Arka payment deadline"
    >
      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${expired ? 'bg-[#f8d3ce] text-[#9c3027]' : 'bg-[#ffe9a3] text-[#8d5f00]'}`}>
        <CalendarClock size={22} strokeWidth={1.9} aria-hidden="true" />
      </span>
      {isEditing ? (
        <div className="host-deadline-editor">
          <label htmlFor="host-arka-deadline">Payment deadline</label>
          <div className="host-deadline-input-row">
            <input
              id="host-arka-deadline"
              autoFocus
              type="datetime-local"
              value={draft}
              aria-invalid={showError}
              onChange={(event) => {
                setDraft(event.target.value)
                setShowError(false)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  saveEdit()
                }
                if (event.key === 'Escape') cancelEdit()
              }}
            />
            <button type="button" aria-label="Save payment deadline" onClick={saveEdit}><Check size={18} /></button>
            <button type="button" aria-label="Cancel payment deadline edit" onClick={cancelEdit}><X size={18} /></button>
          </div>
          {showError ? <p className="host-deadline-error">Choose a future date and time.</p> : null}
        </div>
      ) : editable ? (
        <button type="button" className="host-deadline-trigger" onClick={beginEdit} aria-label={arka.expiresAt ? `Edit payment deadline, ${formatArkaDeadline(arka.expiresAt)}` : 'Set payment deadline'}>
          <span className="min-w-0">
            <span className="block text-xs font-extrabold uppercase tracking-[0.1em] text-arka-muted">{expired ? 'Payments closed' : 'Payment deadline'}</span>
            <span className="mt-1 block text-left text-sm font-black text-[#111b25]">{arka.expiresAt ? formatArkaDeadline(arka.expiresAt) : 'Set a date and time'}</span>
          </span>
          <PencilLine size={16} aria-hidden="true" />
        </button>
      ) : (
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-arka-muted">{expired ? 'Payments closed' : 'Payment deadline'}</p>
          <p className="mt-1 text-sm font-black text-[#111b25]">{formatArkaDeadline(arka.expiresAt!)}</p>
        </div>
      )}
    </section>
  )
}
