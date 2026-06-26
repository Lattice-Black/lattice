// API client for the admin control plane.
// Uses cookie-based session auth (credentials: 'include').

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const CSRF_HEADER = 'X-Requested-With'
const CSRF_VALUE = 'XMLHttpRequest'

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, ...fetchOptions } = options

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    [CSRF_HEADER]: CSRF_VALUE,
    ...options.headers,
  }

  const response = await fetch(endpoint, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  if (!response.ok) {
    const errorText = await response.text()
    let message = errorText || `HTTP ${response.status}`
    try {
      const parsed = JSON.parse(errorText)
      message = parsed.error || message
    } catch {}
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
}