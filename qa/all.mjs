#!/usr/bin/env node
// qa/all.mjs — 배포 전에 한 번에: 무결성 → 스모크 → 접근성. 시각 회귀(visual.mjs)는 "고치기 전" 스냅샷이 필요해서 따로 돌려요.
//   node qa/all.mjs           # 전부
//   node qa/all.mjs --quick   # 무결성만(1초, Playwright 불필요)
// Playwright · axe-core 가 없으면 그 검사는 건너뛰고 알려 준다(실패로 치지 않음). 하나라도 ✗ 면 종료 코드 1.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireOptional } from './lib.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const quick = process.argv.includes('--quick');
const STEPS = [
  { name: '무결성', file: 'check-integrity.mjs', needs: [] },
  { name: '스모크(오프라인·성능 예산·망가진 저장소)', file: 'smoke.mjs', needs: ['playwright'] },
  { name: '접근성(axe-core)', file: 'a11y.mjs', needs: ['playwright', 'axe-core'] },
  { name: '변동 감시 도구 자가 테스트', file: 'watch.mjs', args: ['--selftest'], needs: [] },
];
const results = [];
for (const s of STEPS) {
  const missing = s.needs.filter((n) => !requireOptional(n));
  if (quick && s.needs.length) { results.push([s.name, 'skip', '--quick']); continue; }
  if (missing.length) { results.push([s.name, 'skip', `${missing.join(', ')} 없음`]); continue; }
  console.log(`\n━━ ${s.name} ━━`);
  const r = spawnSync(process.execPath, [join(dir, s.file), ...(s.args ?? [])], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
  process.stdout.write(r.stdout.split('\n').filter((l) => !/agent-proxy|connect_rejected|^For details|^- /.test(l)).join('\n'));
  results.push([s.name, r.status === 0 ? 'ok' : 'fail', '']);
}
console.log('\n━━ 요약 ━━');
for (const [n, st, why] of results) console.log(`${st === 'ok' ? '✓' : st === 'fail' ? '✗' : '–'} ${n}${st === 'skip' ? ` (건너뜀: ${why})` : ''}`);
process.exit(results.some(([, st]) => st === 'fail') ? 1 : 0);
