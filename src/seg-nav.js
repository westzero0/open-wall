// src/seg-nav.js — which tab a key press moves to, for any row of tabs (the segments, the bottom tabs). No DOM.

/** segStep(keys, cur, key) → the key to select. ←/→ stop at the ends, Home/End jump, anything else (or an unknown cur) keeps cur / the first. */
export function segStep(keys, cur, key) {
  const i = keys.indexOf(cur);
  if (i < 0) return keys[0];
  if (key === 'ArrowRight') return keys[Math.min(i + 1, keys.length - 1)];
  if (key === 'ArrowLeft') return keys[Math.max(i - 1, 0)];
  if (key === 'Home') return keys[0];
  if (key === 'End') return keys[keys.length - 1];
  return cur;
}
