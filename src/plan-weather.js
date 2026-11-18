// Forecast loading for the planner. DOM-free; fetchFn / storage are injected. Never throws.
import { listForecastUrl, parseListForecast, weatherFresh, iceForecastUrl, parseIceForecast } from './weather.js';
import { loadCragWeather } from './crag-weather.js';
import { getJson } from './remote.js';
import { wallPosition } from './viewmodel.js';

const memory = new Map(); // wall key -> { hours, at }: outdoor-wall hourly, reused for 3 hours (weatherFresh)
const ICE_FRESH_MS = 3 * 3600e3; // ice temperatures are reused for 3 hours, like the wall hourly
const iceKey = (v) => `ice|${v.id}|${v.lat.toFixed(2)},${v.lng.toFixed(2)}`;
const keyOf = (w, p) => `${w.name}|${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;

/**
 * loadPlanWeather({ walls, crags, ice }, { fetchFn, storage, now, cache }) → { hourly: Map name → Map hour → {t,c,g}, crag: {daily,hourly,wet,ok}, ice: { byId: Map id → {days,hours}, ok }, ok }
 * ice: [{ id, lat, lng }] — the ice venues the plans use (planner-state passes only located ones). Its failure leaves the walls and crags as they are.
 * Pass only places the plans use; places without coordinates are skipped. A failed part stays empty and ok is false.
 */
export async function loadPlanWeather({ walls = [], crags = [], ice = [] } = {}, { fetchFn, storage = null, now = Date.now(), cache = memory } = {}) {
  const spots = [...new Map(walls.map((w) => [w.name, w])).values()].map((w) => [w, wallPosition(w)]).filter(([, p]) => p);
  const hourly = new Map();
  const stale = [];
  for (const [w, p] of spots) {
    const hit = cache.get(keyOf(w, p));
    if (weatherFresh(hit, now) && hit.hours) hourly.set(w.name, hit.hours); else stale.push([w, p]);
  }
  let wallsOk = true;
  if (stale.length) {
    try {
      const maps = parseListForecast(await getJson(listForecastUrl(stale.map(([, p]) => p)), { fetchFn }), stale.length);
      if (!maps) wallsOk = false;
      else stale.forEach(([w, p], i) => { cache.set(keyOf(w, p), { hours: maps[i], at: now }); hourly.set(w.name, maps[i]); });
    } catch { wallsOk = false; }
  }
  let crag = { daily: new Map(), hourly: new Map(), wet: new Map(), ok: true };
  if (crags.length) {
    try { crag = await loadCragWeather(crags, { fetchFn, storage, now }); } catch { crag = { ...crag, ok: false }; }
  }
  const byId = new Map();
  const ask = [];
  for (const v of ice) {
    const hit = cache.get(iceKey(v));
    if (hit?.ice && now - hit.at < ICE_FRESH_MS) byId.set(v.id, hit.ice); else ask.push(v);
  }
  let iceOk = true;
  if (ask.length) {
    try {
      const list = parseIceForecast(await getJson(iceForecastUrl(ask), { fetchFn }), ask.length);
      if (!list) iceOk = false;
      else ask.forEach((v, i) => { cache.set(iceKey(v), { ice: list[i], at: now }); byId.set(v.id, list[i]); });
    } catch { iceOk = false; }
  }
  return { hourly, crag, ice: { byId, ok: iceOk }, ok: wallsOk && crag.ok && iceOk };
}
