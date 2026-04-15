const API_BASE_URL = "http://localhost:8000"

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  headers?: Record<string, string>
  body?: any
  token?: string
}

export async function apiCall(endpoint: string, options: ApiOptions = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers
  }

  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`
  }

  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers
  }

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body)
  }

  const response = await fetch(url, fetchOptions)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || `API error: ${response.status}`)
  }

  return response.json()
}

export async function validateUserToken(token: string) {
  try {
    return await apiCall("/auth/me", { token })
  } catch (error) {
    throw error
  }
}

export async function loginUser(loginId: string, password: string) {
  return await apiCall("/auth/login", {
    method: "POST",
    body: { login_id: loginId, password }
  })
}
