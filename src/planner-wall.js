// src/planner-wall.js — 암장 시트: one official wall (hours, fee, nearby walls, link to the utility page), opened from a plan's detail,
// an alternative, a search result, or straight from #/wall/<id>. It is a sheet over the screen below (route.screen === 'wall'; base keeps the screen under it).
// Model words come from plan-wall.js. No fetch, no storage here; the forecast is only what the plans already loaded (s.wx).
import { html, usePlannerState } from './planner-ui.js';
import { Sheet } from './planner-sheet.js';
import { LinkButton, ButtonRow, Note } from './planner-parts.js';
import { Cells } from './planner-cells.js';
import { SunCard } from './planner-sun.js';
import { findWall, wallSheetModel, utilLinks } from './plan-wall.js';
import { resolvePlace } from './plan-place.js';
import { homeCells, cellsQuiet } from './plan-view.js';
import { changePlace } from './plan-actions.js';
import { wallPosition } from './viewmodel.js';
import { IceSheet } from './planner-ice.js';
import { findIce } from './plan-ice-sheet.js';
import { config } from './config.js';
import { cragRow, COND_NOTE } from './crag-model.js';
import { symbolKind } from './plan-card.js';
import { wallPageId } from './share-id.js';

/** Which kind of place an id names: 외벽 first, then 빙벽장, then 자연암장 (a pending crag still opens, with whatever it has). */
export function pickSheetPlace(s, id) {
  const wall = findWall(s.walls, id);
  if (wall) return { kind: 'wall', place: wall };
  const ice = findIce(s.ice, id);
  if (ice) return { kind: 'ice', place: ice };
  const crag = findWall(s.crags, id);
  return crag ? { kind: 'crag', place: crag } : null;
}

/** cragSheetView(crag, { s, ctx, now }) → { title, top, condText, cells, showSun, plan } (no DOM). Weather: the rain map, else what the plans loaded. */
export function cragSheetView(crag, { s, ctx = {}, now = new Date() }) {
  const id = wallPageId(crag);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(ctx.date ?? '') ? ctx.date : s.today;
  const min = Number.isFinite(ctx.min) ? ctx.min : null;
  const has = (w) => w?.daily?.has?.(crag.name); // EMPTY_WX is not weather
  const wx = [s.rainWx?.crag, s.wx?.crag].find(has) ?? null;
  let at = now;
  if (date === ctx.date) { const [y, mo, d] = ctx.date.split('-').map(Number); const t = new Date(y, mo - 1, d, 0, min ?? 12 * 60); if (!Number.isNaN(+t)) at = t; }
  const row = cragRow(crag, at, { now, ...(wx ?? {}) });
  const place = { kind: 'official', id };
  const resolved = resolvePlace(place, { walls: s.walls, crags: s.crags, mine: s.db.mine, aliases: s.aliases });
  const cells = wx ? homeCells(resolved, { date, min, place }, { ...s, wx: { ...s.wx, crag: wx } }) : null;
  return {
    id, title: crag.name,
    top: [crag.region, row.typeLabel].filter(Boolean).join(' · '),
    condText: wx ? row.cond.text : '컨디션 정보 없음',
    cells, quiet: cells ? cellsQuiet(cells) : null, resolved, place,
    showSun: !!wallPosition(crag),
    plan: { id: 'crag:' + id, date, min },
  };
}

function CragSheet({ crag, s, h }) {
  const ctx = s.wallCtx ?? {};
  const v = cragSheetView(crag, { s, ctx, now: new Date(Date.now()) });
  const id = v.id;
  const plan = ctx.planId ? s.db.plans.find((p) => p.id === ctx.planId) : null;
  const swap = () => { if (plan && h.savePlan(changePlace(plan, v.place, crag.name))?.ok !== false) h.back(); };
  const create = () => { h.replace({ screen: 'home' }); h.onAdd({ place: v.place }); };
  return html`<${Sheet} key=${'w:' + id} title=${v.title} onClose=${h.back}>
    <div class="wsh">
      ${v.top && html`<p class="wl-top">${v.top}</p>`}
      <section aria-labelledby="cg-h"><h3 id="cg-h" class="lbl">컨디션</h3>
        <p>${v.condText}</p><${Note}>${COND_NOTE}<//></section>
      ${v.cells && (v.quiet ? html`<${Note} ruled class="n">${v.quiet}<//>` : html`<${Cells} c=${v.cells} />`)}
      ${v.showSun && html`<${SunCard} key=${'sun:' + id} place=${crag} resolved=${v.resolved} plan=${v.plan} s=${s} now=${Date.now()} kind=${symbolKind(v.resolved)} />`}
      ${ctx.from === 'alt' && plan ? html`<${ButtonRow}><button type="button" class="btn p" onClick=${swap}>이곳으로 바꾸기</button><//>`
        : !ctx.from && html`<${ButtonRow}><button type="button" class="btn p" onClick=${create}>이 암장으로 일정 잡기</button><//>`}
    </div>
  <//>`;
}

export function WallSheet({ store, handlers: h }) {
  const s = usePlannerState(store);
  if (s.route.screen !== 'wall') return null;
  const id = s.route.id;
  const ctx = s.wallCtx ?? {};
  const picked = pickSheetPlace(s, id);
  if (picked?.kind === 'ice') return html`<${IceSheet} key=${'w:' + id} place=${picked.place} s=${s} h=${h} />`; // a 빙벽장 (never the mountain entry) has its own sheet
  if (picked?.kind === 'crag') return html`<${CragSheet} key=${'w:' + id} crag=${picked.place} s=${s} h=${h} />`;
  const wall = picked?.place ?? null;
  if (!wall) {
    return html`<${Sheet} key=${'w:' + id} title=${s.walls.length ? '암장 정보' : '불러오는 중이에요'} onClose=${h.back}>
      ${s.walls.length > 0 && html`<p role="status">암장을 찾을 수 없어요</p>`}<//>`;
  }
  const date = ctx.date ?? s.today;
  const min = Number.isFinite(ctx.min) ? ctx.min : null;
  const m = wallSheetModel(wall, { date, min, walls: s.walls });
  const place = { kind: 'official', id };
  const resolved = resolvePlace(place, { walls: s.walls, crags: s.crags, mine: s.db.mine, aliases: s.aliases });
  const probe = { date, min, place };
  const hasWx = s.wx?.hourly?.has(wall.name); // the forecast exists only for places a plan uses (no new request here)
  const cells = hasWx ? homeCells(resolved, probe, s) : null;
  const quiet = cells ? cellsQuiet(cells) : null;
  const kind = wall.venue === 'indoor' ? 'lead' : 'wall';
  const util = utilLinks(config.utilUrl, wall.name)?.wall;
  const plan = ctx.planId ? s.db.plans.find((p) => p.id === ctx.planId) : null;
  const swap = () => { if (plan && h.savePlan(changePlace(plan, place, wall.name))?.ok !== false) h.back(); };
  const create = () => { h.replace({ screen: 'home' }); h.onAdd({ place }); };
  return html`<${Sheet} key=${'w:' + id} title=${m.name} onClose=${h.back}>
    <div class="wsh">
      ${(m.region || m.open) && html`<p class="wl-top">${[m.region, m.open].filter(Boolean).join(' · ')}</p>`}
      ${cells && (quiet ? html`<${Note} ruled class="n">${quiet}<//>` : html`<${Cells} c=${cells} />`)}
      ${wallPosition(wall) && kind === 'wall' && html`<${SunCard} key=${'sun:' + id} place=${wall} resolved=${resolved} plan=${{ id: 'wall:' + id, date, min }} s=${s} now=${Date.now()} kind=${kind} />`}
      <section aria-labelledby="wl-h"><h3 id="wl-h" class="lbl">운영시간</h3>
        ${m.week ? html`<dl class="wl-week">${m.week.map((r, i) => html`<dt key=${'d' + i}>${r.days}</dt><dd key=${'t' + i}>${r.text}</dd>`)}</dl>` : html`<${Note}>운영시간 정보가 없어요<//>`}</section>
      ${m.fee && html`<section aria-labelledby="wl-f"><h3 id="wl-f" class="lbl">요금</h3><p>${m.fee}</p></section>`}
      ${m.nearby.length > 0 && html`<section aria-labelledby="wl-n"><h3 id="wl-n" class="lbl">근처 암장</h3>
        <ul class="wl-near">${m.nearby.map((n) => html`<li key=${n.id}><${LinkButton} class="p-link nr" onClick=${() => h.swapWall(n.id)}><b>${n.name}</b><small>${[n.region, `약 ${Math.max(1, Math.round(n.km))}km`, n.open].filter(Boolean).join(' · ')}</small><//></li>`)}</ul></section>`}
      ${ctx.from === 'alt' && plan ? html`<${ButtonRow}><button type="button" class="btn p" onClick=${swap}>이곳으로 바꾸기</button><//>`
        : !ctx.from && html`<${ButtonRow}><button type="button" class="btn p" onClick=${create}>이 암장으로 일정 잡기</button><//>`}
      ${util && html`<${LinkButton} href=${util} external>전체 운영시간·제보 ›<//>`}
    </div>
  <//>`;
}
