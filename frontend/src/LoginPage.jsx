import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from './AuthContext'
import { Loader2, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')   // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else {
        if (form.password.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); setLoading(false); return }
        await register(form.email, form.password, form.name)
      }
    } catch (err) {
      setError(err?.response?.data?.detail || '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #080c18 0%, #0e0a1f 50%, #080c18 100%)' }}>
      <div aria-hidden className="fixed inset-0 pointer-events-none" style={{
        background:
          'radial-gradient(ellipse 60% 50% at 10% 10%, rgba(30,58,138,0.35) 0%, transparent 70%),' +
          'radial-gradient(ellipse 50% 45% at 90% 90%, rgba(76,29,149,0.3) 0%, transparent 70%)',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative w-full max-w-sm"
      >
        {/* 로고 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            Bid-Master AI
          </h1>
          <p className="text-xs text-slate-500 mt-1">지능형 입찰 전략 플랫폼</p>
        </div>

        {/* 카드 */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur p-8">
          {/* 탭 */}
          <div className="flex rounded-xl bg-white/5 p-1 mb-6">
            {['login', 'register'].map((m) => (
              <button key={m} type="button"
                onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === m
                    ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {m === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <label className="block text-xs text-slate-400 mb-1.5">이름</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={set('name')}
                    placeholder="홍길동"
                    className="w-full px-3.5 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">이메일</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="email@example.com"
                required
                className="w-full px-3.5 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">비밀번호</label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder={mode === 'register' ? '8자 이상' : ''}
                required
                className="w-full px-3.5 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <AlertCircle size={13} className="text-rose-400 shrink-0" />
                <p className="text-xs text-rose-300">{error}</p>
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {mode === 'login' ? '로그인' : '가입하기'}
            </motion.button>
          </form>

          {mode === 'register' && (
            <p className="text-xs text-slate-600 text-center mt-4">
              첫 번째 가입 계정은 자동으로 관리자(Admin)가 됩니다.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}
