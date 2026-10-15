import { useContext, useEffect, useRef, useState } from 'react'
import { initials } from '../utils/format'
import { PhotosContext } from './photos'

/** Runs an async action and tracks whether it is pending and what went wrong. */
export function useAction() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function run(fn) {
    setPending(true)
    setError('')
    try {
      await fn()
      return true
    } catch (err) {
      setError(err?.message || 'The change wasn’t saved. Check your connection and try again.')
      return false
    } finally {
      setPending(false)
    }
  }

  return { pending, error, setError, run }
}

export function PageHeading({ title, subtitle, children }) {
  return (
    <section className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </section>
  )
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className="filter-tabs" role="tablist">
      {items.map((item) => {
        const key = typeof item === 'string' ? item : item.value
        const label = typeof item === 'string' ? item : `${item.label}${item.count != null ? ` (${item.count})` : ''}`
        return (
          <button key={key} role="tab" aria-selected={value === key}
            className={value === key ? 'selected' : ''} onClick={() => onChange(key)}>{label}</button>
        )
      })}
    </div>
  )
}

/** Initials, or the person's photo when `userId` is given and they've uploaded one. */
export function Avatar({ name, small, muted, userId }) {
  const photo = useContext(PhotosContext).get(userId)
  return (
    <span className={`avatar ${small ? 'avatar-small' : ''} ${muted ? 'avatar-muted' : ''} ${photo ? 'has-photo' : ''}`} title={name}>
      {photo ? <img src={photo} alt="" /> : initials(name)}
    </span>
  )
}

export function Status({ tone, children }) {
  return <span className={`status status-inline ${tone}`}><i />{children}</span>
}

export function Progress({ value }) {
  return <div className="progress-track"><i style={{ width: `${value}%` }} /></div>
}

/** Weekly hours against the 40-hour week. Over it, the bar turns red and says by how much. */
export function HoursBar({ hours, limit }) {
  const pct = Math.min(100, Math.round((hours / limit) * 100))
  const tone = hours > limit ? 'over' : hours === limit ? 'full' : hours === 0 ? 'empty' : ''
  return (
    <div className={`hours-bar ${tone}`}>
      <span><strong>{formatHours(hours)}h</strong><small>{hours > limit ? `${formatHours(hours - limit)}h over ${limit}h` : `of ${limit}h`}</small></span>
      <div className="progress-track"><i style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export function Modal({ title, subtitle, onClose, children, footer }) {
  const ref = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector('input, select, textarea, button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="modal-header">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button className="icon-button close-button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  )
}

/** A form inside a modal: Cancel + a primary button named for what it does. */
export function FormModal({ title, subtitle, submitLabel, onClose, onSubmit, pending, error, children, danger }) {
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}
      footer={(
        <>
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" form="modal-form" className={danger ? 'danger-button' : 'primary-button'} disabled={pending}>
            {pending ? 'Saving…' : submitLabel}
          </button>
        </>
      )}>
      <form id="modal-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); onSubmit() }} noValidate>
        {children}
        {error && <div className="login-error form-wide" role="alert">{error}</div>}
      </form>
    </Modal>
  )
}

export function Field({ label, hint, wide, children }) {
  return (
    <label className={`login-field ${wide ? 'form-wide' : ''}`}>
      {label}
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty empty-state">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function formatHours(hours) {
  const rounded = Math.round(hours * 10) / 10
  return Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toFixed(1)
}
