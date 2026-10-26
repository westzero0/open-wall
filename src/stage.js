// src/stage.js — which features the current stage shows. config.stage 'beta' hides what needs many users to mean anything (클라이머 유형 테스트,
// 이번 주말 추천); 'open' shows them. The 기록 tab opens per person, by how much they have recorded (TIERS below). No DOM.
import { config } from './config.js';

const NEEDS_OPEN = new Set(['pick']);

/** featureOn(name, cfg) → bool. 'climber' also needs its own switch (config.climberTest). */
export function featureOn(name, cfg = config) {
  if (name === 'climber') return !!cfg.climberTest && cfg.stage === 'open';
  return NEEDS_OPEN.has(name) && cfg.stage === 'open';
}

// 기록 단계 (docs/superpowers/specs/2026-10-21-staged-opening.md): what a person's own records unlock, in order. need: visits (records), months (distinct YYYY-MM), walls (distinct walls).
export const TIERS = [
  { id: 'summary', need: { visits: 3 } }, // the calendar itself is open from the first record; no `say`
  { id: 'poster', need: { visits: 5 }, say: '기록이 5번 쌓여서 카드 모아보기가 열렸어요.' },
  { id: 'seal', need: { visits: 10, months: 2 }, say: '두 달에 걸쳐 10번 다녀와서 올해 도장이 열렸어요.' },
  { id: 'passport', need: { walls: 5 } }, // no screen and no `say` yet (roadmap `passport`); give it a `say` the day it ships, or the note would announce nothing
];

/** tiersFor(log) → Set of tier ids this person's records have reached. Pure; the log is the normalized one. */
export function tiersFor(log) {
  const months = new Set(log.map((r) => r.date.slice(0, 7)));
  const walls = new Set(log.map((r) => r.wall));
  const have = { visits: log.length, months: months.size, walls: walls.size };
  return new Set(TIERS.filter((t) => Object.entries(t.need).every(([k, n]) => have[k] >= n)).map((t) => t.id));
}

/** newTier(unlocked, seen) → the first tier (in TIERS order) that is unlocked, has something to say, and is not yet seen, or null. */
export function newTier(unlocked, seen) {
  return TIERS.find((t) => t.say && unlocked.has(t.id) && !seen.has(t.id)) ?? null;
}

/** logSections({ tiers, hasRecords }) → the 기록 tab's sections, in order. The calendar is open from the first record; the poster strip and seal still open by tier. */
export function logSections({ tiers, hasRecords }) {
  if (!hasRecords) return ['empty'];
  const out = ['summary', 'activity', 'calendar', 'dayList', 'wallTable']; // 달력은 처음부터 펼침(2026-10-26); 날짜를 누르면 dayList가 열린다
  if (tiers.has('poster')) out.push('strip');
  if (tiers.has('seal')) out.push('yearMap', 'gradeYear');
  return [...out, 'backup'];
}
