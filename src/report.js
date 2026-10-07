// "정보 수정 요청" report: pure payload + validation. The sink is a published Google Form (see config.js).
export const KINDS = ['운영시간', '임시휴무', '주차', '기타'];
export const MAX_BODY = 2000;
export const MAX_NOTE = 300;
export const COOLDOWN_MS = 10_000;
const ENTRY = { name: 'entry.188461628', kind: 'entry.803930553', body: 'entry.2089578077', note: 'entry.750589902' };

import { CHAT_URL_RE } from './store.js';

export const PARKING = ['무료', '유료', '주차 불가', '모름'];
// A choice in the sheet, not a kind of the Google Form (whose options are fixed): it goes out as 기타 with the link on the first line.
export const CHAT_KIND = '오픈채팅방';

const s = (v) => (typeof v === 'string' ? v.normalize('NFC').trim() : '');
const oneLine = (v) => s(v).replace(/[\s]+/g, ' ');
const isDate = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(+d) && d.toISOString().startsWith(v); // 2026-02-30 rolls over, so it fails
};

// Everything the form sends travels in the one 내용 entry. 임시휴무 and 주차 put their pick on labelled lines above an
// optional 메모; 운영시간 and 기타 are the plain memo, so the sheet reads the same whichever way it was filled in.
// -> { ok: true, report } | { ok: false, error }. honeypot: a filled hidden field means a bot; caller skips the send.
export function validateReport(input = {}) {
  const name = oneLine(input.name);
  const kind = s(input.kind);
  const memo = s(input.body);
  const note = s(input.note);
  const fail = (error) => ({ ok: false, error });
  if (!name) return fail('암장 이름이 없어요.');
  if (!KINDS.includes(kind) && kind !== CHAT_KIND) return fail('무엇이 달라졌는지 골라 주세요.');
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
  } else if (!memo) return fail('내용을 적어 주세요.');
  if (memo) lines.push(lines.length ? `메모: ${memo}` : memo);
  if (note.length > MAX_NOTE) return fail(`날짜·출처는 ${MAX_NOTE}자까지 적을 수 있어요.`);
  return { ok: true, report: { name, kind: kind === CHAT_KIND ? '기타' : kind, body: lines.join('\n'), note }, honeypot: s(input.hp) !== '' };
}

export function buildPayload({ name, kind, body, note }) {
  const p = new URLSearchParams();
  p.set(ENTRY.name, name);
  p.set(ENTRY.kind, kind);
  p.set(ENTRY.body, body);
  if (note) p.set(ENTRY.note, note);
  return p.toString();
}

export const cooldownLeft = (last, now, ms = COOLDOWN_MS) => (Number.isFinite(last) ? Math.max(0, last + ms - now) : 0);
