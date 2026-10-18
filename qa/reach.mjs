#!/usr/bin/env node
// qa/reach.mjs — 이 컴퓨터(이 네트워크)에서 감시할 곳들이 실제로 열리는지 확인한다. 읽기만 하고, 보고서는 qa/.out/ 에만 쓴다.
//
//   node qa/reach.mjs                # 암장 공지 주소 전부 + 디시인사이드 갤러리 + 검색 API 주소
//   node qa/reach.mjs --selftest     # 분류 규칙을 가짜 서버로 확인(외부 접속 없음)
//
// 무엇을 알려 주나: 주소마다 열림 / 막힘(403·429) / 접속 실패 / 주소 없음(404) / 내용이 비어 보임(자바스크립트로 그리는 페이지)
// 집(한국 IP)에서 돌려야 의미가 있어요. 해외·데이터센터 IP 에서는 막히는 곳이 많아서 결과가 달라요.
// 요청은 주소당 한 번, 사이에 0.4초를 쉬고, 본문은 처음 200KB 만 읽는다.

import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';
import { loadWalls, stripTags } from './watch-lib.mjs';

const UA = 'Mozilla/5.0 (compatible; haebyeok-reach-check; +https://haebyeok.app)';

export function classify({ status, error, text }) {
  if (error) return /ENOTFOUND|EAI_AGAIN/.test(error) ? ['fail', '주소를 찾지 못함(DNS) — 네트워크가 막았거나 주소가 틀림'] : /abort|timeout|TIMEOUT|ECONNRESET|ECONNREFUSED|UND_ERR/i.test(error) ? ['fail', `접속 실패(${error.slice(0, 40)})`] : ['fail', `오류(${error.slice(0, 40)})`];
  if (status === 404 || status === 410) return ['dead', `주소 없음(${status}) — notice_url 이 바뀌었을 수 있어요`];
  if (status === 401 || status === 403 || status === 429 || status === 451) return ['blocked', `막힘(${status}) — 이 네트워크·IP 에서는 안 열려요`];
  if (status >= 500) return ['fail', `서버 오류(${status})`];
  if (status >= 200 && status < 400) return (text ?? '').length < 200 ? ['empty', `열리지만 글자가 거의 없어요(${(text ?? '').length}자) — 자바스크립트로 그리는 페이지일 수 있어요`] : ['ok', '열림'];
  return ['fail', `상태 ${status}`];
}

async function probe(url, timeoutMs = 15000) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/json;q=0.9,*/*;q=0.8' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
    const reader = r.body?.getReader();
    let got = 0; const chunks = [];
    while (reader && got < 200000) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; }
    try { await reader?.cancel(); } catch { /* 이미 닫힘 */ }
    const body = Buffer.concat(chunks).toString('utf8');
    const text = /json/.test(r.headers.get('content-type') ?? '') ? body : stripTags(body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ''));
    return { url, status: r.status, ms: Date.now() - t0, bytes: got, text, finalUrl: r.url };
  } catch (e) { return { url, error: String(e.cause?.code ?? e.name ?? e.message) + (e.cause?.code ? '' : `:${e.message}`), ms: Date.now() - t0 }; }
}

if (process.argv.includes('--selftest')) {
  const srv = http.createServer((q, s) => {
    if (q.url === '/ok') s.end(`<html><body>${'공지 내용 '.repeat(60)}</body></html>`);
    else if (q.url === '/403') s.writeHead(403).end('no');
    else if (q.url === '/429') s.writeHead(429).end('slow down');
    else if (q.url === '/404') s.writeHead(404).end('nf');
    else if (q.url === '/500') s.writeHead(500).end('err');
    else if (q.url === '/js') s.end('<html><body><div id="root"></div><script>app()</script></body></html>');
    else if (q.url === '/redir') s.writeHead(302, { location: '/ok' }).end();
    else s.writeHead(404).end();
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const want = { '/ok': 'ok', '/403': 'blocked', '/429': 'blocked', '/404': 'dead', '/500': 'fail', '/js': 'empty', '/redir': 'ok' };
  let bad = 0;
  for (const [path, kind] of Object.entries(want)) { const [k] = classify(await probe(base + path)); const ok = k === kind; console.log(`${ok ? '✓' : '✗'} ${path} → ${k}${ok ? '' : ` (기대 ${kind})`}`); if (!ok) bad++; }
  const [k] = classify(await probe('http://no-such-host.invalid/')); const ok = k === 'fail'; console.log(`${ok ? '✓' : '✗'} 없는 호스트 → ${k}`); if (!ok) bad++;
  srv.close();
  console.log(bad ? `\n✗ ${bad}건 실패` : '\n✓ 모두 통과');
  process.exit(bad ? 1 : 0);
}

const walls = loadWalls(ROOT);
const targets = [];
const seen = new Set();
for (const w of walls) {
  const u = w.contact?.notice_url;
  if (u && !seen.has(u)) { seen.add(u); targets.push({ group: '암장 공지', label: w.name, url: u }); }
}
targets.push(
  { group: '커뮤니티', label: '디시인사이드 암벽 갤러리', url: 'https://gall.dcinside.com/mgallery/board/lists/?id=rock_climbing' },
  { group: '커뮤니티', label: '디시인사이드 스포츠클라이밍 갤러리', url: 'https://gall.dcinside.com/mgallery/board/lists/?id=sports_climbing' },
  { group: '커뮤니티', label: '디시인사이드 robots.txt', url: 'https://gall.dcinside.com/robots.txt' },
  { group: '검색 API', label: '네이버 검색 API(키 없이는 401 이 정상 = 도달은 됨)', url: 'https://openapi.naver.com/v1/search/blog.json?query=test', okStatuses: [401, 403] },
  { group: '검색 API', label: '카카오(다음) 검색 API(키 없이는 401 이 정상 = 도달은 됨)', url: 'https://dapi.kakao.com/v2/search/blog?query=test', okStatuses: [401, 403] },
);

console.log(`${targets.length}곳을 확인해요(주소당 한 번, 0.4초 간격)…\n`);
const rows = [];
for (const t of targets) {
  const r = await probe(t.url);
  let [kind, why] = classify(r);
  if (t.okStatuses?.includes(r.status)) [kind, why] = ['ok', `도달함(${r.status}: 키가 필요하다는 응답)`];
  rows.push({ ...t, ...r, kind, why });
  console.log(`${{ ok: '✓', empty: '△', blocked: '✗', dead: '✗', fail: '✗' }[kind]} ${t.label.slice(0, 36).padEnd(36)} ${String(r.status ?? '-').padEnd(4)} ${String(r.ms).padStart(5)}ms  ${why}`);
  await new Promise((ok) => setTimeout(ok, 400));
}
const by = (k) => rows.filter((r) => r.kind === k);
const notices = rows.filter((r) => r.group === '암장 공지');
const L = ['# 도달성 시험 결과', '', `- 시각: ${new Date().toISOString()}`,
  `- 암장 공지 ${notices.length}곳: 열림 ${notices.filter((r) => r.kind === 'ok').length} · 글자 거의 없음 ${notices.filter((r) => r.kind === 'empty').length} · 막힘 ${notices.filter((r) => r.kind === 'blocked').length} · 주소 없음 ${notices.filter((r) => r.kind === 'dead').length} · 접속 실패 ${notices.filter((r) => r.kind === 'fail').length}`, '',
  ...['dead', 'blocked', 'fail', 'empty'].filter((k) => by(k).length).flatMap((k) => [`## ${{ dead: '주소 없음(공지 주소 갱신 필요)', blocked: '막힘', fail: '접속 실패', empty: '자바스크립트로 그리는 것 같음(자동 감지 어려움)' }[k]}`, ...by(k).map((r) => `- ${r.label}: ${r.url} — ${r.why}`), ''])];
mkdirSync(join(ROOT, 'qa', '.out'), { recursive: true });
writeFileSync(join(ROOT, 'qa', '.out', 'reach.md'), L.join('\n') + '\n');
console.log(`\n${L.slice(2, 4).join('\n')}\n보고서: qa/.out/reach.md`);
