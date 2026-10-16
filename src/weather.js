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

export const RAIN_MM = 1; // a day with at least this much rain, or ...
export const RAIN_PROB = 60; // ... at least this chance of it (%), is a "비 예보" day

/** weekendForecastUrl([{lat, lng}, ...]) → one request for every wall: daily rain / gust numbers for 7 days. Only coordinates (2 decimals) vary. */
export const weekendForecastUrl = (points) => 'https://api.open-meteo.com/v1/forecast'
  + `?latitude=${points.map((p) => round2(p.lat)).join(',')}&longitude=${points.map((p) => round2(p.lng)).join(',')}`
  + '&daily=precipitation_sum,precipitation_probability_max,wind_gusts_10m_max&wind_speed_unit=ms&timezone=Asia/Seoul&forecast_days=7';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** parseDaily(json, n) → n Maps ('YYYY-MM-DD' → {mm, p (null when unknown), g}) in request order, or null when anything is off. One place comes back as an object, several as an array. */
export function parseDaily(json, n) {
  const list = Array.isArray(json) ? json : [json];
  if (list.length !== n || n < 1) return null;
  const out = [];
  for (const item of list) {
    const d = item?.daily;
    if (!d || !Array.isArray(d.time)) return null;
    const { time, precipitation_sum: mm, precipitation_probability_max: p, wind_gusts_10m_max: g } = d;
    if (!time.length || time.length > 16 || ![mm, p, g].every((a) => Array.isArray(a) && a.length === time.length)) return null;
    const days = new Map();
    for (let i = 0; i < time.length; i++) {
      if (typeof time[i] !== 'string' || !DAY_RE.test(time[i])) return null;
      if (!within(mm[i], 0, 1000) || !within(g[i], 0, 100) || !(p[i] === null || within(p[i], 0, 100))) return null;
      days.set(time[i], { mm: mm[i], p: p[i], g: g[i] });
    }
    out.push(days);
  }
  return out;
}

/** local YYYY-MM-DD, the key of parseDaily's maps. */
export const dayKey = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** dayWeather({mm, p, g}) → { rain, windy, rainText } for one wall on one day; undefined (no forecast) → null. */
export function dayWeather(d) {
  if (!d) return null;
  const rain = d.mm >= RAIN_MM || (d.p ?? 0) >= RAIN_PROB;
  const rainText = !rain ? null : d.p !== null && d.p >= RAIN_PROB ? `비 예보 ${Math.round(d.p)}%` : `비 예보 ${Math.round(d.mm)}mm`;
  return { rain, windy: d.g >= GUST_STRONG, rainText };
}

/** listForecastUrl([{lat, lng}, ...]) → one request for every outdoor wall: the hourly temperature and sky for 4 days (the list row's weather). Only coordinates (2 decimals) vary. */
export const listForecastUrl = (points) => 'https://api.open-meteo.com/v1/forecast'
  + `?latitude=${points.map((p) => round2(p.lat)).join(',')}&longitude=${points.map((p) => round2(p.lng)).join(',')}`
  + '&hourly=temperature_2m,weather_code&timezone=Asia/Seoul&forecast_days=4';

/** parseListForecast(json, n) → n Maps ('YYYY-MM-DDTHH:00' → {t °C, c WMO weather code}) in request order, or null when anything is off. One place comes back as an object, several as an array. */
export function parseListForecast(json, n) {
  const list = Array.isArray(json) ? json : [json];
  if (list.length !== n || n < 1) return null;
  const out = [];
  for (const item of list) {
    const h = item?.hourly;
    if (!h || !Array.isArray(h.time) || !Array.isArray(h.temperature_2m) || !Array.isArray(h.weather_code)) return null;
    const { time, temperature_2m: t, weather_code: c } = h;
    const len = time.length;
    if (!len || len > MAX_HOURS || t.length !== len || c.length !== len) return null;
    const hours = new Map();
    for (let i = 0; i < len; i++) {
      if (typeof time[i] !== 'string' || !HOUR_RE.test(time[i])) return null;
      if (!within(t[i], -80, 80) || !within(c[i], 0, 99)) return null;
      hours.set(time[i], { t: t[i], c: c[i] });
    }
    out.push(hours);
  }
  return out;
}

/** skyKind(wmoCode) → { kind, text }: the picture and the word for a weather code (WMO: 0 clear, 1–2 partly, 3 cloud, 45/48 fog, 51–67 and 80–82 rain, 71–77 and 85–86 snow, 95–99 thunderstorm). */
export function skyKind(c) {
  if (c === 0) return { kind: 'clear', text: '맑음' };
  if (c <= 2) return { kind: 'partly', text: '구름 조금' };
  if (c === 3) return { kind: 'cloud', text: '흐림' };
  if (c === 45 || c === 48) return { kind: 'fog', text: '안개' };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { kind: 'snow', text: '눈' };
  if (c >= 95) return { kind: 'storm', text: '뇌우' };
  return { kind: 'rain', text: '비' }; // 51–67 drizzle / rain / freezing rain, 80–82 showers
}

export const weatherLine = (h) => `예보 · 기온 ${Math.round(h.t)}° · 바람 ${Math.round(h.w)}m/s · 돌풍 ${Math.round(h.g)}m/s`;
