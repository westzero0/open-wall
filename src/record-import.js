// src/record-import.js — 피치 기록 내보내기 파일(명세 0.x) → 일정앱 지난 일정. No DOM, no storage.
// Spec: docs/superpowers/specs/2026-11-18-record-format.md §5·§6. Files are untrusted: the plans made here still go through cleanPlan.
import { ID_RE, validDate } from './log.js';
import { cleanLine } from './clean-line.js';
import { MAX_NAME, WALL_ID_RE } from './store.js';
import { AUTHOR_RE } from './author-id.js';
import { MEMO_MAX } from './plan-model.js';
import { wallPageId } from './share-id.js';
import { resolveAlias } from './plan-api.js';

export const MAX_FILE = 1_000_000;
const MAX_ROUTES = 20;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const firstLine = (v) => (typeof v === 'string' ? cleanLine(v.split(/\r\n|\r|\n/)[0], MEMO_MAX) : '');

/** text → { ok: true, rec } | { ok: false, reason: 'json'|'size'|'version'|'date'|'place' } */
export function parseRecord(text) {
  if (typeof text !== 'string') return { ok: false, reason: 'json' };
  if (text.length > MAX_FILE) return { ok: false, reason: 'size' };
  let j;
  try { j = JSON.parse(text); } catch { return { ok: false, reason: 'json' }; }
  if (!isObj(j)) return { ok: false, reason: 'json' };
  if (typeof j.schema_version !== 'string' || j.schema_version.split('.')[0] !== '0') return { ok: false, reason: 'version' };
  const c = isObj(j.climb) ? j.climb : {};
  if (!validDate(c.date)) return { ok: false, reason: 'date' };
  const areaId = typeof c.area_id === 'string' && ID_RE.test(c.area_id) ? c.area_id : null;
  const area = cleanLine(c.area, MAX_NAME);
  if (!areaId && !area) return { ok: false, reason: 'place' };
  const routes = [...new Set((Array.isArray(c.routes) ? c.routes : []).map((r) => cleanLine(r, 40)).filter(Boolean))].slice(0, MAX_ROUTES);
  const depart = isObj(c.times) && typeof c.times.depart === 'string' ? c.times.depart : null;
  return {
    ok: true,
    rec: { recordId: typeof j.record_id === 'string' && AUTHOR_RE.test(j.record_id) ? j.record_id : null, date: c.date, areaId, area, routes, highlight: firstLine(c.highlight), depart },
  };
}

/** A record's area_id → the official 8-char place id (the id itself, or the entry whose aliases hold it), else null. */
export function placeIdOf(areaId, { walls = [], crags = [], ice = [] } = {}) {
  if (typeof areaId !== 'string' || !areaId) return null;
  const all = [...walls, ...crags, ...ice];
  if (WALL_ID_RE.test(areaId) && all.some((x) => wallPageId(x) === areaId)) return areaId;
  const hit = all.find((x) => Array.isArray(x?.aliases) && x.aliases.includes(areaId));
  return hit ? wallPageId(hit) : null;
}

const planPlaceId = (p, aliases) => { const r = resolveAlias(aliases, p.place); return r?.kind === 'official' ? r.id : null; };

/**
 * recs (parseRecord's rec) × the stored plans → { create: [{ rec, placeId }], link: [{ planId, rec, statusChanged }], same: [rec] }.
 * Order (spec §5): same recordId → date + place id → date + place name (when either side has no id) → create.
 * A plan is linked at most once and never when it already carries a recordId; a rec without recordId matching such a plan is `same`.
 * Within one batch a repeated recordId keeps the first.
 */
export function planImport(recs, plans, { walls, crags, ice, aliases = new Map() } = {}) {
  const out = { create: [], link: [], same: [] };
  const seen = new Set(), used = new Set();
  const byAge = [...plans].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  for (const rec of recs) {
    if (rec.recordId) {
      if (seen.has(rec.recordId)) continue;
      seen.add(rec.recordId);
      if (plans.some((p) => p.recordId === rec.recordId)) { out.same.push(rec); continue; }
    }
    const placeId = placeIdOf(rec.areaId, { walls, crags, ice });
    const samePlace = (p) => {
      if (p.date !== rec.date || used.has(p.id)) return false;
      const pid = planPlaceId(p, aliases);
      if (placeId && pid) return pid === placeId;
      const name = cleanLine(p.placeName, MAX_NAME);
      return !!name && name === rec.area;
    };
    const hit = byAge.find((p) => !p.recordId && samePlace(p));
    if (hit) { used.add(hit.id); out.link.push({ planId: hit.id, rec, statusChanged: hit.status !== '갔다' }); }
    else if (!rec.recordId && byAge.some((p) => p.recordId && samePlace(p))) out.same.push(rec); // an old (0.3) file of a day already linked: not a second climb
    else out.create.push({ rec, placeId });
  }
  return out;
}

/** `루트: A, B` + the highlight's first line, within MEMO_MAX; '' when neither. */
export function summaryMemo(rec) {
  const lines = [];
  if (rec.routes?.length) lines.push('루트: ' + rec.routes.join(', '));
  if (rec.highlight) lines.push(rec.highlight);
  return [...lines.join('\n')].slice(0, MEMO_MAX).join('');
}

// times.depart → minutes of that day, only when it is the record's own date ('2026-07-31T07:30…' → 450).
function departMin(rec) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(rec.depart ?? '');
  if (!m || m[1] !== rec.date) return null;
  const n = +m[2] * 60 + +m[3];
  return n <= 1439 ? n : null;
}

/** A new past plan (before cleanPlan). Partners are not imported (spec §5). */
export function planFromRecord(rec, placeId, { id, authorId, now }) {
  const name = rec.area || rec.areaId; // ponytail: an unresolved area_id with no name shows the raw id; the user can rename the plan
  return {
    id, authorId, date: rec.date, min: departMin(rec),
    place: placeId ? { kind: 'official', id: placeId } : { kind: 'name', name },
    placeName: name,
    discipline: 'multi', status: '갔다',
    record: { memo: summaryMemo(rec) },
    recordId: rec.recordId,
    createdAt: now, updatedAt: now,
  };
}

/** The stored plan linked to a record: recordId set, status 갔다, the memo filled only when it was empty. */
export function linkPatch(plan, rec) {
  return { ...plan, recordId: rec.recordId, status: '갔다', record: { ...plan.record, memo: plan.record?.memo || summaryMemo(rec) } };
}
