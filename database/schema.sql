-- ============================================================
-- Bid-Master AI — SQLite 스키마
-- ============================================================

PRAGMA journal_mode = WAL;   -- 동시 읽기/쓰기 성능
PRAGMA foreign_keys = ON;

-- ── 1. 입찰공고 (bids) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS bids (
    bid_no          TEXT NOT NULL,          -- 공고번호 (PK 구성)
    bid_ord         TEXT NOT NULL DEFAULT '000', -- 공고차수
    bid_name        TEXT,                   -- 공고명
    org_name        TEXT,                   -- 공고기관
    demand_org      TEXT,                   -- 수요기관
    bid_method      TEXT,                   -- 입찰방식 (전자입찰 등)
    contract_method TEXT,                   -- 계약방식 (제한경쟁 등)
    price_method    TEXT,                   -- 예가방식 (복수예가/비예가)
    tot_prdprc_num  INTEGER,                -- 복수예비가 총 개수
    drwt_prdprc_num INTEGER,                -- 추첨 개수
    budget_amt      REAL,                   -- 배정예산액
    est_price       REAL,                   -- 추정가격
    announce_dt     TEXT,                   -- 공고일시
    close_dt        TEXT,                   -- 입찰마감일시
    open_dt         TEXT,                   -- 개찰일시
    large_category  TEXT,                   -- 대분류
    mid_category    TEXT,                   -- 중분류
    category_no     TEXT,                   -- 품목분류번호
    region_limit    TEXT,                   -- 지역 제한
    g2b_url         TEXT,                   -- 나라장터 URL
    raw_json        TEXT,                   -- 원본 전체 데이터 (JSON)
    created_at      TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT DEFAULT (datetime('now', 'localtime')),

    PRIMARY KEY (bid_no, bid_ord)
);

-- 검색 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_bids_org       ON bids(org_name);
CREATE INDEX IF NOT EXISTS idx_bids_close_dt  ON bids(close_dt);
CREATE INDEX IF NOT EXISTS idx_bids_price_method ON bids(price_method);
CREATE INDEX IF NOT EXISTS idx_bids_est_price ON bids(est_price);
CREATE INDEX IF NOT EXISTS idx_bids_announce  ON bids(announce_dt);

-- 공고명 전문 검색 (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS bids_fts USING fts5(
    bid_no,
    bid_name,
    org_name,
    demand_org,
    content='bids',
    content_rowid='rowid'
);

-- ── 2. 개찰결과 (bid_results) — 사정률 분석 핵심 ────────────
CREATE TABLE IF NOT EXISTS bid_results (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    bid_no          TEXT NOT NULL,          -- 공고번호
    bid_ord         TEXT NOT NULL DEFAULT '000',
    bid_name        TEXT,                   -- 공고명
    org_name        TEXT,                   -- 공고기관
    demand_org      TEXT,                   -- 수요기관
    open_dt         TEXT,                   -- 개찰일시
    winner_name     TEXT,                   -- 낙찰업체명
    winning_amt     REAL,                   -- 낙찰금액
    est_price       REAL,                   -- 예정가격 (사정가)
    base_rate       REAL,                   -- 사정률 (낙찰금액/예정가격 × 100)
    bid_method      TEXT,                   -- 입찰방식
    price_method    TEXT,                   -- 예가방식
    contract_method TEXT,                   -- 계약방식
    large_category  TEXT,                   -- 대분류
    mid_category    TEXT,                   -- 중분류
    category_no     TEXT,                   -- 품목분류번호
    raw_json        TEXT,                   -- 원본 JSON
    created_at      TEXT DEFAULT (datetime('now', 'localtime')),

    UNIQUE (bid_no, bid_ord)                -- 중복 방지
);

-- 사정률 분석 쿼리용 인덱스
CREATE INDEX IF NOT EXISTS idx_results_org        ON bid_results(org_name);
CREATE INDEX IF NOT EXISTS idx_results_open_dt    ON bid_results(open_dt);
CREATE INDEX IF NOT EXISTS idx_results_base_rate  ON bid_results(base_rate);
CREATE INDEX IF NOT EXISTS idx_results_price_meth ON bid_results(price_method);
CREATE INDEX IF NOT EXISTS idx_results_category   ON bid_results(category_no);

-- ── 3. 사용자 (users) ──────────────────────────────────────────
-- role: admin / manager / premium / general
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    name            TEXT NOT NULL DEFAULT '',
    role            TEXT NOT NULL DEFAULT 'general'
                        CHECK(role IN ('admin','manager','premium','general')),
    is_active       INTEGER NOT NULL DEFAULT 1,
    -- AI 분석 일일 할당량 (-1 = 무제한)
    ai_daily_limit  INTEGER NOT NULL DEFAULT 3,
    ai_calls_today  INTEGER NOT NULL DEFAULT 0,
    last_reset_date TEXT DEFAULT (date('now','localtime')),
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- ── 4. API 사용 로그 (api_usage_log) ──────────────────────────
CREATE TABLE IF NOT EXISTS api_usage_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    endpoint    TEXT NOT NULL,
    called_at   TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_usage_user ON api_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_date ON api_usage_log(called_at);

-- ── 5. 공고 열람 기록 (bid_views) ─────────────────────────────
CREATE TABLE IF NOT EXISTS bid_views (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    bid_no      TEXT NOT NULL,
    bid_name    TEXT,
    org_name    TEXT,
    est_price   REAL,
    viewed_at   TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_views_user ON bid_views(user_id);
CREATE INDEX IF NOT EXISTS idx_views_date ON bid_views(viewed_at);

-- ── 6. AI 브리핑 사용 기록 (ai_brief_log) ─────────────────────
CREATE TABLE IF NOT EXISTS ai_brief_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    bid_no      TEXT NOT NULL,
    bid_name    TEXT,
    org_name    TEXT,
    used_at     TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_ai_log_user ON ai_brief_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_log_date ON ai_brief_log(used_at);
