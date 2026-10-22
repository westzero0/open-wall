// 싱글피치 암장의 날씨: 일별 강수(지난 7일 + 예보 7일)와 시간별 기온·하늘을 한 번에 받아 암장 이름으로 찾게 한다.
// weather.js의 요청·검증 함수를 재사용하고, 요청에는 암장 좌표(소수 2자리)만 실린다. 네트워크와 저장소는 주입받는다(DOM 없음).
// 성공한 답은 3시간 동안 기기에 두고, 실패한 답은 저장하지 않는다(좋은 복사본을 실패가 덮어쓰지 않는다).
import { cragForecastUrl, listForecastUrl, parseDaily, parseListForecast, weatherFresh } from './weather.js';
import { wallPosition } from './viewmodel.js';

export const CRAG_WX_KEY = 'open-wall:wx-crag';
const TIMEOUT_MS = 8000;

// names and coordinates (2 decimals, what is sent): a crag added, removed or moved asks again
const keyOf = (spots) => spots.map(([c, p]) => `${c.name}@${p.lat.toFixed(2)},${p.lng.toFixed(2)}`).join('|');

function readCache(storage) {
  try {
    const v = JSON.parse(storage?.getItem(CRAG_WX_KEY));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch { return null; /* no copy, or a broken one: ask */ }
}

// A body that is not what was asked for (wrong number of places, odd numbers) becomes an empty map, never a half-trusted one.
function build(spots, dailyJson, hourlyJson) {
  const daily = dailyJson == null ? null : parseDaily(dailyJson, spots.length);
  const hourly = hourlyJson == null ? null : parseListForecast(hourlyJson, spots.length);
  return {
    daily: new Map(daily ? spots.map(([c], i) => [c.name, daily[i]]) : []),
    hourly: new Map(hourly ? spots.map(([c], i) => [c.name, hourly[i]]) : []),
    ok: !!daily && !!hourly,
  };
}

async function ask(fetchFn, url) {
  try {
    const res = await fetchFn(url, { credentials: 'omit', signal: AbortSignal.timeout?.(TIMEOUT_MS) });
    return res.ok ? await res.json() : null;
  } catch { return null; /* quiet: the rows stay without that part */ }
}

/**
 * loadCragWeather(crags, { fetchFn, storage, now }) → { daily, hourly, ok }
 * daily: Map name → Map 'YYYY-MM-DD' → {mm, p, g}; hourly: Map name → Map 'YYYY-MM-DDTHH:00' → {t, c}.
 * Only crags with a position are asked for. ok: both parts arrived and passed the checks.
 */
export async function loadCragWeather(crags, { fetchFn = fetch, storage = null, now = Date.now() } = {}) {
  const spots = crags.map((c) => [c, wallPosition(c)]).filter(([, p]) => p);
  if (!spots.length) return { daily: new Map(), hourly: new Map(), ok: false };
  const key = keyOf(spots);
  const saved = readCache(storage);
  // a copy stamped in the future (a clock that was ahead, or a tampered value) is not trusted: it would never age out
  if (saved?.key === key && Number.isFinite(saved.at) && saved.at <= now && weatherFresh({ hours: true, at: saved.at }, now)) {
    const r = build(spots, saved.daily, saved.hourly);
    if (r.ok) return r;
  }
  const points = spots.map(([, p]) => p);
  const [dailyJson, hourlyJson] = await Promise.all([ask(fetchFn, cragForecastUrl(points)), ask(fetchFn, listForecastUrl(points))]);
  const r = build(spots, dailyJson, hourlyJson);
  if (r.ok) {
    try { storage?.setItem(CRAG_WX_KEY, JSON.stringify({ key, at: now, daily: dailyJson, hourly: hourlyJson })); } catch { /* full or blocked: asked again next time */ }
  }
  return r;
}
