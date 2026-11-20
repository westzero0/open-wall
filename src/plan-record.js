// src/plan-record.js — pure helpers for the record's route list (자연암장 ascents). No DOM, no storage. Cleaning stays in plan-model.
import { STYLE_NAME, routeHistory } from './plan-fields.js';
import { emptyDraft, draftToPlan } from './plan-draft.js';

export const MAX_ASCENTS = 20; // same ceiling as cleanAscents
/** One line per route: routeId when the route is in the data, else the typed name. */
export const ascentKey = (a) => a.routeId ?? `n:${a.routeName}`;

/** A route + a style button → the ascent line. style 'tried' = 시도만 (no style, tries 1). */
export function ascentOf(route, style, note = '') {
  const base = { routeId: route.id ?? null, routeName: route.name, note };
  return style === 'tried' ? { ...base, result: 'tried', style: null, tries: 1 } : { ...base, result: 'sent', style, tries: null };
}

/** Add or replace the line of the same route (the note stays). Full list: unchanged. */
export function putAscent(list, a) {
  const i = list.findIndex((x) => ascentKey(x) === ascentKey(a));
  if (i >= 0) return list.map((x, j) => (j === i ? { ...a, note: x.note ?? a.note ?? '' } : x));
  return list.length >= MAX_ASCENTS ? list : [...list, a];
}
export const dropAscent = (list, key) => list.filter((x) => ascentKey(x) !== key);
export const patchAscent = (list, key, patch) => list.map((x) => (ascentKey(x) === key ? { ...x, ...patch } : x));

/** What a chosen route row says: '✓ 온사이트' / '시도만 했어요'. */
export const ascentLabel = (a) => (a.result === 'tried' ? '시도만 했어요' : `✓ ${STYLE_NAME[a.style] ?? ''}`.trim());

/** The sub-line of a chosen route: ascentLabel, or '시도만 N번'. */
export const ascentLine = (a) => (a.result === 'tried' ? `시도만 ${a.tries ?? 1}번` : ascentLabel(a));

/** Earlier tries of each route on the OTHER plans that were 갔다 (this plan's own lines, and plans never gone to, must not turn a route into a project). */
export function historyMap(plans, planId, routes) {
  const others = plans.filter((p) => p.id !== planId && p.status === '갔다'); // only trips that happened count as earlier tries
  return new Map(routes.map((r) => [r.id, routeHistory(others, r.id)]));
}

/** The plan a route tap is written to: the one `planId` names (any date) when its place is `isHere`, else today's first plan here, else null (none yet). */
export function recordTarget({ plans = [], today, planId = null, isHere }) {
  const named = planId ? plans.find((p) => p.id === planId) : null;
  if (named && isHere(named)) return named;
  const todays = plans.filter((p) => p.date === today && isHere(p));
  return todays.reduce((a, b) => (a && (b.createdAt ?? Infinity) >= (a.createdAt ?? Infinity) ? a : b), null);
}

/** '루트 3개 · 레드포인트 1' (방식별 개수, 0인 방식은 뺌, 시도만은 마지막). No lines: '아직 기록한 루트가 없어요'. */
export function ascentSummary(ascents) {
  const list = Array.isArray(ascents) ? ascents : [];
  if (!list.length) return '아직 기록한 루트가 없어요';
  const bits = Object.keys(STYLE_NAME).map((st) => [STYLE_NAME[st], list.filter((a) => a.result === 'sent' && a.style === st).length]);
  bits.push(['시도만', list.filter((a) => a.result === 'tried').length]);
  return [`루트 ${list.length}개`, ...bits.filter(([, n]) => n > 0).map(([name, n]) => `${name} ${n}`)].join(' · ');
}

/** The band over the route list: '오늘 기록 · 11월 19일 · 2개' / '11월 16일 기록 중 · 2개' (0개: no count). */
export function recordBand({ date, today, count = 0 }) {
  const [, m, d] = String(date).split('-').map(Number);
  const day = `${m}월 ${d}일`;
  return [date === today ? `오늘 기록 · ${day}` : `${day} 기록 중`, count > 0 && `${count}개`].filter(Boolean).join(' · ');
}

/** The notice after a style tap puts a route in the record: '허니문 · 플래시' / '허니문 · 시도만'. */
export const styleFlash = (a) => `${a.routeName} · ${a.result === 'tried' ? '시도만' : STYLE_NAME[a.style] ?? ''}`.replace(/ · $/, '');

/** The head over the chosen routes: '오늘 한 루트' / '11월 16일 한 루트'. */
export function chosenHead({ date, today }) {
  if (date === today) return '오늘 한 루트';
  const [, m, d] = String(date).split('-').map(Number);
  return `${m}월 ${d}일 한 루트`;
}

/** The plan made by the first route tap on a day with no plan here: today, 가요 (예정). */
export function startRecordPlan({ place, today, authorId = '', id, now, resolved }) {
  return draftToPlan({ ...emptyDraft(today), place }, { authorId, id, now, resolved });
}
