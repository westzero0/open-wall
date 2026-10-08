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
export const sharePageUrl = (href, name) => new URL(`w/${wallShareId(name)}/`, href);
