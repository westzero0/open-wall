// src/planner-route.js — planner screen from the address. No DOM.
// parseRoute(hash, search) → { screen: 'home'|'calendar'|'crags'|'walls'|'plan'|'wall'|'settings', id, tab, newWall }; tab only on #/wall/<id>/<tab>, else null. Anything unknown or malformed is home.
export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const TAB_RE = /^[a-z]{1,16}$/;

const SINGLE = new Set(['calendar', 'settings', 'crags', 'walls']);

export function parseRoute(hash = '', search = '') {
  let newWall = null;
  const q = new URLSearchParams(search);
  if (q.has('new')) { const w = q.get('wall') ?? ''; newWall = ID_RE.test(w) ? w : ''; }
  const home = { screen: 'home', id: null, tab: null, newWall };
  const parts = String(hash).replace(/^#\/?/, '').split('/');
  if (SINGLE.has(parts[0]) && parts.length === 1) return { screen: parts[0], id: null, tab: null, newWall };
  if (parts[0] === 'plan' || parts[0] === 'wall') {
    let id = '';
    try { id = decodeURIComponent(parts[1] ?? ''); } catch { return home; }
    if (ID_RE.test(id)) {
      if (parts.length === 2) return { screen: parts[0], id, tab: null, newWall };
      if (parts[0] === 'wall' && parts.length === 3 && TAB_RE.test(parts[2])) return { screen: 'wall', id, tab: parts[2], newWall };
    }
  }
  return home;
}

export function routeHref(r) {
  if (SINGLE.has(r?.screen)) return '#/' + r.screen;
  if ((r?.screen === 'plan' || r?.screen === 'wall') && r.id) return `#/${r.screen}/${encodeURIComponent(r.id)}${r.screen === 'wall' && TAB_RE.test(r.tab ?? '') ? '/' + r.tab : ''}`;
  return '#/';
}
