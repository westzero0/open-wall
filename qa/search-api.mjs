#!/usr/bin/env node
// qa/search-api.mjs — 네이버·카카오(다음)의 공식 검색 API 로 "암장 이름 + 휴관·운영시간" 글을 찾아 변동 후보로 정리한다.
//
//   node qa/search-api.mjs                 # 켜졌을 때 한 번: 새로 나온 글만 보여 줌
//   node qa/search-api.mjs --all           # 이미 본 글도 다시
//   node qa/search-api.mjs --days 30       # 날짜가 있는 글은 최근 N일만(기본 90)
//   node qa/search-api.mjs --walls 뚝섬,익산   # 이름에 이 글자가 든 암장만(시험할 때)
//   node qa/search-api.mjs --selftest      # 가짜 서버로 동작 확인(키·외부 접속 없음)
//
// 키는 각자 발급받아 환경 변수로만 넣으세요(이 저장소·대화에 적지 마세요). 없는 서비스는 건너뜁니다.
//   NAVER_CLIENT_ID, NAVER_CLIENT_SECRET   (네이버 개발자센터 → 검색 API: 블로그 · 카페글)
//   KAKAO_REST_API_KEY                     (카카오 디벨로퍼스 → 다음 검색: 블로그 · 카페)
// 공식 API 라서 크롤링이 아니지만 일일 한도가 있어요(네이버 검색 API 는 문서상 하루 25,000회). 한 번 돌 때 암장당 2개 질문 × 4곳 = 약 500회예요.
// 응답 형식은 각 서비스 공식 문서를 따랐지만 이 환경에서는 실제 서버로 확인하지 못했어요. 첫 실행에서 오류가 나면 알려 주세요.
// 결과는 제목·요약·링크뿐이라 본문은 못 봐요. 후보일 뿐이니 링크를 열어 확인한 뒤 data 를 고치세요.

import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';
import { loadWalls, loadAliases, findCandidates, stripTags, renderCandidates } from './watch-lib.mjs';

const OUT = join(ROOT, 'qa', '.out');
const SEEN = join(OUT, 'search-seen.json');
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const clean = (s) => stripTags(String(s ?? '')).replace(/&[a-z]+;/g, ' ');
const ymd = (s) => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : String(s ?? '').slice(0, 10));

// 서비스별 요청·응답 모양 (공식 문서 기준)
export function providers(env, bases) {
  const naver = env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET ? { 'X-Naver-Client-Id': env.NAVER_CLIENT_ID, 'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET } : null;
  const kakao = env.KAKAO_REST_API_KEY ? { Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}` } : null;
  const nv = (kind, label) => ({ id: `naver-${kind}`, label, headers: naver, need: 'NAVER_CLIENT_ID, NAVER_CLIENT_SECRET',
    url: (q) => `${bases.naver}/v1/search/${kind}.json?query=${encodeURIComponent(q)}&display=20&sort=date`,
    items: (j) => (j.items ?? []).map((i) => ({ text: `${clean(i.title)}. ${clean(i.description)}`, link: i.link, date: ymd(i.postdate), where: clean(i.bloggername ?? i.cafename ?? '') })) });
  const kk = (kind, label) => ({ id: `kakao-${kind}`, label, headers: kakao, need: 'KAKAO_REST_API_KEY',
    url: (q) => `${bases.kakao}/v2/search/${kind}?query=${encodeURIComponent(q)}&sort=recency&size=20`,
    items: (j) => (j.documents ?? []).map((i) => ({ text: `${clean(i.title)}. ${clean(i.contents)}`, link: i.url, date: ymd(i.datetime), where: clean(i.blogname ?? i.cafename ?? '') })) });
  return [nv('blog', '네이버 블로그'), nv('cafearticle', '네이버 카페글'), kk('blog', '다음 블로그'), kk('cafe', '다음 카페')];
}

export async function searchAll({ walls, aliases, env, bases, days = 90, pace = 150, only = [], now = Date.now() }) {
  const provs = providers(env, bases);
  const missing = provs.filter((p) => !p.headers);
  const active = provs.filter((p) => p.headers);
  const errors = []; const cands = []; let calls = 0; let okCalls = 0;
  const targets = walls.filter((w) => !only.length || only.some((o) => w.name.includes(o)));
  for (const p of active) {
    let stop = false;
    for (const w of targets) {
      if (stop) break;
      for (const kw of ['휴관', '운영시간']) {
        const q = `${w.name} ${kw}`;
        try {
          const r = await fetch(p.url(q), { headers: p.headers, signal: AbortSignal.timeout(15000) });
          calls++;
          if (r.status === 401 || r.status === 403) { errors.push(`${p.label}: 키가 틀렸거나 권한이 없어요(${r.status}) — 이 서비스는 건너뜀`); stop = true; break; }
          if (r.status === 429) { errors.push(`${p.label}: 호출 한도에 걸렸어요(429) — 이 서비스는 여기서 멈춤`); stop = true; break; }
          if (!r.ok) { errors.push(`${p.label}: ${q} → 상태 ${r.status}`); continue; }
          okCalls++;
          const items = p.items(await r.json()).filter((i) => i.link && i.text);
          const fresh = items.filter((i) => !/^\d{4}-\d{2}-\d{2}$/.test(i.date) || (now - new Date(`${i.date}T12:00:00+09:00`)) / 86400000 <= days);
          for (const c of findCandidates(fresh.map((i) => ({ text: i.text, source: i.link, date: i.date, file: p.label })), [w], aliases)) cands.push({ ...c, walls: [w.name], via: `${p.label}${items.find((i) => i.link === c.source)?.where ? ` · ${items.find((i) => i.link === c.source).where}` : ''}` });
        } catch (e) { errors.push(`${p.label}: ${q} → 접속 실패(${String(e.cause?.code ?? e.name)})`); if (/ENOTFOUND|ECONNREFUSED/.test(String(e.cause?.code))) { stop = true; break; } }
        await sleep(pace);
      }
    }
  }
  // 같은 글(링크)이 여러 질문에서 나오면 하나로
  const uniq = new Map();
  for (const c of cands) uniq.set(`${c.source}|${c.walls[0]}`, c);
  return { candidates: [...uniq.values()], errors: [...new Set(errors)], calls, okCalls, activeCount: active.length, missing: missing.map((m) => `${m.label}(${m.need})`) };
}

async function selftest() {
  const log = [];
  const srv = http.createServer((q, s) => {
    const u = new URL(q.url, 'http://x'); const query = u.searchParams.get('query') ?? '';
    log.push({ path: u.pathname, query, naver: q.headers['x-naver-client-id'], secret: q.headers['x-naver-client-secret'], kakao: q.headers.authorization });
    const send = (o) => { s.writeHead(200, { 'content-type': 'application/json' }); s.end(JSON.stringify(o)); };
    const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
    if (u.pathname === '/v1/search/blog.json') return send({ items: [
      { title: '<b>익산시스포츠클라이밍장</b> 11월 운영시간 변경', link: 'https://blog.example/1', description: '다음 달부터 <b>운영시간</b>이 바뀐다고 하네요', bloggername: '클라이머A', postdate: day(3) },
      { title: '<b>익산시스포츠클라이밍장</b> 임시휴관 소식', link: 'https://blog.example/old', description: '옛날 글', bloggername: '클라이머B', postdate: day(400) },
      { title: '오늘의 등반 일지', link: 'https://blog.example/3', description: '재밌었다', bloggername: '클라이머C', postdate: day(1) }] });
    if (u.pathname === '/v1/search/cafearticle.json') return send({ items: [{ title: '익산시스포츠클라이밍장 보수공사로 휴관', link: 'https://cafe.example/9', description: '공사 기간 안내', cafename: '클라이밍카페' }] });
    if (u.pathname === '/v2/search/cafe') { if (q.headers.authorization !== 'KakaoAK kk') { s.writeHead(401); return s.end('{}'); } return send({ documents: [{ title: '익산시스포츠클라이밍장 휴관일 정리', contents: '정기 휴관일 안내', url: 'https://daum.example/c1', cafename: '다음카페', datetime: new Date().toISOString() }] }); }
    if (u.pathname === '/v2/search/blog') { s.writeHead(429); return s.end('{}'); }
    s.writeHead(404).end();
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const b = `http://127.0.0.1:${srv.address().port}`;
  const walls = loadWalls(ROOT); const aliases = loadAliases(ROOT, walls);
  const run = (env, extra = {}) => searchAll({ walls, aliases, env, bases: { naver: b, kakao: b }, pace: 0, only: ['익산'], ...extra });
  const full = await run({ NAVER_CLIENT_ID: 'id', NAVER_CLIENT_SECRET: 'sec', KAKAO_REST_API_KEY: 'kk' });
  const noKeys = await run({});
  const badKakao = await run({ KAKAO_REST_API_KEY: 'wrong' });
  const links = full.candidates.map((c) => c.source);
  const checks = [
    ['키가 없으면 해당 서비스를 건너뛰고 알려 줌', noKeys.calls === 0 && noKeys.missing.length === 4],
    ['네이버 요청에 키 헤더를 보냄', log.some((l) => l.naver === 'id' && l.secret === 'sec')],
    ['카카오 요청에 KakaoAK 헤더를 보냄', log.some((l) => l.kakao === 'KakaoAK kk')],
    ['암장 이름 + 휴관/운영시간으로 검색함', log.some((l) => l.query === '익산시스포츠클라이밍장 휴관') && log.some((l) => l.query === '익산시스포츠클라이밍장 운영시간')],
    ['네이버 블로그 글에서 후보를 찾음(<b> 태그 제거)', links.includes('https://blog.example/1') && !full.candidates.some((c) => /<b>/.test(c.snippet))],
    ['네이버 카페글에서 후보를 찾음', links.includes('https://cafe.example/9')],
    ['다음 카페에서 후보를 찾음', links.includes('https://daum.example/c1')],
    ['90일보다 오래된 글은 뺌', !links.includes('https://blog.example/old')],
    ['변동 단어가 없는 글은 뺌', !links.includes('https://blog.example/3')],
    ['429 는 그 서비스만 멈추고 알려 줌', full.errors.some((e) => /다음 블로그.*429/.test(e))],
    ['401 은 키 문제로 알려 줌', badKakao.errors.some((e) => /키가 틀렸/.test(e))],
    ['같은 글이 여러 질문에 나와도 한 번만', links.filter((l) => l === 'https://blog.example/1').length === 1],
    ['보고서에 서비스 이름이 함께 나옴', /익산시스포츠클라이밍장/.test(renderCandidates(full.candidates, walls).text)],
  ];
  srv.close();
  let bad = 0;
  for (const [label, ok] of checks) { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) bad++; }
  console.log(bad ? `\n✗ ${bad}건 실패` : '\n✓ 모두 통과');
  process.exit(bad ? 1 : 0);
}

if (process.argv.includes('--selftest')) await selftest();
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
  const walls = loadWalls(ROOT); const aliases = loadAliases(ROOT, walls);
  const only = (flag('walls', '') ?? '').split(',').filter(Boolean);
  const res = await searchAll({ walls, aliases, env: process.env, bases: { naver: process.env.WATCH_NAVER_BASE ?? 'https://openapi.naver.com', kakao: process.env.WATCH_KAKAO_BASE ?? 'https://dapi.kakao.com' }, days: Number(flag('days', 90)), only });
  if (res.missing.length) console.log(`키가 없어 건너뜀: ${res.missing.join(', ')}\n`);
  mkdirSync(OUT, { recursive: true });
  const seen = new Set(existsSync(SEEN) ? JSON.parse(readFileSync(SEEN, 'utf8')) : []);
  const id = (c) => createHash('sha1').update(`${c.source}|${c.walls[0]}`).digest('hex').slice(0, 16);
  const fresh = argv.includes('--all') ? res.candidates : res.candidates.filter((c) => !seen.has(id(c)));
  console.log(`요청 ${res.calls}번 → 후보 ${res.candidates.length}건 (새로운 것 ${fresh.length}건)\n`);
  const { text } = renderCandidates(fresh.map((c) => ({ ...c, source: `${c.source}  (${c.via})` })), walls);
  console.log(text);
  for (const e of res.errors) console.log(`! ${e}`);
  writeFileSync(join(OUT, 'search-report.md'), text + '\n');
  if (res.okCalls > 0) { for (const c of res.candidates) seen.add(id(c)); writeFileSync(SEEN, JSON.stringify([...seen])); }
  if (res.activeCount && !res.okCalls) { console.log('! 성공한 검색이 하나도 없어요(인터넷이 아직 안 붙었거나 키·한도 문제). 나중에 다시 실행하세요.'); process.exitCode = 3; }
}
