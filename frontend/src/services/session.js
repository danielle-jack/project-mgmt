// Remembers the login token, so a page reload keeps you logged in.
// Tokens expire after 8 hours; the backend then answers 401 and you log in again.

const STORAGE_KEY = 'tracker.authToken'

let currentToken = readStoredToken()

function readStoredToken() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function getToken() {
  return currentToken
}

export function setToken(token) {
  currentToken = token
  try {
    if (token == null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, token)
  } catch {
    // Storage blocked (private window etc.); the login just won't survive a reload.
  }
}
