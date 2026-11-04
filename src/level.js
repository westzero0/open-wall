// src/level.js — 레벨: XP → level (never stored, always counted from the records), the highest grade of each discipline, and the numbers
// the 내 클라이밍 card draws. No DOM.
import { DISCIPLINES, DISCIPLINE_NAME, scaleOf } from './discipline.js';
import { activityXp, climbXpByDiscipline } from './xp.js';

/** Level L starts at LEVEL_K × L² XP: quick at first, slower as it goes (first draft, tune here). */
export const LEVEL_K = 10;
const wholeXp = (xp) => Math.max(0, Math.floor(Number(xp) || 0));
export const levelOf = (xp) => Math.floor(Math.sqrt(wholeXp(xp) / LEVEL_K));

/** levelInfo(xp) → {level, xp, floor, next, need, frac}: floor/next are the XP at this and the next level, frac how far between (0..1). */
export function levelInfo(xp) {
  const x = wholeXp(xp);
  const level = levelOf(x);
  const floor = LEVEL_K * level * level;
  const next = LEVEL_K * (level + 1) ** 2;
  return { level, xp: x, floor, next, need: next - x, frac: (x - floor) / (next - floor) };
}

/** topGrade(log, discipline) → the highest sent grade there (multi-pitch: the highest top grade), null when none. */
export function topGrade(log, discipline) {
  const scale = scaleOf(discipline);
  let best = -1;
  for (const r of log) {
    if ((r.discipline ?? 'lead') !== discipline) continue;
    for (const g of discipline === 'multi' ? [r.multi?.result === 'summit' ? r.multi.top : undefined] : Object.keys(r.sends ?? {})) best = Math.max(best, scale.indexOf(g));
  }
  return best < 0 ? null : scale[best];
}

/** climberStats(log) → { total: {...levelInfo, climb, activity}, disciplines: [{key, name, top, ...levelInfo}] } — total = all climbing XP + 활동 XP. */
export function climberStats(log) {
  const by = climbXpByDiscipline(log);
  const activity = activityXp(log);
  const climb = DISCIPLINES.reduce((sum, d) => sum + by[d], 0);
  return {
    total: { ...levelInfo(climb + activity), climb, activity },
    disciplines: DISCIPLINES.map((key) => ({ key, name: DISCIPLINE_NAME[key], top: topGrade(log, key), ...levelInfo(by[key]) })),
  };
}

/** levelUps(before, after) → [{name, level}] for every level that rose ('내 레벨' is the total). */
export function levelUps(before, after) {
  const ups = [];
  if (after.total.level > before.total.level) ups.push({ name: '내 레벨', level: after.total.level });
  after.disciplines.forEach((d, i) => { if (d.level > before.disciplines[i].level) ups.push({ name: d.name, level: d.level }); });
  return ups;
}
