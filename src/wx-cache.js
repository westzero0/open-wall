// src/wx-cache.js — 날씨 응답을 이 브라우저에 하루쯤 남겨 같은 요청을 다시 보내지 않는다 (Open-Meteo 무료 한도).
// No DOM, no fetch: storage (getItem/setItem) and the clock are injected. Stores the raw JSON, not parsed Maps.
// Slots: open-wall:wx-list / wx-week → {key, at, json}; open-wall:wx-wall → {name: {key, at, json}}; open-wall:wx-limit → ms of the last 429.

export const WX_TTL = 3 * 3600e3; // a forecast is asked again after this, unless the daily limit is hit
export const WX_LIMIT_KEY = 'open-wall:wx-limit';
const WALL_KEY = 'open-wall:wx-wall';
const WALL_MAX = 20, WALL_KEEP_MS = 24 * 3600e3;

export function wxCache(storage, now = () => Date.now()) {
  const read = (k) => { try { const v = JSON.parse(storage.getItem(k)); return v && typeof v === 'object' ? v : null; } catch { return null; } };
  const write = (k, v) => { try { storage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked: asked again next visit */ } };
  const usable = (e, key, stale) => !!e && e.key === key && e.json != null && Number.isFinite(e.at) && e.at <= now() && (stale || now() - e.at < WX_TTL);

  return {
    /** get(slot, key, {sub, stale}) → {at, json} or null. sub: the wall name for the per-wall slot. stale: ignore the 3 hours (the daily limit is on). */
    get(slot, key, { sub = null, stale = false } = {}) {
      const rec = read(slot);
      const e = sub === null ? rec : rec?.[sub];
      return usable(e, key, stale) ? { at: e.at, json: e.json } : null;
    },
    /** put(slot, key, json, {sub}) — a per-wall write also drops entries older than a day and keeps the newest 20. */
    put(slot, key, json, { sub = null } = {}) {
      const at = now();
      if (sub === null) return write(slot, { key, at, json });
      const map = read(slot) ?? {};
      map[sub] = { key, at, json };
      const keep = Object.entries(map)
        .filter(([, e]) => e && Number.isFinite(e.at) && now() - e.at < WALL_KEEP_MS)
        .sort((a, b) => b[1].at - a[1].at).slice(0, WALL_MAX);
      write(slot, Object.fromEntries(keep));
    },
    /** setLimited() — a 429 came back: nothing is asked until UTC midnight (Open-Meteo's daily reset; KST 09:00). */
    setLimited() { write(WX_LIMIT_KEY, now()); },
    /** limited() → true from a 429 until the next UTC midnight (KST 09:00). */
    limited() {
      let at = 0;
      try { at = Number(JSON.parse(storage.getItem(WX_LIMIT_KEY))); } catch { /* broken: not limited */ }
      if (!Number.isFinite(at) || at <= 0) return false;
      const d = new Date(at); d.setUTCHours(24, 0, 0, 0);
      return now() < d.getTime();
    },
  };
}
