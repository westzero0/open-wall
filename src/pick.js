// src/pick.js — 이번 주말 추천: on a weekend day, which open walls give the most of what the season asks for
// (shade in summer, sun in winter, otherwise the longest stay). Built on the hours and sun engines. No DOM.
import { hasHours, openIntervals } from './hours.js';
import { isSunlit } from './sun.js';
import { scopeRows, sunIntervals, viewOf, fmtMin } from './viewmodel.js';
import { staleness } from './card-model.js';
import { DAY_KO } from './time.js';

export const WINDOW = [9 * 60, 21 * 60]; // the stretch of the day that counts
const MIN_STAY = 120; // under two hours is not worth recommending
const MIN_PREF = 60; // and the shade/sun the season asks for must be at least an hour

// Mon–Fri: the coming Sat and Sun. Sat: today and Sun. Sun: today. Today only counts from now (rounded up to 10 min).
export function weekendDays(now) {
  const dow = now.getDay();
  const offsets = dow === 0 ? [0] : dow === 6 ? [0, 1] : [6 - dow, 7 - dow];
  const nowMin = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 10) * 10;
  return offsets.map((o) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + o);
    return { date, label: DAY_KO[date.getDay()], fromMin: o === 0 ? Math.max(WINDOW[0], nowMin) : WINDOW[0] };
  });
}

// Summer wants shade, winter wants sun; spring and autumn lean neither way (the longest stay decides).
export function seasonPref(date) {
  const m = date.getMonth() + 1;
  return m >= 6 && m <= 9 ? 'shade' : m === 12 || m <= 2 ? 'sun' : 'any';
}

export function intersect(xs, ys) {
  const out = [];
  for (const [a, b] of xs) for (const [c, d] of ys) {
    const s = Math.max(a, c);
    const e = Math.min(b, d);
    if (e > s) out.push([s, e]);
  }
  return out.sort((p, q) => p[0] - q[0]);
}

export function subtract(xs, ys) {
  return xs.flatMap((x) => {
    let parts = [x];
    for (const [c, d] of ys) {
      parts = parts.flatMap(([s, e]) => (d <= s || c >= e ? [[s, e]] : [[s, Math.min(c, e)], [Math.max(d, s), e]].filter(([p, q]) => q > p)));
    }
    return parts;
  });
}

const sum = (list) => list.reduce((n, [a, b]) => n + (b - a), 0);

export function hoursText(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m}분` : m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

// One wall on one day: its open minutes in the window, and how many of them are sunny / shady (null: no sun facing known).
function measure(wall, day, now) {
  if (!hasHours(wall) || staleness(wall, now).stale) return null;
  const open = intersect(openIntervals(wall, day.date), [[day.fromMin, WINDOW[1]]]);
  const openMin = sum(open);
  if (openMin < MIN_STAY) return null;
  const { date } = day;
  const known = isSunlit(wall, new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)).lit !== null;
  const sun = known ? intersect(open, sunIntervals(wall, date)) : null;
  const shade = known ? subtract(open, sun) : null;
  return {
    wall, day, open, openMin, longestMin: Math.max(...open.map(([a, b]) => b - a)),
    sun, shade, sunMin: known ? sum(sun) : null, shadeMin: known ? sum(shade) : null,
  };
}

// In a tie, a wall that has both sun and shade to move between is the better pick (-1: no sun facing known).
const balanceOf = (m) => (m.sunMin === null ? -1 : Math.min(m.sunMin, m.shadeMin));
const metricOf = (m, pref) => (pref === 'shade' ? m.shadeMin : pref === 'sun' ? m.sunMin : m.openMin);

/**
 * weekendPicks(walls, now, {pref, regions, venue, limit}) → { pref, days, byDay: [{ day, items }] }
 * pref: 'auto' (by the season of the first day) | 'shade' | 'sun' | 'any'. regions / venue: the 내 지역 and 구분 choices.
 * Left out: no hours, hours not checked for over a year, under 2 h on the day, and (shade/sun) walls whose
 * facing is unknown or with under an hour of what is asked for.
 */
export function weekendPicks(walls, now, { pref = 'auto', regions = [], venue = 'any', limit = 3 } = {}) {
  const days = weekendDays(now);
  const resolved = pref === 'auto' ? seasonPref(days[0].date) : pref;
  const scoped = scopeRows(walls.map((w) => ({ wall: viewOf(w, venue) })), { regions, venue }).map((r) => r.wall);
  const byDay = days.map((day) => {
    const items = scoped.map((w) => measure(w, day, now))
      .filter((m) => m && metricOf(m, resolved) !== null && (resolved === 'any' || metricOf(m, resolved) >= MIN_PREF))
      .sort((a, b) => metricOf(b, resolved) - metricOf(a, resolved) || b.openMin - a.openMin || balanceOf(b) - balanceOf(a)
        || b.longestMin - a.longestMin || a.wall.name.localeCompare(b.wall.name, 'ko'))
      .slice(0, limit);
    return { day, items };
  });
  return { pref: resolved, days, byDay };
}

const rangeText = (list) => {
  const t = list.slice(0, 2).map(([a, b]) => `${fmtMin(a)}–${fmtMin(b)}`).join(', ');
  return list.length > 2 ? `${t} 외` : t;
};

// "응달 14:00–19:00 · 5시간": the windows that were counted, so a visitor can judge the pick instead of trusting a rank.
export function describe(item, pref) {
  const [label, list, min] = pref === 'shade' ? ['응달', item.shade, item.shadeMin]
    : pref === 'sun' ? ['양달', item.sun, item.sunMin] : ['운영', item.open, item.openMin];
  const split = pref === 'any' && item.sunMin !== null ? ` · 양달 ${hoursText(item.sunMin)}, 응달 ${hoursText(item.shadeMin)}` : '';
  return `${label} ${rangeText(list)} · ${hoursText(min)}${split}`;
}

// ---- the one-sentence reason: only what the counted minutes say (nothing about heat, crowds or weather)
const MOSTLY = 0.8; // "almost all day": at least this share of the open minutes

const longest = (list) => list.reduce((best, r) => (!best || r[1] - r[0] > best[1] - best[0] ? r : best), null);
const windowText = (r, word) => `${fmtMin(r[0])}부터 ${fmtMin(r[1])}까지 ${word}`;

/**
 * reasonOf(item, pref) → { short, sentence }: "하루 종일 응달" / "하루 종일 응달이에요."
 * pref 'shade' / 'sun': all day, almost all day, or the longest stretch of it. 'any': the lean when there is one,
 * else when the day turns ("14:00부터 응달", in full "양달로 시작해 14:00부터 응달이에요."); with no sun facing known, just the stay.
 */
export function reasonOf(item, pref) {
  const { open, openMin, sun, shade, sunMin, shadeMin } = item;
  if (sunMin === null) return { short: `${hoursText(openMin)} 운영`, sentence: `${hoursText(openMin)} 열려 있어요.` };
  const says = (short) => ({ short, sentence: `${short}이에요.` });
  const side = (word, min, other, list) => {
    if (other === 0) return says(`하루 종일 ${word}`);
    if (min >= openMin * MOSTLY) return says(`거의 종일 ${word}`);
    return says(windowText(longest(list), word));
  };
  if (pref === 'shade') return side('응달', shadeMin, sunMin, shade);
  if (pref === 'sun') return side('양달', sunMin, shadeMin, sun);
  if (sunMin === 0) return says('하루 종일 응달');
  if (shadeMin === 0) return says('하루 종일 양달');
  if (sunMin >= openMin * MOSTLY) return says('거의 종일 양달');
  if (shadeMin >= openMin * MOSTLY) return says('거의 종일 응달');
  // both: which one the day starts with, and when it turns
  const litFirst = sun.some(([a, b]) => a <= open[0][0] && b > open[0][0]);
  const turn = litFirst ? shade.find(([a]) => a > open[0][0]) : sun.find(([a]) => a > open[0][0]);
  if (!turn) return { short: `${hoursText(openMin)} 운영`, sentence: `${hoursText(openMin)} 열려 있어요.` };
  const word = litFirst ? '응달' : '양달';
  return { short: `${fmtMin(turn[0])}부터 ${word}`, sentence: `${litFirst ? '양달' : '응달'}로 시작해 ${fmtMin(turn[0])}부터 ${word}이에요.` };
}

// "09:00부터 21:00까지 열려 있어요." (first opening to last closing; a note when a break splits the day)
export function hoursLine(item) {
  const { open } = item;
  return `${fmtMin(open[0][0])}부터 ${fmtMin(open[open.length - 1][1])}까지 열려 있어요.${open.length > 1 ? ' (휴게시간 있음)' : ''}`;
}
