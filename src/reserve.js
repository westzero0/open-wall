// src/reserve.js — 예약 규칙 해석·마감 날짜·문구, 일정의 "예약했어요" 체크. DOM 없음, 저장소 없음.
// Spec: docs/superpowers/specs/2026-11-16-reservation.md. 문구는 이 파일에서만 만든다(docs/system/planner-copy.md "예약").
import { HTTP_URL_RE } from './store.js';
import { DAY_KO } from './time.js';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const p2 = (n) => String(n).padStart(2, '0');
const dateOf = (s) => { const m = DATE_RE.exec(s ?? ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

const shape = (r, inherited) => (r && typeof r.url === 'string' && HTTP_URL_RE.test(r.url)
  ? { name: r.name || null, url: r.url, required: r.required === true, daysBefore: Number.isInteger(r.days_before) ? r.days_before : null, checkedAt: r.checked_at || null, ...(r.note ? { note: r.note } : {}), inherited }
  : null);

/** The reserve rule of a place (a cleaned wall/crag): its own contact.reserve, else its parent's (parentId, one level, whole), else null. byId(id) → item. */
export function reserveOf(place, byId) {
  if (!place || typeof place !== 'object') return null;
  const own = shape(place.contact?.reserve, false);
  if (own) return own;
  const parent = place.parentId && typeof byId === 'function' ? byId(place.parentId) : null;
  return parent && parent !== place ? shape(parent.contact?.reserve, true) : null;
}

/** The last day to book: plan date − daysBefore (local calendar). null when either is unknown. */
export function reserveDeadline(date, daysBefore) {
  const d = dateOf(date);
  if (!d || !Number.isInteger(daysBefore) || daysBefore < 0) return null;
  d.setDate(d.getDate() - daysBefore);
  return ymd(d);
}

/** 'none' | 'todo' | 'today' | 'late' | 'done'. Only a required rule on a plan still ahead (예정, today or later) says anything. */
export function reserveState({ plan, reserve, today, reserved }) {
  if (!reserve?.required || plan?.status !== '예정' || !plan.date || plan.date < today) return 'none';
  if (reserved) return 'done';
  const deadline = reserveDeadline(plan.date, reserve.daysBefore);
  if (!deadline || today < deadline) return 'todo';
  return today === deadline ? 'today' : 'late';
}

const md = (s) => { const d = dateOf(s); return d ? `${d.getMonth() + 1}월 ${d.getDate()}일` : ''; };
const mdDow = (s) => { const d = dateOf(s); return d ? `${md(s)}(${DAY_KO[d.getDay()]})` : ''; };
const NEED = '예약이 필요한 곳이에요';

/** → { line, tag, checked }: the detail screen's line, the home row's tag, the 확인일 line (each null when there is nothing to say). */
export function reserveCopy(state, { deadline, checkedAt } = {}) {
  const c = dateOf(checkedAt);
  const checked = c && state !== 'none' ? `${c.getFullYear()}년 ${c.getMonth() + 1}월 ${c.getDate()}일에 확인한 내용이에요` : null;
  switch (state) {
    case 'todo': return { line: deadline && dateOf(deadline) ? `${NEED} · ${mdDow(deadline)}까지` : NEED, tag: '예약 필요', checked };
    case 'today': return { line: `${NEED} · 오늘까지`, tag: '예약 필요', checked };
    case 'late': return { line: deadline && dateOf(deadline) ? `예약 마감일(${md(deadline)})이 지났어요` : NEED, tag: '예약 마감 지남', checked };
    case 'done': return { line: null, tag: null, checked };
    default: return { line: null, tag: null, checked: null };
  }
}

/** The line when there is no plan day to count from: the rule itself ('… · 등반일 3일 전까지'); null when booking is not required. */
export function reserveRuleLine(rule) {
  if (!rule?.required) return null;
  return Number.isInteger(rule.daysBefore) && rule.daysBefore >= 0 ? `${NEED} · ${rule.daysBefore === 0 ? '등반일 당일까지' : `등반일 ${rule.daysBefore}일 전까지`}` : NEED;
}

/** 'official:<id>' for an official place; null otherwise (a name-only or my own place has no rule, so no check). */
export const placeKey = (place) => (place?.kind === 'official' && typeof place.id === 'string' && place.id ? `official:${place.id}` : null);

/** The check counts only for the date and place it was made for: moving either one un-checks it (spec §6, D2). */
export const isReserved = (plan) => {
  const r = plan?.reservedFor;
  return !!r && r.date === plan.date && r.place === placeKey(plan.place);
};

/** → a new plan with the check on/off; the same plan when the place cannot have one. */
export function toggleReserved(plan, on) {
  const place = placeKey(plan?.place);
  if (!place) return plan;
  return { ...plan, reservedFor: on ? { date: plan.date, place } : null };
}
