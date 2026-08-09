import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import type { User } from '../types'
import * as authApi from '../api/auth'
import { getToken } from '../api/client'

interface AuthState {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string, hours: number) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
})

export function useAuthProvider(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 检查本地 token，自动恢复登录态
    if (getToken()) {
      authApi.getMe()
        .then(setUser)
        .catch(() => authApi.logout())
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password)
    setUser(res.user)
  }, [])

  const register = useCallback(async (
    username: string, email: string, password: string, hours: number,
  ) => {
    const res = await authApi.register(username, email, password, hours)
    setUser(res.user)
  }, [])

  const logout = useCallback(() => {
    authApi.logout()
    setUser(null)
  }, [])

  return { user, loading, login, register, logout }
}

export function useAuth() {
  return useContext(AuthContext)
}
