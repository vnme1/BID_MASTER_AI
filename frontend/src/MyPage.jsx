import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import {
  User, Sparkles, Eye, Clock, ChevronRight,
  Loader2, BarChart2, CalendarDays, X,
  TrendingUp, Building2, RefreshCw,
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

function formatAmt(val) {
  const n = Number(val)
  if (!val || isNaN(n) || n === 0) return '-'
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만`
  return n.toLocaleString() + '원'
}

function fmtDt(iso) {
  if (!iso) return '-'
  return iso.slice(0, 16).replace('T', ' ')
}

/* ── 일간 AI 사용 미니 차트 ─────────────────────────────────── */
function MiniBarChart({ daily }) {
  if (!daily || daily.length === 0) return (
    <p className="text-xs text-slate-600 text-center py-4">사용 기록 없음</p>
  )
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
  const maxCount = Math.max(...sorted.map(d => d.count), 1)

  return (
    <div>
      <div className="flex items-end gap-0.5 h-20 px-1">
        {sorted.map(({ date, count }) => (
          <div key={date} className="flex flex-col items-center justify-end flex-1 min-w-0 group h-full">
            <div className="relative flex flex-col items-center justify-end w-full h-full">
              <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                <div className="bg-slate-800 border border-white/10 rounded-md px-2 py-1 text-xs text-white whitespace-nowrap shadow-lg">
                  {date.slice(5)}<br />{count}회
                </div>
                <div className="w-1.5 h-1.5 bg-slate-800 border-r border-b border-white/10 rotate-45 -mt-1" />
              </div>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max((count / maxCount) * 100, 6)}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="w-full rounded-t bg-violet-500/70 group-hover:bg-violet-400 transition-colors"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-0.5 mt-1 px-1">
        {sorted.map(({ date }, i) => (
          <div key={date} className="flex-1 min-w-0 text-center">
            {(i === 0 || i === sorted.length - 1) && (
              <span className="text-xs text-slate-700 block truncate">{date.slice(5)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 마이페이지 메인 ─────────────────────────────────────────── */

const TABS = [
  { id: 'overview', label: '개요',      icon: User },
  { id: 'views',    label: '열람 기록', icon: Eye },
  { id: 'ai',       label: 'AI 사용',   icon: Sparkles },
]

export default function MyPage({ onClose }) {
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: d } = await axios.get(`${API}/mypage`)
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

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

      <div className="relative max-w-3xl mx-auto px-6 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/15 border border-violet-500/30">
              <User size={18} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">마이페이지</h1>
              <p className="text-xs text-slate-500">Bid-Master AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={load}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
              title="새로고침"
            >
              <RefreshCw size={13} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-sm transition-all border border-white/10">
              <X size={13} />대시보드로 돌아가기
            </motion.button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 gap-2 text-slate-500">
            <Loader2 size={20} className="animate-spin text-violet-400" />
          </div>
        ) : data ? (
          <>
            {/* 탭 */}
            <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 w-fit">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={cx(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    tab === id
                      ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow'
                      : 'text-slate-500 hover:text-slate-300',
                  )}
                >
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {tab === 'overview' && <OverviewTab data={data} />}
                {tab === 'views'    && <ViewsTab views={data.views} />}
                {tab === 'ai'       && <AiTab aiLogs={data.ai_logs} aiDaily={data.ai_daily} />}
              </motion.div>
            </AnimatePresence>
          </>
        ) : null}
      </div>
    </motion.div>
  )
}

/* ── 개요 탭 ─────────────────────────────────────────────────── */

function OverviewTab({ data }) {
  const { user, views, ai_logs, ai_daily } = data
  const role = ROLE_META[user.role] ?? ROLE_META.general
  const totalAi = ai_daily.reduce((s, d) => s + d.count, 0)

  return (
    <div className="flex flex-col gap-5">
      {/* 프로필 카드 */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
            <User size={24} className="text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-base font-bold text-white truncate">{user.name || user.email}</p>
              <span className={cx('shrink-0 px-2 py-0.5 rounded-md text-xs font-medium border', role.color)}>
                {role.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">{user.email}</p>
            <p className="text-xs text-slate-700 mt-0.5">
              가입일 {user.created_at?.slice(0, 10) ?? '-'}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '열람한 공고', value: views.length, icon: Eye, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'AI 분석 (30일)', value: totalAi, icon: Sparkles, color: 'text-violet-400', bg: 'bg-violet-500/10' },
          {
            label: '오늘 AI 잔여',
            value: user.ai_daily_limit === -1 ? '∞' : Math.max(0, user.ai_daily_limit - user.ai_calls_today),
            icon: TrendingUp,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <GlassCard key={label} className="p-5 flex flex-col gap-2">
            <div className={cx('w-8 h-8 rounded-xl flex items-center justify-center', bg)}>
              <Icon size={15} className={color} />
            </div>
            <p className={cx('text-2xl font-bold', color)}>{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </GlassCard>
        ))}
      </div>

      {/* AI 사용 차트 */}
      {ai_daily.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={13} className="text-violet-400" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">일별 AI 사용 (최근 30일)</p>
          </div>
          <MiniBarChart daily={ai_daily} />
        </GlassCard>
      )}

      {/* 최근 열람 */}
      {views.length > 0 && (
        <GlassCard className="overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
            <Eye size={13} className="text-slate-500" />
            <p className="text-sm font-medium text-slate-300">최근 열람 공고</p>
          </div>
          <div className="divide-y divide-white/5">
            {views.slice(0, 5).map((v, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                <Building2 size={13} className="text-slate-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-300 truncate">{v.bid_name || v.bid_no}</p>
                  <p className="text-xs text-slate-600 truncate">{v.org_name || '-'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-500 font-mono">{fmtDt(v.viewed_at)}</p>
                  {v.est_price > 0 && <p className="text-xs text-blue-400">{formatAmt(v.est_price)}</p>}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  )
}

/* ── 열람 기록 탭 ─────────────────────────────────────────────── */

function ViewsTab({ views }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          총 <span className="text-white font-medium">{views.length}</span>건 (최근 50건)
        </p>
      </div>

      {views.length === 0 ? (
        <GlassCard className="p-16 text-center">
          <Eye size={28} className="text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-600">아직 열람한 공고가 없습니다.</p>
        </GlassCard>
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
            {views.map((v, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/3 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Eye size={12} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{v.bid_name || v.bid_no}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-600 truncate">{v.org_name || '-'}</p>
                    {v.est_price > 0 && (
                      <span className="text-xs text-blue-400 shrink-0">{formatAmt(v.est_price)}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-500 font-mono whitespace-nowrap">{fmtDt(v.viewed_at)}</p>
                  <p className="text-xs text-slate-700 font-mono">{v.bid_no}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  )
}

/* ── AI 사용 탭 ─────────────────────────────────────────────── */

function AiTab({ aiLogs, aiDaily }) {
  const total = aiDaily.reduce((s, d) => s + d.count, 0)

  return (
    <div className="flex flex-col gap-5">
      {/* 요약 */}
      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="p-5">
          <p className="text-xs text-slate-500 mb-2">30일 총 AI 분석</p>
          <p className="text-3xl font-bold text-violet-400">{total}</p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-xs text-slate-500 mb-2">분석한 공고 수</p>
          <p className="text-3xl font-bold text-blue-400">{new Set(aiLogs.map(l => l.bid_no)).size}</p>
        </GlassCard>
      </div>

      {/* 차트 */}
      {aiDaily.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays size={13} className="text-violet-400" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">일별 AI 사용 (최근 30일)</p>
          </div>
          <MiniBarChart daily={aiDaily} />
        </GlassCard>
      )}

      {/* 사용 목록 */}
      <GlassCard className="overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <Sparkles size={13} className="text-violet-400" />
          <p className="text-sm font-medium text-slate-300">AI 분석 기록</p>
          <span className="text-xs text-slate-600">최근 50건</span>
        </div>

        {aiLogs.length === 0 ? (
          <div className="py-16 text-center">
            <Sparkles size={28} className="text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-600">아직 AI 분석 기록이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
            {aiLogs.map((l, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/3 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <Sparkles size={12} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{l.bid_name || l.bid_no}</p>
                  <p className="text-xs text-slate-600 truncate">{l.org_name || '-'}</p>
                </div>
                <p className="text-xs text-slate-500 font-mono whitespace-nowrap shrink-0">{fmtDt(l.used_at)}</p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
