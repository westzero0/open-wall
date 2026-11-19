// src/plan-sheet.js — pure helpers for the 일정 만들기/고치기 sheet (no DOM, no storage).
import { cleanPlan } from './plan-model.js';
import { draftToPlan } from './plan-draft.js';
import { timeText } from './plan-view.js';
import { searchPlaces } from './plan-place.js';
import { DAY_KO } from './time.js';

/** '14:30' → 870; '' or junk → null (time is optional). */
export function minFromTime(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t ?? ''));
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
}
export const timeFromMin = timeText;

/** '2026-11-21' → '토요일' (shown beside the 날짜 label: the field itself shows digits only); a cleared or junk value → ''. */
export function dowText(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ''));
  if (!m) return '';
  const at = new Date(+m[1], +m[2] - 1, +m[3]);
  return at.getMonth() === +m[2] - 1 ? `${DAY_KO[at.getDay()]}요일` : '';
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

/** Is the date before today? (YYYY-MM-DD strings compare in order; a cleared date is not past) The sheet only says so, never blocks. */
export const isPastDate = (date, today) => /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') && date < today;
export const PAST_NOTE = '지난 날짜예요. 이대로 저장할 수 있어요';
export const UNSAVED_NOTE = '저장하지 않았어요';
/** Pure: has the person typed or picked anything beyond what the sheet opened with? (then a tap on the backdrop must not throw it away) */
export function draftDirty(cur, init) {
  const ids = (a) => [...a].sort().join(',');
  return cur.date !== init.date || cur.time !== init.time || cur.query.trim() !== init.query.trim() || ids(cur.partnerIds) !== ids(init.partnerIds);
}
export const SAVE_FAIL = '저장하지 못했어요. 기기 저장 공간을 확인해 주세요';
