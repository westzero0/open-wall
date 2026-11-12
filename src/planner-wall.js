// src/planner-wall.js — 암장 시트: one official wall (hours, fee, nearby walls, link to the utility page), opened from a plan's detail,
// an alternative, a search result, or straight from #/wall/<id>. It is a sheet over the screen below (route.screen === 'wall'; base keeps the screen under it).
// Model words come from plan-wall.js. No fetch, no storage here; the forecast is only what the plans already loaded (s.wx).
import { html, usePlannerState } from './planner-ui.js';
import { Sheet } from './planner-sheet.js';
import { LinkButton, ButtonRow } from './planner-parts.js';
import { Cells } from './planner-cells.js';
import { SunCard } from './planner-sun.js';
import { findWall, wallSheetModel, utilLinks } from './plan-wall.js';
import { resolvePlace } from './plan-place.js';
import { homeCells, cellsQuiet } from './plan-view.js';
import { changePlace } from './plan-actions.js';
import { wallPosition } from './viewmodel.js';
import { config } from './config.js';

export function WallSheet({ store, handlers: h }) {
  const s = usePlannerState(store);
  if (s.route.screen !== 'wall') return null;
  const id = s.route.id;
  const ctx = s.wallCtx ?? {};
  const wall = findWall(s.walls, id);
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
      ${cells && (quiet ? html`<p class="quiet n">${quiet}</p>` : html`<${Cells} c=${cells} />`)}
      ${wallPosition(wall) && kind === 'wall' && html`<${SunCard} key=${'sun:' + id} place=${wall} resolved=${resolved} plan=${{ id: 'wall:' + id, date, min }} s=${s} now=${Date.now()} kind=${kind} />`}
      <section aria-labelledby="wl-h"><h3 id="wl-h" class="lbl">운영시간</h3>
        ${m.week ? html`<dl class="wl-week">${m.week.map((r, i) => html`<dt key=${'d' + i}>${r.days}</dt><dd key=${'t' + i}>${r.text}</dd>`)}</dl>` : html`<p>운영시간 정보가 없어요</p>`}</section>
      ${m.fee && html`<section aria-labelledby="wl-f"><h3 id="wl-f" class="lbl">요금</h3><p>${m.fee}</p></section>`}
      ${m.nearby.length > 0 && html`<section aria-labelledby="wl-n"><h3 id="wl-n" class="lbl">근처 암장</h3>
        <ul class="wl-near">${m.nearby.map((n) => html`<li key=${n.id}><${LinkButton} class="p-link nr" onClick=${() => h.swapWall(n.id)}><b>${n.name}</b><small>${[n.region, `약 ${Math.max(1, Math.round(n.km))}km`, n.open].filter(Boolean).join(' · ')}</small><//></li>`)}</ul></section>`}
      ${ctx.from === 'alt' && plan ? html`<${ButtonRow}><button type="button" class="btn p" onClick=${swap}>이곳으로 바꾸기</button><//>`
        : !ctx.from && html`<${ButtonRow}><button type="button" class="btn p" onClick=${create}>이 암장으로 일정 잡기</button><//>`}
      ${util && html`<${LinkButton} href=${util} external>전체 운영시간·제보 ›<//>`}
    </div>
  <//>`;
}
