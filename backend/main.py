"""
Bid-Master AI — FastAPI 백엔드 v0.4.0

신규 기능:
  1. GPT-4o AI 공고 브리핑 (OPENAI_API_KEY 설정 시 자동 활성화)
  2. 경쟁사 패턴 분석 (/api/analysis/competitors)
  3. APScheduler 자동 데이터 갱신 (매일 06:00, 매주 월요일 02:00)
  4. 복수예가 전용 사정률 분석 (bids JOIN 방식)
"""

import json
import logging
import os
import sqlite3
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ── 환경변수 ─────────────────────────────────────────────────

load_dotenv(Path(__file__).parent / ".env")

OPENAI_API_KEY  = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "")
KONEPS_API_KEY  = os.getenv("KONEPS_API_KEY", "")

DB_PATH         = Path(__file__).parent.parent / "database" / "bidmaster.db"
CRAWLER_DIR     = Path(__file__).parent.parent / "data-crawlers"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── 스케줄러 ─────────────────────────────────────────────────

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")
_last_collect: dict = {"bids": None, "results": None}

# AI 브리핑 캐시 (bid_no → {result, ts})
_brief_cache: dict = {}


async def _run_collection(days: int = 30, keywords: list[str] | None = None):
    """크롤러를 서브프로세스로 실행 (백엔드 venv와 크롤러 venv 분리 대응)"""
    import asyncio

    kws = keywords or ["소프트웨어", "AI", "정보시스템"]
    venv_py = CRAWLER_DIR.parent / "backend" / "venv" / "Scripts" / "python.exe"

    script = f"""
import sys, time
sys.path.insert(0, r'{CRAWLER_DIR}')
from db_loader import init_db, collect_bids, collect_results, get_conn
from datetime import datetime, timedelta

init_db()
today = datetime.now()
keywords = {kws!r}

for kw in keywords:
    collect_bids(keyword=kw, days={days}, max_pages=5)
    time.sleep(1)

# 개찰결과: 최근 28일 (API 범위 제한)
for kw in keywords:
    try:
        collect_results(
            keyword=kw,
            start_date=(today - timedelta(days=27)).strftime('%Y%m%d'),
            end_date=today.strftime('%Y%m%d'),
        )
    except Exception as e:
        print(f'결과 수집 실패 ({{kw}}): {{e}}')
    time.sleep(1)

with get_conn() as c:
    bids_n = c.execute('SELECT COUNT(*) FROM bids').fetchone()[0]
    res_n  = c.execute('SELECT COUNT(*) FROM bid_results').fetchone()[0]
print(f'bids={{bids_n}} results={{res_n}}')
"""
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    proc = await asyncio.create_subprocess_exec(
        str(venv_py), "-c", script,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode == 0:
        logger.info(f"[스케줄러] 수집 완료: {stdout.decode('utf-8', errors='replace').strip()}")
    else:
        logger.warning(f"[스케줄러] 수집 오류: {stderr.decode('utf-8', errors='replace')[-300:]}")


async def _scheduled_daily():
    logger.info("[스케줄러] 일간 공고 수집 시작")
    await _run_collection(days=3)
    _last_collect["bids"] = datetime.now().isoformat()


async def _scheduled_weekly():
    logger.info("[스케줄러] 주간 전체 갱신 시작")
    await _run_collection(days=30)
    _last_collect["results"] = datetime.now().isoformat()


# ── 앱 수명 주기 ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 매일 오전 6시: 최근 3일치 공고 수집
    scheduler.add_job(_scheduled_daily,  CronTrigger(hour=6,  minute=0), id="daily",  replace_existing=True)
    # 매주 월요일 새벽 2시: 최근 30일 전체 갱신
    scheduler.add_job(_scheduled_weekly, CronTrigger(day_of_week="mon", hour=2, minute=0), id="weekly", replace_existing=True)
    scheduler.start()
    ai_provider = "OpenAI" if OPENAI_API_KEY else ("Gemini" if GEMINI_API_KEY else "없음 (규칙 기반)")
    logger.info(f"[스케줄러] 시작 — AI 브리핑: {ai_provider}")
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Bid-Master AI", version="0.4.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── DB 연결 ──────────────────────────────────────────────────

def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _bucket(rate: float) -> str:
    return f"{(rate // 0.5) * 0.5:.1f}"


# ── 기본 ─────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "version": "0.4.0"}


@app.get("/health")
def health():
    try:
        with get_conn() as conn:
            conn.execute("SELECT 1")
        return {
            "status": "healthy",
            "db": "connected",
            "openai": bool(OPENAI_API_KEY),
            "scheduler": scheduler.running,
            "last_collect": _last_collect,
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


# ── 수동 수집 트리거 ──────────────────────────────────────────

@app.post("/api/admin/collect")
async def trigger_collect(days: int = Query(3, ge=1, le=30)):
    """수동으로 데이터 수집 트리거 (즉시 실행, 백그라운드)"""
    import asyncio
    asyncio.create_task(_run_collection(days=days))
    _last_collect["bids"] = datetime.now().isoformat()
    return {"status": "started", "days": days}


# ── 공고 목록 ─────────────────────────────────────────────────

@app.get("/api/bids")
def get_bids(
    keyword:      str   = Query(""),
    org:          str   = Query(""),
    price_method: str   = Query(""),
    bid_method:   str   = Query(""),
    large_category: str = Query(""),
    min_price:    float = Query(0),
    max_price:    float = Query(0),
    deadline:     int   = Query(0, description="마감 D-day 이내 (0=전체)"),
    page:         int   = Query(1, ge=1),
    page_size:    int   = Query(20, ge=1, le=100),
):
    with get_conn() as conn:
        conditions, params = [], []

        if keyword:
            conditions.append("bid_no IN (SELECT bid_no FROM bids_fts WHERE bids_fts MATCH ?)")
            params.append(f'"{keyword}"*')
        if org:
            conditions.append("org_name LIKE ?")
            params.append(f"%{org}%")
        if price_method:
            conditions.append("price_method LIKE ?")
            params.append(f"%{price_method}%")
        if bid_method:
            conditions.append("bid_method LIKE ?")
            params.append(f"%{bid_method}%")
        if large_category:
            conditions.append("large_category LIKE ?")
            params.append(f"%{large_category}%")
        if min_price > 0:
            conditions.append("est_price >= ?")
            params.append(min_price)
        if max_price > 0:
            conditions.append("est_price <= ?")
            params.append(max_price)
        if deadline > 0:
            conditions.append("close_dt >= datetime('now', 'localtime')")
            conditions.append("close_dt <= datetime('now', 'localtime', ? || ' days')")
            params.append(str(deadline))

        where  = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        total  = conn.execute(f"SELECT COUNT(*) FROM bids {where}", params).fetchone()[0]
        offset = (page - 1) * page_size
        rows   = conn.execute(
            f"""
            SELECT bid_no, bid_ord, bid_name, org_name, demand_org,
                   bid_method, contract_method, price_method,
                   tot_prdprc_num, drwt_prdprc_num,
                   budget_amt, est_price, announce_dt, close_dt,
                   large_category, mid_category, g2b_url
            FROM bids {where}
            ORDER BY announce_dt DESC
            LIMIT ? OFFSET ?
            """,
            params + [page_size, offset],
        ).fetchall()

    return {
        "total":       total,
        "page":        page,
        "page_size":   page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
        "items":       [dict(r) for r in rows],
    }


# ── 공고 상세 ─────────────────────────────────────────────────

@app.get("/api/bids/{bid_no}")
def get_bid_detail(bid_no: str):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM bids WHERE bid_no = ? ORDER BY bid_ord DESC LIMIT 1", (bid_no,)
        ).fetchone()
    if not row:
        raise HTTPException(404, "공고를 찾을 수 없습니다.")
    return dict(row)


# ── 투찰 전략 ─────────────────────────────────────────────────

@app.get("/api/bids/{bid_no}/strategy")
def get_bid_strategy(bid_no: str):
    """기관별 과거 낙찰 사정률 → AI 추천 투찰가 + 슬라이더용 win_probability"""
    with get_conn() as conn:
        bid = conn.execute(
            "SELECT * FROM bids WHERE bid_no = ? ORDER BY bid_ord DESC LIMIT 1", (bid_no,)
        ).fetchone()
        if not bid:
            raise HTTPException(404, "공고를 찾을 수 없습니다.")

        bid       = dict(bid)
        org_name  = bid.get("org_name") or ""
        est_price = bid.get("est_price") or 0

        # ① 동일 기관 실적 (기관명 앞 6자 LIKE)
        org_prefix = org_name[:6]
        scope = "기관별"
        rows  = []
        if org_prefix:
            rows = conn.execute(
                "SELECT base_rate FROM bid_results WHERE org_name LIKE ? AND base_rate IS NOT NULL",
                (f"%{org_prefix}%",),
            ).fetchall()

        # ② 데이터 부족 시 전체 fallback
        if len(rows) < 3:
            rows  = conn.execute(
                "SELECT base_rate FROM bid_results WHERE base_rate IS NOT NULL"
            ).fetchall()
            scope = "전체 평균"

    rates = [r["base_rate"] for r in rows]
    if not rates:
        return {
            "bid_no": bid_no, "org_name": org_name, "est_price": est_price,
            "scope": scope, "count": 0, "recommendation": None, "distribution": {}, "win_probability": {},
        }

    count = len(rates)
    avg   = sum(rates) / count

    buckets: dict[str, int] = {}
    for r in rates:
        k = _bucket(r)
        buckets[k] = buckets.get(k, 0) + 1

    top_key  = max(buckets, key=lambda k: buckets[k])
    top_rate = float(top_key)

    win_prob = {k: round(v / count * 100, 1) for k, v in buckets.items()}

    return {
        "bid_no": bid_no, "org_name": org_name, "est_price": est_price,
        "scope": scope, "count": count, "avg": round(avg, 2),
        "recommendation": {
            "rate":       top_rate,
            "price":      round(est_price * top_rate / 100) if est_price else None,
            "confidence": "높음" if count >= 10 else "보통" if count >= 3 else "낮음",
        },
        "distribution":   {k: v for k, v in sorted(buckets.items(),  key=lambda x: float(x[0]))},
        "win_probability": {k: v for k, v in sorted(win_prob.items(), key=lambda x: float(x[0]))},
    }


# ── AI 공고 브리핑 ────────────────────────────────────────────

def _rule_based_brief(bid: dict, raw: dict) -> dict:
    """OpenAI 없을 때 규칙 기반 분석"""
    risks: list[dict] = []

    region = bid.get("region_limit") or raw.get("rgnLmtBidLocplcJdgmBssNm", "")
    if region and region not in ("-", ""):
        risks.append({"level": "warning", "text": f"지역 제한: {region}"})

    pm = bid.get("price_method") or ""
    if "복수예가" in pm:
        tot  = bid.get("tot_prdprc_num") or 0
        drwt = bid.get("drwt_prdprc_num") or 0
        if tot:
            risks.append({"level": "info", "text": f"복수예가 {tot}개 제출 → {drwt}개 추첨"})

    if "협상" in (bid.get("contract_method") or ""):
        risks.append({"level": "warning", "text": "협상에 의한 계약 — 기술 제안서 준비 필요"})

    close_dt = bid.get("close_dt") or ""
    if close_dt:
        try:
            diff = (datetime.fromisoformat(close_dt[:19].replace(" ", "T")) - datetime.now()).days
            if diff < 0:
                risks.append({"level": "info",    "text": f"입찰 마감 완료 ({abs(diff)}일 전)"})
            elif diff <= 3:
                risks.append({"level": "danger",  "text": f"마감 D-{diff} — 즉시 서류 준비"})
            elif diff <= 7:
                risks.append({"level": "warning", "text": f"마감 D-{diff} — 이번 주 내 제출"})
        except Exception:
            pass

    if not risks:
        risks.append({"level": "ok", "text": "특이 사항 없음 — 표준 입찰 공고"})

    est    = bid.get("est_price") or 0
    budget = bid.get("budget_amt") or 0
    summary = [
        {"label": "발주기관", "value": bid.get("org_name") or "-"},
        {"label": "수요기관", "value": bid.get("demand_org") or bid.get("org_name") or "-"},
        {"label": "추정가격", "value": f"{est:,.0f}원" if est else "비공개"},
        {"label": "배정예산", "value": f"{budget:,.0f}원" if budget else "-"},
        {"label": "입찰방식", "value": f"{bid.get('bid_method') or '-'} / {bid.get('price_method') or '-'}"},
        {"label": "계약방식", "value": bid.get("contract_method") or "-"},
        {"label": "품목분류", "value": f"{bid.get('large_category') or ''} > {bid.get('mid_category') or ''}".strip(" >")},
    ]
    return {"risks": risks, "summary": summary, "recommendation": None}


async def _openai_brief(bid: dict) -> dict | None:
    """GPT-4o-mini로 공고 리스크 분석 (JSON 응답)"""
    if not OPENAI_API_KEY:
        return None
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)

        prompt = f"""당신은 한국 공공입찰 전문가입니다.
아래 입찰 공고를 분석하여 JSON으로만 응답하세요.

공고명: {bid.get('bid_name')}
발주기관: {bid.get('org_name')}
수요기관: {bid.get('demand_org')}
추정가격: {bid.get('est_price')}원
입찰방식: {bid.get('bid_method')}
예가방식: {bid.get('price_method')}
계약방식: {bid.get('contract_method')}
지역제한: {bid.get('region_limit') or '없음'}
마감일시: {bid.get('close_dt')}
대분류: {bid.get('large_category')} / 중분류: {bid.get('mid_category')}

응답 형식:
{{
  "risks": [
    {{"level": "danger|warning|info|ok", "text": "리스크 설명 (1~2문장)"}}
  ],
  "summary": [
    {{"label": "항목명", "value": "내용"}}
  ],
  "recommendation": "투찰 전략 한 줄 제안"
}}

risks는 실적 제한, 지역 제한, 기술 요건, 마감 임박, 낙찰 방식 유의사항 위주로 3~5개.
summary는 발주기관/추정가격/입찰방식/핵심요건 위주 5~7개."""

        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=800,
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        logger.warning(f"OpenAI 브리핑 실패: {e}")
        return None


def _build_brief_prompt(bid: dict) -> str:
    return f"""당신은 한국 공공입찰 전문가입니다.
아래 입찰 공고를 분석하여 JSON으로만 응답하세요.

공고명: {bid.get('bid_name')}
발주기관: {bid.get('org_name')}
수요기관: {bid.get('demand_org')}
추정가격: {bid.get('est_price')}원
입찰방식: {bid.get('bid_method')}
예가방식: {bid.get('price_method')}
계약방식: {bid.get('contract_method')}
지역제한: {bid.get('region_limit') or '없음'}
마감일시: {bid.get('close_dt')}
대분류: {bid.get('large_category')} / 중분류: {bid.get('mid_category')}

응답 형식:
{{
  "risks": [
    {{"level": "danger|warning|info|ok", "text": "리스크 설명 (1~2문장)"}}
  ],
  "summary": [
    {{"label": "항목명", "value": "내용"}}
  ],
  "recommendation": "투찰 전략 한 줄 제안"
}}

risks는 3~4개, text는 한 문장(30자 이내)으로 간결하게.
summary는 4~5개, value는 20자 이내."""


async def _gemini_brief(bid: dict) -> dict | None:
    """Gemini 1.5 Flash로 공고 리스크 분석 (REST v1 직접 호출)"""
    if not GEMINI_API_KEY:
        return None
    try:
        import httpx
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        )
        payload = {
            "contents": [{"parts": [{"text": _build_brief_prompt(bid)}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 8192,
            },
        }
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()

        # thinking 모델은 thought:true 파트 제외, text만 합침
        parts = r.json()["candidates"][0]["content"]["parts"]
        text = "".join(p["text"] for p in parts if "text" in p and not p.get("thought"))

        logger.info(f"[Gemini 원문] {text[:300]}")

        # 마크다운 코드블록 제거 후 JSON 파싱
        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(text)
    except Exception as e:
        logger.warning(f"Gemini 브리핑 실패: {e}")
        return None


@app.get("/api/bids/{bid_no}/ai-brief")
async def get_ai_brief(bid_no: str):
    # 캐시 확인 (10분 TTL)
    cached = _brief_cache.get(bid_no)
    if cached and (datetime.now() - cached["ts"]).seconds < 600:
        return cached["result"]

    with get_conn() as conn:
        bid = conn.execute(
            "SELECT * FROM bids WHERE bid_no = ? ORDER BY bid_ord DESC LIMIT 1", (bid_no,)
        ).fetchone()
    if not bid:
        raise HTTPException(404, "공고를 찾을 수 없습니다.")

    bid = dict(bid)
    raw: dict = {}
    if bid.get("raw_json"):
        try:
            raw = json.loads(bid["raw_json"])
        except Exception:
            pass

    # OpenAI → Gemini → 규칙 기반 순서로 시도
    ai_result = await _openai_brief(bid)
    provider  = "GPT-4o-mini"

    if ai_result is None:
        ai_result = await _gemini_brief(bid)
        provider  = "Gemini Flash"

    ai_powered = ai_result is not None
    if not ai_powered:
        ai_result = _rule_based_brief(bid, raw)

    result = {
        "bid_no":         bid_no,
        "title":          bid.get("bid_name") or "",
        "risks":          ai_result.get("risks", []),
        "summary":        ai_result.get("summary", []),
        "recommendation": ai_result.get("recommendation"),
        "ai_powered":     ai_powered,
        "note": f"{provider} 분석" if ai_powered else "규칙 기반 분석 · GEMINI_API_KEY 또는 OPENAI_API_KEY 설정 시 AI 분석 활성화",
    }

    # AI 성공 시에만 캐싱
    if ai_powered:
        _brief_cache[bid_no] = {"result": result, "ts": datetime.now()}

    return result


# ── 경쟁사 패턴 분석 ──────────────────────────────────────────

@app.get("/api/analysis/competitors")
def analyze_competitors(
    org:     str = Query("", description="발주기관 필터"),
    keyword: str = Query("", description="공고명 키워드"),
    limit:   int = Query(15, ge=5, le=50),
):
    """
    경쟁사 낙찰 패턴 분석

    bid_results.winner_name 기준으로:
    - 낙찰 횟수
    - 평균 사정률
    - 최근 낙찰일
    - 주요 수주 기관
    """
    with get_conn() as conn:
        conditions = ["winner_name != ''", "winner_name IS NOT NULL", "base_rate IS NOT NULL"]
        params: list = []

        if org:
            conditions.append("org_name LIKE ?")
            params.append(f"%{org}%")
        if keyword:
            conditions.append("bid_name LIKE ?")
            params.append(f"%{keyword}%")

        where = "WHERE " + " AND ".join(conditions)

        rows = conn.execute(
            f"""
            SELECT
                winner_name,
                COUNT(*)          AS win_count,
                ROUND(AVG(base_rate), 2) AS avg_rate,
                ROUND(MIN(base_rate), 2) AS min_rate,
                ROUND(MAX(base_rate), 2) AS max_rate,
                MAX(open_dt)      AS last_win_dt,
                GROUP_CONCAT(DISTINCT org_name) AS orgs
            FROM bid_results {where}
            GROUP BY winner_name
            ORDER BY win_count DESC
            LIMIT ?
            """,
            params + [limit],
        ).fetchall()

    competitors = []
    for r in rows:
        orgs_raw = r["orgs"] or ""
        orgs     = [o.strip() for o in orgs_raw.split(",") if o.strip()][:3]
        wc       = r["win_count"]
        competitors.append({
            "winner_name": r["winner_name"],
            "win_count":   wc,
            "avg_rate":    r["avg_rate"],
            "min_rate":    r["min_rate"],
            "max_rate":    r["max_rate"],
            "last_win_dt": r["last_win_dt"] or "",
            "top_orgs":    orgs,
            "threat":      "high" if wc >= 10 else "medium" if wc >= 3 else "low",
        })

    high_threat = sum(1 for c in competitors if c["threat"] == "high")

    return {
        "total":       len(competitors),
        "high_threat": high_threat,
        "period":      "최근 1년",
        "org_filter":  org,
        "keyword":     keyword,
        "competitors": competitors,
    }


# ── 통계 ─────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats():
    with get_conn() as conn:
        total_bids    = conn.execute("SELECT COUNT(*) FROM bids").fetchone()[0]
        total_results = conn.execute("SELECT COUNT(*) FROM bid_results").fetchone()[0]
        with_rate     = conn.execute("SELECT COUNT(*) FROM bid_results WHERE base_rate IS NOT NULL").fetchone()[0]

        price_methods = {
            r["price_method"]: r["cnt"]
            for r in conn.execute(
                "SELECT price_method, COUNT(*) as cnt FROM bids GROUP BY price_method"
            ).fetchall()
            if r["price_method"]
        }
        bid_methods = {
            r["bid_method"]: r["cnt"]
            for r in conn.execute(
                "SELECT bid_method, COUNT(*) as cnt FROM bids GROUP BY bid_method"
            ).fetchall()
            if r["bid_method"]
        }

    last_collect_dt = _last_collect.get("bids") or _last_collect.get("results")

    return {
        "total_bids":        total_bids,
        "total_results":     total_results,
        "results_with_rate": with_rate,
        "by_price_method":   price_methods,
        "by_bid_method":     bid_methods,
        "scheduler":         scheduler.running,
        "last_collect":      last_collect_dt,
    }


# ── 개찰결과 목록 ─────────────────────────────────────────────

@app.get("/api/results")
def get_results(
    org:          str = Query(""),
    price_method: str = Query(""),
    page:         int = Query(1, ge=1),
    page_size:    int = Query(50, ge=1, le=200),
):
    with get_conn() as conn:
        conditions, params = ["base_rate IS NOT NULL"], []
        if org:
            conditions.append("org_name LIKE ?")
            params.append(f"%{org}%")
        if price_method:
            conditions.append("price_method = ?")
            params.append(price_method)

        where  = "WHERE " + " AND ".join(conditions)
        total  = conn.execute(f"SELECT COUNT(*) FROM bid_results {where}", params).fetchone()[0]
        offset = (page - 1) * page_size
        rows   = conn.execute(
            f"""
            SELECT bid_no, bid_name, org_name, open_dt,
                   winner_name, winning_amt, est_price, base_rate,
                   price_method, large_category
            FROM bid_results {where}
            ORDER BY open_dt DESC
            LIMIT ? OFFSET ?
            """,
            params + [page_size, offset],
        ).fetchall()

    return {
        "total":       total,
        "page":        page,
        "total_pages": max(1, (total + page_size - 1) // page_size),
        "items":       [dict(r) for r in rows],
    }


# ── 사정률 분석 (복수예가 전용 JOIN 지원) ──────────────────────

@app.get("/api/analysis/base-rate")
def analyze_base_rate(
    org:          str = Query(""),
    category:     str = Query(""),
    price_method: str = Query(""),
    fuksu_only:   bool = Query(False, description="복수예가만 필터 (bids JOIN)"),
):
    """
    사정률 분포 분석

    fuksu_only=true 시: bid_results JOIN bids WHERE bids.price_method LIKE '복수예가%'
    """
    with get_conn() as conn:
        if fuksu_only:
            # rsrvtnPrceFileExistnceYn='Y' → 복수예가 proxy
            # (개찰결과 API에 price_method 없음 → 예비가격 파일 존재 여부로 판별)
            base_query = """
                SELECT base_rate FROM bid_results
                WHERE base_rate IS NOT NULL
                  AND json_extract(raw_json, '$.rsrvtnPrceFileExistnceYn') = 'Y'
            """
            conditions, params = [], []
            if org:
                conditions.append("org_name LIKE ?")
                params.append(f"%{org}%")
            if category:
                conditions.append("category_no = ?")
                params.append(category)
        else:
            base_query = "SELECT base_rate FROM bid_results WHERE base_rate IS NOT NULL"
            conditions, params = [], []
            if price_method:
                conditions.append("price_method = ?")
                params.append(price_method)
            if org:
                conditions.append("org_name LIKE ?")
                params.append(f"%{org}%")
            if category:
                conditions.append("category_no = ?")
                params.append(category)

        if conditions:
            base_query += " AND " + " AND ".join(conditions)

        rows = conn.execute(base_query, params).fetchall()

    if not rows:
        return {"count": 0, "fuksu_only": fuksu_only, "message": "데이터 없음"}

    rates = [r[0] for r in rows]
    count = len(rates)
    avg   = sum(rates) / count

    buckets: dict[str, int] = {}
    for rate in rates:
        k = _bucket(rate)
        buckets[k] = buckets.get(k, 0) + 1

    top_bucket = max(buckets, key=lambda k: buckets[k])

    return {
        "count":        count,
        "avg":          round(avg, 4),
        "min":          round(min(rates), 4),
        "max":          round(max(rates), 4),
        "top_rate":     float(top_bucket),
        "fuksu_only":   fuksu_only,
        "distribution": {k: v for k, v in sorted(buckets.items(), key=lambda x: float(x[0]))},
    }
