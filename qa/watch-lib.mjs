// qa/watch-lib.mjs — 변동 후보를 찾는 공통 함수(별칭 만들기, 변동 단어, 읽기, 가리기, 후보 찾기). qa/watch.mjs · notices.mjs · search-api.mjs 가 같이 쓴다.
// 네트워크를 쓰지 않고, 파일을 바꾸지 않는다.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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

export const daysSince = (ymd) => (ymd ? Math.floor((Date.now() - new Date(`${ymd}T12:00:00+09:00`)) / 86400000) : null);
export const CONF_RANK = { high: 0, medium: 1, low: 2 };
export { squash, stripTags, readHtml, readText, redact, snippet, kindsOf, KINDS };
export function loadWalls(root) { return JSON.parse(readFileSync(join(root, 'data/national.json'), 'utf8')).walls; }
export function loadAliases(root, walls) {
  const extraFile = join(root, 'qa', 'watch-aliases.json');
  return buildAliases(walls, existsSync(extraFile) ? JSON.parse(readFileSync(extraFile, 'utf8')) : {});
}
