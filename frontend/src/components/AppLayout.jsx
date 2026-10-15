import { useEffect, useState } from 'react'
import Icon from './Icon'
import NotificationsMenu from './NotificationsMenu'
import { initials, ROLE_LABELS } from '../utils/format'

export const NAV_ITEMS = [
  { label: 'Overview', icon: 'grid' },
  { label: 'Projects', icon: 'folder' },
  { label: 'People', icon: 'users' }, // employees see their own week here
  { label: 'Milestones', icon: 'calendar' },
  { label: 'Archive', icon: 'archive' },
  { label: 'Activity', icon: 'clock', roles: ['ADMIN'] }, // the audit log
]

/**
 * Sidebar + top bar around every logged-in page.
 * On phones (780px and narrower) the sidebar becomes a slide-in menu opened by
 * the hamburger button. The Back button appears whenever there's a page to go back to.
 */
export default function AppLayout({
  user, active, onNavigate, canGoBack, onBack, counts, query, onQueryChange, onNewProject, onLogout,
  notifications, onOpenNotification, children,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role))

  // Escape closes the menu.
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  function go(page) {
    setMenuOpen(false)
    onNavigate(page)
  }

  return (
    <div className="app-shell">
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <aside id="app-menu" className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Main menu">
        <div className="brand">
          <span className="brand-mark"><span /><span /><span /></span><span>Planeo</span>
          <button className="menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><Icon name="close" size={18} /></button>
        </div>
        <div className="workspace">
          <span className="workspace-icon">N</span>
          <span><strong>Northstar Co.</strong><small>Business workspace</small></span>
          <span className="chevron">⌄</span>
        </div>
        <nav className="nav">
          <div className="nav-label">Workspace</div>
          {items.map((item) => (
            <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => go(item.label)}
              aria-current={active === item.label ? 'page' : undefined}>
              <Icon name={item.icon} /><span>{item.label}</span>{counts[item.label] > 0 && <em>{counts[item.label]}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${active === 'Settings' ? 'active' : ''}`} onClick={() => go('Settings')}
            aria-current={active === 'Settings' ? 'page' : undefined}>
            <Icon name="settings" /><span>Settings</span>
          </button>
          <div className="profile">
            <span className={`avatar avatar-dark ${user.photo ? 'has-photo' : ''}`}>{user.photo ? <img src={user.photo} alt="" /> : initials(user.name)}</span>
            <span><strong>{user.name}</strong><small>{ROLE_LABELS[user.role]}</small></span>
            <button className="more" onClick={onLogout} title="Log out" aria-label="Log out">•••</button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-button" onClick={() => setMenuOpen(true)}
              aria-label="Open menu" aria-expanded={menuOpen} aria-controls="app-menu">
              <Icon name="menu" size={18} />
            </button>
            {canGoBack && (
              <button className="back-button" onClick={onBack} aria-label="Go back">
                <Icon name="back" size={16} /><span>Back</span>
              </button>
            )}
            <div className="mobile-brand">Planeo</div>
            <label className="search"><Icon name="search" size={17} /><input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Search…" /></label>
          </div>
          <div className="top-actions">
            <NotificationsMenu userId={user.id} notifications={notifications} onOpen={onOpenNotification} />
            {user.role === 'ADMIN' && (
              <button className="primary-button" onClick={onNewProject} aria-label="New project"><Icon name="plus" size={16} /><span className="button-label">New project</span></button>
            )}
          </div>
        </header>

        <div className="content">{children}</div>
      </main>
    </div>
  )
}
