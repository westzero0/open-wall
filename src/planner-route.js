// src/planner-route.js — planner screen from the address. No DOM.
// parseRoute(hash, search) → { screen: 'home'|'calendar'|'crags'|'walls'|'plan'|'wall'|'settings', id, newWall }. Anything unknown or malformed is home.
export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const SINGLE = new Set(['calendar', 'settings', 'crags', 'walls']);

export function parseRoute(hash = '', search = '') {
  let newWall = null;
  const q = new URLSearchParams(search);
  if (q.has('new')) { const w = q.get('wall') ?? ''; newWall = ID_RE.test(w) ? w : ''; }
  const home = { screen: 'home', id: null, newWall };
  const parts = String(hash).replace(/^#\/?/, '').split('/');
  if (SINGLE.has(parts[0]) && parts.length === 1) return { screen: parts[0], id: null, newWall };
  if (parts[0] === 'plan' || parts[0] === 'wall') {
    let id = '';
    try { id = decodeURIComponent(parts[1] ?? ''); } catch { return home; }
    if (parts.length === 2 && ID_RE.test(id)) return { screen: parts[0], id, newWall };
  }
  return home;
}

export function routeHref(r) {
  if (SINGLE.has(r?.screen)) return '#/' + r.screen;
  if ((r?.screen === 'plan' || r?.screen === 'wall') && r.id) return `#/${r.screen}/${encodeURIComponent(r.id)}`;
  return '#/';
}
