// src/cluster.js — group map pins that sit within `radius` screen px of each other. Pure, no DOM.
// items: [{lat, lng, keep?}] · project(lat, lng) → {x, y} in px at the current zoom · a `keep` item (the selected pin) never joins a group.
// → arrays of item indexes; a group of one is a lone pin.
export function clusterPins(items, project, radius) {
  const pts = items.map((p) => project(p.lat, p.lng));
  const used = new Set();
  const groups = [];
  items.forEach((p, i) => {
    if (used.has(i)) return;
    used.add(i);
    const g = [i];
    if (!p.keep) {
      items.forEach((q, j) => {
        if (used.has(j) || q.keep || Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) > radius) return;
        used.add(j);
        g.push(j);
      });
    }
    groups.push(g);
  });
  return groups;
}
