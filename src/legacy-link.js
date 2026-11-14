// src/legacy-link.js — links made before the planner became the first screen (?wall=…, ?crag=…, with &at= &n= &board &info …) belong to the old app, now walls.html.
// legacyTarget(pathname, search, hash) → the walls.html address to send the visitor to (same folder, query and hash kept), or null for an ordinary planner visit. No DOM.
export function legacyTarget(pathname, search, hash = '') {
  const q = new URLSearchParams(search);
  if (q.has('new') || (!q.has('wall') && !q.has('crag'))) return null; // ?new&wall=<id> is the planner's own bridge
  const dir = String(pathname || '/').replace(/[^/]*$/, '');
  return `${dir}walls.html${search}${hash}`;
}
