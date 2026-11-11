// Forecast loading for the planner. DOM-free; fetchFn / storage are injected. Never throws.
import { listForecastUrl, parseListForecast, weatherFresh } from './weather.js';
import { loadCragWeather } from './crag-weather.js';
import { getJson } from './remote.js';
import { wallPosition } from './viewmodel.js';

const memory = new Map(); // wall key -> { hours, at }: outdoor-wall hourly, reused for 3 hours (weatherFresh)
const keyOf = (w, p) => `${w.name}|${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;

/**
 * loadPlanWeather({ walls, crags }, { fetchFn, storage, now, cache }) → { hourly: Map name → Map hour → {t,c,g}, crag: {daily,hourly,wet,ok}, ok }
 * Pass only places the plans use; places without coordinates are skipped. A failed part stays empty and ok is false.
 */
export async function loadPlanWeather({ walls = [], crags = [] } = {}, { fetchFn, storage = null, now = Date.now(), cache = memory } = {}) {
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
  return { hourly, crag, ok: wallsOk && crag.ok };
}
