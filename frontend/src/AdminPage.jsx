import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import {
  Users, Activity, Database, RefreshCw, Loader2,
  CheckCircle2, XCircle, ChevronDown, Play, Clock,
  ShieldCheck, BarChart2, AlertCircle, Search,
  CalendarDays, User, X,
} from 'lucide-react'
import { ROLE_META } from './AuthContext'

const API = '/api'

function cx(...args) { return twMerge(...args) }

function GlassCard({ children, className }) {
  return (
    <div className={cx('rounded-2xl border border-white/10 bg-slate-900/70', className)}>
      {children}
    </div>
  )
}

const ADMIN_TABS = [
  { id: 'users',   label: '회원 관리',   icon: Users },
  { id: 'usage',   label: '사용량',      icon: BarChart2 },
  { id: 'collect', label: '데이터 수집', icon: Database },
]

const ROLES = ['general', 'premium', 'manager', 'admin']

/* ── 회원 관리 ─────────────────────────────────────────────── */

function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/admin/users`)
      setUsers(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const updateUser = async (id, patch) => {
    setUpdating(id)
    try {
      await axios.patch(`${API}/admin/users/${id}`, patch)
      await load()
    } catch (e) {
      alert(e?.response?.data?.detail || '업데이트 실패')
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
      <Loader2 size={18} className="animate-spin text-violet-400" />
      <span className="text-sm">불러오는 중...</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">총 <span className="text-white font-medium">{users.length}</span>명</p>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs transition-all">
          <RefreshCw size={12} />새로고침
        </motion.button>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                <th className="text-left px-5 py-3 font-medium">이메일</th>
                <th className="text-left px-5 py-3 font-medium">이름</th>
                <th className="text-left px-5 py-3 font-medium">역할</th>
                <th className="text-left px-5 py-3 font-medium">AI 사용</th>
                <th className="text-left px-5 py-3 font-medium">상태</th>
                <th className="text-left px-5 py-3 font-medium">가입일</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const role = ROLE_META[u.role] ?? ROLE_META.general
                const isUpdating = updating === u.id
                return (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-5 py-3 text-slate-300 font-mono text-xs">{u.email}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{u.name || '-'}</td>
                    <td className="px-5 py-3">
                      <div className="relative inline-block">
                        <select
                          value={u.role}
                          disabled={isUpdating}
                          onChange={(e) => updateUser(u.id, { role: e.target.value })}
                          className={cx(
                            'appearance-none pl-2.5 pr-6 py-1 rounded-lg text-xs font-medium border cursor-pointer transition-all bg-slate-900',
                            role.color,
                            isUpdating && 'opacity-50',
                          )}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_META[r].label}</option>
                          ))}
                        </select>
                        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 max-w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          {u.ai_daily_limit > 0 && (
                            <div
                              className="h-full bg-violet-500 rounded-full"
                              style={{ width: `${Math.min(100, (u.ai_calls_today / u.ai_daily_limit) * 100)}%` }}
                            />
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
                          {u.ai_calls_today}/{u.ai_daily_limit === -1 ? '∞' : u.ai_daily_limit}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => updateUser(u.id, { role: u.role, is_active: u.is_active ? 0 : 1 })}
                        disabled={isUpdating}
                        className="flex items-center gap-1 transition-all hover:opacity-80"
                      >
                        {isUpdating ? (
                          <Loader2 size={14} className="animate-spin text-slate-500" />
                        ) : u.is_active ? (
                          <><CheckCircle2 size={14} className="text-emerald-400" /><span className="text-xs text-emerald-400">활성</span></>
                        ) : (
                          <><XCircle size={14} className="text-rose-400" /><span className="text-xs text-rose-400">비활성</span></>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600 font-mono">
                      {u.created_at?.slice(0, 10) ?? '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}

/* ── 사용량 — 사용자별 일간 차트 ────────────────────────────── */

function DailyUsageChart({ daily }) {
  if (!daily || daily.length === 0) return (
    <p className="text-sm text-slate-600 text-center py-6">사용 기록 없음</p>
  )

  // 오래된 날짜 → 최신 날짜 순으로 정렬
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
  const maxCount = Math.max(...sorted.map(d => d.count), 1)

  return (
    <div>
      {/* 막대 차트 */}
      <div className="flex items-end gap-0.5 h-28 px-1">
        {sorted.map(({ date, count }) => {
          const pct = (count / maxCount) * 100
          return (
            <div key={date} className="flex flex-col items-center justify-end flex-1 min-w-0 group h-full">
              <div className="relative flex flex-col items-center justify-end w-full h-full">
                {/* hover 툴팁 */}
                <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                  <div className="bg-slate-800 border border-white/10 rounded-md px-2 py-1 text-xs text-white whitespace-nowrap shadow-lg">
                    {date}<br />{count}회
                  </div>
                  <div className="w-1.5 h-1.5 bg-slate-800 border-r border-b border-white/10 rotate-45 -mt-1" />
                </div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(pct, 4)}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className={cx(
                    'w-full rounded-t transition-colors',
                    count >= maxCount * 0.8 ? 'bg-violet-500 group-hover:bg-violet-400' :
                    count >= maxCount * 0.4 ? 'bg-blue-500/70 group-hover:bg-blue-400' :
                                              'bg-slate-600/60 group-hover:bg-slate-500',
                  )}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* 날짜 레이블 — 5개 간격으로 표시 */}
      <div className="flex gap-0.5 mt-1.5 px-1">
        {sorted.map(({ date }, i) => (
          <div key={date} className="flex-1 min-w-0 text-center">
            {(i === 0 || i === sorted.length - 1 || i % Math.ceil(sorted.length / 5) === 0) && (
              <span className="text-xs text-slate-600 block truncate">{date.slice(5)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 사용량 탭 ─────────────────────────────────────────────── */

function UsageTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // 사용자별 뷰
  const [viewMode, setViewMode] = useState('role')   // 'role' | 'user'
  const [users, setUsers]       = useState([])
  const [userQuery, setUserQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [userDetail, setUserDetail]     = useState(null)
  const [userLoading, setUserLoading]   = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    axios.get(`${API}/admin/usage`)
      .then(({ data: d }) => setData(d))
      .finally(() => setLoading(false))
    axios.get(`${API}/admin/users`)
      .then(({ data: d }) => setUsers(d))
  }, [])

  const selectUser = useCallback(async (u) => {
    setSelectedUser(u)
    setUserQuery(u.email)
    setUserDetail(null)
    setUserLoading(true)
    try {
      const { data: d } = await axios.get(`${API}/admin/usage/user/${u.id}`)
      setUserDetail(d)
    } finally {
      setUserLoading(false)
    }
  }, [])

  const clearUser = () => {
    setSelectedUser(null)
    setUserDetail(null)
    setUserQuery('')
    inputRef.current?.focus()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
      <Loader2 size={18} className="animate-spin text-violet-400" />
    </div>
  )

  const byRole = data?.by_role ?? {}
  const maxCalls = Math.max(...Object.values(byRole), 1)

  const filteredUsers = userQuery && !selectedUser
    ? users.filter(u =>
        u.email.toLowerCase().includes(userQuery.toLowerCase()) ||
        (u.name && u.name.includes(userQuery))
      ).slice(0, 6)
    : []

  return (
    <div className="flex flex-col gap-5">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: '오늘 AI 분석 호출', value: data?.today_calls ?? 0, color: 'text-violet-400' },
          { label: '누적 AI 분석 호출', value: data?.total_calls ?? 0, color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <GlassCard key={label} className="p-6">
            <p className="text-xs text-slate-500 mb-2">{label}</p>
            <p className={cx('text-3xl font-bold', color)}>{value.toLocaleString()}</p>
          </GlassCard>
        ))}
      </div>

      {/* 뷰 모드 토글 */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
        {[
          { id: 'role', label: '역할별', icon: BarChart2 },
          { id: 'user', label: '사용자별', icon: User },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setViewMode(id)}
            className={cx(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              viewMode === id
                ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow'
                : 'text-slate-500 hover:text-slate-300',
            )}
          >
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'role' ? (
          /* ── 역할별 차트 ── */
          <motion.div
            key="role"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
          >
            <GlassCard className="p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">역할별 AI 호출</p>
              {Object.keys(byRole).length === 0 ? (
                <p className="text-sm text-slate-600 text-center py-4">데이터 없음</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {Object.entries(byRole).map(([role, count]) => {
                    const meta = ROLE_META[role] ?? ROLE_META.general
                    const pct = (count / maxCalls) * 100
                    return (
                      <div key={role} className="flex items-center gap-3">
                        <span className={cx('w-16 shrink-0 px-2 py-0.5 rounded-md text-xs font-medium border text-center', meta.color)}>
                          {meta.label}
                        </span>
                        <div className="flex-1 h-5 bg-white/5 rounded-md overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full bg-gradient-to-r from-violet-600 to-blue-500 rounded-md"
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-mono text-slate-400">{count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </GlassCard>
          </motion.div>
        ) : (
          /* ── 사용자별 뷰 ── */
          <motion.div
            key="user"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
            className="flex flex-col gap-4"
          >
            {/* 사용자 검색 */}
            <GlassCard className="p-4">
              <p className="text-xs text-slate-500 mb-3 font-medium">사용자 검색</p>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  ref={inputRef}
                  value={userQuery}
                  onChange={(e) => { setUserQuery(e.target.value); if (selectedUser) setSelectedUser(null) }}
                  placeholder="이메일 또는 이름으로 검색..."
                  className="w-full pl-9 pr-9 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                {userQuery && (
                  <button onClick={clearUser} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* 드롭다운 검색 결과 */}
              {filteredUsers.length > 0 && (
                <div className="mt-1.5 rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
                  {filteredUsers.map((u) => {
                    const meta = ROLE_META[u.role] ?? ROLE_META.general
                    return (
                      <button
                        key={u.id}
                        onClick={() => selectUser(u)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                          <User size={12} className="text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">{u.email}</p>
                          <p className="text-xs text-slate-600 truncate">{u.name || '이름 없음'}</p>
                        </div>
                        <span className={cx('shrink-0 px-2 py-0.5 rounded-md text-xs font-medium border', meta.color)}>
                          {meta.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </GlassCard>

            {/* 선택된 사용자 상세 */}
            {selectedUser && (
              <GlassCard className="overflow-hidden">
                {/* 사용자 헤더 */}
                <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                    <User size={15} className="text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">{selectedUser.email}</p>
                      <span className={cx('shrink-0 px-2 py-0.5 rounded-md text-xs font-medium border', (ROLE_META[selectedUser.role] ?? ROLE_META.general).color)}>
                        {(ROLE_META[selectedUser.role] ?? ROLE_META.general).label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{selectedUser.name || '이름 없음'}</p>
                  </div>
                </div>

                {userLoading ? (
                  <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
                    <Loader2 size={16} className="animate-spin text-violet-400" />
                    <span className="text-xs">불러오는 중...</span>
                  </div>
                ) : userDetail ? (
                  <div className="p-5 flex flex-col gap-5">
                    {/* 요약 통계 */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: '누적 AI 호출', value: userDetail.total, color: 'text-violet-400' },
                        { label: '오늘 사용',     value: userDetail.user.ai_calls_today, color: 'text-blue-400' },
                        {
                          label: '일일 한도',
                          value: userDetail.user.ai_daily_limit === -1 ? '∞' : userDetail.user.ai_daily_limit,
                          color: 'text-slate-300',
                        },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="rounded-xl bg-white/5 border border-white/8 p-3 text-center">
                          <p className="text-xs text-slate-500 mb-1">{label}</p>
                          <p className={cx('text-xl font-bold', color)}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* 일간 사용량 차트 */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <CalendarDays size={13} className="text-violet-400" />
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">일별 AI 사용 (최근 30일)</p>
                      </div>
                      <DailyUsageChart daily={userDetail.daily} />
                    </div>

                    {/* 날짜별 상세 테이블 */}
                    {userDetail.daily.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">날짜별 상세</p>
                        <div className="rounded-xl border border-white/8 overflow-hidden">
                          <div className="flex flex-col divide-y divide-white/5 max-h-40 overflow-y-auto">
                            {[...userDetail.daily]
                              .sort((a, b) => b.date.localeCompare(a.date))
                              .map(({ date, count }) => (
                              <div key={date} className="flex items-center px-4 py-2 bg-white/3 hover:bg-white/5 transition-colors">
                                <span className="text-xs font-mono text-slate-400 flex-1">{date}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-violet-500 rounded-full"
                                      style={{ width: `${(count / Math.max(...userDetail.daily.map(d => d.count), 1)) * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-mono text-violet-300 w-8 text-right">{count}회</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </GlassCard>
            )}

            {/* 미선택 안내 */}
            {!selectedUser && !userQuery && (
              <GlassCard className="p-10 text-center">
                <User size={28} className="text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-600">위에서 사용자를 검색해 선택하면<br />일별 AI 사용 현황이 표시됩니다.</p>
              </GlassCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── 수집 로그 카드 ─────────────────────────────────────────── */

const TYPE_COLOR = {
  수동: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  일간: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  주간: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
}

function duration(started, finished) {
  if (!started || !finished) return null
  const s = new Date(started), f = new Date(finished)
  const sec = Math.round((f - s) / 1000)
  if (sec < 60) return `${sec}초`
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`
}

function fmtDt(iso) {
  if (!iso) return '-'
  return iso.slice(0, 19).replace('T', ' ')
}

function lineColor(line) {
  if (line.startsWith('[완료]')) return 'text-emerald-400'
  if (line.startsWith('[경고]') || line.includes('실패')) return 'text-amber-400'
  if (line.startsWith('[시작]')) return 'text-blue-400'
  return 'text-slate-400'
}

/* 터미널 뷰 — 개별 로그 항목 클릭 시 확장 */
function LogTerminal({ log }) {
  const termRef = useRef(null)
  const lines   = log.lines ?? []

  // 새 줄이 생길 때 자동 스크롤
  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight
    }
  }, [lines.length])

  if (lines.length === 0 && log.status === 'running') {
    return (
      <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-500">
        <Loader2 size={11} className="animate-spin text-blue-400 shrink-0" />
        <span>프로세스 시작 중...</span>
      </div>
    )
  }

  if (lines.length === 0) return null

  return (
    <div
      ref={termRef}
      className="bg-black/40 rounded-lg mx-3 mb-3 p-3 max-h-52 overflow-y-auto font-mono text-xs leading-relaxed scroll-smooth"
    >
      {lines.map((line, i) => (
        <div key={i} className={cx('whitespace-pre-wrap break-all', lineColor(line))}>
          <span className="text-slate-700 select-none mr-2">{String(i + 1).padStart(2, ' ')} │</span>
          {line}
        </div>
      ))}
      {log.status === 'running' && (
        <div className="flex items-center gap-1.5 mt-1 text-blue-400">
          <Loader2 size={10} className="animate-spin" />
          <span className="animate-pulse">_</span>
        </div>
      )}
    </div>
  )
}

const CollectLogCard = forwardRef(function CollectLogCard(props, ref) {
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null)   // 펼쳐진 로그 인덱스
  const pollRef = useRef(null)

  const silentLoad = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/admin/collect-logs`)
      setLogs(data)
      // 진행 중인 항목이 없으면 폴링 중단
      const hasRunning = data.some(l => l.status === 'running')
      if (!hasRunning && pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    } catch { /* 무시 */ }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    await silentLoad()
    setLoading(false)
  }, [silentLoad])

  // 부모에서 load() 호출 가능하도록 노출
  useImperativeHandle(ref, () => ({ load }), [load])

  useEffect(() => { load() }, [load])

  // 진행 중 항목 감지 → 2초 폴링 시작
  useEffect(() => {
    const hasRunning = logs.some(l => l.status === 'running')
    if (hasRunning && !pollRef.current) {
      pollRef.current = setInterval(silentLoad, 2000)
      // 진행 중 항목이 있으면 자동으로 첫 번째 펼치기
      const idx = logs.findIndex(l => l.status === 'running')
      if (idx !== -1) setExpanded(idx)
    }
    return () => {
      if (!hasRunning && pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [logs, silentLoad])

  // 언마운트 시 폴링 정리
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  return (
    <GlassCard className="overflow-hidden">
      <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-slate-500" />
          <p className="text-sm font-medium text-slate-300">수집 로그</p>
          {logs.some(l => l.status === 'running') && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              실시간
            </span>
          )}
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={load}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs transition-all">
          <RefreshCw size={11} />새로고침
        </motion.button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 gap-2 text-slate-500">
          <Loader2 size={15} className="animate-spin text-violet-400" />
          <span className="text-xs">불러오는 중...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-10 text-center">
          <Clock size={22} className="text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-600">아직 수집 기록이 없습니다.</p>
          <p className="text-xs text-slate-700 mt-1">수동 수집을 실행하거나 스케줄러가 동작하면 여기에 기록됩니다.</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
          {logs.map((log, i) => {
            const isRunning  = log.status === 'running'
            const isError    = log.status === 'error'
            const isExpanded = expanded === i
            const hasLines   = (log.lines ?? []).length > 0 || isRunning

            return (
              <div key={i} className={cx('transition-colors', isRunning ? 'bg-blue-500/5' : '')}>
                {/* 로그 항목 헤더 — 클릭으로 터미널 토글 */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : i)}
                  className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-white/3 transition-colors text-left"
                >
                  {/* 상태 아이콘 */}
                  <div className="shrink-0 mt-0.5">
                    {isRunning ? (
                      <Loader2 size={14} className="animate-spin text-blue-400" />
                    ) : isError ? (
                      <AlertCircle size={14} className="text-rose-400" />
                    ) : (
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cx('px-2 py-0.5 rounded-md text-xs font-medium border', TYPE_COLOR[log.type] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30')}>
                        {log.type}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{log.days}일치 수집</span>
                      {isRunning && (
                        <span className="text-xs text-blue-400 font-medium">진행 중...</span>
                      )}
                      {!isRunning && (
                        <span className={cx('text-xs font-medium', isError ? 'text-rose-400' : 'text-emerald-400')}>
                          {isError ? '실패' : '완료'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Clock size={10} className="shrink-0" />
                        {fmtDt(log.started_at)}
                      </span>
                      {!isRunning && log.finished_at && (
                        <span>소요 {duration(log.started_at, log.finished_at)}</span>
                      )}
                      {isRunning && (
                        <span className="text-blue-500/70">
                          {Math.round((Date.now() - new Date(log.started_at)) / 1000)}초 경과
                        </span>
                      )}
                    </div>

                    {/* 마지막 줄 요약 (접힌 상태) */}
                    {!isExpanded && log.message && (
                      <p className={cx(
                        'mt-1 text-xs font-mono truncate',
                        isError ? 'text-rose-400/70' : isRunning ? 'text-blue-400/70' : 'text-slate-600',
                      )}>
                        {log.message}
                      </p>
                    )}
                  </div>

                  {/* 펼치기 화살표 */}
                  {hasLines && (
                    <ChevronDown
                      size={13}
                      className={cx(
                        'shrink-0 mt-1 text-slate-600 transition-transform',
                        isExpanded && 'rotate-180',
                      )}
                    />
                  )}
                </button>

                {/* 터미널 뷰 (펼쳤을 때) */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <LogTerminal log={log} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </GlassCard>
  )
})

/* ── 데이터 수집 탭 ─────────────────────────────────────────── */

function CollectTab() {
  const [stats, setStats] = useState(null)
  const [days, setDays] = useState(3)
  const [collecting, setCollecting] = useState(false)
  const [result, setResult] = useState(null)
  const logRef = useRef(null)

  useEffect(() => {
    axios.get(`${API}/stats`).then(({ data }) => setStats(data))
  }, [])

  const triggerCollect = async () => {
    setCollecting(true)
    setResult(null)
    try {
      const { data } = await axios.post(`${API}/admin/collect?days=${days}`)
      setResult({ ok: true, msg: `수집 시작됨 (${data.days}일치)` })
      // 2초 후 stats & 로그 갱신
      setTimeout(() => {
        axios.get(`${API}/stats`).then(({ data: d }) => setStats(d))
        logRef.current?.load()
      }, 2000)
    } catch (e) {
      setResult({ ok: false, msg: e?.response?.data?.detail || '수집 실패' })
    } finally {
      setCollecting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 시스템 상태 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '전체 공고',   value: stats?.total_bids?.toLocaleString() ?? '-',    color: 'text-blue-400' },
          { label: '개찰 결과',   value: stats?.total_results?.toLocaleString() ?? '-', color: 'text-violet-400' },
          { label: '사정률 보유', value: stats?.results_with_rate?.toLocaleString() ?? '-', color: 'text-emerald-400' },
          { label: '스케줄러',    value: stats?.scheduler ? '운영 중' : '중지',        color: stats?.scheduler ? 'text-emerald-400' : 'text-rose-400' },
        ].map(({ label, value, color }) => (
          <GlassCard key={label} className="p-5">
            <p className="text-xs text-slate-500 mb-2">{label}</p>
            <p className={cx('text-xl font-bold', color)}>{value}</p>
          </GlassCard>
        ))}
      </div>

      {/* 마지막 수집 */}
      {stats?.last_collect && (
        <GlassCard className="p-4 flex items-center gap-3">
          <Clock size={14} className="text-slate-500 shrink-0" />
          <p className="text-xs text-slate-400">
            마지막 수집: <span className="text-slate-200 font-medium">{stats.last_collect.slice(0, 16).replace('T', ' ')}</span>
          </p>
        </GlassCard>
      )}

      {/* 수동 수집 */}
      <GlassCard className="p-6">
        <p className="text-sm font-semibold text-slate-300 mb-1">수동 데이터 수집</p>
        <p className="text-xs text-slate-500 mb-5">KONEPS API에서 최신 공고와 개찰결과를 즉시 수집합니다.</p>

        <div className="flex items-center gap-3 mb-4">
          <p className="text-xs text-slate-400 shrink-0">수집 기간</p>
          <div className="flex gap-2">
            {[3, 7, 14, 30].map((d) => (
              <button key={d} type="button"
                onClick={() => setDays(d)}
                className={cx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  days === d
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white',
                )}
              >
                {d}일
              </button>
            ))}
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={triggerCollect}
          disabled={collecting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-medium disabled:opacity-50 transition-all"
        >
          {collecting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {collecting ? '수집 중...' : `최근 ${days}일치 수집 시작`}
        </motion.button>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cx(
              'mt-4 flex items-center gap-2 p-3 rounded-xl border text-xs',
              result.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300',
            )}
          >
            {result.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {result.msg}
          </motion.div>
        )}
      </GlassCard>

      {/* 스케줄 안내 */}
      <GlassCard className="p-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">자동 수집 스케줄</p>
        <div className="flex flex-col gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3">
            <span className="w-20 shrink-0 text-slate-300 font-medium">매일 06:00</span>
            <span>최근 3일치 공고 수집</span>
          </div>
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3">
            <span className="w-20 shrink-0 text-slate-300 font-medium">매주 월 02:00</span>
            <span>최근 30일치 전체 갱신</span>
          </div>
        </div>
      </GlassCard>

      {/* 수집 로그 */}
      <CollectLogCard ref={logRef} />
    </div>
  )
}

/* ── 관리자 페이지 메인 ─────────────────────────────────────── */

export default function AdminPage({ onClose }) {
  const [tab, setTab] = useState('users')

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'linear-gradient(135deg, #080c18 0%, #0e0a1f 50%, #080c18 100%)' }}
    >
      <div aria-hidden className="fixed inset-0 pointer-events-none" style={{
        background:
          'radial-gradient(ellipse 60% 50% at 10% 10%, rgba(30,58,138,0.3) 0%, transparent 70%),' +
          'radial-gradient(ellipse 50% 45% at 90% 90%, rgba(76,29,149,0.25) 0%, transparent 70%)',
      }} />

      <div className="relative max-w-5xl mx-auto px-6 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30">
              <ShieldCheck size={18} className="text-rose-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">관리자 패널</h1>
              <p className="text-xs text-slate-500">Bid-Master AI</p>
            </div>
          </div>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-sm transition-all border border-white/10">
            대시보드로 돌아가기
          </motion.button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 w-fit">
          {ADMIN_TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cx(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                tab === id
                  ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {tab === 'users'   && <UsersTab />}
            {tab === 'usage'   && <UsageTab />}
            {tab === 'collect' && <CollectTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
