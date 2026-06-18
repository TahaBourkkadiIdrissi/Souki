import { getSecureItem, TOKEN_KEY } from "@/services/secureStorage"

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  ""
)

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

interface ApiOptions {
  method?: HttpMethod
  headers?: Record<string, string>
  body?: unknown
  token?: string | null
  signal?: AbortSignal
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function readToken(explicitToken?: string | null) {
  if (explicitToken !== undefined) return explicitToken
  return getSecureItem(TOKEN_KEY)
}

export async function apiCall<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const token = await readToken(options.token)
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...options.headers
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: options.method || "GET",
    headers,
    signal: options.signal,
    body:
      options.body === undefined
        ? undefined
        : isFormData
          ? (options.body as BodyInit)
          : JSON.stringify(options.body)
  })

  const contentType = response.headers.get("content-type") || ""
  const isJson = contentType.includes("application/json")

  if (!response.ok) {
    const errorPayload = isJson ? await response.json().catch(() => null) : null
    throw new ApiError(response.status, errorPayload?.detail || `API error: ${response.status}`)
  }

  if (!isJson) {
    return null as T
  }

  return response.json() as Promise<T>
}
