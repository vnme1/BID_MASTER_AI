import { useState, useRef } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import {
  Loader2, Trophy, Target, Zap, RefreshCw,
  TrendingUp, AlertCircle,
} from 'lucide-react'

const API = '/api'
const cx = (...args) => twMerge(...args)

function GlassCard({ children, className }) {
  return (
    <div className={cx('rounded-2xl border border-white/10 bg-slate-900/70', className)}>
      {children}
    </div>
  )
}

function DistBar({ rate, count, maxCount }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
  const n = parseFloat(rate)
  const color =
    n >= 98 ? 'from-emerald-500 to-emerald-400' :
    n >= 94 ? 'from-blue-500 to-blue-400' :
    n >= 88 ? 'from-violet-500 to-violet-400' :
              'from-rose-500 to-rose-400'
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-right text-xs font-mono text-slate-400 shrink-0">{rate}%</span>
      <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cx('h-full rounded bg-gradient-to-r', color)}
        />
      </div>
      <span className="w-5 text-xs font-mono text-slate-600 shrink-0 text-right">{count}</span>
    </div>
  )
}

export default function SimulationTab() {
  const [phase, setPhase] = useState('idle')
  const [quiz, setQuiz] = useState(null)
  const [result, setResult] = useState(null)
  const [userRate, setUserRate] = useState(95.0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const sessionRef = useRef(null)

  const loadQuiz = async () => {
    setPhase('loading')
    setResult(null)
    setError('')
    try {
      const { data } = await axios.get(`${API}/simulation/quiz`)
      setQuiz(data)
      sessionRef.current = data.session_id
      setUserRate(95.0)
      setPhase('quiz')
    } catch (e) {
      setError(e?.response?.data?.detail || '퀴즈를 불러오지 못했습니다.')
      setPhase('idle')
    }
  }

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    setPhase('scanning')
    try {
      const { data } = await axios.post(`${API}/simulation/submit`, {
        session_id: sessionRef.current,
        user_rate: userRate,
        user_name: '나',
      })
      await new Promise(r => setTimeout(r, 1800))
      setResult(data)
      setPhase('result')
    } catch (e) {
      setError(e?.response?.data?.detail || '오류가 발생했습니다.')
      setPhase('quiz')
    } finally {
      setSubmitting(false)
    }
  }

  const distEntries = Object.entries(quiz?.distribution ?? {})
  const maxDist = distEntries.reduce((m, [, v]) => Math.max(m, v), 0)

  const commentStyle = (rank, total) => {
    if (rank === 1)                        return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
    if (rank <= Math.ceil(total / 3))      return 'bg-blue-500/15 border-blue-500/40 text-blue-300'
    return 'bg-rose-500/15 border-rose-500/40 text-rose-300'
  }

  return (
    <div className="flex flex-col gap-5">
      <AnimatePresence mode="wait">

        {/* ── 시작 화면 ── */}
        {phase === 'idle' && (
          <motion.div key="idle"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6 py-16"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center">
              <Trophy size={36} className="text-violet-400" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-2">입찰 연습장 <span className="text-xs font-normal text-violet-400 border border-violet-500/40 rounded-full px-2 py-0.5 ml-1">Beta</span></h2>
              <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                실제 개찰 결과 데이터로 나의 투찰 감각을 테스트해보세요.<br />
                과거 공고에 직접 사정률을 써보고 몇 위인지 확인하세요!
              </p>
            </div>
            {error && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <AlertCircle size={13} className="text-rose-400 shrink-0" />
                <p className="text-xs text-rose-300">{error}</p>
              </div>
            )}
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
              onClick={loadQuiz}
              className="px-8 py-3 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold rounded-2xl shadow-[0_0_24px_rgba(139,92,246,0.4)] text-sm"
            >
              문제 시작하기
            </motion.button>
          </motion.div>
        )}

        {/* ── 로딩 ── */}
        {phase === 'loading' && (
          <motion.div key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center justify-center py-20 gap-2 text-slate-500"
          >
            <Loader2 size={18} className="animate-spin text-violet-400" />
            <span className="text-sm">공고 불러오는 중...</span>
          </motion.div>
        )}

        {/* ── 문제 화면 ── */}
        {phase === 'quiz' && quiz && (
          <motion.div key="quiz"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex flex-col gap-5"
          >
            {/* 공고 카드 */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  실제 개찰 공고
                </span>
                <span className="text-xs text-slate-500">{quiz.open_dt?.slice(0, 10)}</span>
                <motion.button
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={loadQuiz}
                  className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
                  title="다른 문제"
                >
                  <RefreshCw size={12} />
                </motion.button>
              </div>
              <h3 className="text-base font-semibold text-white leading-snug mb-3">{quiz.bid_name}</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-xs text-slate-500 mb-1">발주기관</p>
                  <p className="text-sm font-medium text-slate-200">{quiz.org_name}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-xs text-slate-500 mb-1">참여업체 수 (추정)</p>
                  <p className="text-sm font-bold text-violet-300">{quiz.participant_count}개사</p>
                </div>
                {quiz.price_method && (
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-xs text-slate-500 mb-1">예가방식</p>
                    <p className="text-sm font-medium text-slate-200">{quiz.price_method}</p>
                  </div>
                )}
                {quiz.large_category && (
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-xs text-slate-500 mb-1">분류</p>
                    <p className="text-sm font-medium text-slate-200 truncate">{quiz.large_category}</p>
                  </div>
                )}
              </div>
            </GlassCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* 투찰 입력 */}
              <GlassCard className="p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Target size={14} className="text-amber-400" />
                  <p className="text-sm font-semibold text-slate-200">내 투찰 사정률 입력</p>
                </div>
                <div>
                  <div className="flex justify-between items-end text-xs text-slate-500 mb-2">
                    <span>70%</span>
                    <span className="font-mono font-black text-3xl text-amber-400">{userRate.toFixed(1)}%</span>
                    <span>100%</span>
                  </div>
                  <input
                    type="range"
                    min={70} max={100} step={0.1}
                    value={userRate}
                    onChange={e => setUserRate(parseFloat(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, rgb(251,191,36) 0%, rgb(251,191,36) ${(userRate - 70) / 30 * 100}%, rgba(255,255,255,0.1) ${(userRate - 70) / 30 * 100}%, rgba(255,255,255,0.1) 100%)`
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={70} max={100} step={0.1}
                    value={userRate}
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      if (!isNaN(v)) setUserRate(Math.min(100, Math.max(70, v)))
                    }}
                    className="w-28 px-3 py-2 text-sm font-mono font-bold bg-white/5 border border-white/10 rounded-xl text-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500 text-center"
                  />
                  <span className="text-xs text-slate-500">% 직접 입력</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={submit}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl text-sm shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                >
                  투찰하기
                </motion.button>
              </GlassCard>

              {/* 사정률 통계 참고 */}
              <GlassCard className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={13} className="text-blue-400" />
                  <p className="text-xs font-semibold text-slate-300">기관 사정률 통계</p>
                  <span className="ml-auto text-xs text-slate-500">{quiz.dist_count}건 기준</span>
                </div>
                {distEntries.length > 0 ? (
                  <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto pr-1">
                    {distEntries.map(([rate, count]) => (
                      <DistBar key={rate} rate={rate} count={count} maxCount={maxDist} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-8">데이터 없음</p>
                )}
              </GlassCard>
            </div>
          </motion.div>
        )}

        {/* ── 스캐닝 애니메이션 ── */}
        {phase === 'scanning' && (
          <motion.div key="scanning"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-6"
          >
            <div className="relative w-32 h-32 flex items-center justify-center">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border border-violet-500/50"
                  initial={{ width: 40, height: 40, opacity: 0.9 }}
                  animate={{ width: 128, height: 128, opacity: 0 }}
                  transition={{
                    duration: 1.6,
                    delay: i * 0.55,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                />
              ))}
              <div className="w-16 h-16 rounded-full bg-violet-500/20 border border-violet-500/50 flex items-center justify-center">
                <Zap size={26} className="text-violet-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-violet-300 mb-1">데이터 분석 중...</p>
              <p className="text-xs text-slate-500">실제 개찰 결과와 비교하고 있습니다</p>
            </div>
            <div className="w-64 h-1 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.6, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        )}

        {/* ── 결과 화면 ── */}
        {phase === 'result' && result && (
          <motion.div key="result"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex flex-col gap-5"
          >
            {/* 결과 헤더 카드 */}
            <GlassCard className={cx(
              'p-5 border',
              result.user_rank === 1
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : result.user_rank <= 3
                  ? 'border-blue-500/40 bg-blue-500/5'
                  : 'border-white/10',
            )}>
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
                  className={cx(
                    'w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0',
                    result.user_rank === 1 ? 'bg-amber-500/25 text-amber-400' :
                    result.user_rank <= 3  ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-white/5 text-slate-400',
                  )}
                >
                  {result.user_rank === 1 ? '🏆' : `${result.user_rank}위`}
                </motion.div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">최종 순위</p>
                  <p className="text-2xl font-black text-white">
                    {result.user_rank}
                    <span className="text-sm font-normal text-slate-400 ml-1">/ {result.total}개사</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    점수 <span className={cx(
                      'font-bold',
                      result.score >= 800 ? 'text-emerald-400' :
                      result.score >= 500 ? 'text-blue-400' : 'text-slate-400',
                    )}>{result.score}점</span>
                  </p>
                </div>
                <div className="ml-auto text-right shrink-0">
                  <p className="text-xs text-slate-500 mb-0.5">실제 낙찰 사정률</p>
                  <p className="text-2xl font-bold text-violet-400 font-mono">{result.actual_rate?.toFixed(2)}%</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    내 투찰: <span className="text-amber-400 font-mono font-semibold">{result.user_rate?.toFixed(2)}%</span>
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* AI 코멘트 */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className={cx(
                'flex items-start gap-3 p-4 rounded-xl border',
                commentStyle(result.user_rank, result.total),
              )}
            >
              <Zap size={14} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{result.comment}</p>
            </motion.div>

            {/* 순위표 */}
            <GlassCard className="overflow-hidden">
              <div className="px-5 py-4 border-b border-white/8 flex items-center gap-2">
                <Trophy size={14} className="text-amber-400" />
                <p className="text-sm font-medium text-slate-300">최종 순위표</p>
                <span className="ml-auto text-xs text-slate-500">낙찰가 근접도 기준</span>
              </div>
              <div className="divide-y divide-white/5">
                {result.participants.map((p, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.055, duration: 0.28 }}
                    className={cx(
                      'flex items-center gap-3 px-5 py-3 transition-colors',
                      p.is_user && 'bg-amber-500/8 border-l-2 border-amber-500',
                    )}
                  >
                    <span className={cx(
                      'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                      p.rank === 1 ? 'bg-amber-500/25 text-amber-400' :
                      p.rank === 2 ? 'bg-slate-400/15 text-slate-300' :
                      p.rank === 3 ? 'bg-orange-700/20 text-orange-400' :
                                    'bg-white/5 text-slate-500',
                    )}>
                      {p.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cx(
                        'text-sm font-medium truncate',
                        p.is_user ? 'text-amber-400 font-bold' : 'text-slate-300',
                      )}>
                        {p.is_user ? '★ 나' : p.name}
                        {p.rank === 1 && !p.is_user && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">낙찰</span>
                        )}
                        {p.rank === 1 && p.is_user && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">🎉 낙찰!</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cx(
                        'text-sm font-mono',
                        p.is_user ? 'text-amber-400 font-bold' : 'text-slate-200',
                      )}>{p.rate?.toFixed(2)}%</p>
                      <p className="text-xs text-slate-500">
                        차이 <span className={cx(
                          'font-mono',
                          p.distance < 0.3 ? 'text-emerald-400' :
                          p.distance < 1.0 ? 'text-blue-400' : 'text-slate-400',
                        )}>
                          {p.distance?.toFixed(2)}%
                        </span>
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* 실제 낙찰 정보 */}
              <div className="px-5 py-4 border-t border-white/8 bg-violet-500/5">
                <p className="text-xs text-slate-500 mb-2">실제 낙찰 정보 (정답 공개)</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-violet-300">{result.actual_winner || '정보 없음'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">낙찰 사정률 <span className="text-violet-400 font-mono font-bold">{result.actual_rate?.toFixed(2)}%</span></p>
                  </div>
                  {result.winning_amt && (
                    <p className="text-sm font-mono text-slate-300">
                      {result.winning_amt.toLocaleString()}원
                    </p>
                  )}
                </div>
              </div>
            </GlassCard>

            {/* 다시 도전 */}
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              onClick={loadQuiz}
              className="w-full py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold rounded-xl text-sm shadow-[0_0_20px_rgba(99,102,241,0.3)]"
            >
              <RefreshCw size={14} />다시 도전하기
            </motion.button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
