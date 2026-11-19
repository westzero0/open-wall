// src/planner-places.js — 암장 tab (#/crags, #/walls): natural crags and walls as two lists; a press opens the wall sheet. No fetch/storage here.
import { html, useState, usePlannerState } from './planner-ui.js';
import { Note } from './planner-parts.js';
import { wallRows, cragRows } from './plan-places.js';

const rowsOf = (list, h) => html`<div class="picks list">${list.map((r) => html`<div class="pick-row" key=${r.id}>
  <button type="button" class="pick" aria-label=${r.label} onClick=${() => h.openWall(r.id, {})}>${r.name}<small>${r.sub}</small></button>
</div>`)}</div>`;

/** The screen without any hook (so a test can read the vnode): screen 'crags' | 'walls', q/setQ = the wall search text, now = ms. */
export function PlacesView({ s, h, screen, q, setQ, now }) {
  const at = new Date(now);
  const crags = cragRows(s.crags, s.rainWx?.crag ?? null, { at, now: at });
  const walls = wallRows(s.walls, { date: s.today, min: s.nowMin, q: '' }).length;
  const failed = s.rainLoaded && s.rainWx?.crag?.ok !== true;
  const kinds = [['crags', `자연암장 ${crags.length}`], ['walls', `외벽 ${walls}`]];
  let body;
  if (screen === 'crags') {
    const list = crags.map((r) => ({ id: r.id, name: r.name, label: `${r.name}, ${[r.region, r.typeLabel, r.text].filter(Boolean).join(' · ')}`, sub: [r.region, r.typeLabel, s.rainLoaded ? r.short : '불러오는 중'].filter(Boolean).join(' · ') }));
    body = html`${failed && html`<p class="rm-state" role="status">날씨를 불러오지 못했어요</p>
        <button type="button" class="p-link rm-retry" onClick=${() => h.loadRainMap()}>다시 받기</button>`}
      ${list.length ? rowsOf(list, h) : html`<${Note}>아직 등록된 자연암장이 없어요<//>`}`;
  } else {
    const rows = wallRows(s.walls, { date: s.today, min: s.nowMin, q });
    const list = rows.map((r) => ({ id: r.id, name: r.name, label: `${r.name}, ${r.region} ${r.open}`.trim(),
      sub: html`${r.region}${r.region && r.open ? ' · ' : ''}${r.shut ? html`<span class="op-no">${r.open}</span>` : r.open}` }));
    body = html`<input class="in-t" aria-label="외벽 검색" placeholder="암장 이름이나 지역" autocomplete="off" value=${q} onInput=${(e) => setQ(e.target.value)} />
      ${list.length ? rowsOf(list, h) : s.walls.length > 0 && html`<${Note}>맞는 암장이 없어요<//>`}`;
  }
  return html`<section class="places">
    <div class="sel" role="group" aria-label="암장 종류">${kinds.map(([k, label]) => html`<button type="button" key=${k} aria-pressed=${screen === k} onClick=${() => h.replace({ screen: k })}>${label}</button>`)}</div>
    ${body}
  </section>`;
}

export function Places({ store, handlers }) {
  const s = usePlannerState(store);
  const [q, setQ] = useState('');
  if (s.base.screen !== 'crags' && s.base.screen !== 'walls') return null;
  return PlacesView({ s, h: handlers, screen: s.base.screen, q, setQ, now: Date.now() });
}
