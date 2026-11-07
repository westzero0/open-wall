// Route projects from log records (no DOM). A project = the same route name at the same wall, over all records.
const KEY = 'open-wall:project-hide';
export const HIDE_KEY = KEY;
export const MAX_HIDDEN = 100;

const norm = (s) => String(s).normalize('NFC').replace(/\s+/g, '').toLowerCase();

export const SENT_NAME = { onsight: '온사이트', flash: '플래시', redpoint: '레드포인트' };
export const sentOptions = (tries) => (tries >= 2 ? ['redpoint'] : ['onsight', 'flash']);

export function projectsAt(log, wallName, hidden = []) {
  const hide = new Set(hidden.map((h) => `${h.wall}\n${norm(h.name)}`));
  const by = new Map();
  const at = new Map(); // project key → 'date time' of its newest record (a later time on the same date wins)
  for (const r of log) {
    if (r.wall !== wallName || !r.routes) continue;
    const when = `${r.date} ${r.time ?? ''}`;
    for (const x of r.routes) {
      const k = norm(x.name);
      if (hide.has(`${wallName}\n${k}`)) continue;
      const p = by.get(k);
      if (!p) { at.set(k, when); by.set(k, { name: x.name, ...(x.grade ? { grade: x.grade } : {}), tries: x.tries, lastDate: r.date, sent: x.sent }); }
      else {
        p.tries += x.tries;
        if (when > at.get(k)) { at.set(k, when); p.lastDate = r.date; p.sent = x.sent; if (x.grade) p.grade = x.grade; p.name = x.name; }
      }
    }
  }
  return [...by.values()].sort((a, b) => (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0));
}

export const cleanHidden = (v) => {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  for (const h of v) {
    if (!h || typeof h.wall !== 'string' || typeof h.name !== 'string') continue;
    const wall = h.wall.normalize('NFC').trim().slice(0, 100);
    const name = h.name.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 40);
    const k = `${wall}\n${norm(name)}`;
    if (!wall || !name || seen.has(k)) continue;
    seen.add(k);
    out.push({ wall, name });
  }
  return out.slice(0, MAX_HIDDEN);
};

export function loadHidden(storage) {
  try { return cleanHidden(JSON.parse(storage.getItem(KEY))); } catch { return []; }
}

export function saveHidden(storage, list) {
  try { storage.setItem(KEY, JSON.stringify(cleanHidden(list))); } catch { /* storage full or blocked: keep in memory */ }
}

export const hideProject = (list, wall, name) => cleanHidden([{ wall, name }, ...list]); // newest first: at MAX_HIDDEN the oldest goes
export const unhideProject = (list, wall, name) => list.filter((h) => !(h.wall === wall && norm(h.name) === norm(name)));
