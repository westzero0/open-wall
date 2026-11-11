// src/plan-sun.js — the detail screen's sun card as plain data (no DOM): ruler time <-> x, ticks, the status pill. planner-sun.js only paints it.
// Words follow planner-copy.md ("일정 상세 · 해 카드 상태 알약"). The sun itself comes from sun.js / dial.js (the same numbers the wall sheet uses).
import { isSunlit, fmt } from './sun.js';

/** The ruler spans 06:00-21:00 in 15-minute steps; x is in the scene's 360-wide user units. */
export const RULER = { from: 360, to: 1260, step: 15, x0: 22, x1: 338, long: 180 };
export const LIT_OP = 0.55; // tick opacity: lit / shade (the tick colour is the paper colour, set in CSS)
export const SHADE_OP = 0.2;
export const LOW_SUN = 12; // degrees: below this the scene's altitude word moves into the pill

const snap = (min) => Math.round(min / RULER.step) * RULER.step;
export const clampMin = (min) => Math.min(RULER.to, Math.max(RULER.from, snap(min)));
export const minToX = (min) => RULER.x0 + ((RULER.x1 - RULER.x0) * (Math.min(RULER.to, Math.max(RULER.from, min)) - RULER.from)) / (RULER.to - RULER.from);
export const xToMin = (x) => clampMin(RULER.from + ((x - RULER.x0) / (RULER.x1 - RULER.x0)) * (RULER.to - RULER.from));
export const stepMin = (min, delta) => clampMin(min + delta);
/** where the thumb starts: the plan's time, or noon when it has none */
export const startMin = (planMin) => (Number.isInteger(planMin) ? clampMin(planMin) : 720);

const dayAt = (day, min) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, min);

/** ticks for a place on a day: [{ min, x, lit, long }] — long every 3 hours. */
export function tickList(place, day) {
  const out = [];
  for (let min = RULER.from; min <= RULER.to; min += RULER.step) {
    out.push({ min, x: minToX(min), lit: isSunlit(place, dayAt(day, min)).lit === true, long: min % RULER.long === 0 });
  }
  return out;
}

/** first minute (5-minute scan) after `at` when the place is no longer sunlit, or null */
export function nextShadeMin(place, at) {
  const m0 = at.getHours() * 60 + at.getMinutes();
  for (let m = m0 + 5; m < 1440; m += 5) if (!isSunlit(place, dayAt(at, m)).lit) return m;
  return null;
}

/**
 * pillOf(model, name, flip, { isNow, before }) → { lit, title, note }; model = dialModel(), name = the place, flip = nextShadeMin() or null.
 * isNow: today at the current time (else the title says `이 시각`); before: the sun has not risen yet (`해 뜨기 전`, not `해가 졌어요`).
 * null when the sun cannot be told (no wall direction). A low sun says its height instead of the place.
 */
export const sunTitle = (lit, isNow) => `${isNow ? '지금' : '이 시각'} ${lit ? '양달' : '응달'}`;
export const HOME_SHADE_NOTE = '해가 가렸어요';
/** is the picked ruler minute the current time of today? only then the pill says `지금` */
export const isNowPick = (planDate, today, pickMin, nowMin) => planDate === today && pickMin === clampMin(nowMin);

export function pillOf(model, name, flip = null, { isNow = true, before = false } = {}) {
  if (!model || model.state === 'unknown' || model.state === 'override') return null;
  const lit = model.lit === true;
  const title = sunTitle(lit, isNow);
  if (lit) {
    const alt = model.sun?.altitude;
    if (Number.isFinite(alt) && alt < LOW_SUN) return { lit, title, note: `해 고도 ${Math.round(alt)}°${flip != null ? ' · 곧 응달' : ''}` };
    return { lit, title, note: flip != null ? `${name} · ${fmt(flip)}부터 응달` : name };
  }
  const why = !model.sun ? (before ? '해 뜨기 전' : '해가 졌어요') : model.state === 'terrain' ? '산에 가려져요' : '해는 벽 뒤';
  return { lit, title, note: `${name} · ${why}` };
}

/** the slider's spoken value: '14:00 양달' */
export const valueText = (min, lit) => `${fmt(min)} ${lit ? '양달' : '응달'}`;
