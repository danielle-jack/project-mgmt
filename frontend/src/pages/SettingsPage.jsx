import { useState } from 'react'
import { Avatar, PageHeading, useAction } from '../components/ui'
import { resizePhoto } from '../components/photos'
import { Notice } from './ProjectsPage'
import { DAY_HOURS, POLICY, ROLE_LABEL, ROLES, WEEK_HOURS, WORK_DAYS } from '../utils/rules'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Props: user, data ({ users }), actions ({ updateProfile, setPhoto, changePassword }). */
export default function SettingsPage({ user, data, actions }) {
  const [form, setForm] = useState({ name: user.name, email: user.email })
  const [notice, setNotice] = useState('')
  const { pending, error, setError, run } = useAction()
  const manager = data.users.find((u) => u.id === user.managerId)
  const changed = form.name.trim() !== user.name || form.email.trim().toLowerCase() !== user.email.toLowerCase()
  const photo = useAction()

  async function pickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // so picking the same file again still triggers a change
    if (!file) return
    const ok = await photo.run(async () => actions.setPhoto(user.id, await resizePhoto(file)))
    if (ok) setNotice('Photo updated.')
  }

  async function removePhoto() {
    const ok = await photo.run(() => actions.setPhoto(user.id, null))
    if (ok) setNotice('Photo removed.')
  }

  async function save(e) {
    e.preventDefault()
    const email = form.email.trim().toLowerCase()
    if (!form.name.trim()) return setError('Enter your full name.')
    if (!EMAIL.test(email)) return setError('Enter a valid email address, like name@company.com.')
    if (data.users.some((u) => u.id !== user.id && u.email.toLowerCase() === email)) return setError('Someone else already uses that email.')
    const ok = await run(() => actions.updateProfile({ name: form.name.trim(), email }))
    if (ok) setNotice(email !== user.email.toLowerCase() ? 'Profile saved. Use your new email next time you log in.' : 'Profile saved.')
  }

  return (
    <>
      <PageHeading title="Settings" subtitle="Your profile and how your organization plans work." />
      {notice && <Notice text={notice} onDismiss={() => setNotice('')} />}

      <section className="settings-grid">
        <div className="settings-main">
        <form className="panel settings-panel" onSubmit={save} noValidate>
          <div className="panel-header"><div><h2>Profile</h2><p>You can change your name, email and photo.</p></div></div>
          <div className="settings-body form-grid">
            <div className="profile-preview form-wide">
              <Avatar name={form.name || user.name} userId={user.id} />
              <span><strong>{form.name || user.name}</strong><small>{form.email}</small></span>
              <span className="photo-actions">
                <label className="secondary-button photo-upload">
                  {photo.pending ? 'Saving…' : user.photo ? 'Change photo' : 'Upload photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} disabled={photo.pending} />
                </label>
                {user.photo && <button type="button" className="text-button danger-text" onClick={removePhoto} disabled={photo.pending}>Remove</button>}
              </span>
            </div>
            {photo.error && <div className="login-error form-wide" role="alert">{photo.error}</div>}
            <label className="login-field form-wide">Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="login-field form-wide">Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            {error && <div className="login-error form-wide" role="alert">{error}</div>}
            <div className="form-wide settings-actions">
              <button type="button" className="secondary-button" disabled={!changed || pending} onClick={() => { setForm({ name: user.name, email: user.email }); setError('') }}>Discard</button>
              <button type="submit" className="primary-button" disabled={!changed || pending}>{pending ? 'Saving…' : 'Save profile'}</button>
            </div>
          </div>
        </form>

        <PasswordPanel actions={actions} onSaved={setNotice} />
        </div>

        <div className="settings-side">
          <div className="panel settings-panel">
            <div className="panel-header"><div><h2>Account</h2><p>Set by an admin</p></div></div>
            <dl className="facts">
              <div><dt>Role</dt><dd>{ROLE_LABEL[user.role]}</dd></div>
              {user.role === ROLES.EMPLOYEE && <div><dt>Manager</dt><dd>{manager?.name ?? 'Not assigned'}</dd></div>}
            </dl>
          </div>

          <div className="panel settings-panel">
            <div className="panel-header"><div><h2>Planning rules</h2><p>Apply to everyone in the organization</p></div></div>
            <dl className="facts">
              <div><dt>Work week</dt><dd>{WEEK_HOURS}h ({DAY_HOURS}h × {WORK_DAYS} days)</dd></div>
              <div><dt>Weekly limit</dt><dd>{WEEK_HOURS}h per person, across all projects</dd></div>
              <div><dt>Team members</dt><dd>{POLICY.managersAssignOnlyOwnEmployees ? 'Managers assign their own reports' : 'Managers assign any employee'}</dd></div>
              <div><dt>Dependencies</dt><dd>{POLICY.dependencyGate === 'START' ? 'Must be complete before a milestone starts' : 'Must be complete before a milestone is completed'}</dd></div>
              <div><dt>Project dependencies</dt><dd>A project is completed only after the projects it depends on</dd></div>
              <div><dt>Finished projects</dt><dd>Managers mark them completed, admins archive them</dd></div>
              <div><dt>Deactivating & archiving</dt><dd>Needs a reason; nothing is ever deleted</dd></div>
            </dl>
          </div>
        </div>
      </section>
    </>
  )
}

/** Change your own password. New users start with a temporary one from their admin. */
function PasswordPanel({ actions, onSaved }) {
  const empty = { current: '', next: '', confirm: '' }
  const [form, setForm] = useState(empty)
  const { pending, error, setError, run } = useAction()
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function save(e) {
    e.preventDefault()
    if (!form.current) return setError('Enter your current password.')
    if (form.next.length < 8) return setError('Your new password needs at least 8 characters.')
    if (form.next !== form.confirm) return setError('The two new passwords don’t match.')
    const ok = await run(() => actions.changePassword(form.current, form.next))
    if (ok) { setForm(empty); onSaved('Password changed. Use it next time you log in.') }
  }

  return (
    <form className="panel settings-panel" onSubmit={save} noValidate>
      <div className="panel-header"><div><h2>Password</h2><p>Replace the temporary password your admin gave you.</p></div></div>
      <div className="settings-body form-grid">
        <label className="login-field form-wide">Current password
          <input type="password" value={form.current} onChange={set('current')} autoComplete="current-password" /></label>
        <label className="login-field">New password
          <input type="password" value={form.next} onChange={set('next')} autoComplete="new-password" /></label>
        <label className="login-field">Repeat new password
          <input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" /></label>
        {error && <div className="login-error form-wide" role="alert">{error}</div>}
        <div className="form-wide settings-actions">
          <button type="submit" className="primary-button" disabled={pending || !form.current || !form.next}>{pending ? 'Saving…' : 'Change password'}</button>
        </div>
      </div>
    </form>
  )
}
