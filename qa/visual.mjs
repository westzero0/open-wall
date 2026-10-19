#!/usr/bin/env node
// qa/visual.mjs — 수정 전·후 화면을 같은 조건으로 찍어 비교하는 시각 회귀 검사. 파일을 바꾸지 않고, 결과는 qa/.out/ 에만 쓴다.
//
//   node qa/visual.mjs snap before            # 지금 코드를 찍어 qa/.out/before/ 에 저장
//   (코드를 고친다)
//   node qa/visual.mjs compare before         # 다시 찍어(qa/.out/current/) before 와 비교
//   node qa/visual.mjs diff before after      # 이미 찍어 둔 두 묶음만 비교
//   옵션: --tolerance 0.002  달라진 픽셀 비율이 이 값을 넘으면 실패(기본 0.2%)
//         --only list,log     이름이 이 글자로 시작하는 장면만
//
// 기준 이미지를 저장소에 두지 않는 이유: 한글 폰트가 컴퓨터마다 달라서 다른 컴퓨터에서 찍은 기준은 전부 어긋난다.
// 그래서 "고치기 전의 같은 컴퓨터"에서 찍은 것과 비교한다.
//
// 같은 조건: 시계는 2026-10-17 14:00(KST)에 맞추고, 외부 요청(지도 타일·날씨·폰트)은 막고, 움직임은 끈다. 지도 영역은 가린다.
// 찍으면서 가로 넘침과 스크립트 오류도 확인한다(오류가 있으면 종료 코드 1).
// 필요: Playwright (npm i -g playwright 또는 프로젝트에 설치) 와 Chromium.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, VIEWPORTS, loadPlaywright, launch, serve, newScene, closeDialogs, tap, sampleLog, wallNames } from './lib.mjs';

const OUT = join(ROOT, 'qa', '.out');

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(`--${name}`); return i < 0 ? dflt : args[i + 1]; };
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const [cmd, labelA, labelB] = positional;
const TOLERANCE = Number(flag('tolerance', 0.002));
const ONLY = flag('only', '')?.split(',').filter(Boolean) ?? [];

// ── 장면 ─────────────────────────────────────────────────────────────────────
const walls = wallNames();
const LOG = sampleLog();

const sheet = (opener) => async (p) => { await closeDialogs(p); await tap(p, opener); };
const SCENES = [
  { id: 'first-visit', seed: false, run: async () => {} }, // 처음이세요? 안내가 저절로 열린다
  { id: 'list', run: async () => {} },
  { id: 'list-scroll', run: (p) => p.evaluate(() => scrollTo(0, 700)) },
  { id: 'card', run: (p) => tap(p, '.row-btn') },
  { id: 'log', run: (p) => tap(p, '#tab-log') },
  { id: 'filters', run: sheet('#moreFilters') },
  { id: 'profile', run: sheet('#meBtn') },
  { id: 'about', run: async (p) => { await tap(p, '#meBtn'); await p.evaluate(() => document.querySelector('#pfAbout').click()); } },
  { id: 'safety', run: sheet('#safetyBtn') },
  { id: 'howto', run: sheet('#helpBtn') },
  { id: 'share', url: `/?wall=${encodeURIComponent(walls[57] ?? walls[0])}`, run: async () => {} },
];
// 어떤 화면을 어떤 크기·테마로 찍을지(전부 곱하면 너무 많다)
const PLAN = [
  ...SCENES.map((s) => ({ s, vp: 'm390', scheme: 'light' })),
  ...SCENES.map((s) => ({ s, vp: 'm390', scheme: 'dark' })),
  ...SCENES.filter((s) => ['list', 'card', 'log', 'profile'].includes(s.id)).flatMap((s) => [{ s, vp: 'm360', scheme: 'light' }, { s, vp: 'tab', scheme: 'light' }, { s, vp: 'desk', scheme: 'light' }]),
].filter(({ s, vp, scheme }) => !ONLY.length || ONLY.some((o) => `${s.id}.${vp}.${scheme}`.startsWith(o)));

async function snap(label) {
  const dir = join(OUT, label);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const pw = loadPlaywright();
  const [{ server, base }, browser] = await Promise.all([serve(), launch(pw)]);
  const problems = [];
  for (const { s, vp, scheme } of PLAN) {
    const name = `${s.id}.${vp}.${scheme}`;
    const { ctx, page, errors: errs, goto } = await newScene(browser, base, { vp, scheme, seed: s.seed === false ? null : LOG });
    try {
      await goto(s.url ?? '/');
      if (s.seed !== false) await closeDialogs(page);
      await s.run(page);
      await page.waitForTimeout(700);
      const over = await page.evaluate(() => { const d = document.querySelector('dialog[open]'); return (d && d.scrollWidth > d.clientWidth) || document.documentElement.scrollWidth > innerWidth; });
      if (over) problems.push(`${name}: 가로로 넘쳐요`);
      if (errs.length) problems.push(`${name}: 스크립트 오류 ${errs[0]}`);
      await page.screenshot({ path: join(dir, `${name}.png`), animations: 'disabled', mask: [page.locator('#map'), page.locator('.leaflet-container')] });
    } catch (e) { problems.push(`${name}: ${e.message.split('\n')[0]}`); }
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log(`찍음: ${readdirSync(dir).length}장 → qa/.out/${label}/`);
  for (const p of problems) console.log(`  ! ${p}`);
  return problems;
}

// ── 비교(브라우저의 canvas 로 — 이미지 라이브러리 없이) ──────────────────────
async function diff(a, b) {
  const da = join(OUT, a); const db = join(OUT, b);
  for (const d of [da, db]) if (!existsSync(d)) { console.error(`${d} 가 없어요. 먼저 snap 하세요.`); process.exit(2); }
  const out = join(OUT, `diff-${a}-${b}`);
  rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
  const pw = loadPlaywright();
  const browser = await launch(pw);
  const page = await browser.newPage();
  const wanted = (f) => !ONLY.length || ONLY.some((o) => f.startsWith(o));
  const fa = new Set(readdirSync(da).filter(wanted)); const fb = new Set(readdirSync(db).filter(wanted));
  let bad = 0;
  for (const f of [...fa].filter((x) => fb.has(x)).sort()) {
    const r = await page.evaluate(async ([x, y]) => {
      const load = async (b64) => { const bin = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob()); const c = new OffscreenCanvas(bin.width, bin.height); const g = c.getContext('2d'); g.drawImage(bin, 0, 0); return g.getImageData(0, 0, bin.width, bin.height); };
      const A = await load(x); const B = await load(y);
      if (A.width !== B.width || A.height !== B.height) return { size: [A.width, A.height, B.width, B.height] };
      const out = new ImageData(A.width, A.height); let n = 0;
      for (let i = 0; i < A.data.length; i += 4) {
        const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
        const hit = d > 48; // 글자 가장자리의 미세한 번짐은 무시
        if (hit) n++;
        out.data[i] = hit ? 255 : A.data[i] * 0.25 + 191; out.data[i + 1] = hit ? 0 : A.data[i + 1] * 0.25 + 191; out.data[i + 2] = hit ? 60 : A.data[i + 2] * 0.25 + 191; out.data[i + 3] = 255;
      }
      const c = new OffscreenCanvas(A.width, A.height); c.getContext('2d').putImageData(out, 0, 0);
      const blob = await c.convertToBlob({ type: 'image/png' });
      const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const byte of buf) s += String.fromCharCode(byte);
      return { ratio: n / (A.width * A.height), png: btoa(s) };
    }, [readFileSync(join(da, f)).toString('base64'), readFileSync(join(db, f)).toString('base64')]);
    if (r.size) { console.log(`✗ ${f}: 크기가 달라요 (${r.size[0]}×${r.size[1]} → ${r.size[2]}×${r.size[3]})`); bad++; continue; }
    const pct = (r.ratio * 100).toFixed(2);
    if (r.ratio > TOLERANCE) { writeFileSync(join(out, f), Buffer.from(r.png, 'base64')); console.log(`✗ ${f}: ${pct}% 달라요 → qa/.out/diff-${a}-${b}/${f}`); bad++; }
    else if (r.ratio > 0) console.log(`· ${f}: ${pct}% (허용 범위)`);
  }
  for (const f of fa) if (!fb.has(f)) { console.log(`✗ ${f}: ${b} 에 없어요`); bad++; }
  for (const f of fb) if (!fa.has(f)) { console.log(`+ ${f}: ${a} 에 없던 새 장면`); }
  await browser.close();
  console.log(bad ? `\n✗ ${bad}장이 달라졌어요(빨간 곳이 바뀐 부분). 의도한 변경이면 그대로 진행하세요.` : `\n✓ 모든 장면이 같아요(허용 ${(TOLERANCE * 100).toFixed(1)}%).`);
  return bad;
}

if (cmd === 'snap' && labelA) { process.exit((await snap(labelA)).length ? 1 : 0); }
else if (cmd === 'diff' && labelA && labelB) { process.exit((await diff(labelA, labelB)) ? 1 : 0); }
else if (cmd === 'compare' && labelA) { const p = await snap('current'); const d = await diff(labelA, 'current'); process.exit(p.length || d ? 1 : 0); }
else { console.log('사용법:\n  node qa/visual.mjs snap <이름>\n  node qa/visual.mjs compare <이전 이름>\n  node qa/visual.mjs diff <이름A> <이름B>\n옵션: --tolerance 0.002  --only list,log'); process.exit(2); }
