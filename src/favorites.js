// src/favorites.js — the walls a visitor starred ("즐겨찾기"): kept by name, in this browser only. No DOM.

export const FAV_KEY = 'open-wall:fav';
export const MAX_FAVS = 100;

// Anything stored is untrusted: strings only, NFC, no repeats, capped. Names that no longer exist are simply never shown.
export function cleanFavs(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.normalize('NFC')))].slice(0, MAX_FAVS);
}

// Bad JSON, no storage or a throwing one: no favorites.
export function loadFavs(storage) {
  try {
    return cleanFavs(JSON.parse(storage.getItem(FAV_KEY)));
  } catch {
    return [];
  }
}

export function saveFavs(storage, favs) {
  try {
    storage.setItem(FAV_KEY, JSON.stringify(favs));
  } catch { /* storage full or blocked: keep in memory */ }
}

// The list with `name` added at the end, or removed when it is there. At the cap a new one is refused (list unchanged).
export function toggleFav(favs, name) {
  const n = String(name).normalize('NFC');
  if (favs.includes(n)) return favs.filter((f) => f !== n);
  return favs.length >= MAX_FAVS ? favs : [...favs, n];
}

// ♥ 추천: walls already asked "♥ 즐겨찾기에 추가할까요?" (once per wall, whatever the answer). Same rules as favorites.
export const FAV_ASKED_KEY = 'open-wall:fav-asked';
export function loadFavAsked(storage) {
  try {
    return cleanFavs(JSON.parse(storage.getItem(FAV_ASKED_KEY)));
  } catch {
    return [];
  }
}
export function saveFavAsked(storage, asked) {
  try {
    storage.setItem(FAV_ASKED_KEY, JSON.stringify(cleanFavs(asked)));
  } catch { /* asked again next visit */ }
}
/** shouldAskFav(name, count, favs, asked) → true when this save made the wall's 3rd record, it isn't ♥ and wasn't asked. */
export const FAV_ASK_AT = 3;
export const shouldAskFav = (name, count, favs, asked) => count === FAV_ASK_AT && !favs.includes(name) && !asked.includes(name);
