// 날씨·바람: Open-Meteo hourly forecast for a wall's coordinates. Pure: no DOM, no network (app.js fetches).
// The response is untrusted: parseForecast returns a map only when every value is a sane number.

export const GUST_STRONG = 8; // m/s: a gust at or above this is "바람 셈"

const MAX_HOURS = 200; // forecast_days=4 is 96 hours
const HOUR_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:00$/;
const p2 = (n) => String(n).padStart(2, '0');
const round2 = (n) => (Math.round(n * 100) / 100).toFixed(2);

/** forecastUrl(lat, lng) → the request URL. Only the wall's coordinates (2 decimals) vary. */
export const forecastUrl = (lat, lng) => 'https://api.open-meteo.com/v1/forecast'
  + `?latitude=${round2(lat)}&longitude=${round2(lng)}`
  + '&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m&wind_speed_unit=ms&timezone=Asia/Seoul&forecast_days=4';

const within = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** parseForecast(json) → Map 'YYYY-MM-DDTHH:00' → {t °C, w m/s, g m/s}, or null when anything is off. */
export function parseForecast(json) {
  const h = json?.hourly;
  if (!h || !Array.isArray(h.time)) return null;
  const { time, temperature_2m: t, wind_speed_10m: w, wind_gusts_10m: g } = h;
  if (!Array.isArray(t) || !Array.isArray(w) || !Array.isArray(g)) return null;
  const n = time.length;
  if (!n || n > MAX_HOURS || t.length !== n || w.length !== n || g.length !== n) return null;
  const out = new Map();
  for (let i = 0; i < n; i++) {
    if (typeof time[i] !== 'string' || !HOUR_RE.test(time[i])) return null;
    if (!within(t[i], -80, 80) || !within(w[i], 0, 100) || !within(g[i], 0, 100)) return null;
    out.set(time[i], { t: t[i], w: w[i], g: g[i] });
  }
  return out;
}

/** pickHour(hours, at) → the entry for the local hour `at` falls in, or null (outside the data). */
export const pickHour = (hours, at) => hours.get(`${at.getFullYear()}-${p2(at.getMonth() + 1)}-${p2(at.getDate())}T${p2(at.getHours())}:00`) ?? null;

const OK_MS = 3 * 3600e3; // a good answer is reused this long
const FAIL_MS = 5 * 60e3; // a failed one is not retried before this (the minute tick must not hammer the API)

/** weatherFresh(entry, now) → true while a cached {hours, at} needs no new request. */
export const weatherFresh = (entry, now) => !!entry && now - entry.at < (entry.hours ? OK_MS : FAIL_MS);

export const windy = (h) => h.g >= GUST_STRONG;

export const weatherLine = (h) => `예보 · 기온 ${Math.round(h.t)}° · 바람 ${Math.round(h.w)}m/s · 돌풍 ${Math.round(h.g)}m/s`;
