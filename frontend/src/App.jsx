import { useEffect, useMemo, useState } from 'react'
import AppLayout from './components/AppLayout'
import { PhotosContext } from './components/photos'
import ActivityPage from './pages/ActivityPage'
import ArchivePage from './pages/ArchivePage'
import DashboardPage from './pages/DashboardPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import MilestonesPage from './pages/MilestonesPage'
import PeoplePage from './pages/PeoplePage'
import ProjectsPage from './pages/ProjectsPage'
import SettingsPage from './pages/SettingsPage'
import { createActions } from './services/actions'
import { logout } from './services/authApi'
import { getToken } from './services/session'
import { getMe } from './services/userApi'
import { useWorkspaceData } from './hooks/useWorkspaceData'
import { buildNotifications } from './utils/notifications'
import { resetAppHistory, useAppHistory } from './hooks/useAppHistory'
import { daysUntil } from './utils/format'

/**
 * Top-level screens: landing -> login -> the app. No router; the current screen
 * is just state. "restoring" checks a remembered login token after a page reload.
 */
export default function App() {
  const [screen, setScreen] = useState(getToken() ? 'restoring' : 'landing')
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (screen !== 'restoring') return
    getMe()
      .then((me) => { setUser(me); setScreen('app') })
      .catch(() => { logout(); setScreen('landing') })
  }, [screen])

  function handleLogout() {
    logout()
    resetAppHistory()
    setUser(null)
    setScreen('landing')
  }

  if (screen === 'restoring') return <div className="loading-screen">Loading…</div>
  if (screen === 'landing') return <LandingPage onLogin={() => setScreen('login')} />
  if (screen === 'login') {
    return <LoginPage onBack={() => setScreen('landing')} onLoggedIn={(me) => { setUser(me); setScreen('app') }} />
  }
  return <Workspace key={user.id} user={user} onLogout={handleLogout} onUserUpdated={setUser} />
}

/** Everything after login: the sidebar and top bar, and whichever page is open. */
function Workspace({ user, onLogout, onUserUpdated }) {
  const { page: active, projectId: openProjectId, canGoBack, go, back } = useAppHistory()
  const { data, error, loading, reload } = useWorkspaceData(user)

  // The search box belongs to the page it was typed on; changing page clears it.
  const pageKey = `${active}:${openProjectId ?? ''}`
  const [search, setSearch] = useState({ pageKey, text: '' })
  const query = search.pageKey === pageKey ? search.text : ''
  const setQuery = (text) => setSearch({ pageKey, text })
  const actions = useMemo(() => createActions({ user, reload, onUserUpdated }), [user, reload, onUserUpdated])

  // A 401 means the login expired (after 8 hours) or the account was deactivated.
  useEffect(() => {
    if (error?.status === 401) onLogout()
  }, [error, onLogout])

  const navigate = (page) => go(page)
  const openProject = (id) => go('Projects', id)
  const notifications = useMemo(() => (data ? buildNotifications(user, data) : []), [user, data])
  const photos = useMemo(() => {
    const map = new Map((data?.users ?? []).filter((u) => u.photo).map((u) => [u.id, u.photo]))
    if (user.photo) map.set(user.id, user.photo)
    else map.delete(user.id)
    return map
  }, [data, user])

  const counts = data ? {
    Projects: data.projects.filter((p) => p.status === 'ACTIVE').length,
    Milestones: data.projects.flatMap((p) => p.milestones)
      .filter((m) => m.status !== 'COMPLETED' && daysUntil(m.dueDate) <= 7).length,
  } : {}

  const shared = { user, data, query, actions }
  let page
  if (loading) page = <div className="panel empty">Loading your workspace…</div>
  else if (error) page = <div className="panel empty">Couldn’t load your workspace: {error.message}</div>
  else if (active === 'Projects') {
    page = <ProjectsPage {...shared} projectId={openProjectId} onOpenProject={openProject} />
  } else if (active === 'People') page = <PeoplePage {...shared} />
  else if (active === 'Milestones') page = <MilestonesPage {...shared} />
  else if (active === 'Archive') page = <ArchivePage {...shared} />
  else if (active === 'Settings') page = <SettingsPage {...shared} />
  else if (active === 'Activity' && user.role === 'ADMIN') {
    page = <ActivityPage {...shared} onOpenProject={openProject} onNavigate={navigate} />
  }
  else page = <DashboardPage {...shared} onNavigate={navigate} onOpenProject={openProject} />

  return (
    <PhotosContext.Provider value={photos}>
      <AppLayout
        user={user}
        active={active}
        onNavigate={navigate}
        canGoBack={canGoBack}
        onBack={back}
        counts={counts}
        query={query}
        onQueryChange={setQuery}
        onNewProject={() => navigate('Projects')}
        onLogout={onLogout}
        notifications={notifications}
        onOpenNotification={(target) => go(target.page, target.projectId ?? null)}
      >
        {page}
      </AppLayout>
    </PhotosContext.Provider>
  )
}
