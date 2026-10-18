#!/usr/bin/env node
// qa/provenance.mjs — 의심스러운 사이트가 우리 데이터를 베꼈는지 증거를 모은다. 파일을 바꾸지 않고, 보고서는 qa/.out/ 에만 쓴다.
//
//   node qa/provenance.mjs https://의심사이트/data/national.json     # 주소로
//   node qa/provenance.mjs ./받아둔/national.json                    # 받아 둔 파일로
//   node qa/provenance.mjs <위 둘 중 하나> --photos                  # 사진도 (같은 폴더의 photos/ 를 받아 해시 비교)
//   node qa/provenance.mjs data/national.json                        # 자기 자신과 비교(도구가 정상인지 확인용)
//
// 왜 이게 증거가 되나: 암장마다 양달·응달 계산값(shadow.angles, 72개 실수)은 우리가 DEM 으로 직접 계산한 값이라
// 56곳이 전부 서로 다르다. 이 값이 소수점까지 같다면 계산해서 나올 수 없고 복사한 것이다.
// 이름·주소·운영시간은 공개된 사실이라 겹쳐도 증거로는 약하다(참고용).
//
// 이 도구는 증거를 정리할 뿐이고, 저작권 침해 여부를 판단하지 않는다. 신고·소송은 전문가와 상의하세요.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { ROOT } from './lib.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const WITH_PHOTOS = process.argv.includes('--photos');
const target = args[0];
if (!target) { console.log('사용법: node qa/provenance.mjs <의심 사이트의 national.json 주소 또는 파일> [--photos]'); process.exit(2); }

const isUrl = /^https?:\/\//i.test(target);
const get = async (src, binary = false) => {
  if (/^https?:\/\//i.test(src)) {
    const r = await fetch(src, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'haebyeok-provenance-check' } });
    if (!r.ok) throw new Error(`${src} → ${r.status}`);
    return binary ? Buffer.from(await r.arrayBuffer()) : r.text();
  }
  return binary ? readFileSync(src) : readFileSync(src, 'utf8');
};
const sha = (b) => createHash('sha256').update(b).digest('hex');
const wallsOf = (j) => (Array.isArray(j) ? j : j.walls ?? []);

const ours = wallsOf(JSON.parse(readFileSync(join(ROOT, 'data/national.json'), 'utf8')));
let theirs;
try { theirs = wallsOf(JSON.parse(await get(target))); } catch (e) { console.error(`가져오지 못했어요: ${e.message}`); process.exit(2); }
if (!theirs.length) { console.error('암장 목록(walls)을 찾지 못했어요. national.json 이 맞는지 확인하세요.'); process.exit(2); }

// ── 비교 ─────────────────────────────────────────────────────────────────────
const angleKey = (w) => (Array.isArray(w?.shadow?.angles) && w.shadow.angles.length ? JSON.stringify(w.shadow.angles) : null);
const byAngles = new Map(ours.filter(angleKey).map((w) => [angleKey(w), w]));
const norm = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, '').toLowerCase();
const byName = new Map(ours.map((w) => [norm(w.name), w]));
const byAddr = new Map(ours.filter((w) => w.address).map((w) => [norm(w.address), w]));
const nearAngles = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.length > 0 && a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length < 0.05;

const rows = [];
for (const t of theirs) {
  const k = angleKey(t);
  const exact = k ? byAngles.get(k) : null;
  const near = !exact && Array.isArray(t?.shadow?.angles) ? ours.find((o) => nearAngles(o.shadow?.angles, t.shadow.angles)) : null;
  const sameName = byName.get(norm(t.name));
  const sameAddr = t.address ? byAddr.get(norm(t.address)) : null;
  const our = exact ?? near ?? sameName ?? sameAddr;
  if (!our) continue;
  rows.push({
    theirs: t.name, ours: our.name,
    shadowExact: !!exact, shadowNear: !!near,
    renamed: !!(exact ?? near) && norm(t.name) !== norm(our.name),
    sameMemo: !!t.memo && t.memo === our.memo,
    sameHours: !!t.hours && JSON.stringify(t.hours) === JSON.stringify(our.hours),
    sameChecked: !!t.checked_at && t.checked_at === our.checked_at,
    sameParams: !!t.shadow?.params && JSON.stringify(t.shadow.params) === JSON.stringify(our.shadow?.params),
    ourWall: our,
  });
}
const count = (f) => rows.filter(f).length;
const exact = count((r) => r.shadowExact);
const near = count((r) => r.shadowNear);
const renamed = count((r) => r.renamed);
const memo = count((r) => r.sameMemo);
const hours = count((r) => r.sameHours);
const checked = count((r) => r.sameChecked);

// ── 사진(선택) ───────────────────────────────────────────────────────────────
const photoRows = [];
if (WITH_PHOTOS) {
  const base = isUrl ? target.replace(/[^/]*$/, '') : `${dirname(resolve(target))}/`;
  const seen = new Set();
  for (const r of rows) {
    const p = r.ourWall.photo;
    if (!p || seen.has(p)) continue;
    seen.add(p);
    try {
      const mine = sha(readFileSync(join(ROOT, 'data', p)));
      const theirsHash = sha(await get(isUrl ? new URL(p, base).href : join(base, p), true));
      photoRows.push({ photo: p, same: mine === theirsHash });
    } catch { photoRows.push({ photo: p, same: null }); }
  }
}
const photoSame = photoRows.filter((p) => p.same).length;

// ── 판정(말투는 조심스럽게) ──────────────────────────────────────────────────
let verdict;
if (exact >= 3) verdict = '강한 증거: 직접 계산한 양달·응달 값이 여러 곳에서 소수점까지 같아요. 우연일 수 없어서 복사본일 가능성이 매우 높아요.';
else if (exact >= 1) verdict = '의심: 계산값이 같은 암장이 있어요. 더 많은 페이지·사진을 확인해 보세요.';
else if (near >= 3) verdict = '참고: 계산값이 거의 같은 암장이 있어요(반올림·미세 변조 가능성). 정확히 같지는 않아서 증거로는 약해요.';
else if (rows.length >= 10) verdict = '약한 증거: 이름·주소가 많이 겹쳐요. 공개된 사실이라 겹칠 수 있어서, 이것만으로는 베꼈다고 말하기 어려워요.';
else verdict = '겹치는 것이 거의 없어요.';

// ── 출력 + 보고서 ────────────────────────────────────────────────────────────
const firstCommit = (() => { try { return execSync('git log --diff-filter=A --format=%aI -- data/national.json', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n').pop(); } catch { return ''; } })();
const lines = [
  `# 데이터 출처 비교 보고서`,
  ``,
  `- 비교 대상: ${target}`,
  `- 대상의 암장 수: ${theirs.length}곳 / 우리: ${ours.length}곳 (겹치는 암장 ${rows.length}곳)`,
  `- 비교 시각: ${new Date().toISOString()}`,
  firstCommit ? `- 우리 데이터 파일이 저장소에 처음 올라온 때: ${firstCommit} (git 이력)` : '',
  ``,
  `## 결과`,
  `- 계산값(shadow.angles 72개)이 **정확히 같은 암장: ${exact}곳**`,
  `- 계산값이 거의 같은 암장(평균 오차 0.05° 미만): ${near}곳`,
  `- 이름이 바뀐 채 계산값이 같거나 거의 같은 암장: ${renamed}곳`,
  `- 계산 조건(params)까지 같은 암장: ${count((r) => r.sameParams)}곳`,
  `- 메모 문구가 같은 암장: ${memo}곳 · 운영시간이 같은 암장: ${hours}곳 · 확인일이 같은 암장: ${checked}곳`,
  WITH_PHOTOS ? `- 사진 파일이 바이트까지 같은 것: ${photoSame}/${photoRows.length}장` : '',
  ``,
  `## 판단`,
  verdict,
  ``,
  `## 같은 계산값을 가진 암장`,
  ...(rows.filter((r) => r.shadowExact).length ? ['| 우리 이름 | 그쪽 이름 |', '| --- | --- |', ...rows.filter((r) => r.shadowExact).map((r) => `| ${r.ours} | ${r.theirs}${r.renamed ? ' (이름 바뀜)' : ''} |`)] : ['없음']),
  ``,
  `이 보고서는 비교 결과를 정리한 것이며 법적 판단이 아니에요. 신고·소송 전에 한국저작권위원회나 변호사와 상의하세요.`,
].filter((l) => l !== '');
console.log(lines.join('\n'));
const out = join(ROOT, 'qa', '.out');
mkdirSync(out, { recursive: true });
const host = isUrl ? new URL(target).hostname : 'file';
writeFileSync(join(out, `provenance-${host}.md`), lines.join('\n') + '\n');
console.log(`\n보고서: qa/.out/provenance-${host}.md`);
process.exit(exact >= 1 ? 1 : 0); // 1 = 의심 증거 있음
