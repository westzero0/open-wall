# 해벽 · 지금 열린 외벽

지금 열려 있는 실외암벽과 양달·응달을 한눈에 보여주는 지도예요. 서버·빌드 없이 바닐라 JS(ES 모듈)로 동작하는 정적 웹앱이에요.

- 사이트: https://westzero0.github.io/open-wall/

## 데이터와 면책
- 운영시간은 바뀔 수 있어요. 방문 전에 시설에 전화하거나 공지를 확인해 주세요. 각 외벽의 정보 확인일은 펼친 카드에 표시돼요.
- `data/`의 운영시간·시설 정보·사진은 각 출처(외벽 공지, 운영자 안내, 직접 방문 기록, 공개 자료)의 조건을 따라요. 코드의 라이선스와는 별개예요.
- 지형: Copernicus DEM. 지도: © OpenStreetMap contributors.

## 틀린 정보 제보
카드를 펼쳐 ‘정보 수정 요청’을 누르면 돼요. 개인정보는 적지 마세요.

## 개인정보
운영자가 모으는 개인정보는 없어요. ‘내 위치’는 기기 안에서 거리 계산에만 쓰고 저장·전송하지 않아요. 필터·즐겨찾기는 이 브라우저(localStorage)에만 저장돼요.

## 개발
```bash
npm run serve   # http://localhost:8000
npm test
```
배포 절차는 `docs/system/deploy.md`(작업 저장소) 참고.

## 라이선스
코드: MIT (`LICENSE`). 데이터: 위 안내 참고. Leaflet은 `vendor/leaflet/LICENSE`.
