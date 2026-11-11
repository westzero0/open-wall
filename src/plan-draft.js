// The "새 일정" draft: only a date and a place name are required. No DOM, no storage.
import { cleanPlan, cleanMineWall } from './plan-model.js';

export const emptyDraft = (today) => ({ date: today, min: null, place: null, partnerIds: [] });

export function draftReady(d) {
  const p = d?.place;
  if (!d?.date || !p) return false;
  return p.kind === 'official' || p.kind === 'mine' || (p.kind === 'name' && typeof p.name === 'string' && p.name.trim() !== '');
}

/** → a clean Plan, or null while not ready (nothing else blocks saving). */
export function draftToPlan(d, { authorId, id, now, resolved }) {
  if (!draftReady(d)) return null;
  return cleanPlan({
    id, authorId, date: d.date, min: d.min, place: d.place, placeName: resolved?.name ?? d.place.name ?? '',
    partnerIds: d.partnerIds, status: '예정', createdAt: now,
  });
}

/** Only the name is required; no coordinates by schema. */
export const addMine = (f, { authorId, id }) => cleanMineWall({ id, authorId, name: f?.name, region: f?.region, venue: f?.venue, address: f?.address, reported: false });
