import { getToken } from './session'
import { ApiError } from './errors'
import { handleFakeRequest } from './fake/fakeServer'

export { ApiError }

// Talks to the real backend. To use the in-browser fake data instead, put
// VITE_USE_FAKE_DATA=true in frontend/.env.development.local (not .env.local,
// which bin/generate-env.sh rewrites every time the dev environment starts).
export const USE_FAKE_DATA = import.meta.env.VITE_USE_FAKE_DATA === 'true'

// The Java backend is deployed as the "javaCode" service.
const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api/javaCode`

/**
 * Sends one request to the backend (or the fake server) and returns the parsed JSON.
 * Throws ApiError when the response is not 2xx, with the server's message.
 */
export async function request(method, path, body) {
  const token = getToken()

  if (USE_FAKE_DATA) {
    return handleFakeRequest(method, path, body, token)
  }

  const response = await fetch(BASE_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Not "Authorization": CloudFront doesn't forward that header to the Lambda here.
      ...(token && { 'X-Auth-Token': token }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new ApiError(response.status, data?.message ?? response.statusText)
  }
  return data
}

export const get = (path) => request('GET', path)
export const post = (path, body) => request('POST', path, body ?? {})
export const patch = (path, body) => request('PATCH', path, body)
export const put = (path, body) => request('PUT', path, body)
