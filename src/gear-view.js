// src/gear-view.js — the 근처 tab of a wall's sheet: partner shops near the wall (src/gear.js), DOM via el()/textContent only.
// The free info zone is plain facts (name, one line, 지도/스토어 links); the paid zone, when there is one, is a separate zone with a
// 광고·제휴 mark. Every link carries data-gear=<id>: src/stats.js counts the click as gear-<id> (the name only).
import { el } from './dom.js';
import { gearModel } from './gear.js';
import { formatDistance } from './card-model.js';

const link = (g, href, label) => href
  ? el('a', { class: 'gear-link', href, target: '_blank', rel: 'noopener noreferrer', 'data-gear': g.id }, `${label} ↗`)
  : null;

const card = (g) => el('li', { class: 'gear-item' },
  el('div', { class: 'gear-name' }, g.name, g.km != null ? el('span', { class: 'gear-km' }, formatDistance(g.km)) : null),
  g.note ? el('p', { class: 'gear-note' }, g.note) : null,
  el('div', { class: 'gear-links' }, link(g, g.mapUrl, '지도'), link(g, g.storeUrl, '스토어')));

/** The tab's pane from nearGear results; null when there is nothing to show. */
export function gearPane(info, sponsored) {
  const zones = gearModel(info, sponsored);
  if (!zones) return null;
  return el('div', { class: 'ws-use gear-pane' }, ...zones.map((z) => el('section', { class: `ws-sec gear-zone${z.sponsored ? ' sponsored' : ''}`, 'aria-label': z.mark ? `${z.mark} ${z.title}` : z.title },
    el('div', { class: 'ws-sec-h' }, el('h3', {}, z.title), z.mark ? el('span', { class: 'gear-mark' }, z.mark) : null),
    el('ul', { class: 'gear-list' }, ...z.items.map(card)))));
}
