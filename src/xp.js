// src/xp.js — 경험치: what a record is worth. 등반 XP comes from a record's grades (per discipline), 활동 XP from showing up.
// The numbers are a first draft (tune them here only). No DOM, nothing stored: XP is always counted from the records.
import { GRADES, V_GRADES } from './grades.js';
import { DISCIPLINES } from './discipline.js';

const table = (scale, xs) => Object.fromEntries(scale.map((g, i) => [g, xs[i]]));
/** XP of one send per grade. Steeper at the top: the next grade is always worth more. */
export const BOULDER_XP = table(V_GRADES, [1, 2, 3, 5, 8, 12, 18, 26, 38, 55, 80]);
export const ROPE_XP = table(GRADES, [1, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 48, 62, 80, 100, 125, 155]);
/** A try (not sent) is worth this share of a send of that grade, at least 1 XP. */
export const TRY_FACTOR = 0.25;
/** 활동 XP: a day's distinct walls, each worth VISIT_XP, counted up to VISITS_PER_DAY walls. */
export const VISIT_XP = 5;
export const VISITS_PER_DAY = 3;

/** XP of one send, per discipline. A new discipline is one line here (multi-pitch is worked out in recordClimbXp); an unknown one is worth 0. */
export const XP_TABLE = { boulder: BOULDER_XP, lead: ROPE_XP, single: ROPE_XP };
// own keys only, for the discipline and the grade: a record-supplied 'constructor' must not find Object.prototype (that would be NaN in every total)
const sendXp = (d, g) => (Object.hasOwn(XP_TABLE, d) && Object.hasOwn(XP_TABLE[d], g) ? XP_TABLE[d][g] : 0);
const ropeXp = (g) => (Object.hasOwn(ROPE_XP, g) ? ROPE_XP[g] : 1); // a multi-pitch top with no weight counts as 1

/** recordClimbXp(record) → whole XP of one record. Multi-pitch: pitches × the top grade's weight (1 without a top), halved on a bail. */
export function recordClimbXp(r) {
  const d = r.discipline ?? 'lead';
  if (d === 'multi') {
    if (!r.multi) return 0;
    return Math.round(r.multi.pitches * ropeXp(r.multi.top) * (r.multi.result === 'bail' ? 0.5 : 1));
  }
  let xp = 0;
  for (const [g, n] of Object.entries(r.sends ?? {})) xp += sendXp(d, g) * n;
  for (const [g, n] of Object.entries(r.tries ?? {})) {
    const x = sendXp(d, g);
    if (x) xp += Math.max(1, Math.round(x * TRY_FACTOR)) * n;
  }
  return xp;
}

/** climbXpByDiscipline(log) → { boulder, lead, single, multi } XP. */
export function climbXpByDiscipline(log) {
  const out = Object.fromEntries(DISCIPLINES.map((d) => [d, 0]));
  for (const r of log) {
    const d = r.discipline ?? 'lead';
    if (Object.hasOwn(out, d)) out[d] += recordClimbXp(r); // a discipline this version does not know is kept in the log but not counted
  }
  return out;
}

/** activityXp(log) → XP for showing up: per day, the distinct walls (at most VISITS_PER_DAY) × VISIT_XP. */
export function activityXp(log) {
  const days = new Map();
  for (const r of log) days.set(r.date, (days.get(r.date) ?? new Set()).add(r.wall));
  let xp = 0;
  for (const walls of days.values()) xp += Math.min(walls.size, VISITS_PER_DAY) * VISIT_XP;
  return xp;
}
