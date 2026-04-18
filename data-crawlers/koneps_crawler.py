"""
나라장터(KONEPS) 입찰공고 크롤러
공공데이터포털 API를 통해 입찰 공고 데이터를 수집합니다.

API 문서: https://www.data.go.kr/data/15000051/openapi.do
"""

import os
import time
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from urllib.parse import unquote, urlencode, quote

import httpx
import pandas as pd
from dotenv import load_dotenv

# .env 파일 로드 (data-crawlers/.env 우선, 없으면 프로젝트 루트)
_env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_env_path if _env_path.exists() else Path(__file__).parent.parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── 나라장터 API 엔드포인트 ─────────────────────────────────────────────────────

BASE_URL = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService"

ENDPOINTS = {
    # 물품 입찰공고
    "bid_goods": f"{BASE_URL}/getBidPblancListInfoThng",
    # 용역(서비스) 입찰공고 — 소프트웨어 공고는 여기에 집중
    "bid_service": f"{BASE_URL}/getBidPblancListInfoServc",
    # 공사 입찰공고
    "bid_construction": f"{BASE_URL}/getBidPblancListInfoCnstwk",
    # 개찰결과 (낙찰 데이터 수집용) — /as/ 경로 사용
    "open_result": "https://apis.data.go.kr/1230000/as/ScsbidInfoService/getOpengResultListInfoServc",
}


# ── 핵심 크롤러 클래스 ─────────────────────────────────────────────────────────

class KonepsCrawler:
    """나라장터 입찰공고 크롤러"""

    def __init__(self, api_key: Optional[str] = None, timeout: int = 30):
        raw_key = api_key or os.getenv("KONEPS_API_KEY", "")
        # 포털에서 Encoding 키를 복사한 경우 자동으로 디코딩
        self.api_key = unquote(raw_key)
        self.timeout = timeout
        self._validate_api_key()

    def _validate_api_key(self) -> None:
        if not self.api_key:
            raise ValueError(
                "API 키가 설정되지 않았습니다.\n"
                "data-crawlers/.env 파일에 KONEPS_API_KEY=your_key 를 추가하세요.\n"
                "발급: https://www.data.go.kr"
            )

    def _request(self, url: str, params: dict, retries: int = 3) -> dict:
        """공공데이터포털 API 요청 (재시도 포함)"""
        params["type"] = "json"

        # serviceKey는 httpx params에 넣으면 이중 인코딩 발생 → URL에 직접 삽입
        query_string = urlencode(params) + "&serviceKey=" + quote(self.api_key, safe="")
        full_url = f"{url}?{query_string}"

        for attempt in range(1, retries + 1):
            try:
                response = httpx.get(full_url, timeout=self.timeout)
                response.raise_for_status()
                data = response.json()

                # nkoneps 응답 구조 파싱 (성공/에러 키가 다름)
                if "nkoneps.com.response.ResponseError" in data:
                    err = data["nkoneps.com.response.ResponseError"]["header"]
                    raise ValueError(f"API 오류 [{err.get('resultCode')}]: {err.get('resultMsg')}")

                # 정상 응답 키 탐색
                response_body = None
                for key in data:
                    if "response" in key.lower():
                        response_body = data[key]
                        break

                if response_body is None:
                    raise ValueError(f"예상치 못한 응답 형식: {list(data.keys())}")

                header = response_body.get("header", {})
                result_code = header.get("resultCode", "00")
                if result_code not in ("00", "0000"):
                    raise ValueError(
                        f"API 오류 [{result_code}]: {header.get('resultMsg', '알 수 없음')}"
                    )

                return response_body.get("body", {})

            except httpx.HTTPStatusError as e:
                logger.warning(f"HTTP 오류 (시도 {attempt}/{retries}): {e}")
            except httpx.TimeoutException:
                logger.warning(f"타임아웃 (시도 {attempt}/{retries})")
            except Exception as e:
                logger.error(f"요청 실패: {e}")
                raise

            if attempt < retries:
                time.sleep(2 ** attempt)  # 지수 백오프

        raise RuntimeError(f"API 요청 {retries}회 모두 실패: {url}")

    def fetch_bid_announcements(
        self,
        keyword: str,
        bid_type: str = "service",
        start_date: str = "",
        end_date: str = "",
        page: int = 1,
        page_size: int = 100,
    ) -> pd.DataFrame:
        """
        입찰 공고 목록 조회

        Args:
            keyword:    검색 키워드 (예: '소프트웨어', 'AI', '클라우드')
            bid_type:   공고 유형 ('service'=용역, 'goods'=물품, 'construction'=공사)
            start_date: 공고 시작일 (YYYYMMDD, 빈 값이면 최근 30일)
            end_date:   공고 종료일 (YYYYMMDD, 빈 값이면 오늘)
            page:       페이지 번호
            page_size:  페이지당 결과 수 (최대 100)

        Returns:
            입찰공고 DataFrame
        """
        url = ENDPOINTS.get(f"bid_{bid_type}")
        if url is None:
            raise ValueError(f"지원하지 않는 bid_type: {bid_type}. 가능한 값: service, goods, construction")

        # 날짜 기본값: 오늘 기준 최근 30일 (API 필수값)
        today = datetime.now()
        default_end = today.strftime("%Y%m%d")
        default_start = (today - timedelta(days=30)).strftime("%Y%m%d")

        params = {
            "numOfRows": page_size,
            "pageNo": page,
            "inqryDiv": 1,                  # 1=날짜범위 조회, 2=공고번호 직접 조회
            "inqryBgnDt": (start_date or default_start) + "0000",
            "inqryEndDt": (end_date or default_end) + "2359",
            "bidNtceNm": keyword,
        }

        logger.info(f"[{bid_type}] '{keyword}' 공고 조회 중... (page={page})")
        body = self._request(url, params)

        items = body.get("items", [])
        if not items:
            logger.info("조회된 공고가 없습니다.")
            return pd.DataFrame()

        # 리스트 또는 단일 dict 모두 처리
        if isinstance(items, dict):
            items = [items]

        df = pd.DataFrame(items)
        df = self._normalize_bid_dataframe(df)

        total = body.get("totalCount", len(df))
        logger.info(f"총 {total}건 중 {len(df)}건 반환 (page {page})")
        return df

    def fetch_all_pages(
        self,
        keyword: str,
        bid_type: str = "service",
        start_date: str = "",
        end_date: str = "",
        max_pages: int = 5,
    ) -> pd.DataFrame:
        """
        전체 페이지 순회하여 공고 수집

        Args:
            max_pages: 최대 수집 페이지 수 (과도한 요청 방지)
        """
        frames = []
        for page in range(1, max_pages + 1):
            df = self.fetch_bid_announcements(
                keyword=keyword,
                bid_type=bid_type,
                start_date=start_date,
                end_date=end_date,
                page=page,
            )
            if df.empty:
                break
            frames.append(df)
            time.sleep(0.5)  # API 요청 간격 준수

        if not frames:
            return pd.DataFrame()

        result = pd.concat(frames, ignore_index=True)
        result = result.drop_duplicates(subset=["공고번호"], keep="first")
        logger.info(f"총 수집 완료: {len(result)}건")
        return result

    def fetch_open_results(
        self,
        keyword: str,
        start_date: str,
        end_date: str,
        page_size: int = 100,
    ) -> pd.DataFrame:
        """
        개찰결과 조회 — 낙찰 사정률 분석의 핵심 데이터

        Args:
            keyword:    공고명 키워드
            start_date: 조회 시작일 (YYYYMMDD)
            end_date:   조회 종료일 (YYYYMMDD)
        """
        params = {
            "numOfRows": page_size,
            "pageNo": 1,
            "inqryDiv": 1,
            "inqryBgnDt": start_date + "0000",
            "inqryEndDt": end_date + "2359",
            "bidNtceNm": keyword,
        }

        logger.info(f"'{keyword}' 개찰결과 조회 중... ({start_date} ~ {end_date})")
        body = self._request(ENDPOINTS["open_result"], params)

        items = body.get("items", [])
        if not items:
            logger.info("개찰결과 없음.")
            return pd.DataFrame()

        if isinstance(items, dict):
            items = [items]

        df = pd.DataFrame(items)
        df = self._normalize_open_result_dataframe(df)
        logger.info(f"개찰결과 {len(df)}건 수집 완료")
        return df

    # ── 데이터 정규화 ────────────────────────────────────────────────────────────

    @staticmethod
    def _normalize_bid_dataframe(df: pd.DataFrame) -> pd.DataFrame:
        """입찰공고 컬럼명을 한글 가독성 있는 이름으로 정규화"""
        column_map = {
            "bidNtceNo":        "공고번호",
            "bidNtceNm":        "공고명",
            "ntceInsttNm":      "공고기관",
            "dminsttNm":        "수요기관",
            "bidNtceDt":        "공고일시",
            "bidClseDt":        "입찰마감일시",
            "bidNtceSttus":     "공고상태",
            "asignBdgtAmt":     "배정예산액",
            "presmptPrce":      "추정가격",
            "bidMethdNm":       "입찰방식",
            "cntrctCnclsMthdNm":"계약방식",
            "ntceKindNm":       "공고종류",
            "bidPblancUrl":     "공고URL",
            "dmndInsttNm":      "수요기관명",
            "indstrytyCdNm":    "업종코드명",
        }
        df = df.rename(columns={k: v for k, v in column_map.items() if k in df.columns})

        # 금액 컬럼 숫자 변환
        for col in ["배정예산액", "추정가격"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # 날짜 컬럼 변환 (API 응답 형식: "2026-03-19 11:00:00" 또는 "2026-03-19 11:00")
        for col in ["공고일시", "입찰마감일시"]:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors="coerce")

        return df

    @staticmethod
    def _normalize_open_result_dataframe(df: pd.DataFrame) -> pd.DataFrame:
        """개찰결과 컬럼 정규화 및 사정률 계산

        개찰결과 API는 낙찰업체 정보를 opengCorpInfo 필드에
        '업체명^사업자번호^대표자^입찰금액^낙찰률' 형식으로 반환한다.
        """
        column_map = {
            "bidNtceNo":        "공고번호",
            "bidNtceNm":        "공고명",
            "ntceInsttNm":      "공고기관",
            "dminsttNm":        "수요기관",
            "opengDt":          "개찰일시",
            "progrsDivCdNm":    "개찰상태",
            "prtcptCnum":       "참가업체수",
        }
        df = df.rename(columns={k: v for k, v in column_map.items() if k in df.columns})

        # opengCorpInfo 파싱: '업체명^사업자번호^대표자^입찰금액^낙찰률'
        if "opengCorpInfo" in df.columns:
            def parse_corp_info(val):
                if not val or not isinstance(val, str) or "^" not in val:
                    return pd.Series({"낙찰업체명": "", "낙찰금액": None, "사정률(%)": None})
                parts = val.split("^")
                name = parts[0].strip() if len(parts) > 0 else ""
                amt  = pd.to_numeric(parts[3], errors="coerce") if len(parts) > 3 else None
                rate = pd.to_numeric(parts[4], errors="coerce") if len(parts) > 4 else None
                # 0 또는 NaN인 낙찰률은 의미 없음 (협상·외자 등)
                if rate is not None and rate <= 0:
                    rate = None
                return pd.Series({"낙찰업체명": name, "낙찰금액": amt, "사정률(%)": rate})

            parsed = df["opengCorpInfo"].apply(parse_corp_info)
            df = pd.concat([df, parsed], axis=1)
            df = df.drop(columns=["opengCorpInfo"])

        # 날짜 변환 (API 형식: "2025-07-23 11:00:00" 또는 "YYYYMMDDHHMM")
        if "개찰일시" in df.columns:
            df["개찰일시"] = pd.to_datetime(df["개찰일시"], errors="coerce")

        return df


# ── 편의 함수 (스크립트 직접 실행용) ─────────────────────────────────────────────

def search_bids(keyword: str, bid_type: str = "service") -> pd.DataFrame:
    """
    간편 검색 함수

    Usage:
        df = search_bids("소프트웨어")
        df = search_bids("AI", bid_type="goods")
    """
    crawler = KonepsCrawler()
    return crawler.fetch_bid_announcements(keyword=keyword, bid_type=bid_type)


# ── 메인 실행 ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  나라장터 입찰공고 크롤러 — Bid-Master AI")
    print("=" * 60)

    crawler = KonepsCrawler()

    # ① 소프트웨어 관련 최신 입찰공고 조회
    print("\n[1] '소프트웨어' 입찰공고 조회")
    df_bids = crawler.fetch_bid_announcements(
        keyword="소프트웨어",
        bid_type="service",
        page_size=10,
    )

    if not df_bids.empty:
        print(f"\n총 {len(df_bids)}건 조회됨")
        print(df_bids[["공고번호", "공고명", "공고기관", "입찰마감일시", "추정가격"]].to_string(index=False))

        # CSV 저장
        output_path = Path(__file__).parent / "output"
        output_path.mkdir(exist_ok=True)
        csv_file = output_path / "bid_announcements_software.csv"
        df_bids.to_csv(csv_file, index=False, encoding="utf-8-sig")
        print(f"\n저장 완료: {csv_file}")
    else:
        print("조회 결과 없음 (API 키 또는 네트워크 확인 필요)")

    print("\n완료.")
