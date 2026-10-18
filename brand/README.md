# 해벽(HAEBYEOK) 브랜드 자산 & 자동 생성 에이전트

기존 정체성(**해 + 인공외벽 사이드뷰**)을 그대로 두고 정리한 버전이에요. 노란 원(해) 앞에 검은 쐐기(오버행 벽 단면)가 겹쳐 있고, 글자 획 끝은 같은 벽 각도로 컷팅했어요.
`symbol.svg` / `full-logo.svg` / `full-logo-horizontal.svg` 가 원본이며, 나머지 자산(파비콘·OG·토큰)은 모두 이 원본에서 자동 생성돼요.

> 기존 사이트의 `assets/` 는 건드리지 않아요. 모든 산출물은 `brand/dist/` 에 만들어지고, 적용은 아래 가이드대로 직접 복사해서 하면 돼요.

## 구성

| 파일 | 설명 |
|---|---|
| `symbol.svg` | 심볼 단독 (512×512). 노란 원 + 검은 오버행 벽 |
| `full-logo.svg` | 세로 락업: 심볼 / 해벽 / `HAEBYEOK │ CLIMBING COMMUNITY` |
| `full-logo-horizontal.svg` | 가로 락업: 심볼 + 해벽 + `HAEBYEOK` (헤더·OG용) |
| `generate-assets.js` | 자산 생성 에이전트 (Node.js) |
| `brand.config.json` | 색·폰트·OG 기본 문구 (여기만 고치면 전체가 바뀜) |
| `og-template.html` | OG 이미지 HTML/CSS 템플릿 (1200×630) |
| `scripts/build-logo.js` | (선택) SVG 원본 생성기. 글자 획/컷 각도를 수정할 때만 사용 |
| `dist/` | 생성 결과물 |

### 로고 설계
- **심볼**: 노란 원(`#F3B63F`) + 차콜(`#2B2B2B`) 쐐기 하나. 쐐기는 우측면이 수직, 좌측면이 아래로 갈수록 기울어(≈14°) 오버행 벽을 단순화했고, 원의 중심이 좌측면 위에 놓여 해의 오른쪽이 벽 뒤로 숨어요.
- **한글 '해벽'**: 굵은 고딕 골격을 다각형(outline)으로 직접 설계. 세로획 끝(ㅐ·ㅕ·ㄱ)은 벽 좌측면과 같은 각도로 비스듬히 컷팅하고, 'ㅕ' 가지 끝은 평행하게 깎았어요. 'ㅎ'의 ㅇ은 해(원)를 반복.
- **영문**: 모노라인 기하 산세리프 path. 세로 락업은 노란 구분선(`│`)으로 이름과 `CLIMBING COMMUNITY`를 나눠요.
- 글자가 모두 벡터 outline이라 **폰트 설치가 필요 없어요**.

### CSS 변수 (다크모드/테마)
두 SVG 모두 내부 `<style>` 에 변수를 두고, 기본값(fallback)도 지정해 뒀어요.

| 변수 | 기본(라이트) | 다크 | 용도 |
|---|---|---|---|
| `--primary-yellow` | `#F3B63F` | 동일 | 해(원) |
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
