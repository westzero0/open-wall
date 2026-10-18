# 해벽(HAEBYEOK) 브랜드 자산 & 자동 생성 에이전트

노란 원 위에 놓인 검은 **인공외벽 오버행 단면**이 심볼이고, 글자 획의 끝단은 같은 **오버행 각도(≈28°)** 로 컷팅했어요.
`symbol.svg` / `full-logo.svg` 두 파일이 단일 원본이며, 나머지 자산(파비콘·OG·토큰)은 모두 이 원본에서 자동 생성돼요.

> 기존 사이트의 `assets/` 는 건드리지 않아요. 모든 산출물은 `brand/dist/` 에 만들어지고, 적용은 아래 가이드대로 직접 복사해서 하면 돼요.

## 구성

| 파일 | 설명 |
|---|---|
| `symbol.svg` | 심볼 단독 (512×512). 노란 원 + 검은 오버행 벽 |
| `full-logo.svg` | 심볼 + 커스텀 '해벽' + 영문 `HAEBYEOK` 락업 |
| `generate-assets.js` | 자산 생성 에이전트 (Node.js) |
| `brand.config.json` | 색·폰트·OG 기본 문구 (여기만 고치면 전체가 바뀜) |
| `og-template.html` | OG 이미지 HTML/CSS 템플릿 (1200×630) |
| `scripts/build-logo.js` | (선택) SVG 원본 생성기. 글자 획/컷 각도를 수정할 때만 사용 |
| `dist/` | 생성 결과물 |

### 로고 설계
- **심볼**: 완벽한 단일 노란 원(`#FFD60A`) 위에, 질감 없이 단색 검정 다각형 하나로 벽 단면을 표현. 아래는 수직 슬랩, 위로 갈수록 앞으로 튀어나오는 오버행.
- **한글 '해벽'**: 기본 고딕 대신 직선 획을 다각형(outline)으로 직접 설계. 가로획 끝은 벽면 기울기와 평행하게, 세로획 끝은 그에 수직으로 비스듬히 잘라 심볼과 같은 각도 언어를 써요. 'ㅎ'의 ㅇ은 심볼의 원을 반복.
- **영문 HAEBYEOK**: 모노라인 기하 산세리프를 path로 그려 폰트 없이도 동일하게 보이고, 넓은 자간으로 한글 폭에 맞춰 정렬.
- 글자가 모두 벡터 outline이라 **폰트 설치가 필요 없어요**.

### CSS 변수 (다크모드/테마)
두 SVG 모두 내부 `<style>` 에 변수를 두고, 기본값(fallback)도 지정해 뒀어요.

| 변수 | 기본(라이트) | 다크 | 용도 |
|---|---|---|---|
| `--primary-yellow` | `#FFD60A` | 동일 | 원 |
| `--primary-black` | `#111111` | 동일 | 벽 |
| `--logo-text` | `#111111` | `#F5F5F2` | 한글 '해벽' |
| `--logo-sub` | `#111111` | `#F5F5F2` | 영문 HAEBYEOK |

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
- 최소 크기: 심볼 16px, 풀 로고 높이 96px 이상(가로 약 250px).
- 여백: 심볼 지름의 1/4 이상 비우기.
- 노란색/검정을 바꾸려면 `brand.config.json` 의 `colors` 만 수정 후 재생성 (SVG 원본의 fallback 색은 `scripts/build-logo.js` 의 `STYLE`).
- 심볼의 각도나 글자 획을 바꾸려면 `scripts/build-logo.js` 를 수정하고 `npm run build:logo` → `npm run assets`.
