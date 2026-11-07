// src/zone-watch.js — 등록한 날씨 구역의 비 예보 띠 (docs/superpowers/specs/2026-11-06-positioning-natural-rock-design.md 5절 1단계): the zones a visitor
// watches, kept as ids in this browser only, and the rain on the day the screen shows. No push, no DOM.
import { dayWord, weekStrip } from './schedule.js';

export const ZONE_WATCH_KEY = 'open-wall:zone-watch';
export const MAX_ZONES = 5;

// Anything stored is untrusted: unique non-empty id strings, capped.
export function cleanZones(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x) => typeof x === 'string' && x))].slice(0, MAX_ZONES);
}

// Stored as ids (a rename does not lose it). With the list in hand an id that is not in it is gone and must not hold one of the five places unseen.
export function loadZones(storage, crags = []) {
  try {
    const list = cleanZones(JSON.parse(storage.getItem(ZONE_WATCH_KEY)));
    return crags.length ? list.filter((id) => crags.some((c) => c.id === id)) : list;
  } catch {
    return [];
  }
}

export function saveZones(storage, ids) {
  try { storage.setItem(ZONE_WATCH_KEY, JSON.stringify(cleanZones(ids))); } catch { /* storage full or blocked: keep in memory */ }
}

/** toggleZone(ids, id) → the id removed if it is there, added if not (the cap leaves the list as it is). */
export const toggleZone = (ids, id) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= MAX_ZONES ? ids : [...ids, id]);

/**
 * zoneAlerts(ids, crags, forecasts, at, now) → [{ id, name, day, rain }] for the watched zones that exist, about the one day the screen shows (`at`, the same day planWxLine counts):
 * day is weekStrip's entry for it ({ date, known, rain, text }), rain { label ('토요일' / '오늘' / '내일'), text ('비 예보 70%') } is set only when that day has rain (null when dry or when there is no forecast for it).
 * forecasts: Map zone name → parseDaily's day Map.
 */
export function zoneAlerts(ids, crags, forecasts, at, now = new Date()) {
  const gap = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  return ids.flatMap((id) => {
    const zone = crags.find((c) => c.id === id);
    if (!zone) return [];
    const [day] = weekStrip({ wall: zone.name, days: [] }, forecasts.get(zone.name), at);
    return [{ id, name: zone.name, day, rain: day.rain ? { label: dayWord(day.date, gap), text: day.text } : null }];
  });
}

/** zoneBanner(alert) → '등록한 외설악: 토요일 비 예보 70%', or null (no rain, no forecast: never "no rain"). */
export const zoneBanner = (alert) => (alert.rain ? `등록한 ${alert.name}: ${alert.rain.label} ${alert.rain.text}` : null);
