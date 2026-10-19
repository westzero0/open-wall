#!/usr/bin/env node
// qa/a11y.mjs — 주요 화면을 axe-core(WCAG 2.1 A/AA + 모범 사례)로 검사한다. 파일을 바꾸지 않는다.
//   node qa/a11y.mjs                  # 위반이 있으면 종료 코드 1
//   node qa/a11y.mjs --min-impact serious   # minor|moderate|serious|critical 이상만 실패로 침(기본 minor = 전부)
// 필요: Playwright 와 axe-core (npm i -g playwright axe-core). 시계·외부 요청은 qa/visual.mjs 와 같은 조건으로 고정한다.

import { loadPlaywright, launch, serve, newScene, closeDialogs, tap, sampleLog, wallNames, requireOptional } from './lib.mjs';

const args = process.argv.slice(2);
const MIN = args[args.indexOf('--min-impact') + 1] ?? 'minor';
const ORDER = ['minor', 'moderate', 'serious', 'critical'];

const axe = requireOptional('axe-core');
if (!axe?.source) { console.error('axe-core 를 찾지 못했어요. `npm i -g axe-core` 후 다시 실행하세요.'); process.exit(2); }

const LOG = sampleLog();
const open = (sel) => async (p) => { await closeDialogs(p); await tap(p, sel); };
const SCENES = [
  { id: 'list', run: async () => {} },
  { id: 'card', run: (p) => tap(p, '.row-btn') },
  { id: 'log', run: (p) => tap(p, '#tab-log') },
  { id: 'filters', run: open('#moreFilters') },
  { id: 'profile', run: open('#meBtn') },
  { id: 'about', run: async (p) => { await tap(p, '#meBtn'); await p.evaluate(() => document.querySelector('#pfAbout').click()); } },
  { id: 'safety', run: open('#safetyBtn') },
  { id: 'howto', run: open('#helpBtn') },
  { id: 'first-visit', seed: false, run: async () => {} },
  { id: 'share', url: `/?wall=${encodeURIComponent(wallNames()[57] ?? wallNames()[0])}`, run: async () => {} },
];
const PLAN = [
  ...SCENES.flatMap((s) => [{ s, vp: 'm390', scheme: 'light' }, { s, vp: 'm390', scheme: 'dark' }]),
  { s: SCENES[0], vp: 'desk', scheme: 'light' }, { s: SCENES[1], vp: 'desk', scheme: 'light' },
];

const pw = loadPlaywright();
const [{ server, base }, browser] = await Promise.all([serve(), launch(pw)]);
const found = new Map(); // 규칙 id → {impact, help, nodes, where:Set, sample}
let checked = 0;
for (const { s, vp, scheme } of PLAN) {
  const name = `${s.id}.${vp}.${scheme}`;
  const { ctx, page, goto } = await newScene(browser, base, { vp, scheme, seed: s.seed === false ? null : LOG });
  try {
    await goto(s.url ?? '/');
    if (s.seed !== false) await closeDialogs(page);
    await s.run(page);
    await page.waitForTimeout(500);
    await page.evaluate(axe.source);
    const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] })).violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: `${v.nodes[0].target.join(' ')} — ${(v.nodes[0].failureSummary ?? '').split('\n')[1]?.trim() ?? ''}` })));
    checked++;
    for (const v of violations) {
      const f = found.get(v.id) ?? { ...v, nodes: 0, where: new Set() };
      f.nodes += v.nodes; f.where.add(name); found.set(v.id, f);
    }
  } catch (e) { console.log(`  ! ${name}: ${e.message.split('\n')[0]}`); found.set(`error:${name}`, { impact: 'critical', help: '검사 실패', nodes: 1, where: new Set([name]), sample: e.message.split('\n')[0] }); }
  await ctx.close();
}
await browser.close(); server.close();

const failing = [...found.values()].filter((v) => ORDER.indexOf(v.impact) >= ORDER.indexOf(MIN));
for (const [id, v] of found) console.log(`[${v.impact}] ${id} — ${v.help}\n   ${v.nodes}곳 · ${[...v.where].slice(0, 4).join(', ')}${v.where.size > 4 ? ` 외 ${v.where.size - 4}` : ''}\n   예) ${v.sample}`);
console.log(`\n${checked}개 화면 검사(axe-core ${axe.version}) — ${failing.length ? `✗ 위반 ${failing.length}종` : '✓ 위반 없음'}`);
process.exit(failing.length ? 1 : 0);
