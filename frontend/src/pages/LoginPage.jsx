import { useState } from 'react'
import { login } from '../services/authApi'
import { USE_FAKE_DATA } from '../services/api'
import { createSeedData, DEMO_PASSWORD } from '../services/fake/fakeData'
import { ROLE_SHORT } from '../utils/format'

// With fake data on, offer one-click logins for the sample accounts.
const demoAccounts = USE_FAKE_DATA
  ? createSeedData().users.filter((u) => u.active).map(({ email, name, role }) => ({ email, name, role }))
  : []

/**
 * Not in the wireframes yet: a simple login in the same visual style.
 * New users get a temporary password from their admin.
 */
export default function LoginPage({ onLoggedIn, onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(address, secret) {
    setBusy(true)
    setError('')
    try {
      onLoggedIn(await login(address, secret))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand login-brand">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>Planeo</span>
        </div>
        <h1>Log in</h1>
        <p>Use the email and password your admin set up for you.</p>

        <form onSubmit={(e) => { e.preventDefault(); submit(email, password) }}>
          <label className="login-field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com" autoComplete="username" autoFocus required />
          </label>
          <label className="login-field login-password">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" required />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button className="primary-button login-submit" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        {demoAccounts.length > 0 && (
          <div className="demo-accounts">
            <div className="nav-label">Sample accounts · password “{DEMO_PASSWORD}”</div>
            {demoAccounts.map((account) => (
              <button key={account.email} type="button" disabled={busy} onClick={() => submit(account.email, DEMO_PASSWORD)}>
                <strong>{account.name}</strong>
                <small>{ROLE_SHORT[account.role]}</small>
              </button>
            ))}
          </div>
        )}

        <button type="button" className="text-button login-back" onClick={onBack}>← Back to home</button>
      </div>
    </div>
  )
}
