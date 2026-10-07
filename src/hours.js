import { DAY_KEYS, toMin, ymd } from './time.js';

const dayStart = (d, offset = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
const atMin = (d, min) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, min);

export function inWinter(wall, date) {
  const w = wall.winter;
  if (!w || !w.type || w.type === 'none') return false;
  const m = date.getMonth() + 1;
  return w.from_month <= w.to_month
    ? m >= w.from_month && m <= w.to_month
    : m >= w.from_month || m <= w.to_month;
}

// Day value (pair, list of pairs) for the calendar day, or null (closed / not entered).
function daySlot(wall, date) {
  if (wall.exceptions?.closed_dates?.includes(ymd(date))) return null;
  const key = DAY_KEYS[date.getDay()];
  if (inWinter(wall, date)) {
    if (wall.winter.type === 'closed') return null;
    if (wall.winter.type === 'changed') return wall.winter.hours?.[key] ?? null;
  }
  return wall.hours?.[key] ?? null;
}

// A day value is one pair ["HH:MM","HH:MM"] or a list of pairs; returns sorted spans, touching ones merged.
function spans(date, slot) {
  if (!slot) return [];
  const list = typeof slot[0] === 'string' ? [slot] : slot;
  const out = [];
  for (const [open, close] of list) {
    const o = toMin(open);
    let c = toMin(close);
    if (c <= o) c += 1440; // closes after midnight
    out.push({ openAt: atMin(date, o), closeAt: atMin(date, c) });
  }
  out.sort((x, y) => x.openAt - y.openAt);
  return out.reduce((acc, s) => {
    const last = acc[acc.length - 1];
    if (last && s.openAt <= last.closeAt) last.closeAt = new Date(Math.max(+last.closeAt, +s.closeAt));
    else acc.push(s);
    return acc;
  }, []);
}

// Sorted copy of a list of cleaned ["HH:MM","HH:MM"] intervals, or null when they overlap
// or an after-midnight interval is not the last.
export function orderIntervals(list) {
  const out = [...list].sort((a, b) => toMin(a[0]) - toMin(b[0]));
  let prevEnd = -Infinity;
  for (const [i, [open, close]] of out.entries()) {
    const o = toMin(open);
    let c = toMin(close);
    if (o < prevEnd) return null;
    if (c <= o) {
      if (i < out.length - 1) return null;
      c += 1440;
    }
    prevEnd = c;
  }
  return out;
}

// Open intervals of a calendar day in whole minutes, clipped to 0..1440. Includes the tail of
// yesterday's after-midnight interval; today's after-midnight interval is cut at 1440.
export function openIntervals(wall, date) {
  const d = dayStart(date);
  const prev = dayStart(d, -1);
  const out = [];
  for (const s of spans(prev, daySlot(wall, prev))) {
    const end = Math.round((s.closeAt - d) / 60000);
    if (end > 0) out.push([0, Math.min(end, 1440)]);
  }
  for (const s of spans(d, daySlot(wall, d))) {
    const start = Math.round((s.openAt - d) / 60000);
    if (start < 1440) out.push([start, Math.min(Math.round((s.closeAt - d) / 60000), 1440)]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out.reduce((acc, [s, e]) => {
    const last = acc[acc.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else acc.push([s, e]);
    return acc;
  }, []);
}

export function hasHours(wall) {
  const defined = (h) => h && DAY_KEYS.some((k) => h[k] !== undefined);
  return Boolean(defined(wall.hours) || (wall.winter?.type === 'changed' && defined(wall.winter.hours)));
}

function baseStatus(wall, at) {
  if (!hasHours(wall)) return { state: 'unknown' };

  // Yesterday's last interval can still be open after midnight.
  for (const offset of [-1, 0]) {
    const d = dayStart(at, offset);
    const day = spans(d, daySlot(wall, d));
    for (const { openAt, closeAt } of day) {
      if (at >= openAt && at < closeAt) {
        const endKind = offset === 0 && day.some((s) => s.openAt > at) ? 'break' : 'close';
        return { state: 'open', closeAt, remainingMin: Math.round((closeAt - at) / 60000), endKind };
      }
    }
  }

  const today = spans(dayStart(at), daySlot(wall, dayStart(at)));
  const onBreak = today.some((s) => s.closeAt <= at) && today.some((s) => s.openAt > at);

  for (let n = 0; n <= 200; n++) {
    const d = dayStart(at, n);
    const next = spans(d, daySlot(wall, d)).find((s) => s.openAt > at);
    if (next) return { state: 'closed', nextOpenAt: next.openAt, onBreak };
  }
  return { state: 'closed', nextOpenAt: null, onBreak };
}

// Adds winterNote (the indoor-wall note) when the winter season is active on `at`'s calendar day.
export function getStatus(wall, at) {
  const status = baseStatus(wall, at);
  const note = wall.winter?.indoor_note;
  return typeof note === 'string' && note && inWinter(wall, at) ? { ...status, winterNote: note } : status;
}
