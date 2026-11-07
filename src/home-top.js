// src/home-top.js — 홈 맨 위 카드 고르기 (spec 2026-11-06-schedule-tab-flow-design §0-2b·§0-2c·§5-3): which trip the top of 홈 shows, its rain days and choices. No DOM.
// today is 'YYYY-MM-DD' like the trips' dates; forecasts is Map place name → parseDaily's day Map (as in schedule.js).
import { MAX_ALTS, alternatives, keyDay, nextDryDay, weekStrip } from './schedule.js';
import { isSunlit } from './sun.js';
import { dayKey } from './weather.js';
import { dday, tripState } from './trips.js';

const MAX_SPAN = 60; // days: a trip longer than this is only looked at this far (ponytail: a range is a weekend, not a season)

const placeOf = (place, places) => (place.type === 'zone' ? places.zones : places.walls)?.find((p) => p.id === place.id) ?? null;

/** rainDays(trip, forecasts, today, { zones, walls }) → one { date, rain, known, text } per day of the trip; no forecast for the day (D-8 or later, failed request) is known: false, never "no rain". An indoor wall is dry. */
export function rainDays(trip, forecasts, today, places) {
  const p = placeOf(trip.place, places);
  const strip = p && p.venue !== 'indoor' ? weekStrip({ wall: p.name, days: [] }, forecasts.get(p.name), keyDay(today)) : null;
  const out = [];
  for (let d = keyDay(trip.from), i = 0; dayKey(d) <= trip.to && i < MAX_SPAN; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), i++) {
    const s = strip?.find((x) => dayKey(x.date) === dayKey(d));
    out.push(!p ? { date: d, rain: false, known: false, text: '' }
      : !strip ? { date: d, rain: false, known: true, text: '실내' }
      : { date: d, rain: !!s?.rain, known: !!s?.known, text: s?.text ?? '' });
  }
  return out;
}

/**
 * pickHomeTop({ trips, today, hasRecordFor(trip), forecasts, places, focusTripId }) → { kind: 'day' | 'back' | 'rain' | 'plain' | null, trip, rest }.
 * 당일 > 다녀옴 > 비 예보 (a day of the trip with rain, not rainAck) > 평소 (nearest plan). focusTripId (a date chip's trip): that trip on top, with its own kind;
 * an id that is no live trip falls back to the order above. rest: the other plan / back / day trips, nearest first, for the folded lines.
 */
export function pickHomeTop({ trips, today, hasRecordFor, forecasts, places, focusTripId = null }) {
  const live = trips
    .map((t) => ({ t, state: tripState(t, today, hasRecordFor(t)) }))
    .filter((x) => ['plan', 'back', 'day'].includes(x.state))
    .sort((a, b) => Math.abs(dday(a.t, today)) - Math.abs(dday(b.t, today)));
  const first = (pred) => live.find(pred)?.t ?? null;
  const rainy = (t) => !t.rainAck && rainDays(t, forecasts, today, places).some((d) => d.rain);
  const picks = [['day', first((x) => x.state === 'day')], ['back', first((x) => x.state === 'back')],
    ['rain', first((x) => x.state === 'plan' && rainy(x.t))], ['plain', first((x) => x.state === 'plan')]];
  const focus = focusTripId ? live.find((x) => x.t.id === focusTripId) : null;
  const [kind, top] = focus ? [focus.state === 'plan' ? (rainy(focus.t) ? 'rain' : 'plain') : focus.state, focus.t] : picks.find(([, t]) => t) ?? [null, null];
  return { kind, trip: top, rest: live.map((x) => x.t).filter((t) => t !== top) };
}

/** tripWx(days, today) → the card chip's weather: the first day of the trip (from today on) a forecast covers, { kind: 'rain' | null }; null when none does (D-8+, failed request) or the place is indoor — the chip then shows the calendar, never "no rain". days: rainDays(). */
export function tripWx(days, today) {
  const d = days.find((x) => x.known && dayKey(x.date) >= today);
  return d && d.text !== '실내' ? { kind: d.rain ? 'rain' : null } : null;
}

/** dayCardOrder({ hasProjectHere, firstVisit }) → the 당일 card's rows; 지금 always first. A project here puts it second; a first visit adds the routes row. */
export const dayCardOrder = ({ hasProjectHere, firstVisit: first }) => (hasProjectHere ? ['now', 'project', 'approach', 'report']
  : first ? ['now', 'approach', 'routes', 'report'] : ['now', 'approach', 'report']);

/** firstVisit(log, place, walls, zones) → true when no record names the place (records carry the place's name: a wall from walls, a zone from zones, by id). */
export function firstVisit(log, place, walls, zones = []) {
  const name = (place.type === 'wall' ? walls : zones).find((p) => p.id === place.id)?.name ?? place.name;
  return !name || !log.some((r) => r.wall === name);
}

const COLD_MAX = 10; // °C: at or below it the outdoors is no choice for a rainy day (the day's top temperature, the crag request's tmax)
const SUN_HOUR = 14; // the hour a rain-day choice's 양달/응달 is told at (a trip has no time of day; the hour is named in the line so it is not read as all day)
const isIndoor = (w) => w.venue === 'indoor' || w.venue === 'both';
const sunAt = (w, d) => { // '14시 양달' / '14시 응달'; nothing when the wall's side is unknown
  const { lit } = isSunlit(w, new Date(d.getFullYear(), d.getMonth(), d.getDate(), SUN_HOUR));
  return lit === null || lit === undefined ? '' : `${SUN_HOUR}시 ${lit ? '양달' : '응달'}`;
};
const leadOk = (w) => isIndoor(w) && (w.indoor_kinds ?? []).includes('리드');

/**
 * rainChoices(trip, { forecasts, today, places }) → { otherDay, instead, recommend, keep: true } (spec 2026-11-07-home-schedule-record-frame, 비 예보 선택지).
 * otherDay: a range trip narrowed to its first dry day ({ from, to } both that day), null when nothing is dry / a single day.
 * instead: [{ type: 'wall', id, name, km, indoor, reason }], at most MAX_ALTS, each with its evidence in `reason`. A wall trip is outdoors too, so only an indoor wall that
 * can lead is offered; a zone trip may also be offered a wall with no rain forecast. A rain day at or below COLD_MAX takes the outdoors out of the list for either.
 * recommend: 'otherDay' | 'instead' | null: the first line that has evidence (never a rank or a score).
 */
export function rainChoices(trip, { forecasts, today, places }) {
  const p = placeOf(trip.place, places);
  const days = rainDays(trip, forecasts, today, places);
  const dry = days[nextDryDay(days, -1)];
  const rainDay = days.find((d) => d.rain);
  const alts = p && rainDay // a crag is wall-like enough for alternatives: wallPosition reads its location / sun
    ? alternatives(p, rainDay.date, { walls: places.walls, forecasts, now: keyDay(today), limit: 999 }) : [];
  const tmax = p && rainDay ? forecasts.get(p.name)?.get(dayKey(rainDay.date))?.tmax : undefined;
  const cold = Number.isFinite(tmax) && tmax <= COLD_MAX;
  const instead = alts
    .filter((a) => (trip.place.type === 'wall' ? leadOk(a.wall) : !cold || isIndoor(a.wall)))
    .slice(0, MAX_ALTS)
    .map((a) => ({ type: 'wall', id: a.wall.id, name: a.wall.name, km: a.km, indoor: isIndoor(a.wall),
      reason: isIndoor(a.wall) ? (leadOk(a.wall) ? '실내 · 리드' : '실내') : ['그날 비 예보 없음', sunAt(a.wall, rainDay.date)].filter(Boolean).join(' · ') }));
  const otherDay = trip.from < trip.to && dry ? { from: dayKey(dry.date), to: dayKey(dry.date) } : null;
  return { otherDay, instead, recommend: otherDay ? 'otherDay' : instead.length ? 'instead' : null, keep: true };
}
