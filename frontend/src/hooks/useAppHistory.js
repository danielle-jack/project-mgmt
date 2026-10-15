import { useCallback, useEffect, useState } from 'react'

// Which page is open, kept in the browser's history so Back works everywhere:
// the app's Back button, the browser's back button, and the swipe-back gesture
// on phones. Reloading the page also keeps you where you were.
//
// Each history entry stores { tracker: true, page, projectId, depth }. depth
// counts how many app pages are behind this one, so the Back button only shows
// when going back stays inside the app.

const HOME = { page: 'Overview', projectId: null, depth: 0 }

function current() {
  const s = window.history.state
  return s?.tracker ? { page: s.page, projectId: s.projectId ?? null, depth: s.depth ?? 0 } : HOME
}

const toState = (entry) => ({ tracker: true, ...entry })

export function useAppHistory() {
  const [entry, setEntry] = useState(current)

  useEffect(() => {
    // Tag the entry the app started on, so going back to it shows the right page.
    if (!window.history.state?.tracker) window.history.replaceState(toState(HOME), '')
    const onPop = () => setEntry(current())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  /** Open a page (and optionally a project on the Projects page). */
  const go = useCallback((page, projectId = null) => {
    if (entry.page === page && entry.projectId === projectId) return
    const next = { page, projectId, depth: entry.depth + 1 }
    window.history.pushState(toState(next), '')
    setEntry(next)
  }, [entry])

  const back = useCallback(() => window.history.back(), [])

  return { page: entry.page, projectId: entry.projectId, canGoBack: entry.depth > 0, go, back }
}

/** Forget the app's place in history, e.g. on logout, so the next login starts on Overview. */
export function resetAppHistory() {
  window.history.replaceState(null, '')
}
