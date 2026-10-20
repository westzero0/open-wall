#!/usr/bin/env node
/**
 * 해벽 인스타 게시물 자동 생성기 (수동 업로드용 초안)
 *
 * data/national.json 과 앱의 계산 로직(src/hours.js, src/sun.js)을 그대로 읽어
 * 게시물 이미지(1080×1350 PNG)와 캡션 초안(.txt)을 만든다. 앱과 같은 코드를 쓰므로 값이 어긋나지 않는다.
 *
 *   node generate-posts.mjs                       # 오늘 날짜로 today·sunshade·spotlight 생성
 *   node generate-posts.mjs --date 2026-10-25     # 날짜 지정
 *   node generate-posts.mjs --type today,sunshade # 일부만
 *   node generate-posts.mjs --spotlight 금곡      # 소개할 암장 지정 (이름 일부)
 *   node generate-posts.mjs --thanks "고양인공암벽장" --thanks-note "운영시간을 업데이트했어요"
 *
 * 옵션: --out <dir>(기본 ./out) --max-age <일>(정보 확인일 허용 기간, 기본 45) --config <file>
 * 결과: out/<날짜>/ 에 PNG, 캡션 .txt, 확인용 preview.html. **발행 전에 반드시 사람이 확인**하세요.
 */
process.env.TZ = 'Asia/Seoul'; // 앱과 같은 시간대로 해/그림자 계산 (Date 를 쓰기 전에 지정)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const BRAND = path.resolve(HERE, '..');
const { DAY_KO, ymd, toMin } = await import(path.join(REPO, 'src/time.js'));
const { openIntervals } = await import(path.join(REPO, 'src/hours.js'));
const { isSunlit } = await import(path.join(REPO, 'src/sun.js'));
const { holidayName } = await import(path.join(REPO, 'src/holidays.js'));

/* ───────── CLI ───────── */
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[argv[i].slice(2)] = true;
  else { args[argv[i].slice(2)] = next; i++; }
}
const cfg = JSON.parse(fs.readFileSync(path.resolve(args.config || path.join(BRAND, 'brand.config.json')), 'utf8'));
const C = cfg.colors;
const MAX_AGE = Number(args['max-age'] ?? 45);
const SITE = (cfg.og.tag || 'haebyeok.app').toUpperCase();
const TYPES = new Set(String(args.type || 'today,sunshade,spotlight').split(',').map((s) => s.trim()));
if (args.thanks) TYPES.add('thanks');

const today = new Date();
const [yy, mm, dd] = (args.date ? String(args.date) : ymd(today)).split('-').map(Number);
const DATE = new Date(yy, mm - 1, dd);
const DATE_KEY = ymd(DATE);
const OUT = path.resolve(args.out || path.join(HERE, 'out'), DATE_KEY);
fs.mkdirSync(OUT, { recursive: true });

/* ───────── 데이터 ───────── */
const walls = JSON.parse(fs.readFileSync(path.join(REPO, 'data/national.json'), 'utf8')).walls;
const ageDays = (w) => (w.checked_at ? (DATE - new Date(w.checked_at)) / 86400000 : Infinity);
const fresh = (w) => ageDays(w) <= MAX_AGE;
const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const at = (m) => new Date(yy, mm - 1, dd, 0, m);

/** 하루 정보: 영업 구간, 영업 중 양달 구간(10분 단위), 양달 비율 */
function dayInfo(w) {
  const iv = openIntervals(w, DATE).filter(([s, e]) => e > s);
  if (!iv.length) return null;
  const openMin = iv.reduce((a, [s, e]) => a + (e - s), 0);
  const indoor = w.venue === 'indoor';
  let litMin = 0, known = false;
  const wins = [];
  if (!indoor) {
    for (const [s, e] of iv) {
      let start = null;
      for (let m = s; m <= e; m += 10) {
        const r = m < e ? isSunlit(w, at(m)).lit : false;
        if (r !== null && m < e) known = true;
        if (r && start === null) start = m;
        if (!r && start !== null) { wins.push([start, Math.min(m, e)]); litMin += Math.min(m, e) - start; start = null; }
      }
    }
  }
  const hours = iv.map(([s, e]) => `${fmt(s)}–${e >= 1440 ? '24:00' : fmt(e)}`).join(', ');
  return { iv, openMin, indoor, known, wins, litMin, ratio: known ? litMin / openMin : null, hours };
}
const winText = (wins, n = 2) => wins.slice(0, n).map(([a, b]) => `${fmt(a)}–${fmt(b)}`).join(', ');
const label = (w) => w.short_name && w.short_name.length <= 6 ? w.name : w.name;

const cands = walls.filter(fresh).map((w) => ({ w, d: dayInfo(w) })).filter((x) => x.d);

/* ───────── 렌더링 도구 ───────── */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const read = (f) => fs.readFileSync(path.join(HERE, f), 'utf8');
const vars = { '--primary-yellow': C.yellow, '--primary-black': C.black, '--logo-text': C.ink, '--logo-sub': C.ink, '--brand-paper': C.paper };
const themed = (svg) => svg.replace('</style>', `    :root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}\n  </style>`);
const uniq = (svg, p) => svg.replace(/\bhb-(clip|cap|title|mask)\b/g, `${p}-$1`);
const themedY = (svg) => svg.replace('</style>', `    svg{--primary-yellow:${C.paper};--primary-black:${C.black};--logo-text:${C.black};--logo-sub:${C.black}}\n  </style>`); // 노란 배경 위: 해를 paper 색으로
const rawLogo = fs.readFileSync(path.join(BRAND, 'full-logo-horizontal.svg'), 'utf8');
const rawSymbol = fs.readFileSync(path.join(BRAND, 'symbol.svg'), 'utf8');
const logoSvg = themed(rawLogo);
const symbolSvg = themed(rawSymbol);
const baseCss = () => fill(read('templates/base.css'), {
  CSS_VARS: Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(' '),
  FONT_SANS: cfg.fonts.sans.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(', '),
});
function fill(tpl, map) { return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in map ? map[k] : m)); }
const common = () => ({
  BASE_CSS: baseCss(),
  LOGO: uniq(logoSvg, 'p-a'),
  SYMBOL: uniq(symbolSvg, 'p-b'),
  LOGO_Y: uniq(themedY(rawLogo), 'p-y'),
  BIGSYM: uniq(themedY(rawSymbol), 'p-s'),
  DATE: `${mm}월 ${dd}일`,
  WEEKDAY: `${DAY_KO[DATE.getDay()]}요일${holidayName(DATE) ? ` · ${holidayName(DATE)}` : ''}`,
  SITE,
});
const NOTE = '운영시간은 바뀔 수 있어요. 방문 전 시설 공지를 확인해 주세요.';

const posts = []; // {id, title, png, caption}

/* ───────── 게시물 정의 ───────── */
const pct = (m) => Math.max(0, Math.min(100, ((m - 360) / (1440 - 360)) * 100));
const seg = (cls, a, b) => (b > 360 && a < 1440 ? `<i class="${cls}" style="left:${pct(a).toFixed(2)}%;width:${(pct(b) - pct(a)).toFixed(2)}%"></i>` : '');
// 06~24시 막대: 검정 = 운영 중(그늘/실내), 노랑 = 운영 중 양달
const barHtml = (d) => `<div class="bar">${d.iv.map(([a, b]) => seg('o', a, b)).join('')}${d.wins.map(([a, b]) => seg('s', a, b)).join('')}</div>`;
const timeTag = (d) => {
  if (d.indoor) return '<span class="t indoor">실내</span>';
  if (!d.known) return '<span class="t na">해 정보 없음</span>';
  if (d.ratio <= 0.15) return '<span class="t shade">응달</span>';
  return `<span class="t sun">양달 ${esc(winText(d.wins, 1))}</span>`;
};
const rowHtml = (i, w, d, meta) => `<div class="row"><div class="rank">${i}</div><div class="main"><div class="line"><span class="name">${esc(w.name)}</span>${timeTag(d)}</div><div class="meta">${esc(meta)}</div>${barHtml(d)}</div></div>`;

function buildToday() {
  // 해 정보가 있는 야외·복합 암장을 우선 (양달 비율 높은 순), 그다음 실내/미정
  const rank = (x) => (x.d.indoor ? -2 : x.d.known ? (x.d.ratio ?? 0) : -1);
  const list = [...cands].sort((a, b) => rank(b) - rank(a) || a.w.name.localeCompare(b.w.name, 'ko')).slice(0, 4);
  if (!list.length) return null;
  const rows = list.map((x, i) => rowHtml(i + 1, x.w, x.d, `${x.w.region} · ${x.d.hours}`)).join('');
  const more = cands.length - list.length;
  const html = fill(read('templates/today.html'), { ...common(), ROWS: rows, NOTE: `${NOTE}${more > 0 ? ` 외 ${more}곳은 지도에서 확인하세요.` : ''}` });
  const lines = list.map((x) => `• ${x.w.name} (${x.w.region}) ${x.d.hours}${x.d.indoor ? ' · 실내' : x.d.known && x.d.wins.length ? ` · 양달 ${winText(x.d.wins, 1)}` : ''}`);
  const caption = `${mm}월 ${dd}일 ${DAY_KO[DATE.getDay()]}요일, 열려 있는 외벽이에요.\n\n${lines.join('\n')}\n\n전체 암장과 양달·응달은 지도에서 한눈에 볼 수 있어요 → haebyeok.app\n운영시간은 바뀔 수 있어요. 방문 전 시설에 확인해 주세요.\n\n${tags('오늘열린암장')}`;
  return { id: 'today', title: '오늘 열린 외벽', html, caption };
}

function buildSunshade() {
  const outdoor = cands.filter((x) => !x.d.indoor && x.d.known);
  const sunny = [...outdoor].sort((a, b) => b.d.litMin - a.d.litMin).filter((x) => x.d.ratio >= 0.5).slice(0, 2);
  const shady = [...outdoor].sort((a, b) => a.d.ratio - b.d.ratio || b.d.openMin - a.d.openMin).filter((x) => x.d.ratio <= 0.2).slice(0, 2);
  if (!sunny.length && !shady.length) return null;
  const sec = (cls, name, arr) => arr.length
    ? `<div class="section"><i class="${cls}"></i>${name}</div>${arr.map((x, i) => rowHtml(i + 1, x.w, x.d, `${x.w.region} · ${x.d.hours}`)).join('')}` : '';
  const html = fill(read('templates/sunshade.html'), {
    ...common(),
    ROWS: sec('sun', '해가 드는 곳', sunny) + sec('shade', '그늘진 곳', shady),
    NOTE: '운영시간 중 벽 기준이에요. 나무 가림과 날씨는 반영하지 않아요.',
  });
  const l = (arr) => arr.map((x) => `• ${x.w.name} ${x.d.known && x.d.wins.length ? winText(x.d.wins, 1) : x.d.hours}`).join('\n');
  const caption = `${mm}월 ${dd}일, 오늘 어느 벽에 해가 들까요?\n\n${sunny.length ? `☀️ 해가 드는 곳\n${l(sunny)}\n\n` : ''}${shady.length ? `🌥 그늘진 곳\n${l(shady)}\n\n` : ''}운영시간 중 벽 기준이고 나무 가림·날씨는 반영하지 않아요. 지도에서 시간대별로 볼 수 있어요 → haebyeok.app\n\n${tags('양달응달')}`;
  return { id: 'sunshade', title: '오늘의 양달·응달', html, caption };
}

function buildSpotlight() {
  const withPhoto = (x) => x.w.photo || x.w.photos?.length;
  let pick = null;
  if (args.spotlight && args.spotlight !== true) pick = cands.find((x) => x.w.name.includes(args.spotlight)) || walls.filter(fresh).map((w) => ({ w, d: dayInfo(w) })).find((x) => x.w.name.includes(args.spotlight));
  else {
    const pool = cands.filter(withPhoto);
    const src = pool.length ? pool : cands;
    if (!src.length) return null;
    pick = src[Math.floor(DATE / 86400000) % src.length]; // 날짜로 순환
  }
  if (!pick) { console.warn('  ! spotlight 대상을 찾지 못했어요'); return null; }
  const { w } = pick;
  const d = pick.d || dayInfo(w);
  const rel = w.photos?.find((p) => p.main)?.src || w.photos?.[0]?.src || w.photo;
  const credit = w.photos?.find((p) => p.main)?.credit?.text || w.photo_credit?.text || w.photo_credit;
  let photo = '', chipCls = '';
  if (rel && fs.existsSync(path.join(REPO, 'data', rel))) {
    const buf = fs.readFileSync(path.join(REPO, 'data', rel));
    photo = `<img src="data:image/jpeg;base64,${buf.toString('base64')}" alt="">${credit ? `<div class="credit">사진 ${esc(typeof credit === 'string' ? credit : credit.text ?? '')}</div>` : ''}`;
  } else { photo = `<div class="bigsym">${uniq(themedY(rawSymbol), 'p-c')}</div>`; chipCls = 'on-y'; }
  const fact = (k, v) => (v ? `<div class="fact"><b>${k}</b><span>${esc(v)}</span></div>` : '');
  const parking = { free: '무료', paid: '유료', none: '없음' }[w.parking?.status] || '';
  const sunLine = !d ? '' : d.indoor ? '실내 암장' : d.known && d.wins.length ? `양달 ${winText(d.wins)}` : d.known ? '오늘은 응달' : '';
  const facts = [
    fact('운영', d ? d.hours : '휴무'),
    fact('해', sunLine),
    fact('주소', w.address),
    fact('주차', parking ? `${parking}${w.parking?.nearby?.length ? ` · ${w.parking.nearby[0]}` : ''}` : ''),
  ].join('');
  const html = fill(read('templates/spotlight.html'), {
    ...common(), PHOTO: photo, CHIP_CLASS: chipCls, LOGO_CHIP: chipCls ? uniq(themedY(rawLogo), 'p-k') : uniq(logoSvg, 'p-k'),
    WEEKDAY_SHORT: DAY_KO[DATE.getDay()], REGION: esc(w.region), NAME: esc(w.name), FACTS: facts,
    SUNBAR: d ? barHtml(d) : '<div class="bar"></div>',
    NOTE: `${NOTE} 정보 확인일 ${w.checked_at || '미확인'}`,
  });
  const caption = `📍 ${w.name} (${w.region})\n\n오늘 ${d ? d.hours : '휴무'}${sunLine ? `\n해: ${sunLine}` : ''}\n${w.address ? `주소: ${w.address}\n` : ''}${parking ? `주차: ${parking}\n` : ''}\n정보 확인일 ${w.checked_at || '미확인'} · 운영시간은 바뀔 수 있어요. 방문 전 시설에 확인해 주세요.\n틀린 정보는 앱의 ‘정보 수정 요청’으로 알려 주세요 → haebyeok.app\n${w.photo_credit || credit ? `\n사진: ${typeof credit === 'string' ? credit : credit?.text ?? ''}` : ''}\n\n${tags('암장소개', w.region.split(' ')[0] + '암장')}`;
  return { id: 'spotlight', title: `암장 소개 · ${w.name}`, html, caption };
}

function buildThanks() {
  const name = args.thanks === true ? '암장' : args.thanks;
  const note = args['thanks-note'] || '정보를 업데이트했어요.';
  const html = fill(read('templates/thanks.html'), { ...common(), NAME: esc(name), NOTE_LINE: esc(note) });
  const caption = `제보 고마워요 🙌\n${name} ${note}\n\n혹시 틀린 정보를 발견하셨나요? 앱에서 카드를 펼쳐 ‘정보 수정 요청’을 눌러 주세요. 개인정보는 적지 않아도 돼요.\n→ haebyeok.app\n\n${tags('제보감사')}`;
  return { id: 'thanks', title: `제보 감사 · ${name}`, html, caption };
}

function tags(...extra) {
  return ['해벽', '실외암벽', '인공암벽', '클라이밍', ...extra].map((t) => `#${t}`).join(' ');
}

/* ───────── 실행 ───────── */
function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const t of [() => require('playwright'), () => require('@playwright/test'), () => require(path.join(execSync('npm root -g').toString().trim(), 'playwright')), () => require(path.join(BRAND, 'node_modules/playwright'))]) {
    try { return t(); } catch (_) { /* next */ }
  }
  throw new Error('Playwright를 찾을 수 없어요. brand/ 에서 `npm install` 후 `npx playwright install chromium` 을 실행하세요.');
}

const builders = { today: buildToday, sunshade: buildSunshade, spotlight: buildSpotlight, thanks: buildThanks };
const built = [...TYPES].filter((t) => builders[t]).map((t) => builders[t]()).filter(Boolean);
if (!built.length) { console.error('생성할 게시물이 없어요. (최근 확인된 데이터가 부족하거나 오늘 영업하는 암장이 없을 수 있어요. --max-age 를 늘려 보세요.)'); process.exit(1); }

const { chromium } = loadPlaywright();
const exe = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
try {
  console.log(`해벽 인스타 게시물 → ${path.relative(process.cwd(), OUT)} (확인일 ${MAX_AGE}일 이내 암장 ${cands.length}곳 영업)`);
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  let n = 1;
  for (const p of built) {
    const base = `${String(n++).padStart(2, '0')}-${p.id}`;
    await page.setContent(p.html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    fs.writeFileSync(path.join(OUT, `${base}.png`), await page.screenshot({ type: 'png' }));
    fs.writeFileSync(path.join(OUT, `${base}.txt`), p.caption + '\n');
    p.png = `${base}.png`; p.txt = `${base}.txt`;
    console.log('  ✔', base);
  }
  const prev = `<!doctype html><meta charset="utf-8"><title>해벽 게시물 확인 ${DATE_KEY}</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f4f0;margin:0;padding:24px;color:#2b2b2b}h1{font-size:20px}.g{display:flex;flex-wrap:wrap;gap:24px}.c{width:360px}.c img{width:100%;border-radius:12px;box-shadow:0 2px 12px #0002}pre{white-space:pre-wrap;font:14px/1.5 inherit;background:#fff;border-radius:12px;padding:14px}</style>
<h1>해벽 인스타 게시물 확인 · ${DATE_KEY}</h1><p>정보가 맞는지 확인한 뒤 업로드하세요. (운영시간, 양달·응달은 데이터 기준이며 틀릴 수 있어요)</p>
<div class="g">${built.map((p) => `<div class="c"><h2>${esc(p.title)}</h2><img src="${p.png}"><pre>${esc(p.caption)}</pre></div>`).join('')}</div>`;
  fs.writeFileSync(path.join(OUT, 'preview.html'), prev);
  console.log('  ✔ preview.html\n완료 🎉  발행 전에 preview.html 로 내용을 꼭 확인하세요.');
} finally {
  await browser.close();
}
