// src/stage.js — which features the current stage shows. config.stage 'beta' hides what needs many users or many records to mean
// anything (the 기록 showcase, 클라이머 유형 테스트, 이번 주말 추천); 'open' shows them all. No DOM.
import { config } from './config.js';

const NEEDS_OPEN = new Set(['pick', 'logShowcase']);

/** featureOn(name, cfg) → bool. 'climber' also needs its own switch (config.climberTest). */
export function featureOn(name, cfg = config) {
  if (name === 'climber') return !!cfg.climberTest && cfg.stage === 'open';
  return NEEDS_OPEN.has(name) && cfg.stage === 'open';
}

/** logSections({ open, hasRecords }) → the 기록 tab's sections, in order. Records are saved either way; beta only shows the plain visit list. */
export function logSections({ open, hasRecords }) {
  if (!hasRecords) return ['empty'];
  if (!open) return ['visitList', 'backup'];
  return ['activity', 'calendar', 'dayList', 'strip', 'yearMap', 'gradeYear', 'backup'];
}
