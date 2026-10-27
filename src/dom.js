// src/dom.js — the one way views build DOM: elements, attributes via setAttribute, children as nodes or text (never HTML).
export const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v);
  e.append(...kids.filter((k) => k !== null && k !== undefined && k !== false));
  return e;
};

// Data text with a parenthetical ("(유효 1년, 평일·주말 사용)", "(…, 이용료 별도)"): keep its first two and last two words together so a line never
// breaks right after "(" or leaves a lone "별도)" at the start of a line. Spaces become no-break spaces; the words and the text stay the same.
export const tightParens = (text) => typeof text === 'string'
  ? text.replace(/\(([^()]{3,60})\)/g, (_, inner) => `(${inner.replace(/^(\S+) /, '$1\u00a0').replace(/ (\S+)$/, '\u00a0$1')})`)
  : text;


// Crossfade for a list that is rebuilt (the time slider): `prev` are the rows that were on screen, `rows` the new ones in the DOM.
// Per row the parts in `sels` (sun box, remaining-time chip, gauge) fade from the old clone to the new element over --dur-ui.
// The clones are decoration (aria-hidden) and leave with the next rebuild; reduced motion and rows that did not change draw nothing.
export function crossfadeRows(prev, rows, sels) {
  if (!prev.size || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const css = getComputedStyle(document.documentElement);
  const opt = { duration: parseFloat(css.getPropertyValue('--dur-ui')) || 200, easing: css.getPropertyValue('--ease-out').trim() || 'ease-out' };
  const vh = innerHeight, jobs = [];
  for (const li of rows) { // all reads first, then all writes: one layout, not one per part
    const old = prev.get(li.wallName);
    const r = li.getBoundingClientRect();
    if (!old || r.bottom < 0 || r.top > vh) continue; // only what the eye is on
    for (const sel of sels) {
      const was = old.querySelector(sel), now = li.querySelector(sel);
      if (!was || !now || was.isEqualNode(now) || !now.offsetParent) continue;
      const ghost = was.cloneNode(true);
      ghost.setAttribute('aria-hidden', 'true');
      ghost.removeAttribute('id');
      Object.assign(ghost.style, { position: 'absolute', overflow: 'hidden', margin: '0', pointerEvents: 'none', left: `${now.offsetLeft}px`, top: `${now.offsetTop}px`, width: `${now.offsetWidth}px`, height: `${now.offsetHeight}px` });
      jobs.push([now.offsetParent, ghost, now]);
    }
  }
  for (const [host, ghost, now] of jobs) {
    host.append(ghost);
    ghost.animate({ opacity: [1, 0] }, opt).finished.then(() => ghost.remove(), () => ghost.remove());
    now.animate({ opacity: [0, 1] }, opt);
  }
}
