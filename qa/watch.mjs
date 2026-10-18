#!/usr/bin/env node
// qa/watch.mjs — 커뮤니티 글에서 "운영시간·휴관 변동" 후보를 찾아 준다. 네트워크를 쓰지 않고, 읽기만 한다.
//
//   node qa/watch.mjs dc1.html dc2.html          # 저장한 디시인사이드 목록·글 페이지(HTML)
//   node qa/watch.mjs 오픈채팅.txt                # 카카오톡 "대화 내보내기" 텍스트(본인이 내보낸 것만)
//   node qa/watch.mjs --all 파일…                  # 이미 본 글도 다시 보여 줌(기본은 새 글만)
//   node qa/watch.mjs --selftest                   # 도구가 제대로 동작하는지 가짜 글로 확인(네트워크 없음)
//
// 이 도구가 하는 일: 암장 이름·별칭이 변동 단어(휴관·시간 변경·공사·폐업·재개…)와 한 문장에 같이 나온 글을 후보로 뽑는다.
// 이 도구가 하지 않는 일: 글이 사실인지 판단하지 않는다. 후보는 공지·전화로 확인한 뒤에만 data/national.json 에 반영하세요.
//
// 개인정보: 닉네임·말한 사람은 읽지도 출력하지도 않고, 전화번호·@아이디는 가린다. 글 전문은 저장하지 않고 짧은 발췌와 링크만 남긴다.
// 수집(페이지 저장)은 이 도구가 하지 않는다. 본인이 브라우저로 저장하거나, 사이트의 robots.txt·약관을 확인한 뒤 천천히 받으세요.
// 별칭 보강: qa/watch-aliases.json  {"암장 이름": ["줄임말", "속칭"]}  (줄임말은 높은 신뢰로 취급)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';
import { ROOT } from './lib.mjs';

const OUT = join(ROOT, 'qa', '.out');
const SEEN_FILE = join(OUT, 'watch-seen.json');

// ── 암장 별칭 ────────────────────────────────────────────────────────────────
const squash = (s) => String(s ?? '').normalize('NFC').replace(/[\s·_\-–—()[\]{}'"“”‘’.,!?~]/g, '').toLowerCase();
const TYPE_WORDS = /(?:국제)?(?:인공)?(?:암벽등반장|암벽장|암벽공원|암벽센터|암벽|외벽|스포츠클라이밍(?:경기장|센터|장|파크)?|클라이밍(?:경기장|센터|장|파크)?)$/;
const PLACE_WORDS = /(?:한강공원|생활체육공원|체육공원|유원지|종합운동장|종합스포츠타운|스포츠파크|스포츠타운|월드컵경기장|경기장|스타디움|체육관|공원|광장|호수공원)$/; // '뚝섬한강공원' → '뚝섬'
const CONTEXT = /암장|클라이밍|볼더|인공|외벽|암벽|벽장|센터|등반/; // 지역명 같은 짧은 별칭을 암장으로 읽어도 되는 문맥어

export function buildAliases(walls, extra = {}) {
  const map = new Map(); // squash(별칭) → { alias, conf, walls:Set }
  const add = (alias, wall, conf) => {
    const k = squash(alias);
    if (k.length < 2) return;
    const cur = map.get(k) ?? { alias, conf, walls: new Set() };
    cur.walls.add(wall);
    if (conf === 'high') cur.conf = 'high';
    map.set(k, cur);
  };
  for (const w of walls) {
    add(w.name, w.name, 'high');
    const bases = new Set();
    for (const raw of [w.name, w.short_name]) {
      let b = squash(raw);
      b = b.replace(TYPE_WORDS, '').replace(/시$/, '');
      if (b) bases.add(b);
      bases.add(squash(raw).replace(/시$/, ''));
    }
    for (const b of [...bases]) { const short = b.replace(PLACE_WORDS, ''); if (short.length >= 2) bases.add(short); }
    for (const b of bases) if (b.length >= 2 && b !== squash(w.name)) add(b, w.name, b.length >= 4 ? 'medium' : 'low');
    for (const x of extra[w.name] ?? []) add(x, w.name, 'high');
  }
  return map;
}

// ── 변동 단어 ────────────────────────────────────────────────────────────────
const KINDS = [
  ['휴관·휴무', /임시휴관|휴관|휴무|쉽니다|쉬어요|쉰다|쉬는날|문닫|문을닫|운영중단|운영안|운영하지|운영안함/],
  ['시간 변경', /운영시간|영업시간|이용시간|시간변경|시간이바뀌|시간바뀌|단축|연장운영|조기마감|오픈시간|마감시간|야간/],
  ['공사·점검', /공사|보수|점검|리뉴얼|리모델링|교체|재도색|루트세팅|세팅기간|세팅중/],
  ['폐업·이전', /폐업|폐관|철거|이전|없어졌|없어진|문닫았|영업종료/],
  ['재개·신규', /재개|재오픈|다시열|오픈했|신규오픈|개관|새로오픈|오픈예정/],
];
const kindsOf = (norm) => KINDS.filter(([, re]) => re.test(norm)).map(([k]) => k);

// ── 읽기: 디시인사이드 HTML, 카카오톡 내보내기 텍스트 ───────────────────────────
const stripTags = (h) => h.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();

// 목록·글 페이지에서 글 제목과 링크를 모은다. 구조를 모르는 페이지에도 쓰도록, "글 보기" 링크만 본다.
function readHtml(html, file) {
  const items = [];
  const rows = html.split(/<tr[\s>]/i);
  for (const row of rows.length > 1 ? rows : [html]) {
    for (const m of row.matchAll(/<a\b[^>]*href="([^"]*(?:\/board\/view\/?\?[^"]*no=\d+|\/view\/?\?[^"]*no=\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const title = stripTags(m[2]);
      if (!title || /^\[?\d+\]?$/.test(title)) continue; // 댓글 수 링크
      const href = m[1].replace(/&amp;/g, '&');
      const date = /gall_date[^>]*?(?:title="([^"]+)")?[^>]*>([^<]*)</i.exec(row);
      items.push({ text: title, source: href.startsWith('http') ? href : new URL(href, 'https://gall.dcinside.com').href, date: (date?.[1] || date?.[2] || '').trim(), file });
    }
  }
  return items;
}
// 카카오톡 내보내기: "[닉네임] [오후 3:12] 내용" 또는 "2026년 10월 18일 오후 3:12, 닉네임 : 내용". 말한 사람은 버리고 내용만 쓴다.
const SPEAKER = [/^\[[^\]]*\]\s*\[[^\]]*\]\s*/, /^\d{4}[년.\s]+\d{1,2}[월.\s]+\d{1,2}[일.\s]*(?:오전|오후)?\s*\d{1,2}:\d{2}\s*,\s*[^:]*:\s*/];
function readText(text, file) {
  const items = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    let line = raw.trim();
    if (!line) return;
    for (const re of SPEAKER) line = line.replace(re, '');
    if (line) items.push({ text: line, source: `${file}:${i + 1}`, date: '', file });
  });
  return items;
}

// ── 가리기 + 발췌 ────────────────────────────────────────────────────────────
const redact = (s) => s.replace(/0\d{1,2}-?\d{3,4}-?\d{4}/g, '[전화]').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[메일]').replace(/(^|\s)@[\w.]+/g, '$1[@]');
const snippet = (s, n = 90) => { const r = redact(s); return r.length > n ? `${r.slice(0, n)}…` : r; };

// ── 후보 찾기 ────────────────────────────────────────────────────────────────
export function findCandidates(items, walls, aliases) {
  const wallBy = new Map(walls.map((w) => [w.name, w]));
  const keys = [...aliases.keys()].sort((a, b) => b.length - a.length);
  const out = [];
  for (const it of items) {
    for (const sentence of it.text.split(/(?<=[.!?。…])\s+|\n/)) {
      const norm = squash(sentence);
      const kinds = kindsOf(norm);
      if (!kinds.length) continue;
      const hit = new Map();
      for (const k of keys) {
        if (!norm.includes(k)) continue;
        const a = aliases.get(k);
        // 더 긴 별칭에 포함된 짧은 별칭은 건너뛴다(예: '고양인공암벽장' 안의 '고양')
        if ([...hit.keys()].some((x) => squash(x).includes(k))) continue;
        let conf = a.conf;
        if (conf === 'low' && CONTEXT.test(sentence)) conf = 'medium';
        hit.set(a.alias, { conf, walls: [...a.walls] });
      }
      for (const [alias, h] of hit) out.push({ alias, conf: h.conf, walls: h.walls, kinds, snippet: snippet(sentence), source: it.source, date: it.date, file: it.file });
    }
  }
  return out;
}

const daysSince = (ymd) => (ymd ? Math.floor((Date.now() - new Date(`${ymd}T12:00:00+09:00`)) / 86400000) : null);
const CONF_RANK = { high: 0, medium: 1, low: 2 };

function report(cands, walls) {
  const wallBy = new Map(walls.map((w) => [w.name, w]));
  const rows = cands.map((c) => {
    const names = c.walls;
    const w = wallBy.get(names[0]);
    return { ...c, name: names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}곳(별칭 '${c.alias}' 이 여러 곳)`, region: w?.region ?? '', days: daysSince(w?.checked_at), checked: w?.checked_at ?? '없음', ambiguous: names.length > 1 };
  }).sort((a, b) => CONF_RANK[a.conf] - CONF_RANK[b.conf] || (b.days ?? 9999) - (a.days ?? 9999));
  const L = ['# 운영시간·휴관 변동 후보', '', `후보 ${rows.length}건 (확인 전에는 사실로 취급하지 마세요)`, ''];
  for (const conf of ['high', 'medium', 'low']) {
    const part = rows.filter((r) => r.conf === conf);
    if (!part.length) continue;
    L.push(`## ${{ high: '신뢰 높음(암장 이름이 그대로)', medium: '신뢰 보통(줄임말 + 암장 문맥)', low: '신뢰 낮음(지역명뿐 — 다른 곳일 수 있어요)' }[conf]} (${part.length})`, '');
    for (const r of part) L.push(`- **${r.name}** ${r.region ? `· ${r.region} ` : ''}· 마지막 확인 ${r.checked}${r.days != null ? `(${r.days}일 전)` : ''}`, `  - ${r.kinds.join(' · ')}: “${r.snippet}”`, `  - 출처: ${r.source}${r.date ? ` · ${r.date}` : ''}`);
    L.push('');
  }
  return { rows, text: L.join('\n') };
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
const walls = JSON.parse(readFileSync(join(ROOT, 'data/national.json'), 'utf8')).walls;
const extraFile = join(ROOT, 'qa', 'watch-aliases.json');
const aliases = buildAliases(walls, existsSync(extraFile) ? JSON.parse(readFileSync(extraFile, 'utf8')) : {});

function selftest() {
  const w = (n) => walls.find((x) => x.name === n);
  const A = '뚝섬한강공원 인공암벽'; const B = '익산시스포츠클라이밍장'; const C = '클라임스퀘어 ICN';
  if (![A, B, C].every(w)) { console.log('✗ 시험에 쓸 암장 이름이 데이터에 없어요(데이터가 바뀌었으면 selftest 를 고치세요)'); process.exit(1); }
  const html = `<table><tr class="ub-content"><td class="gall_num">1</td><td class="gall_tit"><a href="/mgallery/board/view/?id=rock_climbing&no=101"><b>${A} 이번주 보수공사로 임시휴관한대요</b></a> <a href="/mgallery/board/view/?id=rock_climbing&no=101&t=cv">[3]</a></td><td class="gall_date" title="2026-10-18 12:00:00">10.18</td></tr>
<tr><td><a href="/mgallery/board/view/?id=rock_climbing&no=102">${B} 운영시간 변경 공지 떴네요</a></td><td class="gall_date" title="2026-10-17 09:00:00">10.17</td></tr>
<tr><td><a href="/mgallery/board/view/?id=rock_climbing&no=107">뚝섬 암장 이번주 보수공사로 임시휴관한대요</a></td></tr>
<tr><td><a href="/mgallery/board/view/?id=rock_climbing&no=103">오늘 클라이밍 갔다왔는데 손 다 갈림</a></td></tr>
<tr><td><a href="/mgallery/board/view/?id=rock_climbing&no=104">강남 맛집 추천해주세요</a></td></tr>
<tr><td><a href="/mgallery/board/view/?id=rock_climbing&no=105">강남에서 휴관한다는데 맞나요?</a></td></tr>
<tr><td><a href="/mgallery/board/view/?id=rock_climbing&no=106">강남 클라이밍 휴관한다는데 맞나요?</a></td></tr></table>`;
  const kakao = `[철수] [오후 3:12] ${C} 다음주 월요일 휴무라네요 문의 010-1234-5678\n2026년 10월 18일 오후 3:13, 영희 : 오늘 날씨 좋다\n[민수] [오후 3:20] 고양인공암벽장 재오픈했어요`;
  const cands = [...findCandidates(readHtml(html, 't.html'), walls, aliases), ...findCandidates(readText(kakao, 'k.txt'), walls, aliases)];
  const has = (name, conf) => cands.some((c) => c.walls.includes(name) && (!conf || c.conf === conf));
  const checks = [
    ['디시 제목에서 이름 + 공사·휴관을 찾음', has(A, 'high') && cands.find((c) => c.walls.includes(A)).kinds.includes('공사·점검')],
    ['시간 변경도 찾음', has(B) && cands.find((c) => c.walls.includes(B)).kinds.includes('시간 변경')],
    ['줄임말(뚝섬) + 암장 문맥도 찾음', cands.some((c) => c.walls.includes(A) && c.alias === '뚝섬' && c.conf === 'medium')],
    ['글 링크를 남김', cands.find((c) => c.walls.includes(A))?.source.endsWith('no=101')],
    ['변동 단어가 없는 글은 무시', !cands.some((c) => /갔다왔는데|맛집|날씨/.test(c.snippet))],
    ['지역명뿐인 별칭(강남)은 신뢰 낮음', cands.some((c) => c.alias === '강남' && c.conf === 'low' && /강남에서/.test(c.snippet))],
    ['지역명 + 암장 문맥이면 신뢰 보통', cands.some((c) => c.alias === '강남' && c.conf === 'medium' && /클라이밍/.test(c.snippet))],
    ['내보내기에서 이름이 있는 줄만 후보', has(C, 'high') && has('고양인공암벽장', 'high')],
    ['말한 사람 닉네임이 출력에 없음', !cands.some((c) => /철수|영희|민수/.test(JSON.stringify(c)))],
    ['전화번호를 가림', !cands.some((c) => /\d{3}-\d{4}-\d{4}/.test(c.snippet)) && cands.some((c) => c.snippet.includes('[전화]'))],
    ['댓글 수 링크([3])는 제목이 아니라 무시', !cands.some((c) => c.snippet === '[3]')],
  ];
  let bad = 0;
  for (const [label, ok] of checks) { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) bad++; }
  console.log(bad ? `\n✗ ${bad}건 실패` : '\n✓ 모두 통과');
  process.exit(bad ? 1 : 0);
}

const argv = process.argv.slice(2);
if (argv.includes('--selftest')) selftest();
const files = argv.filter((a) => !a.startsWith('--'));
if (!files.length) { console.log('사용법: node qa/watch.mjs <저장한 HTML 또는 내보낸 .txt>… [--all]\n        node qa/watch.mjs --selftest'); process.exit(2); }

const items = [];
for (const f of files) {
  if (!existsSync(f)) { console.error(`없는 파일: ${f}`); process.exit(2); }
  const body = readFileSync(f, 'utf8');
  items.push(...(/<\/?(?:html|body|table|tr|a)\b/i.test(body) ? readHtml(body, basename(f)) : readText(body, basename(f))));
}
for (const f of files) if (!items.some((i) => i.file === basename(f))) console.log(`! ${basename(f)}: 읽은 글이 하나도 없어요. 디시인사이드 "글 목록" 페이지를 저장한 게 맞는지, 로그인·차단 안내 페이지가 저장되지 않았는지 확인하세요. (페이지 구조가 달라졌다면 알려 주세요)`);
let cands = findCandidates(items, walls, aliases);
mkdirSync(OUT, { recursive: true });
const seen = new Set(existsSync(SEEN_FILE) ? JSON.parse(readFileSync(SEEN_FILE, 'utf8')) : []);
const id = (c) => createHash('sha1').update(`${c.source}|${c.snippet}`).digest('hex').slice(0, 16);
const fresh = argv.includes('--all') ? cands : cands.filter((c) => !seen.has(id(c)));
const { text } = report(fresh, walls);
console.log(`읽은 글/줄 ${items.length}개 → 변동 후보 ${cands.length}건 (새로운 것 ${fresh.length}건)\n`);
console.log(text);
writeFileSync(join(OUT, 'watch-report.md'), text + '\n');
for (const c of cands) seen.add(id(c));
writeFileSync(SEEN_FILE, JSON.stringify([...seen]));
console.log('보고서: qa/.out/watch-report.md (본 글은 qa/.out/watch-seen.json 에 기억해서 다음에는 새 글만 보여 줘요)');
