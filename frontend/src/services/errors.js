/** A failed request. status follows HTTP: 400 bad input, 403 not allowed, 404 missing, 409 rule broken. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
