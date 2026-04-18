"""
Bid-Master AI — DB 로더
역할:
  1. SQLite DB 초기화 (스키마 적용)
  2. 기존 CSV → DB 마이그레이션
  3. KONEPS API → DB Upsert (공고 + 개찰결과)
"""

import json
import logging
import sqlite3
import time
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from koneps_crawler import KonepsCrawler

load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── 경로 설정 ─────────────────────────────────────────────────

BASE_DIR   = Path(__file__).parent.parent
DB_PATH    = BASE_DIR / "database" / "bidmaster.db"
SCHEMA_PATH = BASE_DIR / "database" / "schema.sql"
CSV_PATH   = Path(__file__).parent / "output" / "bid_announcements_software.csv"


# ── DB 연결 & 초기화 ─────────────────────────────────────────

def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """스키마 파일로 DB 초기화"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    logger.info(f"DB 초기화 완료: {DB_PATH}")


# ── 공고 Upsert ───────────────────────────────────────────────

def upsert_bids(df: pd.DataFrame, conn: sqlite3.Connection) -> int:
    """
    입찰공고 DataFrame → bids 테이블 Upsert
    공고번호+차수 기준으로 있으면 UPDATE, 없으면 INSERT
    """
    rows = []
    for _, r in df.iterrows():
        row = dict(r)
        rows.append({
            "bid_no":          row.get("공고번호") or row.get("bidNtceNo", ""),
            "bid_ord":         row.get("bidNtceOrd", "000"),
            "bid_name":        row.get("공고명") or row.get("bidNtceNm", ""),
            "org_name":        row.get("공고기관") or row.get("ntceInsttNm", ""),
            "demand_org":      row.get("수요기관") or row.get("dminsttNm", ""),
            "bid_method":      row.get("입찰방식") or row.get("bidMethdNm", ""),
            "contract_method": row.get("계약방식") or row.get("cntrctCnclsMthdNm", ""),
            "price_method":    row.get("예가방식") or row.get("prearngPrceDcsnMthdNm", ""),
            "tot_prdprc_num":  _to_int(row.get("totPrdprcNum")),
            "drwt_prdprc_num": _to_int(row.get("drwtPrdprcNum")),
            "budget_amt":      _to_float(row.get("배정예산액") or row.get("asignBdgtAmt")),
            "est_price":       _to_float(row.get("추정가격") or row.get("presmptPrce")),
            "announce_dt":     _to_str(row.get("공고일시") or row.get("bidNtceDt")),
            "close_dt":        _to_str(row.get("입찰마감일시") or row.get("bidClseDt")),
            "open_dt":         _to_str(row.get("opengDt")),
            "large_category":  row.get("대분류") or row.get("pubPrcrmntLrgClsfcNm", ""),
            "mid_category":    row.get("중분류") or row.get("pubPrcrmntMidClsfcNm", ""),
            "category_no":     row.get("pubPrcrmntClsfcNo", ""),
            "region_limit":    row.get("rgnLmtBidLocplcJdgmBssNm", ""),
            "g2b_url":         row.get("bidNtceUrl", ""),
            "raw_json":        json.dumps(row, ensure_ascii=False, default=str),
        })

    sql = """
        INSERT INTO bids (
            bid_no, bid_ord, bid_name, org_name, demand_org,
            bid_method, contract_method, price_method,
            tot_prdprc_num, drwt_prdprc_num,
            budget_amt, est_price, announce_dt, close_dt, open_dt,
            large_category, mid_category, category_no, region_limit,
            g2b_url, raw_json, updated_at
        ) VALUES (
            :bid_no, :bid_ord, :bid_name, :org_name, :demand_org,
            :bid_method, :contract_method, :price_method,
            :tot_prdprc_num, :drwt_prdprc_num,
            :budget_amt, :est_price, :announce_dt, :close_dt, :open_dt,
            :large_category, :mid_category, :category_no, :region_limit,
            :g2b_url, :raw_json, datetime('now','localtime')
        )
        ON CONFLICT(bid_no, bid_ord) DO UPDATE SET
            bid_name        = excluded.bid_name,
            org_name        = excluded.org_name,
            demand_org      = excluded.demand_org,
            bid_method      = excluded.bid_method,
            contract_method = excluded.contract_method,
            price_method    = excluded.price_method,
            budget_amt      = excluded.budget_amt,
            est_price       = excluded.est_price,
            announce_dt     = excluded.announce_dt,
            close_dt        = excluded.close_dt,
            open_dt         = excluded.open_dt,
            large_category  = excluded.large_category,
            mid_category    = excluded.mid_category,
            raw_json        = excluded.raw_json,
            updated_at      = datetime('now','localtime')
    """
    conn.executemany(sql, rows)
    conn.commit()

    # FTS 동기화
    conn.execute("INSERT INTO bids_fts(bids_fts) VALUES('rebuild')")
    conn.commit()

    return len(rows)


# ── 개찰결과 Upsert ───────────────────────────────────────────

def upsert_results(df: pd.DataFrame, conn: sqlite3.Connection) -> int:
    """
    개찰결과 DataFrame → bid_results 테이블 Upsert
    사정률(base_rate) 자동 계산
    """
    rows = []
    for _, r in df.iterrows():
        row = dict(r)
        winning_amt = _to_float(row.get("낙찰금액") or row.get("sucsfbidAmt"))
        est_price   = _to_float(row.get("추정가격") or row.get("presmptPrce"))
        # 사정률: 개찰결과 API는 opengCorpInfo에서 직접 파싱된 사정률(%) 사용
        # 없으면 낙찰금액/추정가격으로 계산
        direct_rate = _to_float(row.get("사정률(%)") or row.get("sucsfbidRate"))
        if direct_rate and direct_rate > 0:
            base_rate = round(direct_rate, 4)
        elif est_price and winning_amt:
            base_rate = round(winning_amt / est_price * 100, 4)
        else:
            base_rate = None

        rows.append({
            "bid_no":          row.get("공고번호") or row.get("bidNtceNo", ""),
            "bid_ord":         row.get("bidNtceOrd", "000"),
            "bid_name":        row.get("공고명") or row.get("bidNtceNm", ""),
            "org_name":        row.get("공고기관") or row.get("ntceInsttNm", ""),
            "demand_org":      row.get("수요기관") or row.get("dminsttNm", ""),
            "open_dt":         _to_str(row.get("개찰일시") or row.get("opengDt")),
            "winner_name":     row.get("낙찰업체명") or row.get("sucsfbidCorpNm", ""),
            "winning_amt":     winning_amt,
            "est_price":       est_price,
            "base_rate":       base_rate,
            "bid_method":      row.get("입찰방식") or row.get("bidMethdNm", ""),
            "price_method":    row.get("예가방식") or row.get("prearngPrceDcsnMthdNm", ""),
            "contract_method": row.get("계약방식") or row.get("cntrctCnclsMthdNm", ""),
            "large_category":  row.get("대분류") or row.get("pubPrcrmntLrgClsfcNm", ""),
            "mid_category":    row.get("중분류") or row.get("pubPrcrmntMidClsfcNm", ""),
            "category_no":     row.get("pubPrcrmntClsfcNo", ""),
            "raw_json":        json.dumps(row, ensure_ascii=False, default=str),
        })

    sql = """
        INSERT INTO bid_results (
            bid_no, bid_ord, bid_name, org_name, demand_org,
            open_dt, winner_name, winning_amt, est_price, base_rate,
            bid_method, price_method, contract_method,
            large_category, mid_category, category_no, raw_json
        ) VALUES (
            :bid_no, :bid_ord, :bid_name, :org_name, :demand_org,
            :open_dt, :winner_name, :winning_amt, :est_price, :base_rate,
            :bid_method, :price_method, :contract_method,
            :large_category, :mid_category, :category_no, :raw_json
        )
        ON CONFLICT(bid_no, bid_ord) DO UPDATE SET
            winner_name  = excluded.winner_name,
            winning_amt  = excluded.winning_amt,
            est_price    = excluded.est_price,
            base_rate    = excluded.base_rate,
            open_dt      = excluded.open_dt,
            raw_json     = excluded.raw_json
    """
    conn.executemany(sql, rows)
    conn.commit()
    return len(rows)


# ── CSV 마이그레이션 ──────────────────────────────────────────

def migrate_csv(conn: sqlite3.Connection) -> None:
    """기존 CSV 데이터 → bids 테이블 마이그레이션"""
    if not CSV_PATH.exists():
        logger.warning(f"CSV 없음, 스킵: {CSV_PATH}")
        return

    df = pd.read_csv(CSV_PATH, dtype=str).fillna("")
    count = upsert_bids(df, conn)
    logger.info(f"CSV 마이그레이션 완료: {count}건 → bids")


# ── API 수집 & DB 저장 ────────────────────────────────────────

def collect_bids(
    keyword: str,
    days: int = 30,
    max_pages: int = 10,
    bid_type: str = "service",
) -> int:
    """KONEPS API로 공고를 수집하여 DB에 저장"""
    crawler = KonepsCrawler()
    today = datetime.now()
    start_date = (today - timedelta(days=days)).strftime("%Y%m%d")
    end_date   = today.strftime("%Y%m%d")

    df = crawler.fetch_all_pages(
        keyword=keyword,
        bid_type=bid_type,
        start_date=start_date,
        end_date=end_date,
        max_pages=max_pages,
    )
    if df.empty:
        logger.info("수집된 공고 없음")
        return 0

    with get_conn() as conn:
        count = upsert_bids(df, conn)
    logger.info(f"공고 수집 완료: {count}건")
    return count


def collect_results(
    keyword: str,
    start_date: str,
    end_date: str,
) -> int:
    """KONEPS API로 개찰결과를 수집하여 DB에 저장"""
    crawler = KonepsCrawler()
    df = crawler.fetch_open_results(
        keyword=keyword,
        start_date=start_date,
        end_date=end_date,
    )
    if df.empty:
        logger.info("개찰결과 없음")
        return 0

    with get_conn() as conn:
        count = upsert_results(df, conn)
    logger.info(f"개찰결과 수집 완료: {count}건")
    return count


# ── 유틸 ─────────────────────────────────────────────────────

def _to_float(val) -> float | None:
    try:
        return float(str(val).replace(",", "")) if val and str(val).strip() not in ("", "nan") else None
    except (ValueError, TypeError):
        return None

def _to_int(val) -> int | None:
    try:
        return int(float(str(val))) if val and str(val).strip() not in ("", "nan") else None
    except (ValueError, TypeError):
        return None

def _to_str(val) -> str:
    """pandas Timestamp 등 모든 타입을 문자열로 변환"""
    if val is None:
        return ""
    import pandas as pd
    if isinstance(val, pd.Timestamp):
        return val.isoformat() if not pd.isna(val) else ""
    s = str(val)
    return "" if s in ("nan", "NaT", "None") else s


# ── 메인 실행 ─────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  Bid-Master AI — DB 초기화 & 데이터 수집")
    print("=" * 60)

    # 1. DB 초기화
    init_db()

    # 2. 기존 CSV 마이그레이션
    print("\n[1] CSV 마이그레이션")
    with get_conn() as conn:
        migrate_csv(conn)

    # 3. 최신 공고 수집 (소프트웨어 키워드, 최근 30일)
    print("\n[2] 최신 공고 수집 (소프트웨어, 최근 30일)")
    collect_bids(keyword="소프트웨어", days=30, max_pages=5)

    # 4. 개찰결과 수집 (최근 1년, 27일 단위 분할)
    # API 최대 조회 범위 제한: 2월 포함 구간에서 최대 28일 차이까지 허용
    # → 안전하게 27일 청크로 고정
    print("\n[3] 개찰결과 수집 (소프트웨어, 최근 1년 — 27일 단위 분할)")
    today = datetime.now()
    total_results = 0
    try:
        chunk_end = today
        one_year_ago = today.replace(year=today.year - 1)
        while chunk_end > one_year_ago:
            chunk_start = max(chunk_end - timedelta(days=27), one_year_ago)
            cnt = collect_results(
                keyword="소프트웨어",
                start_date=chunk_start.strftime("%Y%m%d"),
                end_date=chunk_end.strftime("%Y%m%d"),
            )
            total_results += cnt
            chunk_end = chunk_start - timedelta(days=1)
            time.sleep(0.5)
        print(f"개찰결과 총 수집: {total_results}건")
    except Exception as e:
        logger.warning(f"개찰결과 수집 실패: {e}")

    # 5. 결과 확인
    with get_conn() as conn:
        bids_count    = conn.execute("SELECT COUNT(*) FROM bids").fetchone()[0]
        results_count = conn.execute("SELECT COUNT(*) FROM bid_results").fetchone()[0]

    print(f"\n{'=' * 60}")
    print(f"  bids 테이블:       {bids_count:,}건")
    print(f"  bid_results 테이블: {results_count:,}건")
    print(f"  DB 위치: {DB_PATH}")
    print("=" * 60)
