// src/favorites.js — the walls a visitor starred ("즐겨찾기"). The app works with names; the store keeps each wall's id, so a rename
// or a move to a server doesn't lose the star. In this browser only. No DOM.
import { wallPageId } from './share-id.js';

export const FAV_KEY = 'open-wall:fav';
export const MAX_FAVS = 100;

// Anything stored is untrusted: strings only, NFC, no repeats, capped. Names that no longer exist are simply never shown.
export function cleanFavs(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.normalize('NFC')))].slice(0, MAX_FAVS);
}

// Stored value → name: an id of a wall in `walls` becomes its current name; anything else (a name from before ids, an id of a wall
// not in the list) is kept as it is, so nothing a visitor starred is lost while the list is missing or a wall is gone.
export function favNames(stored, walls = []) {
  const byId = new Map(walls.map((w) => [wallPageId(w), w.name]));
  return cleanFavs(stored.map((v) => byId.get(v) ?? v));
}

// Name → stored value: the wall's id when it is in `walls`, else the value as it is.
export function favIds(names, walls = []) {
  const byName = new Map(walls.map((w) => [w.name, wallPageId(w)]));
  return cleanFavs(names.map((n) => byName.get(n) ?? n));
}

// Bad JSON, no storage or a throwing one: no favorites. walls: the list the ids are read against (empty = ids stay as they are).
export function loadFavs(storage, walls = []) {
  try {
    return favNames(cleanFavs(JSON.parse(storage.getItem(FAV_KEY))), walls);
  } catch {
    return [];
  }
}

export function saveFavs(storage, favs, walls = []) {
  try {
    storage.setItem(FAV_KEY, JSON.stringify(favIds(favs, walls)));
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
