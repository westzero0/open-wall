// src/closure-warning.js — 닫힘·단축 제보를 카드의 "확인 중" 경고로 바꾼다 (docs/superpowers/specs/2026-10-29-closure-warning-design.md). No DOM.
// Input is report-tap's GET /v1/tap-summary (untrusted): { walls: { <name>: { <YYYY-MM-DD>: { hours: { ok, wrong, claims: {closed, short, long}, onsite_wrong, last } } } } }.
// Asymmetric on purpose: one closed / short claim lights the warning (a wrong one costs a phone call); it takes two other people saying "맞아요"
// (and more of them than the claims) to put it out. It never edits the hours: the card's times stay, the warning covers the "열림" words.
// 연장·개장 (claims.long) are not read at all: they change nothing on the card until an admin confirms (the hours data itself).
import { ymd } from './time.js';

const COUNT_MAX = 100000;
const num = (v) => (Number.isInteger(v) && v >= 0 && v <= COUNT_MAX ? v : 0);
export const CLEAR_OK = 2; // distinct "맞아요" it takes to put a warning out

/** hoursEntry(raw, wallName, dayKey) → { ok, closed, short, onsiteWrong, last } | null (anything malformed is dropped, a missing entry is null) */
export function hoursEntry(raw, wallName, dayKey) {
  const days = raw && typeof raw === 'object' && Object.hasOwn(raw.walls ?? {}, wallName) ? raw.walls[wallName] : null;
  const h = days && typeof days === 'object' && Object.hasOwn(days, dayKey) ? days[dayKey]?.hours : null;
  if (!h || typeof h !== 'object') return null;
  const c = h.claims && typeof h.claims === 'object' ? h.claims : {};
  return { ok: num(h.ok), closed: num(c.closed), short: num(c.short), onsiteWrong: num(h.onsite_wrong), last: Number.isFinite(h.last) && h.last > 0 ? h.last : null };
}

/**
 * warningOf({ tap, name, status, at, now }) → null | { kind: 'closed'|'short', phrase, mixed, onsite, ago }
 * Only for a wall that is open at `at` (a shut wall has no "열림" to cover); the summary is keyed by the day `at` falls on, so a claim
 * about another day never shows here and a day's warning ends with the day. ago: minutes since the last claim (null when unknown).
 */
export function warningOf({ tap, name, status, at, now = new Date() }) {
  if (status?.state !== 'open' || status.suspended) return null;
  const e = hoursEntry(tap, name, ymd(at));
  if (!e || e.closed + e.short < 1) return null;
  if (e.ok >= CLEAR_OK && e.ok > e.closed + e.short) return null;
  const mixed = e.ok > 0;
  const kind = e.closed >= e.short ? 'closed' : 'short';
  return {
    kind,
    phrase: mixed ? '제보가 엇갈려요' : kind === 'closed' ? '닫혔을 수 있어요' : '일찍 닫을 수 있어요',
    mixed,
    onsite: e.onsiteWrong > 0,
    ago: e.last == null ? null : Math.max(0, Math.round((now.getTime() - e.last) / 60000)),
  };
}

/** agoText(min) → "방금 제보" | "12분 전 제보" | "2시간 전 제보" | "" */
export function agoText(min) {
  if (min == null) return '';
  if (min < 1) return '방금 제보';
  return min < 60 ? `${min}분 전 제보` : `${Math.floor(min / 60)}시간 전 제보`;
}
