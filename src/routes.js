// src/routes.js — a wall's route counts (data route_sets, cleaned in store.js) as what the wall sheet's 루트 tab draws. No DOM.
import { GRADES, barRows, gradeLabel } from './grades.js';

const sum = (list) => {
  const out = {};
  for (const c of list) for (const g of GRADES) if (c[g]) out[g] = (out[g] ?? 0) + c[g];
  return out;
};
const totalOf = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);
const view = (key, label, counts) => ({ key, label, total: totalOf(counts), rows: barRows(counts).map((r) => ({ ...r, label: gradeLabel(r.grade) })) });

/**
 * routeView(wall) → null without a snapshot, else the newest one:
 * { checked, stale, head, total, views: [{ key, label, total, rows: [{ grade, label, n, frac }] }] }.
 * views[0] is 전체 (the sum when the snapshot is by wall section); a by-section snapshot adds one view per section (w0, w1, …).
 * stale: the wall was set after the count (setting.last later than checked), so the counts are of the old routes.
 */
export function routeView(wall, now = new Date()) {
  const snap = wall?.route_sets?.[0];
  if (!snap) return null;
  const sections = snap.walls ?? null;
  const all = sections ? sum(sections.map((w) => w.counts)) : snap.counts;
  const stale = Boolean(wall.setting?.last) && wall.setting.last > snap.checked;
  const [y, m, d] = snap.checked.split('-').map(Number);
  return {
    checked: snap.checked,
    stale,
    head: stale ? '세팅 이후 분포 미확인' : `확인 ${y === now.getFullYear() ? `${m}/${d}` : `${y}.${m}.${d}`}`, // an earlier year says its year
    total: totalOf(all),
    views: [view('all', '전체', all), ...(sections ?? []).map((w, i) => view(`w${i}`, w.name, w.counts))],
  };
}
