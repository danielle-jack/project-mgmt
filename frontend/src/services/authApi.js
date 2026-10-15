import { post } from './api'
import { setToken } from './session'

/** Logs in and remembers the token. Returns the logged-in user. */
export async function login(email, password) {
  const { token, user } = await post('/auth/login', { email, password })
  setToken(token)
  return user
}

export function logout() {
  setToken(null)
}
