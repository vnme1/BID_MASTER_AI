import { useState, useEffect, useCallback, useRef, memo } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import {
  Search, ChevronLeft, ChevronRight, ExternalLink,
  Loader2, X, TrendingUp, FileText, AlertCircle,
  BarChart2, Activity, Sparkles, Target, ShieldAlert,
  CheckCircle2, Info, Zap, Users, Trophy, Clock,
  SlidersHorizontal, LogOut, ChevronDown, Settings, User,
} from 'lucide-react'
import { useAuth, ROLE_META } from './AuthContext'
import LoginPage from './LoginPage'
import AdminPage from './AdminPage'
import MyPage from './MyPage'
import SimulationTab from './SimulationTab'

const API = '/api'

/* ── 유틸 ──────────────────────────────────────────────────── */

function formatAmount(val) {
  const n = Number(val)
  if (!val || isNaN(n) || n === 0) return '-'
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}

function formatPrice(val) {
  const n = Number(val)
  if (!val || isNaN(n) || n === 0) return '-'
  return `${n.toLocaleString()}원`
}

function getDday(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function cx(...args) { return twMerge(...args) }

/* ── Count-up 훅 ─────────────────────────────────────────── */

function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (!target) return
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    let raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return display.toLocaleString()
}

/* ── 공통 컴포넌트 ─────────────────────────────────────────── */

function GlassCard({ children, className, onClick }) {
  return (
    <div onClick={onClick}
      className={cx('rounded-2xl border border-white/10 bg-slate-900/70', className)}>
      {children}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }) {
  const count = useCountUp(Number(String(value).replace(/,/g, '')))
  const colorMap = {
    blue:    'text-blue-400 bg-blue-500/10',
    violet:  'text-violet-400 bg-violet-500/10',
    rose:    'text-rose-400 bg-rose-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
  }
  return (
    <GlassCard className="p-5 flex items-start gap-4">
      <div className={cx('p-2.5 rounded-xl', colorMap[color])}>
        <Icon size={18} className={colorMap[color].split(' ')[0]} />
      </div>
      <div>
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{count}</p>
      </div>
    </GlassCard>
  )
}

function Badge({ text, color = 'gray' }) {
  const map = {
    blue:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
    green:  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    purple: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    orange: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    gray:   'bg-slate-500/20 text-slate-400 border-slate-500/30',
  }
  return (
    <span className={cx('inline-block px-2 py-0.5 rounded-md text-xs font-medium border', map[color])}>
      {text || '-'}
    </span>
  )
}

function DeadlineBadge({ dateStr }) {
  const d = getDday(dateStr)
  if (d === null || d < 0) return null
  if (d <= 3) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />D-{d}
    </span>
  )
  if (d <= 7) return (
    <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30">
      D-{d}
    </span>
  )
  return null
}

/* ── BidRow ─────────────────────────────────────────────────── */

const rowVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.019, duration: 0.22, ease: 'easeOut' },
  }),
}

function priceColor(m) {
  if (m?.includes('복수예가')) return 'blue'
  if (m?.includes('협상')) return 'purple'
  if (m?.includes('비예가')) return 'orange'
  return 'gray'
}

const BidRow = memo(function BidRow({ bid, index, onClick }) {
  return (
    <motion.tr
      custom={index} variants={rowVariants} initial="hidden" animate="visible"
      onClick={() => onClick(bid)}
      className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group"
      style={{ willChange: 'opacity, transform' }}
    >
      <td className="px-4 py-3 max-w-xs">
        <p className="font-medium text-slate-200 truncate m-0 group-hover:text-white transition-colors">
          {bid.bid_name}
        </p>
        <p className="text-xs text-slate-600 mt-0.5 m-0 font-mono">{bid.bid_no}</p>
      </td>
      <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">{bid.org_name}</td>
      <td className="px-4 py-3"><Badge text={bid.bid_method} color="green" /></td>
      <td className="px-4 py-3"><Badge text={bid.price_method} color={priceColor(bid.price_method)} /></td>
      <td className="px-4 py-3 text-right font-mono text-slate-300 whitespace-nowrap">
        {formatAmount(bid.est_price)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <DeadlineBadge dateStr={bid.close_dt} />
        {getDday(bid.close_dt) === null && (
          <span className="text-xs text-slate-600">
            {bid.close_dt ? bid.close_dt.slice(0, 10) : '-'}
          </span>
        )}
      </td>
    </motion.tr>
  )
})

/* ── 탭 패널 공통 ────────────────────────────────────────────── */

function DrawerTabs({ tabs, active, onChange }) {
  return (
    <div className="flex border-b border-white/10 shrink-0">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cx(
            'flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-all flex-1 justify-center',
            active === id
              ? 'border-violet-500 text-violet-400'
              : 'border-transparent text-slate-500 hover:text-slate-300',
          )}
        >
          <Icon size={13} />{label}
        </button>
      ))}
    </div>
  )
}

/* ── 기본정보 탭 ─────────────────────────────────────────────── */

function BasicInfoTab({ bid }) {
  const g2bUrl = `https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=${bid.bid_no}&bidPbancOrd=000`
  const d = getDday(bid.close_dt)

  const fields = [
    ['공고번호', bid.bid_no],
    ['공고기관', bid.org_name],
    ['수요기관', bid.demand_org],
    ['입찰방식', bid.bid_method],
    ['계약방식', bid.contract_method],
    ['예가방식', bid.price_method],
    ['배정예산', formatAmount(bid.budget_amt)],
    ['추정가격', formatAmount(bid.est_price)],
    ['공고일시', bid.announce_dt ? bid.announce_dt.slice(0, 16) : '-'],
    ['마감일시', bid.close_dt ? bid.close_dt.slice(0, 16) : '-'],
    ['대분류', bid.large_category],
    ['중분류', bid.mid_category],
  ]

  return (
    <div className="flex flex-col gap-4">
      {d !== null && d <= 7 && d >= 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
          <AlertCircle size={14} className="text-rose-400 shrink-0" />
          <p className="text-xs text-rose-300">
            마감까지 <span className="font-bold">D-{d}</span> — 서류 준비를 서두르세요.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {fields.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white/5 border border-white/8 p-3">
            <p className="text-xs text-slate-500 mb-1">{k}</p>
            <p className="text-sm font-medium text-slate-200 break-words">{v || '-'}</p>
          </div>
        ))}
      </div>
      <motion.a
        href={g2bUrl} target="_blank" rel="noopener noreferrer"
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)]"
      >
        <ExternalLink size={15} />나라장터 원문 공고 보기
      </motion.a>
    </div>
  )
}

/* ── 전략 분석 탭 ────────────────────────────────────────────── */

function MiniBar({ rate, count, maxCount, isTarget, isRecommended }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
  const rateNum = parseFloat(rate)
  const barColor =
    isRecommended ? 'from-violet-500 to-violet-400' :
    isTarget       ? 'from-amber-500 to-amber-400' :
    rateNum >= 98  ? 'from-emerald-600 to-emerald-500' :
    rateNum >= 94  ? 'from-blue-600 to-blue-500' :
    rateNum >= 88  ? 'from-slate-600 to-slate-500' :
                     'from-slate-700 to-slate-600'

  return (
    <div className={cx(
      'flex items-center gap-2 rounded-lg px-2 py-1 transition-all',
      (isTarget || isRecommended) ? 'bg-white/5' : '',
    )}>
      <span className={cx(
        'w-12 text-right text-xs font-mono shrink-0',
        isRecommended ? 'text-violet-400 font-bold' :
        isTarget ? 'text-amber-400 font-bold' : 'text-slate-500',
      )}>{rate}%</span>
      <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cx('h-full rounded bg-gradient-to-r', barColor)}
        />
      </div>
      <span className="w-6 text-xs font-mono text-slate-600 shrink-0 text-right">{count}</span>
    </div>
  )
}

function StrategyTab({ bid }) {
  const [strategy, setStrategy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [targetRate, setTargetRate] = useState(95.0)

  useEffect(() => {
    axios.get(`${API}/bids/${bid.bid_no}/strategy`)
      .then(({ data }) => {
        setStrategy(data)
        if (data.recommendation?.rate) setTargetRate(data.recommendation.rate)
      })
      .finally(() => setLoading(false))
  }, [bid.bid_no])

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
      <Loader2 size={16} className="animate-spin text-violet-400" />
      <span className="text-xs">전략 분석 중...</span>
    </div>
  )

  if (!strategy || strategy.count === 0) return (
    <div className="text-center py-12 text-slate-600 text-sm">
      이 기관의 과거 낙찰 데이터가 없습니다.
    </div>
  )

  const { recommendation, distribution, win_probability, est_price, scope, count, avg } = strategy
  const entries = Object.entries(distribution)
  const maxCount = entries.reduce((m, [, v]) => Math.max(m, v), 0)

  const targetKey = `${(Math.floor(targetRate / 0.5) * 0.5).toFixed(1)}`
  const winFreq = win_probability[targetKey] ?? 0
  const targetPrice = est_price ? Math.round(est_price * targetRate / 100) : null

  const freqLevel =
    winFreq >= 15 ? { text: '높음', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' } :
    winFreq >= 5  ? { text: '보통', color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/30' } :
                    { text: '낮음', color: 'text-slate-400',   bg: 'bg-slate-500/15 border-slate-500/30' }

  return (
    <div className="flex flex-col gap-4">
      {/* AI 추천 카드 */}
      {recommendation && (
        <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-violet-400" />
            <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider">AI 추천 투찰가</p>
            <span className={cx(
              'ml-auto px-2 py-0.5 rounded-full text-xs font-medium',
              recommendation.confidence === '높음' ? 'bg-emerald-500/20 text-emerald-400' :
              recommendation.confidence === '보통' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-slate-500/20 text-slate-400',
            )}>
              신뢰도 {recommendation.confidence}
            </span>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">추천 사정률</p>
              <p className="text-3xl font-bold text-white">{recommendation.rate.toFixed(1)}<span className="text-lg text-slate-400 font-normal">%</span></p>
            </div>
            {recommendation.price && (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">추천 금액</p>
                <p className="text-lg font-bold text-violet-300">{recommendation.price.toLocaleString()}원</p>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {scope} {count}건 분석 · 평균 사정률 {avg}%
          </p>
        </div>
      )}

      {/* 슬라이더 시뮬레이터 */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target size={13} className="text-amber-400" />
          <p className="text-xs font-semibold text-slate-300">내 투찰가 시뮬레이터</p>
        </div>

        {/* 사정률 슬라이더 */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>70%</span>
            <span className="font-mono font-bold text-amber-400">{targetRate.toFixed(1)}%</span>
            <span>100%</span>
          </div>
          <input
            type="range"
            min={70} max={100} step={0.5}
            value={targetRate}
            onChange={(e) => setTargetRate(parseFloat(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, rgb(167,139,250) 0%, rgb(167,139,250) ${(targetRate - 70) / 30 * 100}%, rgba(255,255,255,0.1) ${(targetRate - 70) / 30 * 100}%, rgba(255,255,255,0.1) 100%)`
            }}
          />
        </div>

        {/* 목표 금액 & 낙찰 빈도 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-xs text-slate-500 mb-1">목표 투찰 금액</p>
            <p className="text-sm font-bold text-white font-mono">
              {targetPrice ? targetPrice.toLocaleString() + '원' : '-'}
            </p>
          </div>
          <div className={cx('rounded-lg border p-3', freqLevel.bg)}>
            <p className="text-xs text-slate-500 mb-1">과거 낙찰 빈도</p>
            <p className={cx('text-sm font-bold', freqLevel.color)}>
              {winFreq}% <span className="text-xs font-normal text-slate-500">({freqLevel.text})</span>
            </p>
          </div>
        </div>
      </div>

      {/* 분포 미니 차트 */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <p className="text-xs font-semibold text-slate-400 mb-3">
          사정률 분포
          <span className="ml-1 font-normal text-slate-600">({scope} · {count}건)</span>
        </p>
        <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto pr-1">
          {entries.map(([rate, cnt]) => (
            <MiniBar
              key={rate}
              rate={rate}
              count={cnt}
              maxCount={maxCount}
              isTarget={rate === targetKey}
              isRecommended={rate === `${recommendation?.rate?.toFixed(1)}`}
            />
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-slate-600">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" />AI 추천</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />내 목표</span>
        </div>
      </div>
    </div>
  )
}

/* ── AI 브리핑 탭 ────────────────────────────────────────────── */

function AiBriefTab({ bid, onUsed }) {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setBrief(null)
    setErrMsg('')
    axios.get(`${API}/bids/${bid.bid_no}/ai-brief`)
      .then(({ data }) => { if (!cancelled) setBrief(data) })
      .catch((err) => {
        if (cancelled) return
        const status = err?.response?.status
        if (status === 429) setErrMsg('오늘 AI 분석 한도를 모두 사용했습니다. 내일 다시 시도하세요.')
        else setErrMsg('AI 분석을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        onUsed?.()
      })
    return () => { cancelled = true }
  }, [bid.bid_no])

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
      <Loader2 size={16} className="animate-spin text-violet-400" />
      <span className="text-xs">분석 중...</span>
    </div>
  )
  if (errMsg) return (
    <div className="flex items-center gap-2 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
      <AlertCircle size={14} className="text-rose-400 shrink-0" />
      <p className="text-xs text-rose-300">{errMsg}</p>
    </div>
  )
  if (!brief) return null

  const riskConfig = {
    danger:  { icon: ShieldAlert, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
    warning: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
    info:    { icon: Info,        color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/30' },
    ok:      { icon: CheckCircle2,color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
        <Sparkles size={14} className="text-violet-400 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-violet-300">AI 공고 브리핑</p>
          <p className="text-xs text-slate-500">{brief.note}</p>
        </div>
      </div>

      {/* AI 추천 전략 (GPT-4o 응답 시) */}
      {brief.recommendation && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/30">
          <Sparkles size={14} className="text-violet-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-violet-300 mb-1">AI 전략 추천</p>
            <p className="text-xs text-slate-300 leading-relaxed">{brief.recommendation}</p>
          </div>
        </div>
      )}

      {/* 리스크 탐지 */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">리스크 탐지</p>
        <div className="flex flex-col gap-2">
          {brief.risks.map((r, i) => {
            const cfg = riskConfig[r.level] ?? riskConfig.info
            const Icon = cfg.icon
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className={cx('flex items-start gap-2.5 p-3 rounded-xl border', cfg.bg)}
              >
                <Icon size={14} className={cx(cfg.color, 'shrink-0 mt-0.5')} />
                <p className="text-xs text-slate-300">{r.text}</p>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* 핵심 요약 */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">핵심 정보</p>
        <div className="flex flex-col divide-y divide-white/5 rounded-xl overflow-hidden border border-white/8">
          {brief.summary.map(({ label, value }) => (
            <div key={label} className="flex items-center bg-white/3 px-3 py-2.5">
              <span className="text-xs text-slate-500 w-20 shrink-0">{label}</span>
              <span className="text-xs text-slate-200 font-medium flex-1">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* OpenAI 연동 안내 */}
      {!brief.ai_powered && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-white/3 border border-white/8">
          <Zap size={13} className="text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500">
            <span className="text-yellow-400 font-medium">Gemini AI 연동 </span>
            을 활성화하면 공고를 분석해 리스크·실적 조건·투찰 전략을 자동 요약합니다.
            <code className="ml-1 text-slate-400 bg-white/5 px-1 rounded">backend/.env</code>에
            <code className="ml-1 text-slate-400 bg-white/5 px-1 rounded">GEMINI_API_KEY</code> 설정
          </p>
        </div>
      )}
    </div>
  )
}

/* ── 상세 드로어 ─────────────────────────────────────────────── */

const DRAWER_TABS = [
  { id: 'info',     label: '기본정보', icon: FileText },
  { id: 'strategy', label: '전략분석', icon: Target },
  { id: 'ai',       label: 'AI 브리핑', icon: Sparkles },
]

function DetailPanel({ bid, onClose, onAiUsed }) {
  const [drawerTab, setDrawerTab] = useState('info')

  // 공고가 바뀌면 탭 리셋
  useEffect(() => setDrawerTab('info'), [bid.bid_no])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end"
    >
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="relative w-full max-w-lg h-full flex flex-col bg-slate-950 border-l border-white/10"
      >
        {/* 드로어 헤더 */}
        <div className="p-5 pb-0 shrink-0">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-violet-400 mb-1 font-medium">입찰 공고</p>
              <h2 className="text-sm font-semibold text-white leading-snug line-clamp-2">
                {bid.bid_name}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 font-mono">{bid.bid_no}</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </motion.button>
          </div>
          <DrawerTabs tabs={DRAWER_TABS} active={drawerTab} onChange={setDrawerTab} />
        </div>

        {/* 탭 콘텐츠 (스크롤 영역) */}
        <div className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={drawerTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {drawerTab === 'info'     && <BasicInfoTab bid={bid} />}
              {drawerTab === 'strategy' && <StrategyTab bid={bid} />}
              {drawerTab === 'ai'       && <AiBriefTab bid={bid} onUsed={onAiUsed} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── 사정률 분석 탭 (메인 탭) ───────────────────────────────── */

function BaseRateBar({ rate, count, maxCount }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
  const rateNum = parseFloat(rate)
  const barColor =
    rateNum >= 98 ? 'from-emerald-500 to-emerald-400' :
    rateNum >= 94 ? 'from-blue-500 to-blue-400' :
    rateNum >= 88 ? 'from-violet-500 to-violet-400' :
                    'from-rose-500 to-rose-400'
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-right text-xs font-mono text-slate-400 shrink-0">{rate}%</span>
      <div className="flex-1 h-6 bg-white/5 rounded-md overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cx('h-full rounded-md bg-gradient-to-r', barColor)}
        />
      </div>
      <span className="w-8 text-xs font-mono text-slate-500 shrink-0">{count}</span>
    </div>
  )
}

function AnalysisTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [orgFilter, setOrgFilter] = useState('')
  const [orgInput, setOrgInput] = useState('')
  const [fuksuOnly, setFuksuOnly] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const { data: d } = await axios.get(`${API}/analysis/base-rate`, {
        params: { org: orgFilter, fuksu_only: fuksuOnly ? 1 : 0 },
      })
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [orgFilter, fuksuOnly])

  useEffect(() => { fetch() }, [fetch])

  const entries = Object.entries(data?.distribution ?? {}).map(([k, v]) => ({ rate: k, count: v }))
  const maxCount = entries.reduce((m, e) => Math.max(m, e.count), 0)

  return (
    <div className="flex flex-col gap-5">
      <GlassCard className="p-4 flex flex-col gap-3">
        <form onSubmit={(e) => { e.preventDefault(); setOrgFilter(orgInput) }} className="flex gap-2 items-center">
          <p className="text-xs text-slate-400 shrink-0">기관 필터</p>
          <input
            value={orgInput}
            onChange={(e) => setOrgInput(e.target.value)}
            placeholder="예: 서울시, 교육청..."
            className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            type="submit"
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm rounded-xl font-medium">
            적용
          </motion.button>
          {orgFilter && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              type="button" onClick={() => { setOrgFilter(''); setOrgInput('') }}
              className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white">
              <X size={14} />
            </motion.button>
          )}
        </form>
        <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
          <div
            onClick={() => setFuksuOnly(!fuksuOnly)}
            className={cx(
              'relative w-9 h-5 rounded-full transition-colors duration-200',
              fuksuOnly ? 'bg-violet-600' : 'bg-white/15',
            )}
          >
            <div className={cx(
              'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
              fuksuOnly ? 'translate-x-4' : 'translate-x-0',
            )} />
          </div>
          <span className="text-xs text-slate-400">복수예가 전용</span>
          {fuksuOnly && <Badge text="복수예가" color="purple" />}
        </label>
      </GlassCard>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin text-violet-400" />
          <span className="text-sm">분석 중...</span>
        </div>
      ) : data?.count === 0 ? (
        <GlassCard className="p-10 text-center text-slate-500 text-sm">
          데이터 없음
        </GlassCard>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '분석 건수',    value: data.count,              suffix: '건', color: 'text-blue-400' },
              { label: '평균 사정률',  value: data.avg?.toFixed(2),    suffix: '%',  color: 'text-violet-400' },
              { label: '최저 사정률',  value: data.min?.toFixed(2),    suffix: '%',  color: 'text-rose-400' },
              { label: '최다 빈도 구간', value: data.top_rate?.toFixed(1), suffix: '%', color: 'text-emerald-400' },
            ].map(({ label, value, suffix, color }) => (
              <GlassCard key={label} className="p-5">
                <p className="text-xs text-slate-500 mb-2">{label}</p>
                <p className={cx('text-2xl font-bold', color)}>
                  {value}<span className="text-sm font-normal ml-0.5 text-slate-500">{suffix}</span>
                </p>
              </GlassCard>
            ))}
          </div>

          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-slate-300">
                사정률 분포
                <span className="ml-2 text-xs text-slate-500 font-normal">0.5% 구간별</span>
              </p>
              {orgFilter && <Badge text={`기관: ${orgFilter}`} color="blue" />}
            </div>
            <div className="flex flex-col gap-2">
              {entries.map(({ rate, count }) => (
                <BaseRateBar key={rate} rate={rate} count={count} maxCount={maxCount} />
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">해석 가이드</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-500">
              {[
                { dot: 'bg-emerald-500', label: '98%+',    desc: '최고가 낙찰 (협상·수의계약 등)' },
                { dot: 'bg-blue-500',    label: '94~97%',  desc: '복수예가 핵심 낙찰 구간' },
                { dot: 'bg-violet-500',  label: '88~93%',  desc: '경쟁 치열 구간' },
                { dot: 'bg-rose-500',    label: '88% 미만', desc: '덤핑 의심 — 손익 재검토 필요' },
              ].map(({ dot, label, desc }) => (
                <div key={label} className="flex gap-2">
                  <span className={cx('w-3 h-3 rounded-full shrink-0 mt-0.5', dot)} />
                  <span><strong className="text-slate-300">{label}</strong> — {desc}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </>
      )}
    </div>
  )
}

/* ── 경쟁사 분석 탭 ──────────────────────────────────────────── */

const THREAT_CONFIG = {
  high:   { label: '위협 높음', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  medium: { label: '주의',     color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  low:    { label: '낮음',     color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}

function CompetitorTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [inputVal, setInputVal] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: d } = await axios.get(`${API}/analysis/competitors`, {
        params: { keyword: keyword || undefined },
      })
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [keyword])

  useEffect(() => { load() }, [load])

  const maxWins = (data?.competitors ?? []).reduce((m, c) => Math.max(m, c.win_count), 0)

  return (
    <div className="flex flex-col gap-5">
      {/* 검색 필터 */}
      <GlassCard className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); setKeyword(inputVal) }} className="flex gap-2 items-center">
          <p className="text-xs text-slate-400 shrink-0">업체 검색</p>
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="업체명 일부 입력..."
            className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            type="submit"
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm rounded-xl font-medium">
            검색
          </motion.button>
          {keyword && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              type="button" onClick={() => { setKeyword(''); setInputVal('') }}
              className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white">
              <X size={14} />
            </motion.button>
          )}
        </form>
      </GlassCard>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin text-violet-400" />
          <span className="text-sm">분석 중...</span>
        </div>
      ) : !data || data.total === 0 ? (
        <GlassCard className="p-10 text-center text-slate-500 text-sm">데이터 없음</GlassCard>
      ) : (
        <>
          {/* 요약 */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '전체 업체 수', value: data.total,      suffix: '개', color: 'text-blue-400' },
              { label: '고위협 업체',  value: data.high_threat, suffix: '개', color: 'text-rose-400' },
              { label: '분석 기간',    value: data.period,      suffix: '',   color: 'text-slate-300' },
            ].map(({ label, value, suffix, color }) => (
              <GlassCard key={label} className="p-5">
                <p className="text-xs text-slate-500 mb-2">{label}</p>
                <p className={cx('text-2xl font-bold', color)}>
                  {value}<span className="text-sm font-normal ml-0.5 text-slate-500">{suffix}</span>
                </p>
              </GlassCard>
            ))}
          </div>

          {/* 경쟁사 목록 */}
          <GlassCard className="overflow-hidden">
            <div className="px-5 py-4 border-b border-white/8 flex items-center gap-2">
              <Trophy size={14} className="text-amber-400" />
              <p className="text-sm font-medium text-slate-300">낙찰 업체 순위</p>
              <span className="ml-auto text-xs text-slate-500">총 {data.total}개 업체</span>
            </div>
            <div className="divide-y divide-white/5">
              {(data.competitors ?? []).map((c, i) => {
                const threat = THREAT_CONFIG[c.threat] ?? THREAT_CONFIG.low
                const barPct = maxWins > 0 ? (c.win_count / maxWins) * 100 : 0
                return (
                  <motion.div
                    key={c.winner_name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/3 transition-colors"
                  >
                    <span className="w-5 text-xs font-mono text-slate-600 shrink-0 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{c.winner_name || '(미확인)'}</p>
                      <div className="mt-1.5 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500"
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-slate-500 mb-0.5">낙찰 {c.win_count}회</p>
                      <p className="text-sm font-bold font-mono text-slate-200">
                        {c.avg_rate != null ? `${parseFloat(c.avg_rate).toFixed(2)}%` : '-'}
                      </p>
                    </div>
                    <span className={cx(
                      'shrink-0 px-2 py-0.5 rounded-md text-xs font-medium border',
                      threat.color,
                    )}>
                      {threat.label}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">위협도 기준</p>
            <div className="flex flex-col gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-xs font-medium border bg-rose-500/20 text-rose-300 border-rose-500/30">위협 높음</span>
                <span>낙찰 10회 이상 — 높은 경쟁력, 사정률 패턴 면밀히 분석</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-xs font-medium border bg-amber-500/20 text-amber-300 border-amber-500/30">주의</span>
                <span>낙찰 3~9회 — 중간 수준 경쟁자</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-xs font-medium border bg-slate-500/20 text-slate-400 border-slate-500/30">낮음</span>
                <span>낙찰 1~2회 — 소규모 참여자</span>
              </div>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  )
}

/* ── 메인 앱 ────────────────────────────────────────────────── */

const TABS = [
  { id: 'bids',        label: '공고 목록',      icon: FileText },
  { id: 'analysis',   label: '사정률 분석',     icon: Activity },
  { id: 'competitors', label: '경쟁사 분석',    icon: Users },
  { id: 'simulation', label: '입찰 연습장',     icon: Target },
]

const PRICE_METHODS = ['복수예가', '단일예가', '협상에의한계약', '비예가']
const BID_METHODS   = ['전자입찰', '수의계약', '일반경쟁', '제한경쟁', '지명경쟁']
const DEADLINES     = [{ label: '전체', value: 0 }, { label: 'D-3', value: 3 }, { label: 'D-7', value: 7 }, { label: 'D-14', value: 14 }, { label: 'D-30', value: 30 }]

export default function App() {
  const { user, loading, logout, refreshMe } = useAuth()

  // 초기 로딩 중
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #080c18 0%, #0e0a1f 50%, #080c18 100%)' }}>
      <Loader2 size={28} className="animate-spin text-violet-400" />
    </div>
  )

  // 미로그인 → 로그인 페이지
  if (!user) return <LoginPage />

  return <AppInner user={user} logout={logout} refreshMe={refreshMe} />
}

function AppInner({ user, logout, refreshMe }) {
  const [tab, setTab] = useState('bids')
  const [showAdmin, setShowAdmin] = useState(false)
  const [showMyPage, setShowMyPage] = useState(false)
  const [bids, setBids] = useState([])
  const [stats, setStats] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)

  // 필터 상태
  const [showFilter, setShowFilter] = useState(false)
  const [filters, setFilters] = useState({
    price_method: '',
    bid_method: '',
    deadline: 0,
    min_price: '',
    max_price: '',
  })
  const [pendingFilters, setPendingFilters] = useState({ ...filters })

  const activeFilterCount = [
    filters.price_method, filters.bid_method,
    filters.deadline > 0 ? '1' : '',
    filters.min_price, filters.max_price,
  ].filter(Boolean).length

  const fetchBids = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/bids`, {
        params: {
          keyword, page, page_size: 20,
          price_method: filters.price_method,
          bid_method:   filters.bid_method,
          deadline:     filters.deadline,
          min_price:    filters.min_price || 0,
          max_price:    filters.max_price || 0,
        },
      })
      setBids(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } finally {
      setLoading(false)
    }
  }, [keyword, page, filters])

  useEffect(() => { fetchBids() }, [fetchBids])
  useEffect(() => {
    axios.get(`${API}/stats`).then(({ data }) => setStats(data))
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    setKeyword(inputValue)
    setPage(1)
  }

  const applyFilters = () => {
    setFilters({ ...pendingFilters })
    setPage(1)
    setShowFilter(false)
  }

  const resetFilters = () => {
    const empty = { price_method: '', bid_method: '', deadline: 0, min_price: '', max_price: '' }
    setFilters(empty)
    setPendingFilters(empty)
    setPage(1)
    setShowFilter(false)
  }

  const negotiationCount = Object.entries(stats?.by_price_method ?? {})
    .filter(([k]) => k.includes('협상'))
    .reduce((s, [, v]) => s + v, 0)

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #080c18 0%, #0e0a1f 50%, #080c18 100%)' }}>
      <div aria-hidden className="fixed inset-0 pointer-events-none" style={{
        background:
          'radial-gradient(ellipse 60% 50% at 10% 10%, rgba(30,58,138,0.35) 0%, transparent 70%),' +
          'radial-gradient(ellipse 50% 45% at 90% 90%, rgba(76,29,149,0.3) 0%, transparent 70%)',
      }} />

      {/* 헤더 */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent m-0">
                Bid-Master AI
              </h1>
              <p className="text-xs text-slate-500 m-0">지능형 입찰 전략 플랫폼</p>
            </div>
            {stats && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8">
                <span className={cx(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  stats.scheduler ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600',
                )} />
                <Clock size={11} className="text-slate-500" />
                <span className="text-xs text-slate-500">
                  {stats.last_collect
                    ? stats.last_collect.slice(0, 16).replace('T', ' ')
                    : stats.scheduler ? '수집 대기 중' : '스케줄러 꺼짐'}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* AI 할당량 */}
            {user.ai_daily_limit !== -1 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/8">
                <Sparkles size={11} className="text-violet-400" />
                <span className="text-xs text-slate-400">
                  AI <span className="text-violet-300 font-medium">{Math.max(0, user.ai_daily_limit - (user.ai_calls_today || 0))}</span>/{user.ai_daily_limit}
                </span>
              </div>
            )}
            {/* 역할 뱃지 */}
            <span className={`hidden sm:inline-block px-2.5 py-1 rounded-lg text-xs font-medium border ${ROLE_META[user.role]?.color}`}>
              {ROLE_META[user.role]?.label}
            </span>
            <span className="text-xs text-slate-500 hidden md:block">{user.name || user.email}</span>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setShowMyPage(true)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-violet-400 transition-colors"
              title="마이페이지"
            >
              <User size={14} />
            </motion.button>
            {(user.role === 'admin' || user.role === 'manager') && (
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowAdmin(true)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-violet-400 transition-colors"
                title="관리자 패널"
              >
                <Settings size={14} />
              </motion.button>
            )}
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={logout}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
              title="로그아웃"
            >
              <LogOut size={14} />
            </motion.button>
          </div>

          {tab === 'bids' && (
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="공고명 검색..."
                  className="pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/10 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 w-60 transition-all"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                type="submit"
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm rounded-xl font-medium transition-all shadow-[0_0_16px_rgba(99,102,241,0.3)]"
              >
                검색
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => { setShowFilter(!showFilter); setPendingFilters({ ...filters }) }}
                className={cx(
                  'relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all',
                  showFilter || activeFilterCount > 0
                    ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white',
                )}
              >
                <SlidersHorizontal size={14} />
                필터
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </motion.button>
            </form>
          )}
        </div>
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cx(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all',
                tab === id
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300',
              )}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* 필터 패널 */}
        <AnimatePresence>
          {showFilter && tab === 'bids' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/8"
            >
              <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 예가방식 */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2 font-medium">예가방식</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['', ...PRICE_METHODS].map((m) => (
                        <button key={m} type="button"
                          onClick={() => setPendingFilters(f => ({ ...f, price_method: m }))}
                          className={cx(
                            'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                            pendingFilters.price_method === m
                              ? 'bg-violet-600 border-violet-500 text-white'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white',
                          )}
                        >
                          {m || '전체'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 입찰방식 */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2 font-medium">입찰방식</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['', ...BID_METHODS].map((m) => (
                        <button key={m} type="button"
                          onClick={() => setPendingFilters(f => ({ ...f, bid_method: m }))}
                          className={cx(
                            'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                            pendingFilters.bid_method === m
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white',
                          )}
                        >
                          {m || '전체'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 마감 D-day */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2 font-medium">마감 임박</p>
                    <div className="flex flex-wrap gap-1.5">
                      {DEADLINES.map(({ label, value }) => (
                        <button key={value} type="button"
                          onClick={() => setPendingFilters(f => ({ ...f, deadline: value }))}
                          className={cx(
                            'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                            pendingFilters.deadline === value
                              ? 'bg-rose-600 border-rose-500 text-white'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 추정가격 범위 */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2 font-medium">추정가격 범위 (원)</p>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        placeholder="최소"
                        value={pendingFilters.min_price}
                        onChange={(e) => setPendingFilters(f => ({ ...f, min_price: e.target.value }))}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 w-0"
                      />
                      <span className="text-slate-600 text-xs shrink-0">~</span>
                      <input
                        type="number"
                        placeholder="최대"
                        value={pendingFilters.max_price}
                        onChange={(e) => setPendingFilters(f => ({ ...f, max_price: e.target.value }))}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 w-0"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    type="button" onClick={resetFilters}
                    className="px-4 py-2 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
                    초기화
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    type="button" onClick={applyFilters}
                    className="px-5 py-2 text-sm rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-medium transition-all">
                    필터 적용
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="relative max-w-7xl mx-auto px-6 py-6 flex flex-col gap-5">
        {/* 통계 카드 */}
        {tab === 'bids' && stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <StatCard label="전체 공고 수"      value={stats.total_bids}                         icon={FileText}  color="blue" />
            <StatCard label="복수예가"          value={stats.by_price_method?.['복수예가'] ?? 0} icon={BarChart2} color="violet" />
            <StatCard label="협상에의한계약"    value={negotiationCount}                          icon={TrendingUp} color="emerald" />
            <StatCard label="검색 결과"         value={total}                                    icon={Search}   color="rose" />
          </motion.div>
        )}

        {/* 탭 콘텐츠 */}
        <AnimatePresence mode="wait">
          {tab === 'bids' ? (
            <motion.div key="bids" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <GlassCard className="overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm font-medium text-slate-300 m-0">
                    {keyword ? <><span className="text-violet-400">"{keyword}"</span> 검색 결과</> : '전체 공고 목록'}
                    <span className="ml-2 text-slate-500 font-normal text-xs">총 {total.toLocaleString()}건</span>
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {filters.price_method && <Badge text={filters.price_method} color="purple" />}
                    {filters.bid_method && <Badge text={filters.bid_method} color="green" />}
                    {filters.deadline > 0 && <Badge text={`D-${filters.deadline} 이내`} color="orange" />}
                    {(filters.min_price || filters.max_price) && (
                      <Badge text={`${filters.min_price ? formatAmount(filters.min_price) : '0'} ~ ${filters.max_price ? formatAmount(filters.max_price) : '∞'}`} color="blue" />
                    )}
                    {activeFilterCount > 0 && (
                      <button onClick={resetFilters} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 transition-all">
                        <X size={10} />초기화
                      </button>
                    )}
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
                    <Loader2 size={18} className="animate-spin text-violet-400" />
                    <span className="text-sm">데이터 불러오는 중...</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                          <th className="text-left px-4 py-3 font-medium">공고명</th>
                          <th className="text-left px-4 py-3 font-medium">기관</th>
                          <th className="text-left px-4 py-3 font-medium">입찰방식</th>
                          <th className="text-left px-4 py-3 font-medium">예가방식</th>
                          <th className="text-right px-4 py-3 font-medium">추정가격</th>
                          <th className="text-left px-4 py-3 font-medium">마감</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bids.map((bid, i) => (
                          <BidRow key={bid.bid_no} bid={bid} index={i} onClick={(b) => {
                            setSelected(b)
                            axios.post(`${API}/bids/${b.bid_no}/view`).catch(() => {})
                          }} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 페이지네이션 */}
                <div className="px-5 py-4 border-t border-white/8 flex items-center justify-between">
                  <p className="text-xs text-slate-600 m-0">{page} / {totalPages} 페이지</p>
                  <div className="flex gap-1 items-center">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft size={15} />
                    </motion.button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                      return (
                        <motion.button key={p} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={() => setPage(p)}
                          className={cx(
                            'w-8 h-8 rounded-lg text-sm font-medium transition-all',
                            p === page
                              ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                              : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                          )}>
                          {p}
                        </motion.button>
                      )
                    })}
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight size={15} />
                    </motion.button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ) : tab === 'analysis' ? (
            <motion.div key="analysis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <AnalysisTab />
            </motion.div>
          ) : tab === 'competitors' ? (
            <motion.div key="competitors" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <CompetitorTab />
            </motion.div>
          ) : (
            <motion.div key="simulation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <SimulationTab />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 상세 드로어 */}
      <AnimatePresence>
        {selected && <DetailPanel bid={selected} onClose={() => setSelected(null)} onAiUsed={refreshMe} />}
      </AnimatePresence>

      {/* 마이페이지 */}
      <AnimatePresence>
        {showMyPage && <MyPage onClose={() => setShowMyPage(false)} />}
      </AnimatePresence>

      {/* 관리자 패널 */}
      <AnimatePresence>
        {showAdmin && <AdminPage onClose={() => setShowAdmin(false)} />}
      </AnimatePresence>
    </div>
  )
}
