// src/zone-watch-view.js — 등록한 날씨 구역의 비 예보 띠와 등록 버튼 (docs/superpowers/specs/2026-11-06-positioning-natural-rock-design.md 5절, DOM).
// The words and the zones come from zone-watch.js; this file only draws them (no fetch, no storage).
import { el } from './dom.js';
import { zoneBanner } from './zone-watch.js';

/** renderZoneBanner(host, alerts) — one note line per watched zone that has rain coming (the card's 휴무안내 markup, rain blue); nothing to say → host hidden and empty. */
export function renderZoneBanner(host, alerts) {
  const lines = alerts.map((a) => ({ a, text: zoneBanner(a) })).filter((x) => x.text);
  host.hidden = !lines.length;
  host.replaceChildren(...lines.map(({ text }) => el('div', { class: 'irow irow-s notice maybe rain', role: 'note' }, el('span', { class: 'mk' }, '예보'), el('span', { class: 'nt-t' }, text))));
}

/** zoneToggleButton({ on, onToggle }) → the quiet 등록 button; onToggle() returns the new state, the button redraws its own words (a redraw of the list would drop the focus). */
export function zoneToggleButton({ on, onToggle }) {
  const b = el('button', { type: 'button', class: 'help-link zone-toggle', 'aria-pressed': String(on) }, on ? '비 예보 등록됨' : '비 예보 등록');
  b.addEventListener('click', () => {
    const now = onToggle();
    b.setAttribute('aria-pressed', String(now));
    b.textContent = now ? '비 예보 등록됨' : '비 예보 등록';
  });
  return b;
}
