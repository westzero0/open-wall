// qa/lib.mjs — qa/ 도구들이 같이 쓰는 것: 저장소 루트, 정적 서버, Playwright 로더, 고정된 장면 조건. 앱 코드는 건드리지 않는다.

import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { dirname, join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const NOW = new Date('2026-10-17T14:00:00+09:00'); // 모든 화면 검사가 쓰는 "지금"(낮 2시: 열린 곳이 많다)
export const VIEWPORTS = {
  m390: { width: 390, height: 844, mobile: true },
  m360: { width: 360, height: 740, mobile: true },
  tab: { width: 768, height: 1024, mobile: true },
  desk: { width: 1280, height: 800, mobile: false },
};

// 프로젝트에 설치된 것 → 전역 설치 순서로 찾는다.
export function requireOptional(name) {
  const globalRoot = () => `${execSync('npm root -g').toString().trim()}/`;
  for (const make of [() => createRequire(import.meta.url), () => createRequire(`${process.cwd()}/`), () => createRequire(globalRoot())]) {
    try { return make()(name); } catch { /* 다음 */ }
  }
  return null;
}
export function loadPlaywright() {
  const pw = requireOptional('playwright');
  if (!pw) { console.error('Playwright 를 찾지 못했어요. `npm i -g playwright && npx playwright install chromium` 후 다시 실행하세요.'); process.exit(2); }
  return pw;
}
export async function launch(pw) {
  try { return await pw.chromium.launch(); } catch (e) {
    for (const p of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean)) {
      if (existsSync(p)) return pw.chromium.launch({ executablePath: p });
    }
    throw e;
  }
}

// 의존성 없는 정적 서버(저장소 루트). 포트는 아무거나.
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
export function serve() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = join(ROOT, p);
    if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!existsSync(f)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

// 새 문맥: 시계 고정, 외부 요청 차단(결과가 흔들리지 않게), 움직임 끔. seed 가 있으면 기록·안내 완료를 미리 넣는다.
export async function newScene(browser, base, { vp = 'm390', scheme = 'light', seed = null } = {}) {
  const v = VIEWPORTS[vp];
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, hasTouch: v.mobile, isMobile: v.mobile, colorScheme: scheme, reducedMotion: 'reduce', timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  await ctx.clock.install({ time: NOW });
  if (seed) await ctx.addInitScript((log) => { try { localStorage.setItem('open-wall:log', JSON.stringify(log)); localStorage.setItem('open-wall:ui', JSON.stringify({ introDone: true })); } catch { /* 저장소 막힘 */ } }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const blocked = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { blocked.push(r.request().url()); r.abort(); });
  return { ctx, page, errors, blocked, goto: async (path = '/') => { await page.goto(base + path); await page.waitForSelector('.row-btn', { state: 'attached', timeout: 8000 }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(700); } };
}
export const closeDialogs = (p) => p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
export const tap = (p, sel) => p.locator(sel).first().tap().catch(() => p.locator(sel).first().click()); // 데스크톱은 터치가 없어 클릭으로

// 기록 탭 화면에 쓰는 가짜 기록(실제 암장 이름 5곳, 14건)
export function sampleLog() {
  const walls = JSON.parse(readFileSync(join(ROOT, 'data/national.json'), 'utf8')).walls.map((w) => w.name);
  return Array.from({ length: 14 }, (_, i) => ({
    id: `r${i}`, wall: walls[i % 5], date: `2026-10-${String(16 - Math.floor(i / 2)).padStart(2, '0')}`, time: '14:00',
    memo: i % 3 ? '' : '오늘 컨디션 좋음', sends: { '10a': 2, '10b': 1 }, tries: { '11a': 1 },
  }));
}
export const wallNames = () => JSON.parse(readFileSync(join(ROOT, 'data/national.json'), 'utf8')).walls.map((w) => w.name);
