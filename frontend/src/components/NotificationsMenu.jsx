import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

const storageKey = (userId) => `tracker.seenNotifications.${userId}`

function readSeen(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]'))
  } catch {
    return new Set()
  }
}

function writeSeen(userId, ids) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(ids))
  } catch {
    // Storage blocked: the dot just comes back after a reload.
  }
}

/**
 * The bell in the top bar. The red dot shows while there are notifications this
 * person hasn't seen; opening the list marks them all as seen (remembered in this
 * browser). Clicking a notification goes to the project or page it's about.
 */
export default function NotificationsMenu({ userId, notifications, onOpen }) {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(() => readSeen(userId))
  const ref = useRef(null)
  const unseen = notifications.filter((n) => !seen.has(n.id)).length

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onClick = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  function toggle() {
    if (!open) {
      // Only keep ids that still apply, so the stored list doesn't grow forever.
      const ids = notifications.map((n) => n.id)
      setSeen(new Set(ids))
      writeSeen(userId, ids)
    }
    setOpen(!open)
  }

  function choose(notification) {
    setOpen(false)
    onOpen(notification.target)
  }

  return (
    <div className="notifications" ref={ref}>
      <button className="icon-button bell-button" onClick={toggle} aria-haspopup="true" aria-expanded={open}
        aria-label={unseen ? `Notifications, ${unseen} new` : 'Notifications'}>
        {unseen > 0 && <span className="notification-dot" />}
        <Icon name="bell" />
      </button>

      {open && (
        <div className="notifications-panel" role="region" aria-label="Notifications">
          <header className="notifications-header">
            <h2>Notifications</h2>
            <small>{notifications.length ? `${notifications.length} need${notifications.length === 1 ? 's' : ''} attention` : ''}</small>
          </header>
          {notifications.length === 0 ? (
            <div className="notifications-empty">
              <Icon name="check" size={20} />
              <strong>You’re all caught up</strong>
              <span>Overdue or blocked milestones and other things that need you will show up here.</span>
            </div>
          ) : (
            <ul className="notifications-list">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button onClick={() => choose(n)}>
                    <i className={`notification-tone ${n.tone}`} aria-hidden="true" />
                    <span><strong>{n.title}</strong><small>{n.detail}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
