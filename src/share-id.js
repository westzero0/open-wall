// src/share-id.js — the short id of a wall's share page (w/<id>/, made at deploy by tools/share-pages.mjs). No DOM.
// The app and the deploy tool import the same function, so a link made in the app names the page the deploy wrote.

/** wallShareId(name) → 8 base36 chars: FNV-1a 64 of the NFC, space-collapsed name (as normalizeWall keeps it), mod 36^8. */
export function wallShareId(name) {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(String(name).normalize('NFC').replace(/\s+/g, ' ').trim())) {
    h = ((h ^ BigInt(b)) * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return (h % 36n ** 8n).toString(36).padStart(8, '0');
}

/** The share page of a wall, from the app's own address (href's path; its query and hash are dropped). */
/** wallPageId(wall) → the wall's stored id (data/*.json `id`); a wall without one falls back to the name hash, which is what the id was first made from. */
export const wallPageId = (wall) => (typeof wall?.id === 'string' && wall.id ? wall.id : wallShareId(wall?.name ?? ''));

/** idByName(walls, name) → the id of the wall with that name in the list (or the name hash when the list has no such wall). */
export const idByName = (walls, name) => wallPageId(walls?.find((w) => w.name === name) ?? { name });

export const sharePageUrl = (href, id) => new URL(`w/${id}/`, href);
