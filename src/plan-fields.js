// src/plan-fields.js — which record fields each discipline shows/keeps, plus route history. No DOM.
import { cleanRecord as cleanCore } from './plan-model.js';

export const STYLES = {
  single: ['onsight', 'flash', 'redpoint', 'toprope'],
  boulder: ['flash', 'redpoint'],
  multiLead: ['onsight', 'flash', 'redpoint'],
};
export const STYLE_NAME = { onsight: '온사이트', flash: '플래시', redpoint: '레드포인트', toprope: '탑로핑' };

// Table only: boulder/multi screens show one memo line in v1.
export const FIELDS_BY = {
  wall: { fields: ['attempts', 'sends', 'hardest', 'memo'], styles: null },
  crag: { fields: ['ascents', 'memo'], styles: STYLES.single },
  boulder: { fields: ['memo'], styles: STYLES.boulder },
  multi: { fields: ['memo'], role: ['선등', '후등'], styles: STYLES.multiLead, stylesOnlyFor: '선등' },
};

const BY_DISCIPLINE = { wall: 'wall', single: 'crag', boulder: 'memo', lead: 'memo', multi: 'memo' };

/** plan.discipline (when set) wins over the place kind. */
export function fieldsKeyOf(resolved, plan) {
  const d = BY_DISCIPLINE[plan?.discipline];
  if (d) return d;
  const k = resolved && resolved.kind;
  if (k === 'wall') return 'wall';
  if (k === 'crag' || k === 'mine' || k === 'name') return 'crag';
  return 'memo';
}

/** Core clean, then keep only what this discipline owns. */
export function cleanRecord(raw, fieldsKey) {
  const r = cleanCore(raw);
  if (fieldsKey === 'wall') r.ascents = [];
  else if (fieldsKey === 'crag') { r.attempts = 0; r.sends = 0; r.hardest = null; }
  else { r.attempts = 0; r.sends = 0; r.hardest = null; r.ascents = []; }
  return r;
}

/** Earlier tries/sends of one route across the device's plans. */
export function routeHistory(plans, routeId) {
  let tried = 0, sent = false;
  for (const p of Array.isArray(plans) ? plans : []) {
    for (const a of (p && p.record && p.record.ascents) || []) {
      if (!routeId || a.routeId !== routeId) continue;
      if (a.result === 'sent') sent = true;
      else tried += a.tries || 1;
    }
  }
  return { tried, sent };
}

/** Styles the picker offers; a prior try rules out onsight/flash. (A prior send only gets a check mark in the UI.) */
export function styleOptions(history) {
  const h = history || {};
  return h.tried > 0 ? STYLES.single.filter((s) => s !== 'onsight' && s !== 'flash') : [...STYLES.single];
}
