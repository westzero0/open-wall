// src/grades.js — the grade words shared by a wall's route counts and a visitor's 기록 (완등 / 시도 per grade). No DOM.
// "8" is 5.8 and below, "9" is 5.9; then 10a … 13d, shown without the "5." (10a, not 5.10a). Counts are whole numbers 1–99 per grade.
// A counts object is { '10a': 2, '10c': 1 } (only grades with a count). Everything read from storage, a file or a form
// goes through cleanCounts: only the grade list is ever read from it, so a huge or hostile object costs nothing.
export const GRADES = ['8', '9', ...[10, 11, 12, 13].flatMap((n) => ['a', 'b', 'c', 'd'].map((l) => `${n}${l}`))];
// 볼더링: V0 … V10 (전국 공통). A rope grade and a V grade never share a key, so a record keeps one counts object per scale.
export const V_GRADES = Array.from({ length: 11 }, (_, i) => `V${i}`);
export const ALL_GRADES = [...GRADES, ...V_GRADES];
export const MAX_COUNT = 99;
const own = Object.prototype.hasOwnProperty;

export function cleanCounts(v, scale = GRADES) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out = {};
  for (const g of scale) {
    if (!own.call(v, g)) continue;
    const n = v[g];
    if (Number.isInteger(n) && n > 0) out[g] = Math.min(n, MAX_COUNT);
  }
  return out;
}

/** How a grade reads: 10a as is, "8" is 5.8 and below, "9" is 5.9. */
export const gradeLabel = (g) => (g === '8' ? '5.8 이하' : g === '9' ? '5.9' : g);

/** "10a ×2 · 10c ×1", in grade order; '' for nothing. */
export const gradeLine = (counts, scale = GRADES) => Object.entries(cleanCounts(counts, scale)).map(([g, n]) => `${gradeLabel(g)} ×${n}`).join(' · ');

/** "10a 4 · 5.9 1" (no ×; the line a 루트 분포 report carries), in grade order; '' for nothing. */
export const routeLine = (counts) => Object.entries(cleanCounts(counts)).map(([g, n]) => `${gradeLabel(g)} ${n}`).join(' · ');

/** The input wall, easy grades at the top: a row per number, a hold (cell) per grade; text is what the hold shows. */
export const GRADE_ROWS = [
  { label: '5.', cells: [{ grade: '8', text: '8' }, { grade: '9', text: '9' }] },
  ...[10, 11, 12, 13].map((n) => ({ label: String(n), cells: ['a', 'b', 'c', 'd'].map((l) => ({ grade: `${n}${l}`, text: l })) })),
];

/** The input wall for 볼더링: V0–V5, then V6–V10; text is the number after the V. */
export const V_ROWS = [V_GRADES.slice(0, 4), V_GRADES.slice(4, 8), V_GRADES.slice(8)].map((gs) => ({ label: 'V', cells: gs.map((g) => ({ grade: g, text: g.slice(1) })) }));

export const totalOf = (counts, scale = GRADES) => Object.values(cleanCounts(counts, scale)).reduce((a, b) => a + b, 0);

/** bump(counts, grade, by, scale) → a new counts object with that grade moved by `by` (0 removes it, capped at MAX_COUNT; a grade off the scale changes nothing). */
export function bump(counts, grade, by, scale = GRADES) {
  const base = cleanCounts(counts, scale);
  if (!scale.includes(grade)) return base;
  const n = Math.min(Math.max((base[grade] ?? 0) + by, 0), MAX_COUNT);
  if (n) base[grade] = n; else delete base[grade];
  return cleanCounts(base, scale); // back in grade order
}

/** barRows(counts) → [{ grade, n, frac }] for the grades that have a count, lowest first; the biggest count is frac 1. */
export function barRows(counts) {
  const c = counts && typeof counts === 'object' && !Array.isArray(counts) ? counts : {};
  const rows = GRADES.filter((g) => own.call(c, g) && Number.isInteger(c[g]) && c[g] > 0).map((grade) => ({ grade, n: c[grade] })); // not capped: a year's sum may pass 99
  const max = Math.max(0, ...rows.map((r) => r.n));
  return rows.map((r) => ({ ...r, frac: r.n / max }));
}
