#!/usr/bin/env node
// qa/watch-run.mjs — 컴퓨터가 켜졌을 때 "한 번에 따라잡는" 실행기. 시간에 맞춰 돌 필요가 없고, 며칠 꺼 둬도 놓치지 않는다.
//
//   node qa/watch-run.mjs               # 마지막으로 돈 지 12시간이 안 됐으면 그 단계는 건너뜀
//   node qa/watch-run.mjs --force       # 시간과 상관없이 전부
//   node qa/watch-run.mjs --min-hours 6 # 간격을 바꿈
//   node qa/watch-run.mjs --selftest
//
// 하는 일 (각 단계는 저장해 둔 "지난번에 본 것"과 비교해서 새것만 알린다)
//   1. 공지 변경 확인   → qa/notices.mjs   (암장 공지 페이지)
//   2. 검색 API         → qa/search-api.mjs (네이버·다음 블로그·카페. 키가 없으면 건너뜀)
//   3. 받은 글 읽기     → qa/watch.mjs      (qa/inbox/ 에 넣어 둔 디시인사이드 저장 페이지·오픈채팅 내보내기. 처리하면 .html 은 qa/inbox/done/ 으로 옮기고, 오픈채팅 내보내기 .txt 는 남의 대화 원문이라 지움)
// 결과는 한 장으로 합쳐서 qa/.out/watch-summary.md 에 쓴다. 후보일 뿐이니 공지·전화로 확인한 뒤 data/national.json 을 고치세요.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './lib.mjs';

const OUT = join(ROOT, 'qa', '.out');
const STATE = join(OUT, 'watch-run-state.json');
const INBOX = join(ROOT, 'qa', 'inbox');
const here = dirname(fileURLToPath(import.meta.url));

export const due = (lastIso, minHours, now = Date.now()) => !lastIso || now - new Date(lastIso).getTime() >= minHours * 3600000;
const run = (file, args = []) => { const r = spawnSync(process.execPath, [join(here, file), ...args], { encoding: 'utf8', timeout: 20 * 60 * 1000 }); return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() }; };

function selftest() {
  const now = Date.parse('2026-10-18T12:00:00Z');
  const checks = [
    ['처음이면 돈다', due(undefined, 12, now)],
    ['11시간 전이면 건너뛴다', !due('2026-10-18T01:00:00Z', 12, now)],
    ['12시간 전이면 돈다', due('2026-10-18T00:00:00Z', 12, now)],
    ['며칠 꺼 뒀으면 돈다', due('2026-10-10T00:00:00Z', 12, now)],
    ['간격을 바꿀 수 있다', due('2026-10-18T07:00:00Z', 4, now) && !due('2026-10-18T07:00:00Z', 6, now)],
  ];
  let bad = 0;
  for (const [l, ok] of checks) { console.log(`${ok ? '✓' : '✗'} ${l}`); if (!ok) bad++; }
  console.log(bad ? `\n✗ ${bad}건 실패` : '\n✓ 모두 통과');
  process.exit(bad ? 1 : 0);
}

if (process.argv.includes('--selftest')) selftest();
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const force = argv.includes('--force');
  const minHours = Number(argv[argv.indexOf('--min-hours') + 1]) || 12;
  mkdirSync(OUT, { recursive: true }); mkdirSync(INBOX, { recursive: true });
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
  const sections = []; const notes = [];
  const step = (key, title, fn) => {
    if (!force && !due(state[key], minHours)) { notes.push(`- ${title}: 건너뜀(${state[key]}에 했어요, ${minHours}시간이 안 지났어요)`); return; }
    console.log(`\n━━ ${title} ━━`);
    const r = fn();
    if (r) { sections.push(`# ${title}\n\n${r.out}\n`); console.log(r.out); if (r.ok && r.stamp !== false) state[key] = new Date().toISOString(); else if (!r.ok) notes.push(`- ${title}: 실패 — 위 출력을 확인하세요`); }
  };
  step('notices', '1. 암장 공지 변경 확인', () => run('notices.mjs'));
  step('search', '2. 검색 API(네이버·다음)', () => {
    if (!(process.env.NAVER_CLIENT_ID || process.env.KAKAO_REST_API_KEY)) { notes.push('- 2. 검색 API: 키가 없어 건너뜀(NAVER_CLIENT_ID/SECRET 또는 KAKAO_REST_API_KEY 를 환경 변수로)'); return null; }
    return run('search-api.mjs');
  });
  const inbox = readdirSync(INBOX, { withFileTypes: true }).filter((d) => d.isFile() && !d.name.startsWith('.')).map((d) => d.name);
  if (inbox.length) {
    console.log(`\n━━ 3. 받은 글 읽기(${inbox.length}개) ━━`);
    const r = run('watch.mjs', inbox.map((f) => join(INBOX, f)));
    sections.push(`# 3. 받은 글(디시인사이드 저장 페이지·오픈채팅)\n\n${r.out}\n`); console.log(r.out);
    if (r.ok) { // 처리한 .txt(오픈채팅 내보내기·메모)는 남의 대화 원문이 들어 있을 수 있어서 지운다. 저장한 웹 페이지(.html)만 done/ 으로 옮긴다.
      const done = join(INBOX, 'done', new Date().toISOString().slice(0, 10));
      for (const f of inbox) { if (/\.txt$/i.test(f)) rmSync(join(INBOX, f)); else { mkdirSync(done, { recursive: true }); renameSync(join(INBOX, f), join(done, f)); } }
    }
  } else notes.push('- 3. 받은 글: qa/inbox/ 가 비어 있어요(저장한 디시인사이드 페이지나 오픈채팅 내보내기를 넣어 두면 읽어요)');
  writeFileSync(STATE, JSON.stringify(state, null, 2));
  const summary = [`# 변동 확인 요약 (${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })})`, '', ...notes, '', ...sections].join('\n');
  writeFileSync(join(OUT, 'watch-summary.md'), summary + '\n');
  console.log(`\n━━ 요약 ━━\n${notes.join('\n') || '모든 단계를 실행했어요.'}\n\n합친 보고서: qa/.out/watch-summary.md`);
}
