import { useCallback, useEffect, useState } from 'react'
import { getProjectChain, getProjects } from '../services/projectApi'
import { getAssignments } from '../services/assignmentApi'
import { getMilestones } from '../services/milestoneApi'
import { getExpenses } from '../services/expenseApi'
import { getUsers } from '../services/userApi'
import { HOURS_PER_WEEK } from '../services/hours'

/**
 * Loads everything the logged-in user can see, in the shape the pages expect
 * (see the comment at the top of utils/rules.js):
 *
 *   users:            people this user may see, employees with allocatedHours
 *   projects:         active and completed projects, each with team + milestones, plus
 *                     chain ({ upstream, downstream }) and upstreamMilestones (milestones in the
 *                     projects it directly depends on, which its milestones may depend on),
 *                     and, when the API sent a budget (admins and the manager), its expenses
 *   archivedProjects: archived projects, same shape
 *   archivedCount, capacity: extra figures for the dashboard
 *
 * Returns { data, error, loading, reload }. reload() resolves once fresh data is in.
 */
export function useWorkspaceData(user) {
  const [state, setState] = useState({ data: null, error: null, loading: true })

  useEffect(() => {
    let cancelled = false
    loadWorkspace(user)
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }))
    return () => { cancelled = true }
  }, [user])

  const reload = useCallback(async () => {
    const data = await loadWorkspace(user)
    setState({ data, error: null, loading: false })
  }, [user])

  return { ...state, reload }
}

export async function loadWorkspace(user) {
  const [allProjects, users] = await Promise.all([getProjects(), getUsers()])

  const detailed = await Promise.all(allProjects.map(async (project) => {
    const [team, milestones, chain, expenses] = await Promise.all([
      getAssignments(project.id, { includeInactive: true }), // the detail page shows past members too
      getMilestones(project.id),
      getProjectChain(project.id),
      project.budget ? getExpenses(project.id) : null,
    ])
    const upstreamMilestones = chain.upstream.filter((p) => p.direct).flatMap((p) => p.milestones)
      .map((m) => ({ ...m, progress: m.progressPercent, dependsOn: [] }))
    // The pages call a milestone's percentage `progress`; the API calls it `progressPercent`.
    return {
      ...project, team, chain, upstreamMilestones, expenses,
      milestones: milestones.map((m) => ({ ...m, progress: m.progressPercent })),
    }
  }))

  const projects = detailed.filter((p) => p.status !== 'ARCHIVED')
  const archivedProjects = detailed.filter((p) => p.status === 'ARCHIVED')

  return {
    users,
    projects,
    archivedProjects,
    archivedCount: archivedProjects.length,
    capacity: capacityOf(user, users),
  }
}

/**
 * Whose hours count as "the team" on the dashboard: everyone for an admin, a
 * manager's own employees for a manager, and just yourself for an employee.
 * Uses the server's allocatedHours, which only counts active projects.
 */
function capacityOf(user, users) {
  const people = user.role === 'EMPLOYEE'
    ? users.filter((u) => u.id === user.id)
    : users.filter((u) => u.active && u.role === 'EMPLOYEE' && (user.role === 'ADMIN' || u.managerId === user.id))

  const hours = people.map((p) => p.allocatedHours ?? 0)
  return {
    people: people.length,
    total: people.length * HOURS_PER_WEEK,
    allocated: hours.reduce((sum, h) => sum + h, 0),
    fullyBooked: hours.filter((h) => h === HOURS_PER_WEEK).length,
    overAllocated: hours.filter((h) => h > HOURS_PER_WEEK).length,
    unassigned: hours.filter((h) => h === 0).length,
  }
}
