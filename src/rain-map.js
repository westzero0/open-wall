// 전국 비 예보 지도(D3b)의 판정: 같은 날 자연암장이 시·도별로 몇 곳이나 "비 예보 없음"인지. riskOf(D1 "다른 바위"와 같은 판정)만 쓴다. DOM·fetch·storage 없음.
import { riskOf } from './plan-risk.js';
import { NOT_ROCK } from './plan-alt.js';
import { distanceKm, shortName, wallPosition } from './viewmodel.js';
import { wallPageId } from './share-id.js';
import { symbolKind } from './plan-card.js';
import { skyKind } from './weather.js'; // plan-view.js re-exports this; importing from the source avoids a cycle (plan-view imports sidoOf from here)

const FAR_TEXT = '예보가 아직 바뀔 수 있어요';
const STATE = { ok: 'dry', caution: 'caution', hard: 'hard' };

/** '강원 원주시' → '강원' (the first word of region); '' when there is none. */
export const sidoOf = (region) => String(region ?? '').trim().split(/\s+/)[0];

const isOrigin = (c, resolved) => !!c && (c === resolved?.crag || c.name === resolved?.name);

/** The crags the map may show: natural crags with coordinates (not ice/mountain), the original place included. A crag plan only; any other plan → []. */
export function mapPlaces(crags, plan, resolved) {
  if (resolved?.kind !== 'crag') return [];
  return (Array.isArray(crags) ? crags : []).filter((c) => c && typeof c === 'object' && typeof c.name === 'string' && c.name && !NOT_ROCK.has(c.type) && wallPosition(c));
}

/** The mean coordinate of places that have one; null when none. */
export function regionPoint(places) {
  const pts = (Array.isArray(places) ? places : []).map((c) => wallPosition(c)).filter(Boolean);
  if (!pts.length) return null;
  return { lat: pts.reduce((a, p) => a + p.lat, 0) / pts.length, lng: pts.reduce((a, p) => a + p.lng, 0) / pts.length };
}

/**
 * rainRegions(places, wx, plan, { origin, now }) → Region[] nearest (from the original place) first.
 * Region = { sido, total, dry, unknown, at, km, here, rep, places: Row[] }; Row = { crag, state: 'dry'|'caution'|'hard'|'none', km, pending, phrase }.
 * rep = the day's numbers { tmax, mm, g, c } of the region's crag nearest the original place that has a forecast (null when none): the value the 기온·강수·바람 pins show.
 * A crag without a region is left out (no "지역 모름" pin). here = this is the original place's 시·도.
 */
export function rainRegions(places, wx, plan, { origin, now = Date.now() } = {}) {
  const groups = new Map();
  for (const c of Array.isArray(places) ? places : []) {
    const sido = sidoOf(c?.region), at = c && wallPosition(c);
    if (!sido || !at) continue;
    const risk = riskOf({ kind: 'crag', name: c.name, venue: 'natural', pos: at, located: true, reported: false, crag: c }, plan, wx, now);
    const km = origin?.pos ? distanceKm(origin.pos, at) : null;
    const row = { crag: c, state: STATE[risk.level] ?? 'none', km: Number.isFinite(km) ? km : null, pending: c.pending === true, phrase: risk.phrase };
    if (!groups.has(sido)) groups.set(sido, []);
    groups.get(sido).push(row);
  }
  const hereSido = sidoOf(origin?.crag?.region);
  const out = [];
  for (const [sido, rows] of groups) {
    rows.sort((a, b) => (b.state === 'dry') - (a.state === 'dry') || (a.km ?? Infinity) - (b.km ?? Infinity));
    const at = regionPoint(rows.map((r) => r.crag));
    const km = origin?.pos && at ? distanceKm(origin.pos, at) : null;
    const near = [...rows].sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity)).map((r) => wx?.crag?.daily?.get?.(r.crag.name)?.get?.(plan?.date)).find(Boolean);
    out.push({ sido, rep: near ? { tmax: near.tmax, mm: near.mm, g: near.g, c: near.c } : null, total: rows.length, dry: rows.filter((r) => r.state === 'dry').length, unknown: rows.filter((r) => r.state === 'none').length, at, km: Number.isFinite(km) ? km : null, here: sido === hereSido, places: rows });
  }
  return out.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
}

/** One row of a region, shaped like rockRow: { key, name, symbol, sub, tags, place, placeName, canSwap }. The original place gets no distance tag and no 바꾸기. */
export function rainRow(row, resolved) {
  const c = row.crag, origin = isOrigin(c, resolved);
  const tags = [row.state === 'dry' ? '비 예보 없음' : row.state === 'none' ? '예보 없음' : row.phrase];
  if (row.pending) tags.push('위치 확인 전');
  if (!origin && Number.isFinite(row.km)) tags.push(`약 ${Math.max(1, Math.round(row.km))}km`);
  const shown = tags.filter((t) => String(t ?? '').trim());
  return {
    key: wallPageId(c), name: shortName(c), symbol: symbolKind({ kind: 'crag', crag: c }),
    sub: shown.join(' · '), tags: shown,
    place: { kind: 'official', id: wallPageId(c) }, placeName: c.name,
    canSwap: !origin && (row.state === 'dry' || row.state === 'caution'),
  };
}

const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** What the sheet shows: { kind: 'loading'|'failed'|'all-rain'|'ok', summary, far }. Nothing judged (no forecast at all) reads as failed. */
export function rainMapView(regions, { loaded, ok, plan, now = Date.now() } = {}) {
  const list = Array.isArray(regions) ? regions : [];
  const total = list.reduce((a, r) => a + r.total, 0);
  const dry = list.reduce((a, r) => a + r.dry, 0);
  const judged = total - list.reduce((a, r) => a + r.unknown, 0);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(plan?.date ?? '');
  const diff = m ? Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - day0(new Date(now))) / 864e5) : 0;
  const kind = !loaded ? 'loading' : judged === 0 ? 'failed' : dry === 0 ? 'all-rain' : 'ok';
  return { kind, summary: `${total}곳 중 ${dry}곳 비 예보 없음`, far: diff >= 3 ? FAR_TEXT : null };
}

/** The pin's number: '3/5'; '—' when no crag of the region has a forecast; '0' when every judged crag has rain. */
export function pinText(r) {
  if (r.unknown >= r.total) return '—';
  return r.dry === 0 ? '0' : `${r.dry}/${r.total}`;
}

export const MODES = [['dry', '비 예보 없음'], ['temp', '기온'], ['rain', '강수'], ['wind', '바람']];
const sky = (c) => (Number.isFinite(c) ? ({ clear: 'sun', partly: 'sun', cloud: 'cloud', fog: 'cloud' }[skyKind(c).kind] ?? 'rain') : null);

/** What a pin shows in a mode: { text, icon }. dry → pinText (no icon); temp → the day's high + sky; rain → mm + sky; wind → the gust peak (m/s). '—' when the region has no forecast. */
export function pinFace(r, mode = 'dry') {
  if (mode === 'dry') return { text: pinText(r), icon: null };
  const p = r.rep;
  if (!p) return { text: '—', icon: null };
  if (mode === 'temp') return Number.isFinite(p.tmax) ? { text: `${Math.round(p.tmax)}°`, icon: sky(p.c) } : { text: '—', icon: null };
  if (mode === 'rain') return { text: `${p.mm < 10 && p.mm % 1 ? p.mm.toFixed(1) : Math.round(p.mm)}mm`, icon: sky(p.c) ?? (p.mm >= 1 ? 'rain' : null) };
  return { text: `${Math.round(p.g)}m/s`, icon: 'wind' };
}
