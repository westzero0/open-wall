// src/planner-places.js — 암장 tab (#/crags, #/walls): natural crags and walls as two lists; a press opens the wall sheet. No fetch/storage here.
import { html, useState, usePlannerState } from './planner-ui.js';
import { Note } from './planner-parts.js';
import { wallRows, cragRows, groupRows, leadWord, CRAG_GROUPS, WALL_GROUPS } from './plan-places.js';
import { COND_NOTE } from './crag-model.js';

const rowsOf = (list, h) => html`<div class="picks list">${list.map((r) => html`<div class="pick-row" key=${r.id}>
  <button type="button" class="pick" aria-label=${r.label} onClick=${() => h.openWall(r.id, {})}>${r.name}<small>${r.sub}</small></button>
</div>`)}</div>`;
// the list under its sort: one heading per group with the count (always visible); its button folds the rows (the .rm-head pattern of the rain map).
// Open = the user's choice (folds), else only the first group shown. (A search shows no groups at all: see PlacesView.)
const groupsOf = (groups, h, { screen, folds, setFold }) => groups.map((g, i) => {
  const open = folds[g.label] ?? i === 0;
  const id = `places-${screen}-${i}`;
  return html`<h3 class="lbl" key=${g.label}><button type="button" class="rm-head" aria-expanded=${open} aria-controls=${id} onClick=${() => setFold(g.label, !open)}>${g.label} ${g.rows.length}</button></h3>${open && html`<div id=${id}>${rowsOf(g.rows, h)}</div>`}`;
});
const bad = (word) => html`<span class="op-no">${word}</span>`; // 닫힘·휴관·비 예보: 색 없이 굵게

/** The screen without any hook (so a test can read the vnode): screen 'crags' | 'walls', q/setQ = the wall search text, now = ms, folds = {heading: open?} the user's choices for this screen, setFold(heading, open). With a search: no headings, one list, every row says its state. */
export function PlacesView({ s, h, screen, q, setQ, now, folds = {}, setFold = () => {} }) {
  const at = new Date(now);
  const wx = s.rainWx?.crag ?? null;
  const cragAll = s.crags.length; // the chip counts stay the full totals whatever is typed
  const walls = wallRows(s.walls, { date: s.today, min: s.nowMin, q: '' }).length;
  const failed = s.rainLoaded && s.rainWx?.crag?.ok !== true;
  const kinds = [['crags', `자연암장 ${cragAll}`], ['walls', `외벽 ${walls}`]];
  const searching = q.trim() !== '';
  const fold = { screen, folds, setFold };
  const list = (rows, groups) => (searching ? rowsOf(rows, h) : groupsOf(groupRows(rows, groups), h, fold));
  let body;
  let found;
  let merged = false; // the ready crag list puts 'N곳' into its 지금 기준 line
  if (screen === 'crags') {
    const crags = cragRows(s.crags, wx, { at, now: at, q });
    found = crags.length;
    const ready = s.rainLoaded && !failed; // before the weather is in (or without it) the rows carry no condition and no headings: one line says so
    merged = ready;
    const items = crags.map((r) => {
      const place = [r.region, r.typeLabel].filter(Boolean).join(' · ');
      const word = ready ? (searching ? r.short : leadWord(r, r.short, CRAG_GROUPS)) : ''; // under its heading the heading's own word is left out; a search has no headings
      return { id: r.id, rank: r.rank, name: r.name, label: `${r.name}, ${[r.region, r.typeLabel, ready && r.text].filter(Boolean).join(' · ')}`,
        sub: html`${place}${place && word ? ' · ' : ''}${word && r.rank === 2 ? bad(word) : word}` };
    });
    body = html`${failed && html`<p class="rm-state" role="status">날씨를 불러오지 못했어요</p>
        <button type="button" class="p-link rm-retry" onClick=${() => h.loadRainMap()}>다시 받기</button>`}
      ${!s.rainLoaded && html`<p class="rm-state" role="status">날씨를 불러오는 중이에요</p>`}
      ${ready && items.length > 0 && (searching ? html`<p class="rm-state" role="status">${found}곳 · 지금 기준 · ${COND_NOTE}</p>` : html`<p class="rm-state">지금 기준 · ${COND_NOTE}</p>`)}
      ${items.length ? (ready ? list(items, CRAG_GROUPS) : rowsOf(items, h)) : html`<${Note}>${cragAll ? '맞는 암장이 없어요' : '아직 등록된 자연암장이 없어요'}<//>`}`;
  } else {
    const rows = wallRows(s.walls, { date: s.today, min: s.nowMin, q });
    const items = rows.map((r) => ({ id: r.id, rank: r.rank, name: r.name, label: `${r.name}, ${r.region} ${r.open}`.trim(),
      sub: (searching || leadWord(r, r.open, WALL_GROUPS)) ? html`${r.region}${r.region ? ' · ' : ''}${r.shut ? bad(r.open) : r.open}` : r.region })); // its heading already says 지금 열림 / 운영시간 정보 없음 (a search shows every state)
    found = items.length;
    body = items.length ? list(items, WALL_GROUPS) : html`<${Note}>${s.walls.length ? '맞는 암장이 없어요' : '아직 등록된 외벽이 없어요'}<//>`; // no loaded flag exists for walls, so empty reads as 'none yet'
  }
  return html`<section class="places">
    <div class="sel" role="group" aria-label="암장 종류">${kinds.map(([k, label]) => html`<button type="button" key=${k} data-label=${label} aria-pressed=${screen === k} onClick=${() => h.replace({ screen: k })}>${label}</button>`)}</div>
    <input class="in-t" type="search" enterkeyhint="search" aria-label="암장 검색" placeholder="암장 이름이나 지역" autocomplete="off" value=${q} onInput=${(e) => setQ(e.target.value)} />
    ${searching && !merged && found > 0 && html`<p class="rm-state" role="status">${found}곳</p>`}
    ${body}
  </section>`;
}

export function Places({ store, handlers }) {
  const s = usePlannerState(store);
  const [q, setQ] = useState('');
  const [folds, setFolds] = useState({}); // {screen: {heading: open?}}: kept per tab, never stored
  if (s.base.screen !== 'crags' && s.base.screen !== 'walls') return null;
  return PlacesView({ s, h: handlers, screen: s.base.screen, q, setQ, now: Date.now(), folds: folds[s.base.screen], setFold: (label, open) => setFolds((f) => ({ ...f, [s.base.screen]: { ...f[s.base.screen], [label]: open } })) });
}
