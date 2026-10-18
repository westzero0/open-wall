#!/usr/bin/env node
// qa/notices.mjs — 암장 공지 페이지(contact.notice_url)가 지난번과 달라졌는지 확인하고, 달라진 줄에 휴관·시간 변경 단어가 있으면 알린다.
//
//   node qa/notices.mjs             # 켜졌을 때 한 번: 공지 페이지를 읽어 지난번 저장본과 비교
//   node qa/notices.mjs --selftest  # 가짜 서버로 동작 확인(외부 접속 없음)
//   node qa/notices.mjs --reset     # 저장본 지우기(다음 실행이 처음 저장이 됨)
//
// 비교 기준은 "지난번에 본 내용"이라서 컴퓨터를 며칠 꺼 둬도 놓치지 않는다(시간에 맞춰 돌 필요가 없다).
// 첫 실행은 저장만 한다(알림 없음). 두 번째 실행부터 달라진 곳을 알려 준다.
//
// 예의: robots.txt 를 지키고(허용 안 된 곳은 건너뜀), 같은 서버에는 3초 간격, 바뀌지 않았으면 다시 받지 않고(ETag/Last-Modified),
//       403·429 가 나오면 그 서버는 이번 실행에서 포기한다. 로그인·자바스크립트가 필요한 곳(카페·블로그·인스타)은 건드리지 않고 "직접 확인" 목록에 둔다.
// 한계: 공지 "목록" 페이지의 새 글 제목은 잡지만, 글 본문 안의 변경은 못 본다. 후보일 뿐이니 공지 원문과 전화로 확인한 뒤 data 를 고치세요.
// 저장: qa/.out/notices/state.json (줄 단위 텍스트만, git 제외)

import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';
import { loadWalls, squash, stripTags, kindsOf, redact, daysSince } from './watch-lib.mjs';

const DIR = join(ROOT, 'qa', '.out', 'notices');
const STATE = join(DIR, 'state.json');
const UA = 'Mozilla/5.0 (compatible; haebyeok-notice-watch; +https://haebyeok.app)';
const MANUAL_HOSTS = /(^|\.)(cafe\.naver\.com|cafe\.daum\.net|blog\.naver\.com|instagram\.com|open\.kakao\.com|facebook\.com)$/i;
const VOLATILE = /조회\s*\d|조회수|방문자|접속자|오늘\s*\d|누적|현재\s*시각|\bhits?\b|count\s*\d/i;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

// ── 텍스트를 줄 단위로 ───────────────────────────────────────────────────────
export function toLines(html) {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<!--[\s\S]*?-->/gi, ' ')
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6]|table|ul|ol|section|article|br)\s*>|<br\s*\/?>/gi, '\n');
  return stripTags(body.replace(/\n/g, ' \u0001 ')).split('\u0001').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l && !VOLATILE.test(l)).map((l) => (l.length > 200 ? l.slice(0, 200) : l)).slice(0, 400);
}
export function diffLines(oldLines, newLines) {
  const o = new Set(oldLines); const n = new Set(newLines);
  return { added: newLines.filter((l) => !o.has(l)), removed: oldLines.filter((l) => !n.has(l)) };
}

// ── robots.txt ───────────────────────────────────────────────────────────────
export function robotsAllows(txt, path) {
  let applies = false; const rules = [];
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) { if (!line) applies = applies; continue; }
    const k = m[1].toLowerCase(); const v = m[2].trim();
    if (k === 'user-agent') applies = v === '*' || /haebyeok/i.test(v);
    else if (applies && (k === 'disallow' || k === 'allow') && v) rules.push([k, v]);
  }
  let best = null;
  for (const [k, v] of rules) if (path.startsWith(v.replace(/\*.*$/, '')) && (!best || v.length >= best[1].length)) best = [k, v];
  return !best || best[0] === 'allow';
}

// ── 한 번 돌기 ───────────────────────────────────────────────────────────────
export async function runNotices({ targets, state, delayMs = 3000, timeoutMs = 20000 }) {
  const results = [];
  const robots = new Map(); const dead = new Set(); const lastHit = new Map();
  for (const t of targets) {
    const u = new URL(t.url);
    const res = { ...t, kind: 'same', added: [], removed: [] };
    results.push(res);
    if (MANUAL_HOSTS.test(u.hostname)) { res.kind = 'manual'; continue; }
    if (dead.has(u.host)) { res.kind = 'skipped'; res.note = '이 서버가 막아서 이번에는 건너뜀'; continue; }
    const wait = (lastHit.get(u.host) ?? 0) + delayMs - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      if (!robots.has(u.host)) {
        let txt = '';
        try { const r = await fetch(`${u.origin}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(timeoutMs) }); txt = r.ok ? await r.text() : ''; lastHit.set(u.host, Date.now()); } catch { /* robots 를 못 받으면 페이지 쪽 결과로 판단 */ }
        robots.set(u.host, txt);
      }
      if (!robotsAllows(robots.get(u.host), u.pathname + u.search)) { res.kind = 'robots'; continue; }
      const prev = state[t.url];
      const headers = { 'user-agent': UA, accept: 'text/html,*/*;q=0.8' };
      if (prev?.etag) headers['if-none-match'] = prev.etag;
      if (prev?.lastModified) headers['if-modified-since'] = prev.lastModified;
      const r = await fetch(t.url, { headers, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
      lastHit.set(u.host, Date.now());
      if (r.status === 304) { res.kind = 'same'; if (prev) prev.checkedAt = new Date().toISOString(); continue; }
      if ([401, 403, 429, 451].includes(r.status)) { res.kind = 'blocked'; res.note = `막힘(${r.status})`; dead.add(u.host); continue; }
      if (r.status === 404 || r.status === 410) { res.kind = 'gone'; res.note = `주소 없음(${r.status})`; continue; }
      if (!r.ok) { res.kind = 'fail'; res.note = `상태 ${r.status}`; continue; }
      const lines = toLines(await r.text());
      if (lines.join('').length < 150) { res.kind = 'js'; res.note = '글자가 거의 없어요(자바스크립트로 그리는 페이지일 수 있음)'; continue; }
      const meta = { etag: r.headers.get('etag') ?? undefined, lastModified: r.headers.get('last-modified') ?? undefined };
      if (!prev) { res.kind = 'first'; state[t.url] = { walls: t.walls, lines, ...meta, checkedAt: new Date().toISOString() }; continue; }
      const { added, removed } = diffLines(prev.lines, lines);
      state[t.url] = { walls: t.walls, lines, ...meta, checkedAt: new Date().toISOString(), changedAt: added.length || removed.length ? new Date().toISOString() : prev.changedAt };
      if (added.length || removed.length) { res.kind = 'changed'; res.added = added; res.removed = removed; res.hits = added.filter((l) => kindsOf(squash(l)).length).map((l) => ({ line: redact(l.length > 120 ? `${l.slice(0, 120)}…` : l), kinds: kindsOf(squash(l)) })); }
    } catch (e) { res.kind = 'fail'; res.note = `접속 실패(${String(e.cause?.code ?? e.name)})`; }
  }
  return results;
}

export function renderReport(results, walls) {
  const by = (k) => results.filter((r) => r.kind === k);
  const checked = (r) => { const w = walls.find((x) => x.name === r.walls[0]); return w?.checked_at ? `마지막 확인 ${w.checked_at}(${daysSince(w.checked_at)}일 전)` : '확인일 없음'; };
  const L = ['# 암장 공지 변경 확인', '', `- 대상 ${results.length}곳 · 변동 ${by('changed').length} · 처음 저장 ${by('first').length} · 변화 없음 ${by('same').length} · 막힘 ${by('blocked').length + by('robots').length + by('skipped').length} · 직접 확인 ${by('manual').length} · 글자 거의 없음 ${by('js').length} · 주소 없음 ${by('gone').length} · 실패 ${by('fail').length}`, ''];
  const changed = by('changed').sort((a, b) => b.hits.length - a.hits.length);
  if (changed.length) {
    L.push('## 달라진 공지 (후보 — 원문을 확인하세요)', '');
    for (const r of changed) {
      L.push(`- **${r.walls.join(' · ')}** — ${checked(r)}${r.hits.length ? ' · ⚠ 휴관·시간·공사 단어가 있어요' : ''}`, `  - ${r.url}`);
      for (const h of r.hits.slice(0, 5)) L.push(`  - ⚠ [${h.kinds.join('·')}] “${h.line}”`);
      for (const a of r.added.filter((l) => !r.hits.some((h) => h.line.startsWith(redact(l).slice(0, 40)))).slice(0, 4)) L.push(`  - + ${redact(a.length > 100 ? `${a.slice(0, 100)}…` : a)}`);
      if (r.removed.length) L.push(`  - (사라진 줄 ${r.removed.length}개)`);
    }
    L.push('');
  }
  if (by('first').length) L.push(`## 처음 저장 ${by('first').length}곳 — 다음 실행부터 비교해요`, '');
  for (const [k, title] of [['manual', '직접 확인(로그인·자바스크립트가 필요해 건드리지 않음)'], ['js', '글자가 거의 없음(자바스크립트로 그리는 페이지 — 자동 감지 어려움)'], ['gone', '주소 없음(notice_url 갱신 필요)'], ['blocked', '막힘'], ['robots', 'robots.txt 가 허용하지 않아 건너뜀'], ['fail', '접속 실패']]) {
    if (by(k).length) L.push(`## ${title} ${by(k).length}곳`, '', ...by(k).map((r) => `- ${r.walls.join(' · ')}: ${r.url}${r.note ? ` — ${r.note}` : ''}`), '');
  }
  return L.join('\n');
}

export function loadState() { return existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {}; }
export function saveState(state) { mkdirSync(DIR, { recursive: true }); writeFileSync(STATE, JSON.stringify(state)); }
export function noticeTargets(walls) {
  const m = new Map();
  for (const w of walls) { const u = w.contact?.notice_url; if (u) m.set(u, [...(m.get(u) ?? []), w.name]); }
  return [...m].map(([url, names]) => ({ url, walls: names }));
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
async function selftest() {
  let version = 1; let hits = 0; let blockedHits = 0;
  const srv = http.createServer((q, s) => {
    if (q.url === '/robots.txt') return s.end('User-agent: *\nDisallow: /private\n');
    if (q.url === '/private/n') return s.end('x');
    if (q.url === '/n1') { hits++; if (q.headers['if-none-match'] === 'v' + version) return s.writeHead(304).end(); s.writeHead(200, { etag: 'v' + version, 'content-type': 'text/html' });
      return s.end(`<html><body><h1>시설 공지</h1><ul><li>이용 안내 ${'가나다라마바사 '.repeat(20)}</li><li>조회수 ${version * 7}</li>${version >= 2 ? '<li>11월 3일 보수공사로 임시휴관합니다</li><li>이용료 안내</li>' : ''}</ul></body></html>`); }
    if (q.url === '/n2') return s.end(`<html><body>${'안내 문구입니다 '.repeat(30)}</body></html>`);
    if (q.url === '/js') return s.end('<html><body><div id="app"></div><script>x()</script></body></html>');
    if (q.url === '/blocked') { blockedHits++; return s.writeHead(403).end('no'); }
    if (q.url === '/blocked2') { blockedHits++; return s.writeHead(403).end('no'); }
    if (q.url === '/gone') return s.writeHead(404).end('nf');
    s.writeHead(404).end();
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const b = `http://127.0.0.1:${srv.address().port}`;
  const targets = [{ url: `${b}/n1`, walls: ['A'] }, { url: `${b}/n2`, walls: ['B'] }, { url: `${b}/js`, walls: ['C'] }, { url: `${b}/private/n`, walls: ['D'] }, { url: `${b}/gone`, walls: ['E'] }, { url: 'https://cafe.naver.com/x', walls: ['F'] }];
  const state = {};
  const r1 = await runNotices({ targets, state, delayMs: 0 });
  version = 2;
  const r2 = await runNotices({ targets, state, delayMs: 0 });
  const r2b = await runNotices({ targets, state, delayMs: 0 }); // 같은 내용 → 변화 없음(304)
  const k = (r, u) => r.find((x) => x.url.endsWith(u))?.kind;
  // 같은 서버가 403 이면 나머지는 건너뛴다
  const r3 = await runNotices({ targets: [{ url: `${b}/blocked`, walls: ['G'] }, { url: `${b}/blocked2`, walls: ['H'] }], state: {}, delayMs: 0 });
  const changed = r2.find((x) => x.url.endsWith('/n1'));
  const checks = [
    ['첫 실행은 저장만 한다(알림 없음)', k(r1, '/n1') === 'first' && k(r1, '/n2') === 'first'],
    ['robots.txt 가 막은 곳은 건너뜀', k(r1, '/private/n') === 'robots'],
    ['자바스크립트 페이지는 알려 줌', k(r1, '/js') === 'js'],
    ['404 는 주소 없음', k(r1, '/gone') === 'gone'],
    ['카페·블로그는 직접 확인으로 분류(접속하지 않음)', k(r1, 'cafe.naver.com/x') === 'manual' || k(r1, '/x') === 'manual'],
    ['두 번째 실행에서 바뀐 공지를 찾음', k(r2, '/n1') === 'changed' && changed?.added?.length === 2],
    ['조회수 숫자만 바뀐 건 변동으로 치지 않음', !(changed?.added ?? []).some((l) => /조회수/.test(l))],
    ['휴관·공사 줄을 ⚠ 로 표시', changed?.hits?.length === 1 && changed.hits[0].kinds.includes('공사·점검') && changed.hits[0].kinds.includes('휴관·휴무')],
    ['바뀐 게 없으면 변화 없음', k(r2, '/n2') === 'same' && k(r2b, '/n1') === 'same'],
    ['한 서버가 403 이면 같은 서버의 나머지는 건너뜀', r3[0].kind === 'blocked' && r3[1].kind === 'skipped' && blockedHits === 1],
    ['robots.txt 규칙 해석', robotsAllows('User-agent: *\nDisallow: /a\nAllow: /a/ok', '/a/ok') && !robotsAllows('User-agent: *\nDisallow: /a', '/a/x') && robotsAllows('', '/x')],
    ['보고서에 달라진 공지가 나옴', /휴관·시간·공사 단어/.test(renderReport(r2, [{ name: 'A', checked_at: '2026-01-01' }]))],
  ];
  srv.close();
  let bad = 0;
  for (const [label, ok] of checks) { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) bad++; }
  console.log(bad ? `\n✗ ${bad}건 실패` : '\n✓ 모두 통과');
  process.exit(bad ? 1 : 0);
}

if (process.argv.includes('--selftest')) await selftest();
if (process.argv.includes('--reset')) { rmSync(DIR, { recursive: true, force: true }); console.log('저장본을 지웠어요.'); process.exit(0); }
if (import.meta.url === `file://${process.argv[1]}`) {
  const walls = loadWalls(ROOT);
  const targets = noticeTargets(walls);
  const state = loadState();
  console.log(`공지 ${targets.length}곳을 확인해요(같은 서버에는 3초 간격이라 몇 분 걸려요)…\n`);
  const results = await runNotices({ targets, state });
  saveState(state);
  const text = renderReport(results, walls);
  console.log(text);
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(ROOT, 'qa', '.out', 'notices-report.md'), text + '\n');
  console.log('\n보고서: qa/.out/notices-report.md');
  // 하나도 닿지 못했으면(네트워크가 아직 안 붙었거나 전부 막힘) 실패로 끝낸다 → 실행기가 "했다"고 기록하지 않고 다음에 다시 돈다
  const reached = results.filter((r) => ['same', 'first', 'changed', 'js', 'gone', 'robots', 'blocked'].includes(r.kind)).length;
  if (!reached && results.some((r) => r.kind === 'fail')) { console.log('! 접속된 곳이 하나도 없어요(인터넷이 아직 안 붙었거나 이 네트워크가 막혀 있어요). 나중에 다시 실행하세요.'); process.exitCode = 3; }
}
