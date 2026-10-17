// src/my-grade.js — 내 그레이드: the grade range a visitor climbs at (10b–11a), kept in this browser only (never sent anywhere).
// The 루트 tab draws the rows inside it stronger. No DOM; storage is passed in. Everything read goes through cleanMyGrade.
import { GRADES, gradeLabel } from './grades.js';

export const MY_GRADE_KEY = 'open-wall:my-grade';

/** cleanMyGrade(v) → { from, to } (known grades, the easier one first; one grade = a range of one) or null. */
export function cleanMyGrade(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const a = GRADES.indexOf(v.from);
  if (a < 0) return null;
  const b = v.to === undefined ? a : GRADES.indexOf(v.to);
  if (b < 0) return null;
  return { from: GRADES[Math.min(a, b)], to: GRADES[Math.max(a, b)] };
}

export function loadMyGrade(storage) {
  try { return cleanMyGrade(JSON.parse(storage.getItem(MY_GRADE_KEY))); } catch { return null; }
}

/** saveMyGrade(storage, range) → true when stored; a null or invalid range removes the key. Blocked storage: false, no throw. */
export function saveMyGrade(storage, range) {
  try {
    const c = cleanMyGrade(range);
    if (c) storage.setItem(MY_GRADE_KEY, JSON.stringify(c)); else storage.removeItem(MY_GRADE_KEY);
    return true;
  } catch { return false; }
}

export const inMyGrade = (range, grade) => {
  const r = cleanMyGrade(range);
  const i = GRADES.indexOf(grade);
  return Boolean(r) && i >= GRADES.indexOf(r.from) && i <= GRADES.indexOf(r.to);
};

/** "10b–11a", "10c" for one grade, '' for none. */
export function myGradeLabel(range) {
  const r = cleanMyGrade(range);
  if (!r) return '';
  return r.from === r.to ? gradeLabel(r.from) : `${gradeLabel(r.from)}–${gradeLabel(r.to)}`;
}
