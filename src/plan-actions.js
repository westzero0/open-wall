// src/plan-actions.js — pure status transitions and the one-line summary. Inputs are never mutated.
import { MISS_REASONS, cleanRecord as cleanCore } from './plan-model.js';
import { STYLES, STYLE_NAME, cleanRecord } from './plan-fields.js';

export const markWent = (plan) => ({ ...plan, status: '갔다' });
export const markMissed = (plan, reason = null) => ({ ...plan, status: '못 갔다', record: { ...plan.record, missReason: MISS_REASONS.includes(reason) ? reason : null } });
export const rest = (plan) => ({ ...plan, status: '쉼', restReason: '날씨' });
export const changePlace = (plan, place, placeName) => ({ ...plan, place, placeName, changedFrom: { placeName: plan.placeName }, status: plan.status });

/** raw = the fields the form edits; missReason/crowdAsked stay as they were. */
export function saveRecord(plan, raw, fieldsKey) {
  const r = fieldsKey ? cleanRecord(raw, fieldsKey) : cleanCore(raw);
  const old = plan.record || {};
  return { ...plan, record: { ...r, missReason: old.missReason ?? null, crowdAsked: old.crowdAsked === true } };
}

/** today (optional): a 쉼 plan dated today or later reads `쉬기로 했어요`, an earlier one `쉬었어요`. */
export function recordSummary(plan, today = null) {
  if (!plan) return null;
  const r = plan.record || {};
  if (plan.status === '쉼') return `${today && plan.date >= today ? '쉬기로 했어요' : '쉬었어요'} · 날씨`;
  if (plan.status === '못 갔다') return '못 갔어요' + (r.missReason ? ` · ${r.missReason}` : '');
  if (plan.status !== '갔다') return null;
  const asc = r.ascents || [];
  if (asc.length) {
    const parts = [`루트 ${asc.length}`];
    for (const s of STYLES.single) { const n = asc.filter((a) => a.result === 'sent' && a.style === s).length; if (n) parts.push(`${STYLE_NAME[s]} ${n}`); }
    const t = asc.filter((a) => a.result === 'tried').length;
    if (t) parts.push(`시도 ${t}`);
    return parts.join(' · ');
  }
  if (r.sends > 0) return `완등 ${r.sends} / 시도 ${r.attempts}`;
  if (r.attempts > 0) return `시도 ${r.attempts}`;
  if (r.memo) return '메모 있음';
  return '다녀왔어요';
}

export const participantsOf = (plan) => (plan.partnerIds || []).map((partnerId) => ({ partnerId, status: '수락' }));
