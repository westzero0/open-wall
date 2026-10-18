#!/usr/bin/env node
/**
 * 해벽(HAEBYEOK) 브랜드 자산 자동 생성 에이전트
 *
 * symbol.svg / full-logo.svg 를 단일 원본(source of truth)으로 삼아 아래를 한 번에 만든다.
 *   1) 파비콘 세트   favicon.ico · favicon.svg · PNG(16~512) · apple-touch-icon · maskable · site.webmanifest
 *   2) OG 이미지     og-template.html 렌더링 → og-image.png (1200×630) + 채워진 og.html
 *   3) 디자인 토큰   brand-tokens.json · brand-tokens.css · tailwind.config.js (theme.extend 프리셋)
 *
 * 사용법
 *   node generate-assets.js [옵션]
 *     --out <dir>          출력 폴더 (기본 ./dist)
 *     --only <a,b,c>       favicon, og, tokens 중 일부만 실행 (기본 전부)
 *     --title <text>       OG 제목   (기본 brand.config.json 의 og.title)
 *     --subtitle <text>    OG 부제
 *     --tag <text>         OG 하단 태그
 *     --og-name <file>     OG 출력 파일명 (기본 og-image.png)
 *     --config <file>      설정 파일 (기본 ./brand.config.json)
 *
 * PNG 렌더링에는 Playwright(Chromium)가 필요하다. `npm i` 후 `npx playwright install chromium`.
 * 토큰 생성(--only tokens)은 브라우저 없이 동작한다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/* ───────────── CLI ───────────── */
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) a[k] = true;
    else { a[k] = next; i++; }
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));
const ROOT = __dirname;
const cfg = JSON.parse(fs.readFileSync(path.resolve(ROOT, args.config || 'brand.config.json'), 'utf8'));
const OUT = path.resolve(args.out || path.join(ROOT, 'dist'));
const ONLY = new Set(String(args.only || 'favicon,og,tokens').split(',').map((s) => s.trim()));
const C = cfg.colors;

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (rel, data) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  console.log('  ✔', path.relative(process.cwd(), p));
};

/* ───────────── SVG 헬퍼 ───────────── */
/** 테마 변수를 SVG 안에서 강제 지정 (래스터 렌더링은 OS 다크모드와 무관하게 동일해야 함) */
function themed(svg, vars) {
  const css = `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`;
  // 마지막 규칙으로 넣어 @media(prefers-color-scheme) 보다 우선하도록 한다
  return svg.replace('</style>', `    ${css}\n  </style>`);
}
/** 한 페이지에 SVG를 여러 번 넣어도 id 충돌이 없도록 접두어를 붙인다 */
function uniquify(svg, prefix) {
  return svg.replace(/\bhb-(clip|cap|title)\b/g, `${prefix}-$1`);
}
const lightVars = {
  '--primary-yellow': C.yellow, '--primary-black': C.black,
  '--logo-text': C.ink, '--logo-sub': C.ink,
};
const symbolSvg = read('symbol.svg');
const fullSvg = read('full-logo.svg');

/* ───────────── 래스터 렌더러 (Playwright) ───────────── */
function loadPlaywright() {
  const tries = [() => require('playwright'), () => require('@playwright/test'),
    () => require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))];
  for (const t of tries) { try { return t(); } catch (_) { /* next */ } }
  throw new Error('Playwright를 찾을 수 없어요. `npm install` 후 `npx playwright install chromium` 을 실행하세요.');
}
async function launch() {
  const { chromium } = loadPlaywright();
  const exe = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
  return chromium.launch(exe ? { executablePath: exe } : {});
}

/* ───────────── 1) 파비콘 ───────────── */
/** 픽셀 단위 PNG 여러 장을 담은 ICO (PNG-in-ICO, 모든 현대 브라우저 지원) */
function buildIco(entries) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(entries.length, 4);
  let offset = 6 + 16 * entries.length;
  const dirs = entries.map(({ size, png }) => {
    const d = Buffer.alloc(16);
    d.writeUInt8(size >= 256 ? 0 : size, 0); d.writeUInt8(size >= 256 ? 0 : size, 1);
    d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6);
    d.writeUInt32LE(png.length, 8); d.writeUInt32LE(offset, 12);
    offset += png.length;
    return d;
  });
  return Buffer.concat([head, ...dirs, ...entries.map((e) => e.png)]);
}

async function renderSvgToPng(browser, svg, size, { bg = null, pad = 0 } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;width:${size}px;height:${size}px;background:${bg || 'transparent'}}
    body{display:flex;align-items:center;justify-content:center}
    svg{width:${inner}px;height:${inner}px;display:block}</style>${svg}`);
  const png = await page.screenshot({ type: 'png', omitBackground: !bg });
  await page.close();
  return png;
}

async function makeFavicons(browser) {
  console.log('\n[1/3] 파비콘 세트');
  const sym = themed(symbolSvg, lightVars);
  const png = (s, o) => renderSvgToPng(browser, sym, s, o);

  // 투명 배경 PNG (심볼은 원이므로 여백 최소화)
  const sizes = [16, 32, 48, 64, 96, 128, 256];
  const rendered = {};
  for (const s of sizes) { rendered[s] = await png(s); write(`favicon/favicon-${s}x${s}.png`, rendered[s]); }

  write('favicon/favicon.ico', buildIco([16, 32, 48].map((s) => ({ size: s, png: rendered[s] }))));
  write('favicon/favicon.svg', symbolSvg);   // 다크모드/테마 대응 (CSS 변수 포함)

  // iOS: 투명 불가 → paper 배경 + 안전 여백
  write('favicon/apple-touch-icon.png', await png(180, { bg: C.paper, pad: 0.1 }));
  // Android / PWA
  write('favicon/android-chrome-192x192.png', await png(192, { bg: null, pad: 0.04 }));
  write('favicon/android-chrome-512x512.png', await png(512, { bg: null, pad: 0.04 }));
  // maskable: 전체를 노란색으로 채우고 안전영역(중앙 80% 원) 안에 심볼 배치
  const maskSvg = themed(symbolSvg, lightVars);
  write('favicon/maskable-512x512.png', await renderSvgToPng(browser, maskSvg, 512, { bg: C.yellow, pad: 0.2 }));

  write('favicon/site.webmanifest', JSON.stringify({
    name: cfg.name, short_name: cfg.name, description: cfg.description, lang: cfg.lang,
    start_url: './', display: 'standalone',
    background_color: C.paper, theme_color: C.yellow,
    icons: [
      { src: 'android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2) + '\n');

  write('favicon/html-snippet.html', `<!-- <head> 에 붙여 넣기 (경로는 배포 위치에 맞게 수정) -->
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${C.yellow}">
`);
}

/* ───────────── 2) OG 이미지 ───────────── */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderOgHtml() {
  const vars = {
    '--primary-yellow': C.yellow, '--primary-black': C.black,
    '--logo-text': C.ink, '--logo-sub': C.ink, '--brand-paper': C.paper,
  };
  const cssVars = Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(' ');
  const fill = {
    CSS_VARS: cssVars,
    FONT_SANS: cfg.fonts.sans.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(', '),
    LOGO_FULL: uniquify(fullSvg, 'og-a'),
    SYMBOL: uniquify(symbolSvg, 'og-b'),
    TITLE: esc(args.title || cfg.og.title),
    SUBTITLE: esc(args.subtitle || cfg.og.subtitle),
    TAG: esc(args.tag || cfg.og.tag),
  };
  return read('og-template.html').replace(/\{\{(\w+)\}\}/g, (m, k) => (k in fill ? fill[k] : m));
}

async function makeOg(browser) {
  console.log('\n[2/3] Open Graph 이미지');
  const html = renderOgHtml();
  write('og/og.html', html);
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  write(`og/${args['og-name'] || 'og-image.png'}`, await page.screenshot({ type: 'png' }));
  await page.close();
}

/* ───────────── 3) 디자인 토큰 ───────────── */
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (r) => '#' + r.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); };
/** 기준색(500)에서 흰색/검정으로 섞어 50~900 스케일 생성 */
function scale(base) {
  const steps = { 50: [0, .92], 100: [0, .82], 200: [0, .64], 300: [0, .44], 400: [0, .22], 500: null,
    600: [1, .14], 700: [1, .32], 800: [1, .5], 900: [1, .68] };
  const out = {};
  for (const [k, v] of Object.entries(steps)) out[k] = v ? mix(base, v[0] ? '#000000' : '#FFFFFF', v[1]) : base.toUpperCase();
  return out;
}

function makeTokens() {
  console.log('\n[3/3] 디자인 토큰');
  const yellow = scale(C.yellow), neutral = scale(C.black);
  const tokens = {
    $description: `${cfg.name} (${cfg.nameEn}) brand design tokens — generated by generate-assets.js`,
    color: {
      brand: { yellow: C.yellow, black: C.black, paper: C.paper, dark: C.dark },
      yellow, neutral,
      semantic: {
        light: { background: C.paper, surface: '#FFFFFF', text: C.ink, accent: C.yellow, 'on-accent': C.black },
        dark: { background: C.dark, surface: '#1A1A17', text: C.inkOnDark, accent: C.yellow, 'on-accent': C.black },
      },
    },
    font: { family: { sans: cfg.fonts.sans, display: cfg.fonts.display } },
    radius: { sm: '6px', md: '12px', lg: '20px', pill: '9999px' },
    spacing: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px', 12: '48px' },
    logo: { overhangAngleDeg: 28.4, minSizePx: { symbol: 16, full: 96 }, clearSpace: '0.25 × symbol diameter' },
  };
  write('tokens/brand-tokens.json', JSON.stringify(tokens, null, 2) + '\n');

  const flat = (o, p = []) => Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && !Array.isArray(v) ? flat(v, [...p, k]) : [[[...p, k].join('-'), v]]);
  const light = tokens.color.semantic.light, dark = tokens.color.semantic.dark;
  const semantic = (s) => Object.entries(s).map(([k, v]) => `  --color-${k}: ${v};`).join('\n');
  write('tokens/brand-tokens.css', `/* generated by generate-assets.js — 직접 수정하지 마세요 */
:root {
  --primary-yellow: ${C.yellow};
  --primary-black: ${C.black};
  --logo-text: ${C.ink};
  --logo-sub: ${C.ink};
${flat({ yellow, neutral }).map(([k, v]) => `  --color-${k}: ${v};`).join('\n')}
${semantic(light)}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --logo-text: ${C.inkOnDark};
    --logo-sub: ${C.inkOnDark};
${semantic(dark).replace(/^/gm, '  ')}
  }
}
:root[data-theme="dark"] {
  --logo-text: ${C.inkOnDark};
  --logo-sub: ${C.inkOnDark};
${semantic(dark)}
}
`);

  // Tailwind: presets 로 불러 쓰는 theme.extend 설정 (v3 호환, v4 는 @config 로 로드)
  write('tokens/tailwind.config.js', `/**
 * 해벽 브랜드 Tailwind 확장 설정 (generated by generate-assets.js)
 *
 * 사용:  // tailwind.config.js
 *        module.exports = { presets: [require('./brand/dist/tokens/tailwind.config.js')], content: [...] }
 * 다크모드는 CSS 변수 기반이라 'bg-surface text-text' 처럼 쓰면 테마에 따라 자동 전환된다.
 */
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: ${JSON.stringify(tokens.color.brand)},
        yellow: ${JSON.stringify(yellow)},
        neutral: ${JSON.stringify(neutral)},
        // 테마 반응형 시맨틱 컬러 (brand-tokens.css 의 변수를 참조)
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        text: 'var(--color-text)',
        accent: 'var(--color-accent)',
        'on-accent': 'var(--color-on-accent)',
      },
      fontFamily: {
        sans: ${JSON.stringify(cfg.fonts.sans)},
        display: ${JSON.stringify(cfg.fonts.display)},
      },
      borderRadius: ${JSON.stringify(tokens.radius)},
    },
  },
};
`);
}

/* ───────────── main ───────────── */
(async () => {
  console.log(`해벽 브랜드 자산 생성 → ${path.relative(process.cwd(), OUT) || '.'}`);
  fs.mkdirSync(OUT, { recursive: true });
  let browser;
  try {
    if (ONLY.has('favicon') || ONLY.has('og')) browser = await launch();
    if (ONLY.has('favicon')) await makeFavicons(browser);
    if (ONLY.has('og')) await makeOg(browser);
    if (ONLY.has('tokens')) makeTokens();
    console.log('\n완료 🎉');
  } catch (e) {
    console.error('\n✖ 실패:', e.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
