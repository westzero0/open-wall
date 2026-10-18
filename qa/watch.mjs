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
import { buildAliases, findCandidates, readHtml, readText, daysSince, CONF_RANK, loadWalls, loadAliases, renderCandidates, candidateId } from './watch-lib.mjs';

const OUT = join(ROOT, 'qa', '.out');
const SEEN_FILE = join(OUT, 'watch-seen.json');


// ── 실행 ─────────────────────────────────────────────────────────────────────
const walls = loadWalls(ROOT);
const aliases = loadAliases(ROOT, walls);

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
    ['같은 대화를 다시 내보내도(파일 이름·줄 번호가 달라도) 이미 본 글로 취급', candidateId({ source: 'export-1018.txt:2', snippet: '같은 문장' }) === candidateId({ source: 'export-1025.txt:3', snippet: '같은 문장' })],
    ['웹 글은 링크가 다르면 다른 글', candidateId({ source: 'https://x/1', snippet: '같은 문장' }) !== candidateId({ source: 'https://x/2', snippet: '같은 문장' })],
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
const id = candidateId;
const fresh = argv.includes('--all') ? cands : cands.filter((c) => !seen.has(id(c)));
const { text } = renderCandidates(fresh, walls);
console.log(`읽은 글/줄 ${items.length}개 → 변동 후보 ${cands.length}건 (새로운 것 ${fresh.length}건)\n`);
console.log(text);
writeFileSync(join(OUT, 'watch-report.md'), text + '\n');
for (const c of cands) seen.add(id(c));
writeFileSync(SEEN_FILE, JSON.stringify([...seen]));
console.log('보고서: qa/.out/watch-report.md (본 글은 qa/.out/watch-seen.json 에 기억해서 다음에는 새 글만 보여 줘요)');
