import { api, setToken } from './client'
import type { AuthResponse, User } from '../types'

export async function register(
  username: string,
  email: string,
  password: string,
  dailyHours: number,
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/register', {
    username,
    email,
    password,
    daily_available_hours: dailyHours,
  })
  setToken(res.access_token)
  return res
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login', { username, password })
  setToken(res.access_token)
  return res
}

export function logout() {
  setToken(null)
}

export async function getMe(): Promise<User> {
  return api.get<User>('/auth/me')
}
