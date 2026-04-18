import httpx                                                                                                                
from urllib.parse import quote, urlencode

KEY = '/F/lsmvPOaD232jvh8hQfuvQE4Gidb+U/pAwan1HVNCF8wYKwMyWbjvpcd9VhTwf4E2vRHBhy9sqhdYV9SfO/g=='
encoded_key = quote(KEY, safe='')
BASE = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc'

# 날짜 형식 및 파라미터명 변형 테스트
tests = [
    # 날짜 없이
    {'numOfRows': 1, 'pageNo': 1},
    # YYYYMMDD (시간 없이)
    {'numOfRows': 1, 'pageNo': 1, 'inqryBgnDt': '20260401', 'inqryEndDt': '20260418'},
    # fromBidDt/toBidDt
    {'numOfRows': 1, 'pageNo': 1, 'fromBidDt': '20260401', 'toBidDt': '20260418'},
    # bidNtceBgnDt/bidNtceEndDt
    {'numOfRows': 1, 'pageNo': 1, 'bidNtceBgnDt': '20260401', 'bidNtceEndDt': '20260418'},
    # rows/page 대신 다른 이름
    {'rows': 1, 'page': 1, 'inqryBgnDt': '202604010000', 'inqryEndDt': '202604182359'},
]

for params in tests:
    qs = urlencode(params) + f'&serviceKey={encoded_key}'
    r = httpx.get(f'{BASE}?{qs}', timeout=10)
    body = r.text[:120].replace(chr(10),' ')
    print(f'{list(params.keys())} -> {body}')
    print()