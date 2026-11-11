// src/plan-model.js — climber-planner entities (plan, partner, mine wall, settings, record) made safe. No DOM, no storage.
// Every function takes untrusted input (localStorage, imports) and returns clean values; nothing throws.
import { ID_RE, validDate } from './log.js';
import { cleanLine } from './clean-line.js';
import { MAX_NAME, MAX_REGION, MAX_ADDRESS } from './store.js';
import { GRADES } from './grades.js';
import { AUTHOR_RE } from './author-id.js';

export const STATUS = ['예정', '갔다', '못 갔다', '쉼'];
export const PARTICIPANT = ['수락', '대기', '거절'];
export const MISS_REASONS = ['날씨', '컨디션', '파트너 사정', '기타'];
export const NOTE_MAX = 100;
export const MEMO_MAX = 300;
const MAX_PLANS = 1000, MAX_PARTNERS = 200, MAX_MINE = 200, MAX_KEYS = 200, MAX_ASCENTS = 20, MAX_PARTNER_NAME = 12;
const ASCENT_STYLES = ['onsight', 'flash', 'redpoint', 'toprope'];
const ROUTE_ID_RE = /^r\d{1,6}$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const intIn = (v, lo, hi) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};
const pickAuthor = (v) => (typeof v === 'string' && AUTHOR_RE.test(v) ? v : ''); // invalid -> '' (plan-api fills the device id); the entity is kept
const stamp = (v) => (Number.isFinite(v) ? v : 0);
const DISCIPLINES = ['wall', 'boulder', 'lead', 'single', 'multi'];
const pickId = (v) => (typeof v === 'string' && ID_RE.test(v) ? v : null);

/** 32 lowercase hex chars (same shape as author-id's AUTHOR_RE). */
export function randomId(random = (a) => crypto.getRandomValues(a)) {
  return [...random(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function cleanPlace(v) {
  if (!isObj(v)) return null;
  if (v.kind === 'official') { const id = pickId(v.id); return id ? { kind: 'official', id } : null; }
  if (v.kind === 'mine') {
    const id = pickId(v.id);
    if (!id) return null;
    const name = cleanLine(v.name, MAX_NAME);
    return name ? { kind: 'mine', id, name } : { kind: 'mine', id };
  }
  if (v.kind === 'name') { const name = cleanLine(v.name, MAX_NAME); return name ? { kind: 'name', name } : null; }
  return null;
}

// Memo: up to MEMO_MAX code points, newlines allowed (blank lines collapse); each line goes through cleanLine.
function cleanMemo(v) {
  if (typeof v !== 'string') return '';
  const s = v.split(/\r\n|\r|\n/).map((l) => cleanLine(l, MEMO_MAX)).filter(Boolean).join('\n');
  return [...s].slice(0, MEMO_MAX).join('').trim();
}

function cleanAscents(v) {
  if (!Array.isArray(v)) return [];
  const out = [], seen = new Set();
  for (const a of v) {
    if (out.length >= MAX_ASCENTS) break;
    if (!isObj(a)) continue;
    const routeId = typeof a.routeId === 'string' && ROUTE_ID_RE.test(a.routeId) ? a.routeId : null;
    const routeName = cleanLine(a.routeName, 40);
    if (!routeId && !routeName) continue;
    if (routeId) { if (seen.has(routeId)) continue; }
    const result = a.result;
    let line;
    if (result === 'sent') {
      if (!ASCENT_STYLES.includes(a.style)) continue;
      line = { routeId, routeName, result, style: a.style, tries: null, note: cleanLine(a.note, NOTE_MAX) };
    } else if (result === 'tried') {
      line = { routeId, routeName, result, style: null, tries: intIn(a.tries, 1, 99) ?? (intIn(a.tries, 100, Infinity) ? 99 : 1), note: cleanLine(a.note, NOTE_MAX) };
    } else continue;
    if (routeId) seen.add(routeId);
    out.push(line);
  }
  return out;
}

/** The record core: all fields, every one empty/null by default. plan-fields.js filters it per discipline. */
export function cleanRecord(raw) {
  const r = isObj(raw) ? raw : {};
  const attempts = intIn(r.attempts, 0, 99) ?? 0;
  const sends = Math.min(intIn(r.sends, 0, 99) ?? 0, attempts);
  return {
    attempts, sends,
    hardest: GRADES.includes(r.hardest) ? r.hardest : null,
    ascents: cleanAscents(r.ascents),
    memo: cleanMemo(r.memo),
    missReason: MISS_REASONS.includes(r.missReason) ? r.missReason : null,
    crowdAsked: r.crowdAsked === true,
  };
}

export function cleanPlan(v, opts) {
  if (!isObj(v)) return null;
  const id = pickId(v.id), authorId = pickAuthor(v.authorId);
  if (!id || !validDate(v.date)) return null;
  const place = cleanPlace(v.place);
  if (!place) return null;
  const partnerIds = [...new Set((Array.isArray(v.partnerIds) ? v.partnerIds : []).map(pickId).filter(Boolean))];
  const participants = [], seen = new Set();
  for (const p of Array.isArray(v.participants) ? v.participants : []) {
    const partnerId = isObj(p) ? pickId(p.partnerId) : null;
    if (!partnerId || seen.has(partnerId)) continue;
    seen.add(partnerId);
    participants.push({ partnerId, status: PARTICIPANT.includes(p.status) ? p.status : '대기' });
  }
  const changedName = isObj(v.changedFrom) ? cleanLine(v.changedFrom.placeName, MAX_NAME) : '';
  return {
    id, authorId, date: v.date,
    min: intIn(v.min, 0, 1439),
    place,
    placeName: cleanLine(v.placeName, MAX_NAME) || place.name || '',
    partnerIds, participants,
    status: STATUS.includes(v.status) ? v.status : '예정',
    changedFrom: changedName ? { placeName: changedName } : null,
    restReason: v.restReason === '날씨' ? '날씨' : null,
    record: cleanRecord(v.record),
    createdAt: Number.isFinite(v.createdAt) ? v.createdAt : 0,
    updatedAt: stamp(v.updatedAt),
    discipline: DISCIPLINES.includes(v.discipline) ? v.discipline : null,
  };
}

export function cleanPartner(v) {
  if (!isObj(v)) return null;
  const id = pickId(v.id), authorId = pickAuthor(v.authorId), name = cleanLine(v.name, MAX_PARTNER_NAME);
  return id && name ? { id, authorId, name, accountId: null, updatedAt: stamp(v.updatedAt) } : null;
}

// Not a wall record (no coordinates, never in state.walls), so it skips normalizeWall; same limits are applied here.
export function cleanMineWall(v) {
  if (!isObj(v)) return null;
  const id = pickId(v.id), authorId = pickAuthor(v.authorId), name = cleanLine(v.name, MAX_NAME);
  if (!id || !name) return null;
  return {
    id, authorId, name,
    region: cleanLine(v.region, MAX_REGION),
    venue: v.venue === 'indoor' || v.venue === 'outdoor' ? v.venue : null,
    address: cleanLine(v.address, MAX_ADDRESS),
    reported: v.reported === true,
    updatedAt: stamp(v.updatedAt),
  };
}

const keyList = (v) => (Array.isArray(v) ? [...new Set(v.map((k) => cleanLine(k, 100)).filter(Boolean))].slice(0, MAX_KEYS) : []);

export function cleanSettings(v) {
  const s = isObj(v) ? v : {};
  return {
    crowdSkips: (() => { const n = typeof s.crowdSkips === 'string' && s.crowdSkips.trim() !== '' ? Number(s.crowdSkips) : s.crowdSkips; return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.trunc(n))) : 0; })(),
    crowdAsk: s.crowdAsk !== false,
    reportDismissed: keyList(s.reportDismissed),
    reportedKeys: keyList(s.reportedKeys),
  };
}

function cleanList(list, clean, max, opts) {
  const out = [], seen = new Set();
  for (const x of Array.isArray(list) ? list : []) {
    if (out.length >= max) break;
    const c = clean(x, opts);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

export function cleanAll(raw, opts) {
  const { today } = opts ?? {};
  const r = isObj(raw) ? raw : {};
  return {
    plans: cleanList(r.plans, cleanPlan, MAX_PLANS, { today }),
    partners: cleanList(r.partners, cleanPartner, MAX_PARTNERS),
    mine: cleanList(r.mine, cleanMineWall, MAX_MINE),
    settings: cleanSettings(r.settings),
  };
}
