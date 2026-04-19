import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const API = '/api'
const TOKEN_KEY = 'bm_token'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)      // { token, role, name, email, ai_calls_today, ai_daily_limit }
  const [loading, setLoading] = useState(true) // 초기 토큰 검증 중

  // axios 인터셉터 — 모든 요청에 Bearer 토큰 자동 첨부
  useEffect(() => {
    const id = axios.interceptors.request.use((config) => {
      const token = localStorage.getItem(TOKEN_KEY)
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    })
    return () => axios.interceptors.request.eject(id)
  }, [])

  // 앱 시작 시 저장된 토큰으로 사용자 정보 복원
  const restoreSession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) { setLoading(false); return }
    try {
      const { data } = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setUser({ token, ...data })
    } catch {
      localStorage.removeItem(TOKEN_KEY)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { restoreSession() }, [restoreSession])

  const login = async (email, password) => {
    const { data } = await axios.post(`${API}/auth/login`, { email, password })
    localStorage.setItem(TOKEN_KEY, data.access_token)
    // 상세 정보 조회
    const { data: me } = await axios.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    setUser({ token: data.access_token, ...me })
  }

  const register = async (email, password, name) => {
    await axios.post(`${API}/auth/register`, { email, password, name })
    await login(email, password)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  const refreshMe = async () => {
    try {
      const { data } = await axios.get(`${API}/auth/me`)
      setUser((u) => ({ ...u, ...data }))
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

// 권한 레이블/색상
export const ROLE_META = {
  admin:   { label: '관리자', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  manager: { label: '매니저', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  premium: { label: '프리미엄', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  general: { label: '일반',   color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}
