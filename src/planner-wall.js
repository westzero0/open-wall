// src/planner-wall.js — what #/wall/<id> opens: always a place PAGE (planner-page.js; tab in the address): 외벽 컨디션·이용·루트, 자연암장 컨디션·어프로치·루트, 빙벽장 결빙·이용·루트; not found = the same frame with one line.
// It sits over the screen below (route.screen === 'wall'; base keeps the screen under it). Model words come from plan-wall.js / place-page-model.js; pieces are drawn by planner-wall-parts.js.
// No fetch, no storage here; the forecast is only what the plans already loaded (s.wx).
import { html, usePlannerState, useState, useEffect, useRef } from './planner-ui.js';
import { LinkButton, Note } from './planner-parts.js';
import { PlacePage, PlaceReportSheet, Segments } from './planner-page.js';
import { HoursGrid, SeasonSun, TimeLegend, Card, Empty, FeeTable, SpecsList, Parking, RouteBars, HourlyLine } from './planner-wall-parts.js';
import { placePageTabs, pickTab, reportKinds, planRowKind } from './place-page-model.js';
import { blanksOf } from './fill-fields.js';
import { reportOn } from './plan-report-api.js';
import { routeView } from './routes.js';
import { cardModel, shortenDates } from './card-model.js';
import { getStatus, hasHours } from './hours.js';
import { dialModel } from './dial.js';
import { Cells } from './planner-cells.js';
import { SunCard } from './planner-sun.js';
import { findWall, wallSheetModel, utilLinks, wallSky, wallFees, wallTabEmpty, wallTitle } from './plan-wall.js';
import { resolvePlace } from './plan-place.js';
import { homeCells, cellsQuiet } from './plan-view.js';
import { changePlace } from './plan-actions.js';
import { wallPosition, weeklyHours } from './viewmodel.js';
import { IceCond, IceUse, iceModelOf } from './planner-ice.js';
import { findIce } from './plan-ice-sheet.js';
import { config } from './config.js';
import { cragRow, COND_NOTE } from './crag-model.js';
import { symbolKind, cragKind } from './plan-card.js';
import { wallPageId } from './share-id.js';
import { cragSummaryBits, approachView, routesView } from './crag-detail-model.js';
import { ApproachPane, RoutesPane } from './planner-crag-detail.js';

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
    top: [crag.region, cragKind(crag)].filter(Boolean).join(' · '),
    condText: wx ? row.cond.text : '컨디션 정보 없음',
    cells, quiet: cells ? cellsQuiet(cells) : null, resolved, place,
    showSun: !!wallPosition(crag),
    plan: { id: 'crag:' + id, date, min },
  };
}

const ASK = '알려 주기';
/** The ask button of an empty part (null while reports are off). */
const askBtn = (on, setRep, kinds, label = ASK) => on && html`<${LinkButton} onClick=${() => setRep(kinds)}>${label}<//>`;
/** The plan row under every tab: 이곳으로 바꾸기 (from a plan's 대체 추천) / the create line / none (from the plan's detail). */
function planRowOf({ ctx, s, h, place, name, noun }) {
  const plan = ctx.planId ? s.db.plans.find((p) => p.id === ctx.planId) : null;
  const kind = planRowKind(ctx.from, Boolean(plan));
  if (kind === 'none') return null;
  if (kind === 'swap') return html`<button type="button" class="btn p full" onClick=${() => { if (plan && h.savePlan(changePlace(plan, place, name))?.ok !== false) h.back(); }}>이곳으로 바꾸기</button>`;
  return html`<button type="button" class="btn p full" onClick=${() => { h.replace({ screen: 'home' }); h.onAdd({ place }); }}>이 ${noun}으로 일정 잡기</button>`;
}

/** One 자연암장 on the place page: 컨디션, 어프로치, 루트 (a pending crag opens too, with every tab empty). */
function CragPlace({ crag, s, h }) {
  const ctx = s.wallCtx ?? {};
  const v = cragSheetView(crag, { s, ctx, now: new Date(Date.now()) });
  const id = v.id;
  const [data, setData] = useState(null); // 루트 데이터 (handlers.loadRoutes)
  const [rep, setRep] = useState(null);
  useEffect(() => { let on = true; h.loadRoutes().then((d) => { if (on) setData(d ?? {}); }); return () => { on = false; }; }, []);
  const entry = data?.[crag.name];
  useEffect(() => { if (entry?.routes?.length) h.adoptRoutes(id, entry.routes); }, [data]); // typed routes now in the list take its routeId
  const multi = crag.type === 'multi';
  const condEmpty = !v.cells && !v.showSun;
  const tabs = placePageTabs('crag', { empty: { cond: condEmpty, approach: approachView(crag) === null, routes: data != null && routesView(entry, null, multi) === null } });
  const tab = pickTab('crag', s.route.tab);
  const sky = v.showSun ? wallSky(crag, atOf(ctx, s), !ctx.date) : undefined; // k-none stays for a crag without a position
  const on = reportOn();
  const ask = (k) => askBtn(on, setRep, reportKinds('crag', k));
  const bits = cragSummaryBits(crag, entry);
  const cond = html`<div class="wsh">
    ${bits.length > 0 && html`<p class="wl-top">${bits.map((t, i) => html`${i > 0 && ' · '}<span key=${t}>${t}</span>`)}</p>`}
    <section aria-labelledby="cg-h"><h3 id="cg-h" class="lbl vh">컨디션</h3>
      <p class="cond-now">${v.condText}</p><${Note}>${COND_NOTE}<//></section>
    ${v.cells && (v.quiet ? html`<${Note} ruled class="n">${v.quiet}<//>` : html`<${Cells} c=${v.cells} />`)}
    ${v.showSun && html`<${SunCard} key=${'sun:' + id} place=${crag} resolved=${v.resolved} plan=${v.plan} s=${s} now=${Date.now()} kind=${symbolKind(v.resolved)} />`}
    ${condEmpty && ask('cond')}
  </div>`;
  const panels = {
    cond,
    approach: html`<div class="wsh"><${ApproachPane} crag=${crag} ask=${ask('approach')} /></div>`,
    routes: html`<div class="wsh"><${RoutesPane} entry=${entry} data=${data} multi=${multi} ask=${ask('routes')} crag=${crag} s=${s} h=${h} /></div>`,
  };
  return html`<${PlacePage} title=${crag.name} top=${v.top} sky=${sky} tabs=${tabs} tab=${tab} onTab=${(k) => h.replace({ screen: 'wall', id, tab: k })} panels=${panels}
      planRow=${planRowOf({ ctx, s, h, place: v.place, name: crag.name, noun: '암장' })} notice=${s.notice} onBack=${h.back} onReport=${on ? () => setRep(reportKinds('crag', tab)) : null} />
    ${rep && html`<${PlaceReportSheet} wallName=${crag.name} kinds=${rep} crag=${true} onClose=${() => setRep(null)} />`}`;
}

/** One 빙벽장 on the place page: 결빙 (결빙 · 날씨), 이용, 루트 (no route data: an empty invitation). */
function IcePlace({ place: ice, s, h }) {
  const [rep, setRep] = useState(null);
  const id = wallPageId(ice);
  const ctx = s.wallCtx ?? {};
  const m = iceModelOf(ice, s);
  const top = [m.kind, m.region, m.season?.line].filter(Boolean).join(' · ');
  const tabs = placePageTabs('ice', { empty: { use: !m.reserve && m.facts.length === 0, routes: true } });
  const tab = pickTab('ice', s.route.tab);
  const on = reportOn();
  const ask = (k, label) => askBtn(on, setRep, reportKinds('ice', k), label);
  const place = { kind: 'official', id };
  const panels = {
    cond: html`<${IceCond} place=${ice} s=${s} h=${h} />`,
    use: html`<${IceUse} place=${ice} s=${s} ask=${ask('use')} />`,
    routes: html`<div class="ws-use"><${Card} title="루트" sec="routes" empty=${true}><${Empty} title="이 빙벽장의 루트는 아직 비어 있어요" sub="대략 몇 개인지만 알려 주셔도 돼요." ask=${ask('routes', '루트 분포 알려 주기')} /><//></div>`,
  };
  return html`<${PlacePage} title=${m.name} top=${top} tabs=${tabs} tab=${tab} onTab=${(k) => h.replace({ screen: 'wall', id, tab: k })} panels=${panels}
      planRow=${planRowOf({ ctx, s, h, place, name: m.name, noun: '빙벽장' })} notice=${s.notice} onBack=${h.back} onReport=${on ? () => setRep(reportKinds('ice', tab)) : null} />
    ${rep && html`<${PlaceReportSheet} wallName=${ice.name} kinds=${rep} crag=${false} onClose=${() => setRep(null)} />`}`;
}

/** The picked minute: the plan's, else (a plan day that is today) the clock's — noon would be a past hour with no forecast. */
const minOf = (ctx, s) => Number.isFinite(ctx.min) ? ctx.min : ctx.date === s.today && Number.isFinite(s.nowMin) ? s.nowMin : null;
const atOf = (ctx, s) => {
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(ctx.date ?? '');
  if (!ok) return new Date(Date.now());
  const [y, mo, d] = ctx.date.split('-').map(Number);
  const t = new Date(y, mo - 1, d, 0, minOf(ctx, s) ?? 12 * 60);
  return Number.isNaN(+t) ? new Date(Date.now()) : t;
};

/** One 외벽 on the place page: 컨디션 (날씨 · 운영시간), 이용 (시설 · 요금 · 주차), 루트. */
function WallPlace({ wall, s, h }) {
  const id = wallPageId(wall);
  const ctx = s.wallCtx ?? {};
  const [rep, setRep] = useState(null); // kinds the open report sheet offers
  const [seg, setSeg] = useState({ cond: 'weather', use: 'specs' }); // the part in view per tab, kept while the page lives
  const [pick, setPick] = useState(null); // a 하계/동계 preview
  const at = atOf(ctx, s);
  const isNow = !ctx.date;
  const date = ctx.date ?? s.today;
  const min = minOf(ctx, s);
  const place = { kind: 'official', id };
  const resolved = resolvePlace(place, { walls: s.walls, crags: s.crags, mine: s.db.mine, aliases: s.aliases });
  const m = wallSheetModel(wall, { date, min, walls: s.walls });
  const model = cardModel({ wall, status: getStatus(wall, at) }, at);
  const fees = wallFees(wall, s.today);
  const routes = routeView(wall);
  const empty = wallTabEmpty(wall, { fees, routes, model });
  const tabs = placePageTabs('wall', { empty });
  const tab = pickTab('wall', s.route.tab);
  const on = reportOn();
  const ask = (kinds, label = ASK) => on && html`<${LinkButton} onClick=${() => setRep(kinds)}>${label}<//>`;
  const setS = (tabKey, v) => setSeg((c) => ({ ...c, [tabKey]: v }));

  // 컨디션
  const hasWx = s.wx?.hourly?.has(wall.name); // the forecast exists only for places a plan uses (no new request here)
  const cells = hasWx ? homeCells(resolved, { date, min, place }, s) : null;
  const quiet = cells ? cellsQuiet(cells) : null;
  const kind = wall.venue === 'indoor' ? 'lead' : 'wall';
  const hasGrid = weeklyHours(wall, at).rows.length > 0;
  const dm = dialModel(wall, at, { isNow, dayLabel: '' });
  const noSun = dm.state === 'unknown' || dm.state === 'override';
  const util = utilLinks(config.utilUrl, wall.name)?.wall;
  const sunBlock = html`<${SeasonSun} wall=${wall} at=${at} pick=${pick ?? undefined} hasGrid=${hasGrid} noSun=${noSun} />`;
  const hasHrs = hasHours(wall);
  const condParts = [{ key: 'weather', label: '날씨' }, { key: 'hours', label: '운영시간' }];
  const near = m.nearby.length > 0 && html`<section class="wsh" aria-labelledby="wl-n"><h3 id="wl-n" class="lbl">근처 암장</h3>
  <ul class="wl-near">${m.nearby.map((n) => html`<li key=${n.id}><${LinkButton} class="p-link nr" onClick=${() => h.swapWall(n.id)}><b>${n.name}</b><small>${[n.region, `약 ${Math.max(1, Math.round(n.km))}km`, n.open].filter(Boolean).join(' · ')}</small><//></li>`)}</ul></section>`
  const cond = html`<div class="ws-use">
    <${Segments} items=${condParts} cur=${seg.cond} onPick=${(k) => setS('cond', k)} label="컨디션 보기" idPrefix="pp-cs" />
    <div role="tabpanel" id="pp-cs-weather-p" aria-labelledby="pp-cs-weather" class="sx-panel" hidden=${seg.cond !== 'weather'}>
      <section class="ws-sec" aria-label="날씨"><div class="ws-sec-h"><h3>날씨</h3></div>
        ${cells ? (quiet ? html`<${Note} class="n">${quiet}<//>` : html`<${Cells} c=${cells} />`) : html`<${Note}>${at < Date.now() - 36e5 ? '지난 시각이라 예보가 없어요' : '이 시각의 예보가 아직 없어요'}<//>`}
        <${HourlyLine} hours=${s.wx?.hourly?.get(wall.name)} at=${at} /></section>
      ${wallPosition(wall) && kind === 'wall' && html`<${SunCard} key=${'sun:' + id} place=${wall} resolved=${resolved} plan=${{ id: 'wall:' + id, date, min }} s=${s} now=${Date.now()} kind=${kind} />`}
    </div>
    <div role="tabpanel" id="pp-cs-hours-p" aria-labelledby="pp-cs-hours" class="sx-panel" hidden=${seg.cond !== 'hours'}>
      ${hasHrs && hasGrid ? html`<${TimeLegend} sun=${!noSun} hatch=${false} />
        <${Card} title="운영시간" sec="hours"><div class="ws-hours"><${HoursGrid} wall=${wall} at=${at} closureFull=${model.closureFull} pick=${pick ?? undefined} onPick=${setPick} />
          ${model.closureNotes.map((n) => html`<p key=${n.k} class="pnear"><span class="pn-k">${n.k}</span>${n.v}</p>`)}${sunBlock}</div>
          <p class="ws-chk end">${shortenDates(model.checked, s.today)}</p><//>`
        : html`<${Card} title="운영시간" sec="hours" empty=${true}><${Empty} title="운영시간을 아직 몰라요" sub="전화나 공지에서 본 시간 한 줄이면 충분해요." ask=${ask(['운영시간'])} /><//>`}
    ${util && html`<${LinkButton} href=${util} external>전체 운영시간·제보 ›<//>`}
    </div>
  </div>`;

  // 이용
  const hasFacts = Boolean(model.specs.length || model.facilityFacts.length || model.facilityRest.length || model.amenities.length);
  const parkingKnown = !(model.parking.word === '정보는 아직 몰라요' && !model.parkingMore.length && !model.parkingWhere.onsite.length);
  const emptyBox = (card, sec, title, sub, kinds) => html`<${Card} title=${card} sec=${sec} empty=${true}><${Empty} title=${title} sub=${sub} ask=${ask(kinds)} /><//>`;
  const blanks = blanksOf(wall, 'specs').map((x) => x.name); // the blanks 외벽 제원 asks about
  const useParts = [
    { key: 'specs', label: '시설', node: html`<${Card} title="외벽 제원 · 시설" sec="specs"><${SpecsList} m=${model} ask=${on && blanks.length > 0 && html`<ul class="memo-list info fill-list"><li class="fill-row"><span class="mk">${blanks.join(' · ')}</span><span class="mv"><${LinkButton} onClick=${() => setRep(['시설'])}>${ASK}<//></span></li></ul>`} /><//>` },
    { key: 'fees', label: '요금', node: fees ? html`<${Card} title="입장 요금" sec="fees"><${FeeTable} fees=${fees} /><p class="ws-chk end">${shortenDates(model.checked, s.today)}</p><//>` : emptyBox('입장 요금', 'fees', '입장 요금이 아직 비어 있어요', '아는 금액 하나만 알려 주셔도 돼요.', ['요금']) },
    { key: 'parking', label: '주차', node: parkingKnown ? html`<${Card} title="주차" sec="parking"><${Parking} m=${model} />${model.parkingChecked && html`<p class="ws-chk end">${shortenDates(model.parkingChecked, s.today)}</p>`}<//>` : emptyBox('주차', 'parking', '주차 정보가 아직 비어 있어요', '주차장 이름이나 요금 한 줄이면 충분해요.', ['주차']) },
  ].filter((p) => p.key !== 'specs' || hasFacts || blanks.length > 0 && on);
  const useSeg = useParts.some((p) => p.key === seg.use) ? seg.use : useParts[0]?.key;
  const use = empty.use
    ? html`<div class="ws-use"><${Card} title="이용" sec="use" empty=${true}><${Empty} title="이용 정보가 아직 비어 있어요" sub="시설·요금·주차 중 아는 것 한 줄이면 충분해요." ask=${ask(reportKinds('wall', 'use'))} /><//>${near}</div>`
    : html`<div class="ws-use"><${Segments} items=${useParts} cur=${useSeg} onPick=${(k) => setS('use', k)} label="이용 보기" idPrefix="pp-us" />
      ${useParts.map((p) => html`<div key=${p.key} role="tabpanel" id=${`pp-us-${p.key}-p`} aria-labelledby=${`pp-us-${p.key}`} class="sx-panel" hidden=${p.key !== useSeg}>${p.node}</div>`)}${near}</div>`;

  // 루트
  const routesPane = html`<div class="ws-use">${routes
    ? html`<${RouteBars} v=${routes} setting=${model.setting ? shortenDates(model.setting, s.today) : null} />`
    : html`<section class="ws-sec empty" aria-label="루트" data-sec="routes"><div class="ws-sec-h"><h3>루트</h3></div>
      <${Empty} title="이 외벽의 루트는 아직 비어 있어요" sub="대략 몇 개인지만 알려 주셔도 돼요." ask=${ask(reportKinds('wall', 'routes'), '루트 분포 알려 주기')} /></section>`}</div>`;

  const planRow = planRowOf({ ctx, s, h, place, name: wall.name, noun: '외벽' });
  return html`<${PlacePage} title=${wallTitle(wall)} top=${[m.region, m.open].filter(Boolean).join(' · ')} sky=${wallSky(wall, at, isNow)}
      tabs=${tabs} tab=${tab} onTab=${(k) => h.replace({ screen: 'wall', id, tab: k })} panels=${{ cond, use, routes: routesPane }} planRow=${planRow}
      notice=${s.notice} onBack=${h.back} onReport=${on ? () => setRep(reportKinds('wall', tab)) : null} />
    ${rep && html`<${PlaceReportSheet} wallName=${wall.name} kinds=${rep} crag=${false} onClose=${() => setRep(null)} />`}`;
}

export function WallPage({ store, handlers: h }) {
  const s = usePlannerState(store);
  if (s.route.screen !== 'wall') return null;
  const id = s.route.id;
  const picked = pickSheetPlace(s, id);
  if (picked?.kind === 'ice') return html`<${IcePlace} key=${'w:' + id} place=${picked.place} s=${s} h=${h} />`;
  if (picked?.kind === 'crag') return html`<${CragPlace} key=${'w:' + id} crag=${picked.place} s=${s} h=${h} />`;
  const wall = picked?.place ?? null;
  if (!wall) { // not found (or the list has not come yet): the same frame, one line, no tabs
    return html`<${PlacePage} key=${'w:' + id} title=${s.walls.length ? '암장 정보' : '불러오는 중이에요'} tabs=${[]} panels=${{ solo: s.walls.length > 0 ? html`<p role="status">암장을 찾을 수 없어요</p>` : null }} notice=${s.notice} onBack=${h.back} />`;
  }
  return html`<${WallPlace} key=${'w:' + id} wall=${wall} s=${s} h=${h} />`;
}
