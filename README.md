# BID_MASTER_AI

나라장터(KONEPS) 입찰 공고를 수집하고 분석하는 웹 플랫폼.
과거 낙찰 데이터를 기반으로 투찰 전략을 제시하고, AI가 공고별 리스크를 요약한다.

---

## 구성

```
bid-master-ai/
├── backend/          FastAPI 서버 (Python)
├── data-crawlers/    KONEPS API 수집기 (Python)
├── frontend/         React 웹 UI
└── database/         SQLite DB (schema.sql 포함)
```

## 주요 기능

- 나라장터 입찰 공고 자동 수집 및 검색 (FTS5 전문 검색)
- 과거 개찰 결과 기반 사정률 분포 분석
- 기관별 투찰 전략 AI 추천 (추천 사정률, 투찰 시뮬레이터)
- Gemini AI 공고 리스크 브리핑
- 경쟁사 낙찰 패턴 분석
- 공고 필터 (예가방식, 입찰방식, 마감 임박, 금액 범위)
- APScheduler 자동 데이터 갱신 (매일 06:00)

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 백엔드 | FastAPI, SQLite, APScheduler |
| 크롤러 | Python, KONEPS 공공데이터포털 API |
| 프론트엔드 | React, Vite, Tailwind CSS, Framer Motion |
| AI | Google Gemini API (또는 OpenAI GPT-4o-mini) |

## 설치 및 실행

### 1. 환경변수 설정

`backend/.env` 와 `data-crawlers/.env` 파일을 각각 생성한다.

```
# backend/.env
KONEPS_API_KEY=발급받은_키
GEMINI_API_KEY=발급받은_키
OPENAI_API_KEY=      # 선택사항
```

```
# data-crawlers/.env
KONEPS_API_KEY=발급받은_키
```

API 키 발급:
- KONEPS: https://www.data.go.kr
- Gemini: https://aistudio.google.com/app/apikey
- OpenAI: https://platform.openai.com/api-keys

### 2. 백엔드

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install fastapi uvicorn apscheduler python-dotenv google-genai httpx
uvicorn main:app --reload --port 8000
```

### 3. 데이터 수집 (최초 1회)

```bash
cd data-crawlers
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python db_loader.py
```

### 4. 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

## 주의사항

- `.env` 파일은 절대 커밋하지 말 것 (API 키 포함)
- SQLite DB 파일도 `.gitignore`에 포함됨 — 최초 실행 시 `db_loader.py`로 생성
- KONEPS API는 날짜 범위 제한이 있음 (개찰결과 최대 27일 단위 조회)

<img width="1897" height="1937" alt="image" src="https://github.com/user-attachments/assets/97df41de-e389-4db5-8a32-664718a1338a" />

