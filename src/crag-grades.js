// src/crag-grades.js — a crag's route list boiled down to one line: count, easiest–hardest, and how many sit in 내 그레이드. No DOM.
import { GRADES } from './grades.js';
import { inMyGrade, myGradeLabel } from './my-grade.js';

/** gradeKey('5.10b') → '10b'; 5.5–5.8 → '8', '5.9' → '9'; 미상, 5.10 without a letter, 5.14↑ → null. */
export function gradeKey(text) {
  const m = /^5\.(\d{1,2})([a-d])?$/.exec(String(text ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (n <= 8) return m[2] ? null : '8';
  if (n === 9) return m[2] ? null : '9';
  return n <= 13 && m[2] ? `${n}${m[2]}` : null;
}

// order within the scale; same slot (5.5 < 5.7 < 5.8) falls back to the written number
const rank = (t) => GRADES.indexOf(gradeKey(t)) * 100 + (Number(/^5\.(\d+)/.exec(t)[1]) <= 8 ? Number(/^5\.(\d+)/.exec(t)[1]) : 0);

/** routeSummary(routes, mine) → null for no routes, else { total, lo, hi, mineCount, mineLabel } (lo/hi as written, e.g. '5.5'). */
export function routeSummary(routes, mine) {
  if (!Array.isArray(routes) || !routes.length) return null;
  const read = routes.map((r) => r?.grade).filter((t) => gradeKey(t));
  read.sort((a, b) => rank(a) - rank(b));
  const label = mine ? myGradeLabel(mine) : '';
  return {
    total: routes.length,
    lo: read[0] ?? null,
    hi: read.at(-1) ?? null,
    mineCount: label ? routes.filter((r) => inMyGrade(mine, gradeKey(r?.grade))).length : null,
    mineLabel: label,
  };
}

/** '24개 · 내 범위 10b–11a 9개' / '24개 · 5.5–5.13c' / '24개 · 5.10a' / '24개': the card's 루트 row value (its label already says 루트). */
export function routeLineText(s) {
  const head = `${s.total}개`;
  if (s.mineCount !== null) return `${head} · 내 범위 ${s.mineLabel} ${s.mineCount}개`;
  if (!s.lo) return head;
  return `${head} · ${s.lo === s.hi ? s.lo : `${s.lo}–${s.hi}`}`;
}

/** rowMine(route, mine) → true when the route's grade sits inside the visitor's 내 그레이드 (false without a range or a readable grade). */
export const rowMine = (route, mine) => Boolean(mine) && inMyGrade(mine, gradeKey(route?.grade));
