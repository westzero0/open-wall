#!/usr/bin/env node
// qa/smoke.mjs — "켜지고, 오프라인에서도 뜨고, 망가진 저장소에도 안 죽는지"를 보는 스모크 테스트. 파일을 바꾸지 않는다.
//   node qa/smoke.mjs        # 하나라도 ✗ 면 종료 코드 1
// 필요: Playwright. 외부 요청(지도 타일·날씨·폰트)은 막고 로컬 서버로만 돌린다.
//
// 보는 것
//   1. 첫 화면: 스크립트 오류 없음, 암장 수만큼 목록 행이 그려짐
//   2. 첫 방문 예산: 요청 수 · 전송량 · 목록이 그려지기까지(로컬 기준이라 느슨하게)
//   3. 서비스 워커: 등록됨, 캐시 이름이 version.json 과 같음, 오프라인 재방문에도 화면이 뜸
//   4. 공유 링크(w/…/): 앱으로 넘어가 그 암장 카드가 펼쳐짐
//   5. 망가진 저장소: 깨진 JSON · 잘못된 타입 · 저장소 접근 차단에서도 목록과 기록 탭이 뜸

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadPlaywright, launch, serve, wallNames } from './lib.mjs';

const BUDGET = { requests: 120, kb: 2048, rowsMs: 4000 }; // 지금: 88개 · 1.2MB · 0.6초
const version = JSON.parse(readFileSync(join(ROOT, 'version.json'), 'utf8')).v;
const names = wallNames();
const shareSlug = (() => { // 공유 페이지 하나와 그 암장 이름
  const slug = '0bu2bzhq';
  try { const m = /\?wall=([^'&]+)/.exec(readFileSync(join(ROOT, 'w', slug, 'index.html'), 'utf8')); return { slug, name: decodeURIComponent(m[1]) }; } catch { return null; }
})();

let failed = 0;
const ok = (cond, label, detail = '') => { console.log(`${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };

const pw = loadPlaywright();
const [{ server, base }, browser] = await Promise.all([serve(), launch(pw)]);
async function open(extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'Asia/Seoul', locale: 'ko-KR', serviceWorkers: 'allow', ...extra });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  return { ctx, page, errors };
}
const rowCount = (p) => p.locator('.row-btn').count();
const waitRows = (p, timeout = 8000) => p.waitForSelector('.row-btn', { state: 'attached', timeout });

// 1·2·3. 첫 방문, 서비스 워커, 오프라인
{
  const { ctx, page, errors } = await open();
  const reqs = [];
  page.on('response', async (r) => { try { if (r.url().startsWith(base)) reqs.push((await r.body()).length); } catch { /* 취소된 요청 */ } });
  const t0 = Date.now();
  await page.goto(base + '/');
  await waitRows(page);
  const rowsMs = Date.now() - t0;
  await page.waitForTimeout(1500);
  ok(errors.length === 0, '첫 화면에 스크립트 오류가 없어요', errors[0]);
  ok(await rowCount(page) === names.length, `목록에 암장 ${names.length}곳이 모두 그려져요`, `${await rowCount(page)}곳`);
  const kb = reqs.reduce((a, b) => a + b, 0) / 1024;
  ok(reqs.length <= BUDGET.requests, `첫 방문 요청 ${reqs.length}개`, `예산 ${BUDGET.requests}개`);
  ok(kb <= BUDGET.kb, `첫 방문 전송량 ${kb.toFixed(0)}KB`, `예산 ${BUDGET.kb}KB(압축 전)`);
  ok(rowsMs <= BUDGET.rowsMs, `목록이 그려지기까지 ${rowsMs}ms`, `예산 ${BUDGET.rowsMs}ms(로컬)`);

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await waitRows(page);
  await page.waitForTimeout(1500);
  const caches = await page.evaluate(() => caches.keys());
  ok(caches.includes(`haebyeok-shell-${version}`), '서비스 워커 캐시 이름이 version.json 과 같아요', `캐시 ${JSON.stringify(caches)} · version ${version}`);
  await ctx.setOffline(true);
  let offline = false;
  try { await page.reload({ waitUntil: 'load' }); await waitRows(page, 6000); offline = (await rowCount(page)) > 0; } catch { /* 안 뜸 */ }
  ok(offline, '오프라인으로 다시 열어도 화면이 떠요');
  await ctx.close();
}

// 4. 공유 링크
if (shareSlug) {
  const { ctx, page, errors } = await open();
  await page.goto(`${base}/w/${shareSlug.slug}/`);
  await waitRows(page);
  await page.waitForTimeout(800);
  const wall = JSON.parse(readFileSync(join(ROOT, 'data/national.json'), 'utf8')).walls.find((w) => w.name === shareSlug.name);
  const expanded = await page.evaluate(() => [...document.querySelectorAll('.row-btn[aria-expanded="true"]')].map((e) => e.innerText));
  ok(new URL(page.url()).pathname === '/', '공유 링크가 앱 첫 화면으로 넘어와요', page.url().replace(base, ''));
  ok(expanded.length === 1 && expanded[0].includes(wall?.short_name ?? shareSlug.name), `공유 링크로 '${shareSlug.name}' 카드가 펼쳐져요`, `펼쳐진 것: ${JSON.stringify(expanded.map((t) => t.split('\n')[0]))}`);
  ok(errors.length === 0, '공유 링크에서도 스크립트 오류가 없어요', errors[0]);
  await ctx.close();
}

// 5. 망가진 저장소
const BROKEN = {
  '깨진 JSON': () => { for (const k of ['open-wall:v1', 'open-wall:log', 'open-wall:ui']) localStorage.setItem(k, '{bad json'); localStorage.setItem('open-wall:log', '[1,null,{"wall":5}]'); },
  '잘못된 타입': () => { for (const k of ['open-wall:v1', 'open-wall:ui']) localStorage.setItem(k, '[]'); localStorage.setItem('open-wall:log', '"x"'); },
  '저장소 접근 차단': () => { Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError'); }; Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); }; },
};
for (const [label, init] of Object.entries(BROKEN)) {
  const { ctx, page, errors } = await open();
  await ctx.addInitScript(init);
  await page.goto(base + '/');
  let rows = 0; let logTab = false;
  try {
    await waitRows(page, 6000); rows = await rowCount(page);
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    await page.locator('#tab-log').tap({ timeout: 3000 });
    await page.waitForTimeout(400);
    logTab = await page.evaluate(() => !!document.querySelector('#panel-log') && !document.querySelector('#panel-log').hidden);
  } catch { /* 아래에서 실패로 표시 */ }
  ok(rows === names.length && logTab && errors.length === 0, `저장소가 망가져도 앱이 떠요: ${label}`, `행 ${rows} · 기록 탭 ${logTab ? '열림' : '안 열림'}${errors[0] ? ` · 오류 ${errors[0]}` : ''}`);
  await ctx.close();
}

await browser.close(); server.close();
console.log(failed ? `\n✗ ${failed}건 실패` : '\n✓ 모두 통과');
process.exit(failed ? 1 : 0);
