// src/routes.js — a wall's route counts (data route_sets, cleaned in store.js) as what the wall sheet's 루트 tab draws. No DOM.
import { GRADES, barRows, gradeLabel } from './grades.js';
import { cleanMyGrade, inMyGrade, myGradeLabel } from './my-grade.js';

const sum = (list) => {
  const out = {};
  for (const c of list) for (const g of GRADES) if (c[g]) out[g] = (out[g] ?? 0) + c[g];
  return out;
};
const totalOf = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);
const view = (key, label, counts, mine) => {
  const rows = barRows(counts).map((r) => ({ ...r, label: gradeLabel(r.grade), mine: inMyGrade(mine, r.grade) }));
  return { key, label, total: totalOf(counts), mineTotal: rows.filter((r) => r.mine).reduce((a, r) => a + r.n, 0), rows };
};

/**
 * routeView(wall) → null without a snapshot, else the newest one:
 * { checked, stale, head, total, views: [{ key, label, total, rows: [{ grade, label, n, frac }] }] }.
 * views[0] is 전체 (the sum when the snapshot is by wall section); a by-section snapshot adds one view per section (w0, w1, …).
 * mine (the visitor's 내 그레이드, optional): rows inside it carry `mine: true`, each view a `mineTotal`, and the result `mine: { label, total }` (null without a range).
 * stale: the wall was set after the count (setting.last later than checked), so the counts are of the old routes.
 */
export function routeView(wall, now = new Date(), mine = null) {
  const snap = wall?.route_sets?.[0];
  if (!snap) return null;
  const sections = snap.walls ?? null;
  const all = sections ? sum(sections.map((w) => w.counts)) : snap.counts;
  const stale = Boolean(wall.setting?.last) && wall.setting.last > snap.checked;
  const [y, m, d] = snap.checked.split('-').map(Number);
  const range = cleanMyGrade(mine);
  return {
    checked: snap.checked,
    stale,
    head: stale ? '세팅 이후 분포 미확인' : `확인 ${y === now.getFullYear() ? `${m}/${d}` : `${y}.${m}.${d}`}`, // an earlier year says its year
    total: totalOf(all),
    mine: range ? { label: myGradeLabel(range), total: view('all', '', all, range).mineTotal } : null,
    views: [view('all', '전체', all, range), ...(sections ?? []).map((w, i) => view(`w${i}`, w.name, w.counts, range))],
  };
}
