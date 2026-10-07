// "정보가 달라요" report: pure payload + validation. The sink is a published Google Form (see config.js).
export const KINDS = ['운영시간', '임시휴무', '주차', '기타'];
export const MAX_BODY = 2000;
export const MAX_NOTE = 300;
export const COOLDOWN_MS = 10_000;
const ENTRY = { name: 'entry.188461628', kind: 'entry.803930553', body: 'entry.2089578077', note: 'entry.750589902' };

const s = (v) => (typeof v === 'string' ? v.normalize('NFC').trim() : '');
const oneLine = (v) => s(v).replace(/[\s]+/g, ' ');

// -> { ok: true, report } | { ok: false, error }. honeypot: a filled hidden field means a bot; caller skips the send.
export function validateReport(input = {}) {
  const report = { name: oneLine(input.name), kind: s(input.kind), body: s(input.body), note: s(input.note) };
  if (!report.name) return { ok: false, error: '암장 이름이 없어요.' };
  if (!KINDS.includes(report.kind)) return { ok: false, error: '무엇이 달라졌는지 골라 주세요.' };
  if (!report.body) return { ok: false, error: '내용을 적어 주세요.' };
  if (report.body.length > MAX_BODY) return { ok: false, error: `내용은 ${MAX_BODY}자까지 적을 수 있어요.` };
  if (report.note.length > MAX_NOTE) return { ok: false, error: `날짜·출처는 ${MAX_NOTE}자까지 적을 수 있어요.` };
  return { ok: true, report, honeypot: s(input.hp) !== '' };
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
