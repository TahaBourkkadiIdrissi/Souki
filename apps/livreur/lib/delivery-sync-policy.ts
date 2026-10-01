/** Only explicit business rejections may discard a durable delivery event. */
export function deliverySyncFailure(status?: number): "retry" | "session" | "conflict" | "reject" {
  if (status === 401 || status === 403) return "session"
  if (status === 409) return "conflict"
  if (status !== undefined && [400, 404, 410, 422].includes(status)) return "reject"
  return "retry" // network, 408, 425, 429, 5xx and unknown responses
}

export function deliveryRetryDelay(attempt: number) {
  return Math.min(300_000, 5000 * 2 ** Math.min(Math.max(attempt - 1, 0), 6))
}
