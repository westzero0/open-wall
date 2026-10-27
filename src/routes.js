// src/routes.js — a wall's route counts (data route_sets, cleaned in store.js) as what the wall sheet's 루트 tab draws. No DOM.
import { GRADES, barRows, gradeLabel } from './grades.js';
import { cleanMyGrade, inMyGrade, myGradeLabel } from './my-grade.js';

const sum = (list) => {
  const out = {};
  for (const c of list) for (const g of GRADES) if (c[g]) out[g] = (out[g] ?? 0) + c[g];
  return out;
};
const totalOf = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);
const VENUE_KO = { indoor: '실내', outdoor: '실외' };
// a section's chip: its own name, with 실내/실외 in front unless the name already says it
const sectionLabel = (w) => (w.venue && !w.name.includes(VENUE_KO[w.venue]) ? `${VENUE_KO[w.venue]} ${w.name}` : w.name);
// '10a' → '5.10a' like the 5.8 이하 and 5.9 rows beside it (the other grade lists keep the short form)
const fiveLabel = (g) => (/^1\d[a-d]$/.test(g) ? `5.${g}` : gradeLabel(g));
const view = (key, label, counts, mine, venue = null) => {
  const rows = barRows(counts).map((r) => ({ ...r, label: fiveLabel(r.grade), mine: inMyGrade(mine, r.grade) }));
  return { key, label, venue, total: totalOf(counts), mineTotal: rows.filter((r) => r.mine).reduce((a, r) => a + r.n, 0), rows };
};

/**
 * routeView(wall, now, mine, prefer) → null without a snapshot, else the newest one:
 * { checked, stale, head, total, first, views: [{ key, label, venue, total, rows: [{ grade, label, n, frac }] }] }.
 * views[0] is 전체 (the sum when the snapshot is by wall section); a by-section snapshot adds one view per section (w0, w1, …).
 * A snapshot whose sections say both 실내 and 실외 has no 전체: indoor and outdoor routes are not climbed together, so their sum
 * means nothing; its sections come as they are, labelled 실내/실외. `first` is the key to open: the section of the kind the visitor
 * asked for (prefer 'indoor' | 'outdoor', the 구분 filter), else the first outdoor one, else the first view.
 * mine (the visitor's 내 그레이드, optional): rows inside it carry `mine: true`, each view a `mineTotal`, and the result `mine: { label, total }` (null without a range).
 * stale: the wall was set after the count (setting.last later than checked), so the counts are of the old routes.
 */
export function routeView(wall, now = new Date(), mine = null, prefer = null) {
  const snap = wall?.route_sets?.[0];
  if (!snap) return null;
  const sections = snap.walls ?? null;
  const all = sections ? sum(sections.map((w) => w.counts)) : snap.counts;
  const stale = Boolean(wall.setting?.last) && wall.setting.last > snap.checked;
  const [y, m, d] = snap.checked.split('-').map(Number);
  const range = cleanMyGrade(mine);
  const kinds = new Set((sections ?? []).map((w) => w.venue).filter(Boolean));
  const split = kinds.has('indoor') && kinds.has('outdoor');
  const views = [...(split ? [] : [view('all', '전체', all, range)]), ...(sections ?? []).map((w, i) => view(`w${i}`, sectionLabel(w), w.counts, range, w.venue ?? null))];
  const first = (prefer && views.find((x) => x.venue === prefer)) || views.find((x) => x.venue === 'outdoor') || views[0];
  return {
    checked: snap.checked,
    stale,
    head: stale ? '세팅 이후 분포 미확인' : `확인 ${y === now.getFullYear() ? `${m}/${d}` : `${y}.${m}.${d}`}`, // an earlier year says its year
    total: split ? null : totalOf(all),
    first: first.key,
    mine: range ? { label: myGradeLabel(range), total: split ? null : view('all', '', all, range).mineTotal } : null,
    views,
  };
}
