# 해벽(HAEBYEOK) 브랜드 자산 & 자동 생성 에이전트

기존 정체성(**해 + 인공외벽 사이드뷰**)을 그대로 두고 정리한 버전이에요. 노란 원(해) 앞에 검은 쐐기(오버행 벽 단면)가 겹쳐 있고, 글자 획 끝은 같은 벽 각도로 컷팅했어요.
`symbol.svg` / `full-logo.svg` / `full-logo-horizontal.svg` 가 원본이며, 나머지 자산(파비콘·OG·토큰)은 모두 이 원본에서 자동 생성돼요.

> 기존 사이트의 `assets/` 는 건드리지 않아요. 모든 산출물은 `brand/dist/` 에 만들어지고, 적용은 아래 가이드대로 직접 복사해서 하면 돼요.

## 구성

| 파일 | 설명 |
|---|---|
| `symbol.svg` | 심볼 단독 (512×512). 노란 원 + 검은 오버행 벽 |
| `full-logo.svg` | 세로 락업: 심볼 / 해벽 / `HAEBYEOK` / `CLIMBING COMMUNITY` |
| `full-logo-horizontal.svg` | 가로 락업: 심볼 + 해벽 + `HAEBYEOK` (헤더·OG용) |
| `generate-assets.js` | 자산 생성 에이전트 (Node.js) |
| `brand.config.json` | 색·폰트·OG 기본 문구 (여기만 고치면 전체가 바뀜) |
| `og-template.html` | OG 이미지 HTML/CSS 템플릿 (1200×630) |
| `scripts/build-logo.js` | (선택) SVG 원본 생성기. 글자 획/컷 각도를 수정할 때만 사용 |
| `dist/` | 생성 결과물 |

### 로고 설계
- **심볼**: 노란 해(`#FBB041`, 지름 ≈ 쐐기 높이의 0.68) + 차콜(`#2B2B2B`) 쐐기. 쐐기는 우측면 수직, 좌측면은 아래로 갈수록 ≈15° 기울어 오버행 벽을 단순화했어요. 해의 중심이 쐐기 좌측면 위에 있어 오른쪽이 벽 뒤로 숨고, 둘 사이에는 얇은 투명 간격(마스크)이 있어요.
- **한글 '해벽'**: 가로획이 세로획보다 살짝 가는 굵은 고딕을 다각형으로 직접 설계. ㅐ·ㅕ 세로획 아래 끝을 약 26°로 비스듬히 컷팅했고, 'ㅎ'의 ㅇ 구멍은 해(노랑)로 채워 심볼과 연결했어요.
- **영문**: `HAEBYEOK`은 굵은 와이드 산세리프 path를 한글 폭에 양끝 정렬, `CLIMBING COMMUNITY`는 얇은 서브타이틀(세로 락업에만 포함).
- 글자가 모두 벡터 outline이라 **폰트 설치가 필요 없어요**.

### CSS 변수 (다크모드/테마)
두 SVG 모두 내부 `<style>` 에 변수를 두고, 기본값(fallback)도 지정해 뒀어요.

| 변수 | 기본(라이트) | 다크 | 용도 |
|---|---|---|---|
| `--primary-yellow` | `#FBB041` | 동일 | 해(원) |
| `--primary-black` | `#2B2B2B` | `#F2F2EE` | 벽(쐐기) |
| `--logo-text` | `#2B2B2B` | `#F2F2EE` | 한글 '해벽' |
| `--logo-sub` | `#2B2B2B` | `#F2F2EE` | 영문 |

- `<img src>` 로 쓰면 OS 다크모드(`prefers-color-scheme`)를 따라가요.
- HTML에 **인라인**으로 넣으면 페이지의 CSS 변수로 덮어쓸 수 있어요. 예) `[data-theme="dark"] { --logo-text: #fff; }`
  (SVG 내부 `:root` 규칙이 페이지 변수보다 우선하지 않도록, 인라인 시에는 `<style>` 의 `:root{...}` 블록을 지우거나 페이지 CSS를 뒤에 두세요.)

## 실행 방법

```bash
cd brand
npm install                          # playwright
npx playwright install chromium      # 최초 1회 (이미 설치돼 있으면 생략)

node generate-assets.js              # 전부 생성 → brand/dist/
node generate-assets.js --only tokens                  # 토큰만 (브라우저 불필요)
node generate-assets.js --only og --title "오늘 열린 외벽" --subtitle "양달·응달 한눈에"
node generate-assets.js --out ../assets/brand          # 출력 위치 지정
```

옵션: `--out` `--only favicon,og,tokens` `--title` `--subtitle` `--tag` `--og-name` `--config`
Chromium 경로가 특수하면 `CHROMIUM_PATH=/path/to/chromium` 환경변수를 지정하세요.

### 생성 결과 (`dist/`)
```
favicon/  favicon.ico(16·32·48) favicon.svg favicon-{16..256}.png apple-touch-icon.png(180)
          android-chrome-{192,512}.png maskable-512x512.png site.webmanifest html-snippet.html
og/       og-image.png(1200×630) og.html
tokens/   brand-tokens.json brand-tokens.css tailwind.config.js
```

## 프로젝트 적용 가이드

### 1) 파비콘
`dist/favicon/*` 을 사이트 루트(또는 원하는 경로)에 복사하고 `html-snippet.html` 의 태그를 `<head>` 에 붙여 넣어요. 현재 `manifest.webmanifest` 를 쓰고 있다면 `icons` 경로만 새 PNG로 바꾸면 돼요 (`site.webmanifest` 는 참고용).
`favicon.svg` 는 CSS 변수를 포함하므로 다크모드 브라우저 탭에서도 자연스러워요.

### 2) OG 이미지
`dist/og/og-image.png` 를 배포하고:
```html
<meta property="og:image" content="https://example.com/og-image.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
```
페이지별 이미지는 `--title/--subtitle/--og-name` 으로 반복 호출하면 돼요. 디자인은 `og-template.html` 의 CSS를 고치세요 (한글 폰트는 `brand.config.json` 의 `fonts.sans` 순서대로 사용되므로 Pretendard 등 웹폰트를 쓰려면 템플릿에 `@font-face` 를 추가).

### 3) 디자인 토큰 / Tailwind
```js
// tailwind.config.js
module.exports = {
  presets: [require('./brand/dist/tokens/tailwind.config.js')],
  content: ['./**/*.html'],
};
```
```html
<link rel="stylesheet" href="brand/dist/tokens/brand-tokens.css">
<button class="bg-brand-yellow text-brand-black rounded-md">열린 외벽 보기</button>
<body class="bg-background text-text">  <!-- html[data-theme=dark] 또는 OS 다크모드에 자동 전환 -->
```
Tailwind v4 는 CSS에서 `@config "./brand/dist/tokens/tailwind.config.js";` 로 불러와요.
`brand-tokens.json` 은 Style Dictionary·Figma Tokens 등 다른 도구용 원본이에요.

### 로고 사용 규칙
- 최소 크기: 심볼 16px, 가로 락업 높이 96px 이상.
- 여백: 해(원) 지름의 1/4 이상 비우기.
- 노란색/검정을 바꾸려면 `brand.config.json` 의 `colors` 만 수정 후 재생성 (SVG 원본의 fallback 색은 `scripts/build-logo.js` 의 `STYLE`).
- 벽 각도(`WEDGE`)·획 굵기(`W`)·컷 방향(`stroke()` 의 `'v'/'h'`)을 바꾸려면 `scripts/build-logo.js` 를 수정하고 `npm run build:logo` → `npm run assets`.

## 인스타 게시물 자동 생성 (`social/`)

`data/national.json` 과 앱의 계산 로직(`src/hours.js`, `src/sun.js`)을 그대로 읽어 게시물 이미지(1080×1350)와 캡션 초안을 만들어요. 앱과 같은 코드를 쓰므로 운영시간·양달 계산이 앱과 어긋나지 않아요. **자동 발행은 하지 않고, 사람이 확인한 뒤 올리는 초안 생성기**예요.

```bash
cd brand
node social/generate-posts.mjs                      # 오늘: 오늘 열린 외벽 / 양달·응달 / 암장 소개
node social/generate-posts.mjs --date 2026-10-25    # 날짜 지정
node social/generate-posts.mjs --type today        # 일부만 (today, sunshade, spotlight, thanks)
node social/generate-posts.mjs --spotlight 금곡     # 소개할 암장 지정 (이름 일부)
node social/generate-posts.mjs --thanks "고양인공암벽장" --thanks-note "운영시간을 업데이트했어요."
```

- 결과: `social/out/<날짜>/` 에 `NN-종류.png`, 캡션 `NN-종류.txt`, 확인용 `preview.html` (`out/` 은 git 에 올라가지 않아요).
- **정보 확인일(`checked_at`)이 `--max-age`(기본 45일) 안인 암장만** 사용해요. 확인일이 없거나 오래된 암장은 자동 제외돼요.
- 양달·응달은 영업 시간대 안에서만 계산하고, 벽 기준이며 나무 가림·날씨는 반영하지 않는다는 문구가 이미지에 들어가요.
- 암장 소개는 사진이 있는 암장 중에서 날짜로 순환 선택해요. 사진 출처(`photo_credit`)가 있으면 이미지에 표기돼요.
- 디자인은 `social/templates/*.html`, `base.css` 를 고치면 돼요. 색·폰트는 `brand.config.json` 을 따라요.
- 발행 전 체크: ① `preview.html` 에서 운영시간·주소 확인 ② 사진 사용 허락 확인 ③ 캡션 톤 확인.
