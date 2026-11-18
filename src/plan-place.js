// Place resolution and search for the planner. DOM-free.
import { wallPageId } from './share-id.js';
import { wallPosition, shortName, searchPicks } from './viewmodel.js';
import { resolveAlias } from './plan-api.js';
import { KINDS } from './season.js';

const pos = (w) => { const p = wallPosition(w); return p ? { lat: p.lat, lng: p.lng } : null; };

// Same name across official / name / mine is never merged here; only an alias (resolveAlias) turns a place official.
export function resolvePlace(place, { walls, crags, ice, mine, aliases, savedName = '' } = {}) {
  walls ??= []; crags ??= []; ice ??= []; mine ??= [];
  const p = resolveAlias(aliases ?? new Map(), place);
  const base = { pos: null, located: false, reported: false };
  if (p?.kind === 'official') {
    const wall = walls.find((w) => wallPageId(w) === p.id);
    if (wall) {
      const at = pos(wall);
      return { ...base, kind: 'wall', name: wall.name, venue: wall.venue === 'indoor' ? 'indoor' : 'outdoor', pos: at, located: !!at, wall };
    }
    const crag = crags.find((c) => wallPageId(c) === p.id);
    if (crag) {
      const at = pos(crag);
      return { ...base, kind: 'crag', name: crag.name, venue: 'natural', pos: at, located: !!at, crag };
    }
    const iv = ice.find((v) => wallPageId(v) === p.id);
    if (iv) {
      const at = pos(iv);
      return { ...base, kind: 'ice', name: iv.name, venue: 'ice', pos: at, located: !!at, ice: iv };
    }
    return { ...base, kind: 'name', name: savedName, venue: null };
  }
  if (p?.kind === 'mine') {
    const m = mine.find((x) => x.id === p.id);
    return { ...base, kind: 'mine', name: m?.name ?? p.name ?? savedName, venue: m?.venue ?? null, mineWall: m, reported: m?.reported === true };
  }
  return { ...base, kind: 'name', name: p?.name ?? savedName, venue: null };
}

const mineRow = (m) => ({ kind: 'mine', key: 'mine:' + m.id, label: m.name, sub: m.region || '내 암장', place: { kind: 'mine', id: m.id, name: m.name } });
const wallRow = (w) => ({ kind: 'wall', key: 'official:' + wallPageId(w), label: shortName(w), sub: w.region ?? '', place: { kind: 'official', id: wallPageId(w) } });
const cragRow = (c) => ({ kind: 'crag', key: 'official:' + wallPageId(c), label: c.name, sub: [c.region, '자연암장'].filter(Boolean).join(' · '), place: { kind: 'official', id: wallPageId(c) } });
const iceRow = (v) => ({ kind: 'ice', key: 'official:' + wallPageId(v), label: v.name, sub: [v.region, '빙벽장'].filter(Boolean).join(' · '), place: { kind: 'official', id: wallPageId(v) } });

// The browse list: rows of the given kinds ('mine' and src/season.js KINDS), in that order. The planner passes only the kinds in season.
export function listChoices({ walls, crags, ice, mine } = {}, kinds = ['mine', ...KINDS]) {
  const of = {
    mine: () => (mine ?? []).filter((m) => typeof m?.name === 'string').map(mineRow),
    wall: () => (walls ?? []).map(wallRow),
    crag: () => (crags ?? []).map(cragRow),
    ice: () => (ice ?? []).filter((v) => typeof v?.name === 'string').map(iceRow),
  };
  return kinds.flatMap((k) => of[k]?.() ?? []);
}

const norm = (v) => String(v ?? '').trim().normalize('NFC').replace(/\s+/g, ' ').toLowerCase();

// Search ignores seasons: every kind whose name matches is listed.
export function searchPlaces(q, { walls, crags, ice, mine } = {}) {
  const s = String(q ?? '').trim().normalize('NFC').replace(/\s+/g, ' ');
  if (!s) return [];
  const k = s.toLowerCase();
  const hit = (w) => searchPicks([w], s).length > 0 || norm(w.short_name).includes(k);
  const named = (e) => typeof e?.name === 'string';
  const items = [
    ...(mine ?? []).filter((m) => named(m) && norm(m.name).includes(k)).map((m) => [m, mineRow(m)]),
    ...(walls ?? []).filter(hit).map((w) => [w, wallRow(w)]),
    ...(crags ?? []).filter((c) => named(c) && searchPicks([c], s).length).map((c) => [c, cragRow(c)]),
    ...(ice ?? []).filter((v) => named(v) && hit(v)).map((v) => [v, iceRow(v)]),
  ];
  const isExact = ([e]) => norm(e.name) === k || norm(e.short_name) === k;
  const nameRow = { key: 'name:' + s, label: `"${s}" 이름만 쓰기`, sub: '', place: { kind: 'name', name: s } };
  return [...items.filter(isExact).map((x) => x[1]), nameRow, ...items.filter((x) => !isExact(x)).map((x) => x[1])];
}
