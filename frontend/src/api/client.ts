/** API 客户端 —— 统一的 HTTP 请求封装 */

const BASE = '/api'

// 存储 token
let _token: string | null = localStorage.getItem('auth_token')

export function setToken(token: string | null) {
  _token = token
  if (token) {
    localStorage.setItem('auth_token', token)
  } else {
    localStorage.removeItem('auth_token')
  }
}

export function getToken(): string | null {
  return _token
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail || `请求失败 (${res.status})`)
  }

  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: any) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data || {}) }),
  put: <T>(path: string, data?: any) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data || {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
