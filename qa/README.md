# qa/ — 배포 전 검사

앱 코드(`src/`, `index.html` …)는 건드리지 않는 도구들이에요. 결과물은 `qa/.out/`에만 쓰고, 그 폴더는 git에서 제외돼요.
내 컴퓨터에서 처음 켜는 순서는 [`LOCAL-SETUP.md`](LOCAL-SETUP.md) 에 있어요.

```
node qa/all.mjs           # 무결성 → 스모크 → 접근성, 한 번에 (약 1분)
node qa/all.mjs --quick   # 무결성만 (1초, Playwright 불필요)
node qa/visual.mjs snap before … node qa/visual.mjs compare before   # 시각 회귀: 고치기 전·후 비교(아래 4)
```

| 도구 | 보는 것 | 필요한 것 |
| --- | --- | --- |
| `check-integrity.mjs` | 해시·경로·CSP·공유 페이지·데이터 신선도·금지 패턴·공휴일·크기 예산·라이선스 파일 | Node 18+ |
| `smoke.mjs` | 켜지는지, 오프라인, 성능 예산, 공유 링크, 망가진 저장소 | Playwright |
| `a11y.mjs` | 22개 화면을 axe-core(WCAG 2.1 AA)로 | Playwright, axe-core |
| `visual.mjs` | 수정 전·후 화면 비교 | Playwright |

설치: `npm i -g playwright axe-core && npx playwright install chromium`
(`lib.mjs`는 도구들이 같이 쓰는 서버·브라우저 설정이에요.)

## 1. 무결성 검사 — `check-integrity.mjs`

```
node qa/check-integrity.mjs           # 오류가 있으면 종료 코드 1
node qa/check-integrity.mjs --strict  # 경고도 실패로 침
node qa/check-integrity.mjs --today 2027-12-15   # "오늘"을 바꿔서 날짜에 따라 달라지는 검사를 시험
```

설치할 것 없이 Node 18+ 만 있으면 돼요. 1초 안에 끝나요.

| 잡는 것 | 이유 |
| --- | --- |
| `version.json` · `sw.js`의 `CACHE` · `index.html`의 `?v=` 해시 불일치 | 어긋나면 폰에 옛 화면이 남아요 |
| 인라인 `<script>`의 해시가 CSP에 없음 | 브라우저가 스크립트를 막아 앱이 안 떠요 |
| importmap에 없는 모듈 | `?v=` 없이 불러와 옛 파일이 캐시에 남아요 |
| 없는 파일을 가리키는 import · href · src · `url()` · 매니페스트 아이콘 · 사진 | 404 |
| 공유 페이지(`w/`)가 없는 암장을 가리킴 / 암장에 공유 페이지가 없음 | 죽은 링크 |
| 공유 페이지의 제목·h1·og·canonical·지역·유료/무료가 데이터와 다름 | 검색·카톡 미리보기가 거짓말을 해요 |
| `national.json`의 이름 중복 · 좌표 이상 · 날짜 형식 | 데이터 오류 |
| `innerHTML`·`eval`, `rel="noopener"` 없는 `target=_blank` | 지금은 0건이라 새로 생기면 바로 알려요 |
| 공휴일 표(`HOLIDAY_YEARS`)가 올해를 못 덮음(오류) / 9월부터 내년을 못 덮음(경고, 12월부터 오류) | 공휴일이 평일로 보여요 |
| `LICENSE`·`data/LICENSE`·`assets/LICENSE` 가 없거나 앱 정보가 `data/LICENSE` 를 가리키지 않음 | 안내 누락 |
| (경고) 확인일 없음·60일 초과, 임시휴관 중, 운영시간 없음, `http://` 링크 | 틀릴 수 있는 정보가 방치되는지 |
| (경고) 크기 예산 초과: `style.css` 250KB, `index.html` 100KB, `national.json` 400KB, `src/` 합계 1MB, 사진 장당 300KB | 로딩이 조용히 느려지는 것 |
| (경고) 아무도 가져오지 않는 모듈, 참조 없는 에셋·사진, 쓰지 않는 CSP 해시 | 정리 후보 |

배포 도구가 해시를 갱신한 **뒤**에 돌리면 해시 일치 검사까지 의미가 있어요. 예산 숫자는 파일 맨 위 `BUDGET`에 있어요.

## 2. 스모크 — `smoke.mjs`

첫 화면에 스크립트 오류가 없는지, 암장 63곳이 다 그려지는지, 첫 방문이 요청 120개·2MB·4초 예산 안인지(지금 약 90개·1.5MB·0.4초),
서비스 워커 캐시 이름이 `version.json`과 같은지, 오프라인으로 다시 열어도 뜨는지, 공유 링크(`w/…`)가 그 암장 카드를 펼치는지,
저장소가 망가져도(깨진 JSON · 잘못된 타입 · 접근 차단) 목록과 기록 탭이 뜨는지 봐요.

## 3. 접근성 — `a11y.mjs`

목록·카드·기록·조건·내 정보·앱 정보·안전수칙·화면 읽는 법·첫 방문·공유 링크를 모바일 라이트·다크로, 목록과 카드는 데스크톱으로도
axe-core에 넣어요. 위반이 있으면 실패하고, `--min-impact serious`처럼 기준을 올릴 수 있어요. 지금은 위반 0건이에요.

## 4. 시각 회귀 검사 — `visual.mjs`

수정 전과 후 화면을 같은 조건으로 찍어서 달라진 곳을 빨갛게 보여 줘요.

```
node qa/visual.mjs snap before      # 고치기 전에 한 번 찍어 둠
(코드를 고친다)
node qa/visual.mjs compare before   # 다시 찍어서 before 와 비교 → 달라진 장면의 diff 이미지가 qa/.out/diff-before-current/ 에 생겨요
```

- 장면: 첫 방문 안내 · 목록 · 스크롤 · 펼친 카드 · 기록 · 조건 · 내 정보 · 앱 정보 · 안전수칙 · 화면 읽는 법 · 공유 링크.
  모바일 390px 라이트·다크가 기본이고, 360px · 태블릿 · 데스크톱은 주요 4장면만 찍어요(총 34장, 1분 안팎).
- 같은 조건: 시계는 2026-10-17 14:00(KST), 외부 요청(지도 타일·날씨·폰트)은 차단, 애니메이션 끔, 지도 영역은 가림.
  같은 코드를 두 번 찍으면 0% 차이가 나와요.
- 찍으면서 가로 넘침과 스크립트 오류도 함께 확인해요.
- 옵션: `--only list,log`(이름이 이 글자로 시작하는 장면만), `--tolerance 0.005`(허용 픽셀 비율, 기본 0.2%).
- **기준 이미지를 저장소에 두지 않아요.** 한글 폰트가 컴퓨터마다 달라서 다른 컴퓨터에서 찍은 기준은 전부 어긋나요.
  그래서 고치기 전, 같은 컴퓨터에서 찍은 것과 비교해요.
- 지도 화면은 일부러 뺐어요(타일이 외부 서비스라 흔들려요).

## 이 폴더를 배포하지 않으려면
`qa/`는 사이트 동작과 무관해요. GitHub Pages 가 저장소 루트를 그대로 올리면 `qa/` 도 공개 주소(`/qa/…`)로 노출돼요(`qa/.out/` 은 git 에 없어서 올라가지 않아요).
배포 도구가 올릴 파일을 고르는 방식이면 영향이 없어요.
