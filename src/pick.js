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
// A rainy day pushes an outdoor wall behind the dry ones (indoor walls do not care). Only the order changes; nothing is dropped.
const rainyOutdoor = (m) => !!m.wx?.rain && m.wall.venue !== 'indoor';
const metricOf = (m, pref) => (pref === 'shade' ? m.shadeMin : pref === 'sun' ? m.sunMin : m.openMin);

/**
 * weekendPicks(walls, now, {pref, regions, venue, limit, weather, favs}) → { pref, days, byDay: [{ day, items, mine, skipped, alt }] }
 * pref: 'auto' (by the season of the first day) | 'shade' | 'sun' | 'any'. regions / venue: the 내 지역 and 구분 choices.
 * weather(wall, date) → { rain, windy, rainText } | null (see weather.js dayWeather): each item carries it as `wx`, and a rainy outdoor wall sorts after the dry ones.
 * Left out: no hours, hours not checked for over a year, under 2 h on the day, and (shade/sun) walls whose
 * facing is unknown or with under an hour of what is asked for.
 * favs (the 내 암장 names): `mine` ranks them the same way whatever the 내 지역 (up to `limit`, `moreMine` counts the rest); the ones that cannot be picked are in
 * `skipped` with the reason ({ wall, why }: 시간 확인 필요 / 휴무 / 운영 2시간 미만 / 해 방향 모름 / 응달·양달 1시간 미만); `alt` is the best
 * wall in the 내 지역 that is not one of them (null without a 내 지역). Without favs: mine / skipped are empty and alt is null.
 */
export function weekendPicks(walls, now, { pref = 'auto', regions = [], venue = 'any', limit = 3, weather = null, favs = [] } = {}) {
  const days = weekendDays(now);
  const resolved = pref === 'auto' ? seasonPref(days[0].date) : pref;
  const scoped = scopeRows(walls.map((w) => ({ wall: viewOf(w, venue) })), { regions, venue }).map((r) => r.wall);
  const picks = (pool, day) => pool.map((w) => measure(w, day, now))
    .map((m) => m && { ...m, wx: weather?.(m.wall, day.date) ?? null })
    .filter((m) => m && metricOf(m, resolved) !== null && (resolved === 'any' || metricOf(m, resolved) >= MIN_PREF))
    .sort((a, b) => rainyOutdoor(a) - rainyOutdoor(b) || metricOf(b, resolved) - metricOf(a, resolved) || b.openMin - a.openMin || balanceOf(b) - balanceOf(a)
      || b.longestMin - a.longestMin || a.wall.name.localeCompare(b.wall.name, 'ko'));
  const mineWalls = favs.length ? scopeRows(walls.filter((w) => favs.includes(w.name)).map((w) => ({ wall: viewOf(w, venue) })), { venue }).map((r) => r.wall) : [];
  const byDay = days.map((day) => {
    const ranked = picks(scoped, day);
    const mineRanked = picks(mineWalls, day);
    const ok = new Set(mineRanked.map((m) => m.wall.name));
    return {
      day,
      items: ranked.slice(0, limit),
      mine: mineRanked.slice(0, limit),
      moreMine: Math.max(0, mineRanked.length - limit), // 내 암장 that could be picked but are past the limit
      skipped: mineWalls.filter((w) => !ok.has(w.name)).map((wall) => ({ wall, why: skipReason(wall, day, now, resolved) })),
      alt: favs.length && regions.length ? ranked.find((m) => !favs.includes(m.wall.name)) ?? null : null,
    };
  });
  return { pref: resolved, days, byDay };
}

// Why a wall that is not picked is missing on a day (for a 내 암장: the visitor should hear it, not wonder).
function skipReason(wall, day, now, pref) {
  if (!hasHours(wall) || staleness(wall, now).stale) return '시간 확인 필요';
  const m = measure(wall, day, now);
  if (!m) return sum(intersect(openIntervals(wall, day.date), [[day.fromMin, WINDOW[1]]])) === 0 ? '휴무' : '운영 2시간 미만';
  if (pref !== 'any' && metricOf(m, pref) === null) return '해 방향 모름';
  return `${pref === 'shade' ? '응달' : '양달'} 1시간 미만`;
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
 * reasonOf(item, pref) → { short, sentence, at }: "하루 종일 응달" / "하루 종일 응달이에요."
 * pref 'shade' / 'sun': all day, almost all day, or the longest stretch of it. 'any': the lean when there is one,
 * else when the day turns ("14:00부터 응달", in full "양달로 시작해 14:00부터 응달이에요."); with no sun facing known, just the stay.
 */
export function reasonOf(item, pref) {
  const { open, openMin, sun, shade, sunMin, shadeMin } = item;
  const stay = () => ({ short: `${hoursText(openMin)} 운영`, sentence: `${hoursText(openMin)} 열려 있어요.`, at: open[0][0] });
  if (sunMin === null) return stay();
  // `at` is the minute the reason starts (a tap on the pick opens that moment): the day's start for "all day", else the stretch it names
  const says = (short, at) => ({ short, sentence: `${short}이에요.`, at });
  const side = (word, min, other, list) => {
    if (other === 0) return says(`하루 종일 ${word}`, list[0][0]);
    if (min >= openMin * MOSTLY) return says(`거의 종일 ${word}`, longest(list)[0]);
    return says(windowText(longest(list), word), longest(list)[0]);
  };
  if (pref === 'shade') return side('응달', shadeMin, sunMin, shade);
  if (pref === 'sun') return side('양달', sunMin, shadeMin, sun);
  if (sunMin === 0) return says('하루 종일 응달', shade[0][0]);
  if (shadeMin === 0) return says('하루 종일 양달', sun[0][0]);
  if (sunMin >= openMin * MOSTLY) return says('거의 종일 양달', longest(sun)[0]);
  if (shadeMin >= openMin * MOSTLY) return says('거의 종일 응달', longest(shade)[0]);
  // both: which one the day starts with, and when it turns
  const litFirst = sun.some(([a, b]) => a <= open[0][0] && b > open[0][0]);
  const turn = litFirst ? shade.find(([a]) => a > open[0][0]) : sun.find(([a]) => a > open[0][0]);
  if (!turn) return stay();
  const word = litFirst ? '응달' : '양달';
  return { short: `${fmtMin(turn[0])}부터 ${word}`, sentence: `${litFirst ? '양달' : '응달'}로 시작해 ${fmtMin(turn[0])}부터 ${word}이에요.`, at: turn[0] };
}

// The number behind a reason: how many hours of the side it names ("하루 종일 응달" → "응달 9시간"). Null when the reason
// already says the hours (a stretch "13:00부터 19:00까지 …", or "N시간 운영" with no sun to count) or names no side.
export function evidenceOf(item, pref) {
  const why = reasonOf(item, pref).short;
  if (item.sunMin === null || why.includes('까지')) return null;
  return why.includes('응달') ? `응달 ${hoursText(item.shadeMin)}` : why.includes('양달') ? `양달 ${hoursText(item.sunMin)}` : null;
}

// "09:00부터 21:00까지 열려 있어요." (first opening to last closing; a note when a break splits the day)
export function hoursLine(item) {
  const { open } = item;
  return `${fmtMin(open[0][0])}부터 ${fmtMin(open[open.length - 1][1])}까지 열려 있어요.${open.length > 1 ? ' (휴게시간 있음)' : ''}`;
}
