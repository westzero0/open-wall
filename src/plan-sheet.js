// src/plan-sheet.js — pure helpers for the 일정 만들기/고치기 sheet (no DOM, no storage).
import { cleanPlan } from './plan-model.js';
import { draftToPlan } from './plan-draft.js';
import { timeText } from './plan-view.js';
import { searchPlaces } from './plan-place.js';

/** '14:30' → 870; '' or junk → null (time is optional). */
export function minFromTime(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t ?? ''));
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
}
export const timeFromMin = timeText;

const norm = (v) => String(v ?? '').trim().normalize('NFC').replace(/\s+/g, ' ').toLowerCase();

/** What the place box holds: a picked place, else the typed text as a name-only place (so typing a name is enough to save). */
export function placeOf(picked, query, ctx) {
  if (picked) return picked;
  const name = String(query ?? '').trim();
  if (!name) return null;
  const k = norm(name);
  const same = (e) => typeof e?.name === 'string' && (norm(e.name) === k || norm(e.short_name) === k);
  const exact = ctx && [...(ctx.mine ?? []), ...(ctx.walls ?? []), ...(ctx.crags ?? [])].some(same); // only an EXACT name, never the fuzzy first hit
  const top = exact ? searchPlaces(name, ctx)[0] : null; // an exact official/mine name is ranked first by searchPlaces
  return top && top.place.kind !== 'name' ? top.place : { kind: 'name', name };
}

/** → a clean Plan or null. New: draftToPlan. Edit: keep everything else, only 쉼 goes back to 예정 (re-planned); 갔다/못 갔다 keep status, changedFrom only while the place is unchanged. */
export function planFromDraft(existing, draft, { id, now, resolved }) {
  if (!existing) return draftToPlan(draft, { authorId: '', id, now, resolved });
  const same = JSON.stringify(existing.place) === JSON.stringify(draft.place);
  const keep = new Set(draft.partnerIds);
  return cleanPlan({
    ...existing, date: draft.date, min: draft.min, place: draft.place, placeName: resolved?.name ?? draft.place?.name ?? '',
    partnerIds: draft.partnerIds, participants: (existing.participants ?? []).filter((p) => keep.has(p.partnerId)),
    ...(existing.status === '쉼' ? { status: '예정', restReason: null } : {}), changedFrom: same ? existing.changedFrom : null,
  });
}

export const SAVE_FAIL = '저장하지 못했어요. 기기 저장 공간을 확인해 주세요';
