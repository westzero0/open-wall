// src/ice-cond.js — the conditions an ice venue's temperature history meets, as facts (day counts, dates, °C). DOM 없음, 네트워크 없음.
// Plan: docs/superpowers/plans/2026-11-16-ice-cond.md. 근거: .scratch/ice-climbing/criteria-verify-2026-11-16.md("계산(E4)에 써도 되는 숫자", "사용자 결정").
// 한 단어 등급·안전 판단은 만들지 않는다. 문구는 화면(E5)이 만든다.
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const DAY_MS = 86400000;
const dayMs = (d) => Date.parse(`${d}T00:00Z`);
const hourMs = (t) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t ?? '') ? Date.parse(`${t}Z`) : NaN);

/** The biggest fall within 24 hours (hours in any order): { drop, from: {time, t}, to: {time, t} } or null when no two readings are within 24 hours. */
function biggestDrop(hours) {
  const hs = (hours ?? []).map((h) => ({ time: h?.time, t: num(h?.t), ms: hourMs(h?.time) }))
    .filter((h) => h.t !== null && Number.isFinite(h.ms)).sort((a, b) => a.ms - b.ms);
  if (hs.length < 2) return null;
  let best = null;
  for (let i = 0; i < hs.length; i++) {
    for (let j = i + 1; j < hs.length && hs[j].ms - hs[i].ms <= DAY_MS; j++) {
      const drop = hs[i].t - hs[j].t;
      if (!best || drop > best.drop) best = { drop, from: { time: hs[i].time, t: hs[i].t }, to: { time: hs[j].time, t: hs[j].t } };
    }
  }
  return best;
}

const nextDay = (a, b) => dayMs(b.date) - dayMs(a.date) === DAY_MS;

/** Days in a row, ending at the last day of ds, that pass test (a gap in dates ends the run). */
function streakOf(ds, test) {
  let n = 0;
  for (let i = ds.length - 1; i >= 0 && test(ds[i]); i--) {
    if (i < ds.length - 1 && !nextDay(ds[i], ds[i + 1])) break;
    n++;
  }
  return n;
}

/** Daily stand-in for the 24-hour fall: yesterday's high → today's low (normally well under 24 hours apart). */
function dailyDrop(ds) {
  let best = null;
  for (let i = 1; i < ds.length; i++) {
    const a = ds[i - 1], b = ds[i];
    if (a.tmax === null || b.tmin === null || !nextDay(a, b)) continue;
    const drop = a.tmax - b.tmin;
    if (!best || drop > best.drop) best = { drop, from: { date: a.date, t: a.tmax }, to: { date: b.date, t: b.tmin } };
  }
  return best;
}

/**
 * iceConditions(days, { kind, hours }) → { kind, from, to, conditions, unknown, trend }
 * days: [{ date: 'YYYY-MM-DD', tmin, tmax, rain? }] °C / mm, any order. hours (optional): [{ time: 'YYYY-MM-DDTHH:MM', t }].
 * kind: 'natural' | 'artificial' | null. Only `freeze` depends on it: artificial ice is sprayed, so how long it has been freezing says nothing about it.
 * conditions: only the ones met, each { id, source, ...facts }:
 *   warm_night { count, streak, dates, prelimDays: 3 } — nights (일최저) above 0°C. 3 is W11's preliminary figure, a note only, not a threshold.
 *   mild { count, dates, tmins } — 일최저 < 0 ≤ 일최고 ≤ +5°C (W11 "mild days", 교재 "0도를 오르내리는").
 *   cold { count, allDay, dates, coldest } — W11's "cold" (below −10°C): count = days whose low went below it;
 *     allDay = of those, days whose high stayed below too (climbing is in daytime, so this is the one to lead with on screen).
 *   rapid_drop { drop, from, to, basis } — a fall of 10°C or more within 24 hours. basis 'hourly' when hourly readings are given, else 'daily' (yesterday's high → today's low).
 *   rain { count, dates, mm } — days with rain on site (fact only: no mm threshold, no "days after rain").
 *   freeze { count, streak, dates } — natural ice (or unknown kind) only: days that stayed below 0°C all day. A formation reference, not a threshold (G13).
 * unknown: ids that had nothing to measure (never read as "not met"). trend: [{ date, tmin, tmax }] for days with a low (tmax null when unknown) — the screen's graph; recorded only, no label (사용자 결정 3).
 */
export function iceConditions(days, { kind = null, hours = null } = {}) {
  const k = kind === 'natural' || kind === 'artificial' ? kind : null;
  const ds = (Array.isArray(days) ? days : []).filter((d) => DAY_RE.test(d?.date ?? ''))
    .map((d) => ({ date: d.date, tmin: num(d.tmin), tmax: num(d.tmax), rain: num(d.rain) })).sort((a, b) => (a.date < b.date ? -1 : 1));
  const withMin = ds.filter((d) => d.tmin !== null);
  const withMax = ds.filter((d) => d.tmax !== null);
  const both = withMin.filter((d) => d.tmax !== null);
  const conditions = [];
  const unknown = [];
  const dates = (xs) => xs.map((d) => d.date);

  if (!withMin.length) unknown.push('warm_night');
  else {
    const warm = withMin.filter((d) => d.tmin > 0);
    if (warm.length) conditions.push({ id: 'warm_night', source: 'W11', count: warm.length, streak: streakOf(ds, (d) => d.tmin !== null && d.tmin > 0), dates: dates(warm), prelimDays: 3 });
  }

  if (!both.length) unknown.push('mild');
  else {
    const mild = both.filter((d) => d.tmin < 0 && d.tmax >= 0 && d.tmax <= 5);
    if (mild.length) conditions.push({ id: 'mild', source: 'W11', count: mild.length, dates: dates(mild), tmins: mild.map((d) => d.tmin) });
  }

  if (!withMin.length) unknown.push('cold');
  else {
    const nights = withMin.filter((d) => d.tmin < -10);
    if (nights.length) {
      conditions.push({ id: 'cold', source: 'W11', count: nights.length, allDay: nights.filter((d) => d.tmax !== null && d.tmax < -10).length,
        dates: dates(nights), coldest: Math.min(...nights.map((d) => d.tmin)) });
    }
  }

  const hourly = biggestDrop(hours);
  const drop = hourly ? { ...hourly, basis: 'hourly' } : (() => { const d = dailyDrop(ds); return d && { ...d, basis: 'daily' }; })();
  if (!drop) unknown.push('rapid_drop');
  else if (drop.drop >= 10) conditions.push({ id: 'rapid_drop', source: 'W11', ...drop });

  const withRain = ds.filter((d) => d.rain !== null);
  if (!withRain.length) unknown.push('rain');
  else {
    const wet = withRain.filter((d) => d.rain > 0);
    if (wet.length) conditions.push({ id: 'rain', source: null, count: wet.length, dates: dates(wet), mm: Math.round(wet.reduce((s, d) => s + d.rain, 0) * 10) / 10 });
  }

  if (k !== 'artificial') {
    if (!withMax.length) unknown.push('freeze');
    else {
      const frozen = withMax.filter((d) => d.tmax < 0);
      if (frozen.length) conditions.push({ id: 'freeze', source: 'G13', count: frozen.length, streak: streakOf(ds, (d) => d.tmax !== null && d.tmax < 0), dates: dates(frozen) });
    }
  }

  return { kind: k, from: ds[0]?.date ?? null, to: ds.at(-1)?.date ?? null, conditions, unknown, trend: withMin.map((d) => ({ date: d.date, tmin: d.tmin, tmax: d.tmax })) };
}
