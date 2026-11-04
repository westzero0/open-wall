// src/discipline.js — the four kinds of climbing a record can be (기록 분야): which grade scale each uses and how a multi-pitch block is cleaned.
// No DOM. A record without a discipline is 리드 (every record from before this existed).
import { ALL_GRADES, GRADES, V_GRADES } from './grades.js';

export const DISCIPLINES = ['boulder', 'lead', 'single', 'multi'];
export const DISCIPLINE_NAME = { boulder: '볼더링', lead: '리드', single: '싱글피치', multi: '멀티피치' };
export const MAX_ROUTE = 100;
export const MAX_PITCHES = 50;
export const RESULTS = ['summit', 'bail'];

/**
 * The grade scale each discipline's sends/tries use. A new discipline (빙벽, 고산 …) is one line here, one in xp.js XP_TABLE, one in DISCIPLINES /
 * DISCIPLINE_NAME, and its grade keys added to ALL_GRADES in grades.js.
 */
export const SCALE = { boulder: V_GRADES, lead: GRADES, single: GRADES, multi: GRADES };
/** scaleOf(d) → the scale; a discipline this version does not know keeps whatever ALL_GRADES holds (its record is kept, just not counted). */
export const scaleOf = (d) => (Object.hasOwn(SCALE, d) ? SCALE[d] : ALL_GRADES);
/** cleanDiscipline(v) → a known discipline, or a plain lowercase word kept as is (a record from a newer version stays on restore), else 'lead'. */
export const cleanDiscipline = (v) => (DISCIPLINES.includes(v) ? v : typeof v === 'string' && /^[a-z]{2,16}$/.test(v) ? v : 'lead');

/** cleanMulti(v) → {route, pitches, top?, result} or null (no usable pitch count). */
export function cleanMulti(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const pitches = Number(v.pitches);
  if (!Number.isInteger(pitches) || pitches < 1) return null;
  const route = typeof v.route === 'string' ? v.route.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, MAX_ROUTE) : '';
  return { route, pitches: Math.min(pitches, MAX_PITCHES), ...(GRADES.includes(v.top) ? { top: v.top } : {}), result: RESULTS.includes(v.result) ? v.result : 'summit' };
}
