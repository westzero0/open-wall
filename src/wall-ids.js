// src/wall-ids.js — name <-> id of the walls the app knows. The app works with names; the board, photo upload and crowd form talk to
// servers by id (docs/superpowers/specs/2026-10-27-wallid-authorid-design.md). No DOM, no storage.
import { wallPageId } from './share-id.js';

const nfc = (s) => String(s ?? '').normalize('NFC');

/** createWallIds(walls) → { idOf(name) → id|null, nameOf(id) → name|null } over [{ name, id? }] (a wall without a stored id gets its name-hash id). */
export function createWallIds(walls) {
  const byName = new Map(), byId = new Map();
  for (const w of Array.isArray(walls) ? walls : []) {
    if (typeof w?.name !== 'string' || !w.name) continue;
    const id = wallPageId(w);
    byName.set(nfc(w.name), id);
    byId.set(id, nfc(w.name));
  }
  return { idOf: (name) => byName.get(nfc(name)) ?? null, nameOf: (id) => byId.get(id) ?? null };
}

// The app's one directory, refreshed by app.js whenever its wall list changes.
let current = createWallIds([]);
export const setWalls = (walls) => { current = createWallIds(walls); };
export const idOf = (name) => current.idOf(name);
export const nameOf = (id) => current.nameOf(id);
