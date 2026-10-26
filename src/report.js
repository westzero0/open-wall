// "정보 수정 요청" report: pure payload + validation. The sink is a published Google Form (see config.js).
export const KINDS = ['운영시간', '임시휴무', '주차', '세팅일', '루트 분포', '기타']; // 세팅일 and 루트 분포 must also be choices of the form's 종류 question (docs/system/variables.md)
export const MAX_BODY = 2000;
export const MAX_NOTE = 300;
export const COOLDOWN_MS = 10_000;
const ENTRY = { name: 'entry.188461628', kind: 'entry.803930553', body: 'entry.2089578077', note: 'entry.750589902' };

import { CHAT_URL_RE, MAX_ROUTE_WALLS, MAX_ROUTE_WALL_NAME } from './store.js';
import { cleanNote } from './invite.js';
import { ymd } from './time.js';
import { routeLine } from './grades.js';

// 닉네임: the name a report is counted under (event ranking). cleanNote already drops markup, links, e-mails, phone-like
// numbers and direction marks; the nickname is then cut at MAX_NICK code points. Typed text and a value read back from
// localStorage take the same path, so a tampered saved nickname is cleaned like fresh input.
export const MAX_NICK = 6;
export const cleanNick = (v) => [...cleanNote(v)].slice(0, MAX_NICK).join('').trim();
export const loadNick = cleanNick;
export const NICK_KEY = 'open-wall:nick'; // shared by the report sheet and 내 정보
// While the ranking runs (mode 'required') a saved nickname can't be changed: the ranking counts by the name's letters, so a new
// name would split the old reports off. Client-side only (no server): clearing the browser's data gets around it.
export const nickLocked = (mode, saved) => mode === 'required' && !!saved;
/**
 * nickCommit(mode, saved, typed) → { nick, save, confirm }: the nickname a send goes out under, and whether sending also saves it.
 * required (ranking running): a saved nickname always wins and is never rewritten; a first typed one is saved, but only after
 * `confirm` (the sheet asks once: it cannot be changed afterwards). optional: what is typed, saved when not empty. off: none.
 */
export function nickCommit(mode, saved, typed) {
  if (mode === 'off') return { nick: '', save: false, confirm: false };
  const have = loadNick(saved);
  if (mode === 'required' && have) return { nick: have, save: false, confirm: false };
  const nick = cleanNick(typed);
  return { nick, save: !!nick, confirm: mode === 'required' && !!nick };
}
export const nickConfirmText = (nick) => `‘${nick}’ 닉네임은 이벤트 중에는 바꿀 수 없어요. 괜찮으면 한 번 더 눌러 주세요.`;
// 'off' without an entry id (no field, nothing sent); 'optional' once the event is over (nickRequired: false); else 'required'.
export const nickMode = (cfg = {}) => (!cfg.reportNickEntry ? 'off' : cfg.nickRequired === false ? 'optional' : 'required');

// 벽 이름 of a 루트 분포 section: the markup/link/phone cleaning of a note, no brackets (the line is `루트[이름]: …`), cut at the stored name's length.
export const cleanSectionName = (v) => [...cleanNote(v).replace(/[[\]]/g, '')].slice(0, MAX_ROUTE_WALL_NAME).join('').trim();

export const PARKING = ['무료', '유료', '주차 불가', '모름'];
// A choice in the sheet, not a kind of the Google Form (whose options are fixed): it goes out as 기타 with the link on the first line.
// 시설 and 요금 are tabs of the sheet only: the form still gets 기타, with the topic as the first line
export const TOPIC_KINDS = ['시설', '요금'];
export const CHAT_KIND = '오픈채팅방';
// 공지 제보: a choice in the sheet, not a Google Form kind: it goes out as 기타 with the header on the first line. Operator-only: nothing of it is shown in the app.
export const NOTICE_KIND = '공지';
const NOTICE_HEAD = '[공지 제보]';
// 인스타그램 링크: only a post (/p, /reel, /tv) or a profile address; the link is never opened by the app.
export const INSTA_RE = /^https:\/\/(www\.)?instagram\.com\/((p|reel|tv)\/[\w-]{5,40}|(?!(p|reel|reels|tv|explore|accounts|stories|direct)\/?(\?|$))[\w.]{1,30})\/?(\?[\w=&%.-]{0,100})?$/;
// 암장 사진 is a choice in the sheet but not a Google Form kind: the photo goes to the board Worker (src/photo-upload.js), never through validateReport.
export const PHOTO_KIND = '암장 사진';
export const OVERVIEW_KIND = '전경 사진'; // the same photo flow, for the whole-wall picture used to find routes: the memo carries `[전경]`, and the picture keeps more pixels
export const isPhotoKind = (k) => k === PHOTO_KIND || k === OVERVIEW_KIND;
// 싱글피치(crag) card: its own short list, accepted only with opts.crag. 주차 and 기타 are form kinds (주차 keeps its pick line);
// CRAG_TOPICS are sheet-only and go out as 기타 with `[kind]` on the first line, like TOPIC_KINDS. No photo: the board Worker knows walls only.
export const CRAG_TOPICS = ['어프로치', '루트·개념도', '컨디션'];
export const CRAG_KINDS = ['주차', ...CRAG_TOPICS, '기타'];

const s = (v) => (typeof v === 'string' ? v.normalize('NFC').trim() : '');
const oneLine = (v) => s(v).replace(/[\s]+/g, ' ');
const isDate = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(+d) && d.toISOString().startsWith(v); // 2026-02-30 rolls over, so it fails
};

// Everything the form sends travels in the one 내용 entry. 임시휴무 and 주차 put their pick on labelled lines above an
// optional 메모; 운영시간 and 기타 are the plain memo, so the sheet reads the same whichever way it was filled in.
// 루트 분포 sends one line of grade counts ("루트: 10a 4 · 10b 6", the wall's routes, not what a visitor climbed) and the memo after it.
// 세팅일 sends one line ("마지막 세팅: … · 다음 예정: … · 메모: …"); the last setting within the 2 years up to today,
// the next one from today to a year ahead (local dates; `now` is for tests).
// opts: { nick: nickMode, crag: true → only CRAG_KINDS (a 싱글피치 report) }.
// -> { ok: true, report } | { ok: false, error }. honeypot: a filled hidden field means a bot; caller skips the send.
export function validateReport(input = {}, now = new Date(), opts = {}) {
  const name = oneLine(input.name);
  const kind = s(input.kind);
  const memo = s(input.body);
  const note = s(input.note);
  const fail = (error) => ({ ok: false, error });
  if (!name) return fail('암장 이름이 없어요.');
  const known = opts.crag === true ? CRAG_KINDS.includes(kind) : KINDS.includes(kind) || kind === CHAT_KIND || kind === NOTICE_KIND || TOPIC_KINDS.includes(kind);
  if (!known) return fail('무엇이 달라졌는지 골라 주세요.');
  const topic = TOPIC_KINDS.includes(kind) || CRAG_TOPICS.includes(kind); // sheet-only: 기타 with the topic as the first line
  const mode = opts.nick ?? 'off'; // 'off' | 'optional' | 'required' (nickMode)
  const nick = mode === 'off' ? '' : cleanNick(input.nick);
  if (mode === 'required' && !nick) return fail('닉네임을 적어 주세요.');
  if (memo.length > MAX_BODY) return fail(`내용은 ${MAX_BODY}자까지 적을 수 있어요.`);
  const lines = [];
  if (kind === '임시휴무') {
    const from = s(input.from);
    const to = s(input.to);
    if (!isDate(from)) return fail('휴무가 시작되는 날짜를 골라 주세요.');
    if (to && (!isDate(to) || to < from)) return fail('끝나는 날은 시작일과 같거나 그 뒤여야 해요.');
    lines.push(`휴무: ${to && to !== from ? `${from} ~ ${to}` : from}`);
  } else if (kind === '주차') {
    const parking = s(input.parking);
    if (!PARKING.includes(parking)) return fail('주차 상태를 골라 주세요.');
    lines.push(`주차: ${parking}`);
  } else if (kind === CHAT_KIND) {
    const chat = s(input.chat);
    if (!CHAT_URL_RE.test(chat)) return fail('카카오톡 오픈채팅방 링크(https://open.kakao.com/o/…)를 적어 주세요.');
    lines.push(`오픈채팅: ${chat}`);
  } else if (kind === NOTICE_KIND) {
    const insta = s(input.insta);
    const newUrl = s(input.newUrl);
    if (insta && !INSTA_RE.test(insta)) return fail('인스타그램은 게시물이나 프로필 주소(https://www.instagram.com/…)만 받아요.');
    if (newUrl && !(/^https?:\/\/\S+$/i.test(newUrl) && newUrl.length <= 300)) return fail('새 공지 주소는 http(s):// 로 시작하는 한 줄이어야 해요.');
    lines.push(NOTICE_HEAD);
    if (newUrl) lines.push(`새 주소: ${newUrl}`);
    if (insta) lines.push(`인스타그램: ${insta}`);
  } else if (kind === '세팅일') {
    const last = s(input.setLast);
    const next = s(input.setNext);
    const y = now.getFullYear();
    const today = ymd(now);
    const at = (dy) => ymd(new Date(y + dy, now.getMonth(), now.getDate()));
    if (last && (!isDate(last) || last > today || last < at(-2))) return fail('마지막 세팅일은 오늘부터 2년 전까지의 날짜로 골라 주세요.');
    if (next && (!isDate(next) || next < today || next > at(1))) return fail('다음 예정일은 오늘부터 1년 뒤까지의 날짜로 골라 주세요.');
    if (!last && !next && !memo) return fail('세팅일이나 메모 중 하나는 적어 주세요.');
    const parts = [last && `마지막 세팅: ${last}`, next && `다음 예정: ${next}`, memo && `메모: ${oneLine(memo)}`].filter(Boolean);
    lines.push(parts.join(' · '));
  } else if (kind === '루트 분포') {
    // sections ([{ name, counts }], the wall told apart by section) go one per line as `루트[좌측벽]: 10a 4`; without them, the one `루트:` line
    const seen = new Set();
    const secs = (Array.isArray(input.sections) ? input.sections : []).map((x) => ({ name: cleanSectionName(x?.name), line: routeLine(x?.counts) }))
      .filter((x) => x.name && x.line && !seen.has(x.name) && seen.add(x.name)).slice(0, MAX_ROUTE_WALLS);
    const line = secs.length ? '' : routeLine(input.routes);
    if (!secs.length && !line && !memo) return fail('루트 개수를 누르거나 메모를 적어 주세요.');
    for (const x of secs) lines.push(`루트[${x.name}]: ${x.line}`);
    if (line) lines.push(`루트: ${line}`);
  } else if (!memo) return fail('내용을 적어 주세요.');
  else if (topic) lines.push(`[${kind}]`);
  if (memo && kind !== '세팅일') lines.push(lines.length ? `메모: ${memo}` : memo);
  if (note.length > MAX_NOTE) return fail(`날짜·출처는 ${MAX_NOTE}자까지 적을 수 있어요.`);
  const report = { name, kind: kind === CHAT_KIND || kind === NOTICE_KIND || topic ? '기타' : kind, body: lines.join('\n'), note };
  if (nick) report.nick = nick;
  return { ok: true, report, honeypot: s(input.hp) !== '' };
}

// nickEntry: the form's 닉네임 entry id (config.reportNickEntry); without it, or without a nickname, nothing extra goes out.
export function buildPayload({ name, kind, body, note, nick }, nickEntry = '') {
  const p = new URLSearchParams();
  p.set(ENTRY.name, name);
  p.set(ENTRY.kind, kind);
  p.set(ENTRY.body, body);
  if (note) p.set(ENTRY.note, note);
  if (nick && nickEntry) p.set(nickEntry, nick);
  return p.toString();
}

export const cooldownLeft = (last, now, ms = COOLDOWN_MS) => (Number.isFinite(last) ? Math.max(0, last + ms - now) : 0);
