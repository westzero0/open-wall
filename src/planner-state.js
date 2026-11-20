// src/planner-state.js — framework-agnostic boot/state for the planner. No DOM, no framework: the view layer (Preact, Task 12b+)
// subscribes and renders. storage and every fetch function are injected; nothing here touches fetch/localStorage directly.
import { loadAll, loadAliases as realLoadAliases } from './plan-api.js';
import { fetchNational as realFetchNational, fetchCrags as realFetchCrags, fetchPendingCrags as realFetchPendingCrags, fetchIce as realFetchIce } from './store.js';
import { loadPlanWeather as realLoadPlanWeather } from './plan-weather.js';
import { resolvePlace } from './plan-place.js';
import { wallPageId } from './share-id.js';
import { findIce } from './plan-ice-sheet.js';
import { wallPosition } from './viewmodel.js';
import { cragsNear, wallsNear } from './plan-alt.js';
import { loadCragWeather as realLoadCragWeather, CRAG_WX_ALL_KEY } from './crag-weather.js';
import { mapPlaces } from './rain-map.js';
import { ymd } from './time.js';

const HOME = { screen: 'home', id: null };
const EMPTY_WX = { hourly: new Map(), crag: { daily: new Map(), hourly: new Map(), wet: new Map(), ok: true }, ice: { byId: new Map(), ok: true }, ok: true };

/**
 * createPlannerState({ storage, fetchFns, now }) → { get, update, subscribe, boot, tick }
 * - storage: { getItem, setItem }. fetchFns (all optional, default = the real modules): { fetchNational, fetchCrags, fetchIce, loadAliases, loadPlanWeather, fetchFn }.
 * - now: () => Date (default: new Date()).
 * state: { db, walls, crags, ice, aliases, wx, today, nowMin, expandedId, dismissedAuto, detailId, wxLoaded } (detailId = the plan whose detail is open, or null)
 *
 * CONTRACT for the view layer: tick() changes nowMin every minute and notifies. A render triggered by it must patch text only and
 * must NOT re-create elements that hold focus (document.activeElement inside a row => leave that row's DOM alone; experience.md
 * "주기적 재렌더가 포커스를 날림"). Keep keys stable so the framework diffs instead of remounting.
 */
export function createPlannerState({ storage, fetchFns = {}, now = () => new Date() } = {}) {
  const f = {
    fetchNational: realFetchNational, fetchCrags: realFetchCrags, fetchPendingCrags: realFetchPendingCrags, fetchIce: realFetchIce, loadAliases: realLoadAliases, loadPlanWeather: realLoadPlanWeather, loadCragWeather: realLoadCragWeather, ...fetchFns,
  };
  const clock = () => { const d = now(); return { today: ymd(d), nowMin: d.getHours() * 60 + d.getMinutes() }; };
  let state = {
    db: loadAll(storage, { today: clock().today }), walls: [], crags: [], ice: [], aliases: new Map(), wx: EMPTY_WX, ...clock(), expandedId: null, dismissedAuto: new Set(), detailId: null, wxLoaded: false, rainWx: null, rainLoaded: false, route: HOME, base: HOME, preset: null, wallCtx: null,
  };
  const subs = new Set();
  const notify = () => { for (const fn of [...subs]) fn(state); };

  const get = () => state;
  const update = (patch) => { state = { ...state, ...patch }; notify(); };
  const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

  // ponytail: tick also follows midnight (today) because a day change would otherwise leave "오늘" stale; it is still one cheap patch.
  const tick = () => {
    const c = clock();
    if (c.nowMin === state.nowMin && c.today === state.today) return;
    update(c);
  };

  /** The address changed: route follows it; detailId always comes from the base route (a plan's detail is a screen, not a flag).
   *  route = what the address shows; base = the last non-wall route (a wall sheet floats over it); preset = { place?, date? } seeds the new-plan sheet. */
  const setRoute = (r) => {
    const route = { screen: r?.screen ?? 'home', id: r?.id ?? null, tab: r?.tab ?? null };
    const base = route.screen === 'wall' || route.screen === 'settings' ? state.base : route;
    update({ route, base, detailId: base.screen === 'plan' ? base.id : null });
  };

  /** Re-read storage (after a save through plan-api) without touching the network. */
  const reload = () => update({ db: loadAll(storage, { today: state.today }) });

  // weather for the places plans use; re-run after plans change (same places = no new request)
  let wxKey = '';
  async function loadWx() {
    const { walls, crags, ice, aliases } = state;
    const usedWalls = [];
    const usedCrags = [];
    const usedIce = []; // ice venues the plans use: { id, lat, lng } (a place without coordinates and the mountain entry have no temperatures to ask for)
    const soonCrags = []; // crag plans within the forecast range: their nearby crags' weather lets "다른 바위" (plan-alt) be judged
    const soonPlaces = []; // plans within the wall forecast range (today..+3, forecast_days=4): nearby outdoor walls' weather lets wall alternatives be judged
    const until = ymd(new Date(now().getTime() + 7 * 864e5));
    const until4 = ymd(new Date(now().getTime() + 3 * 864e5));
    for (const p of state.db.plans) {
      const r = resolvePlace(p.place, { walls, crags, ice, mine: state.db.mine, aliases, savedName: p.placeName });
      if (r.kind === 'ice') { const id = wallPageId(r.ice); if (r.located && r.ice.type !== 'mountain' && !usedIce.some((v) => v.id === id)) usedIce.push({ id, lat: r.pos.lat, lng: r.pos.lng }); continue; }
      if (r.kind === 'wall' && r.located && !usedWalls.includes(r.wall)) usedWalls.push(r.wall);
      else if (r.kind === 'crag' && r.located && !usedCrags.includes(r.crag)) usedCrags.push(r.crag);
      if (r.kind === 'crag' && r.located && p.date >= state.today && p.date <= until) soonCrags.push(r.crag);
      if (r.located && (r.kind === 'wall' || r.kind === 'crag') && p.date >= state.today && p.date <= until4) soonPlaces.push(r.kind === 'wall' ? r.wall : r.crag);
    }
    if (state.route.screen === 'wall') { // an ice venue's sheet is open: its one place is asked for even when no plan uses it (found by id only)
      const v = findIce(ice, state.route.id);
      const pos = v && wallPosition(v);
      if (pos && !usedIce.some((u) => u.id === wallPageId(v))) usedIce.push({ id: wallPageId(v), lat: pos.lat, lng: pos.lng });
    }
    for (const c of cragsNear(soonCrags, crags)) if (!usedCrags.includes(c)) usedCrags.push(c);
    for (const w of wallsNear(soonPlaces, walls)) if (!usedWalls.includes(w)) usedWalls.push(w);
    const key = [...usedWalls.map((w) => 'w:' + w.name), ...usedCrags.map((c) => 'c:' + c.name), ...usedIce.map((v) => 'i:' + v.id)].sort().join('|');
    if (!key || key === wxKey) { if (!state.wxLoaded) update({ wxLoaded: true }); return state.wx; }
    if (state.wxLoaded) update({ wxLoaded: false }); // a new place: its forecast is on its way
    try { const wx = await f.loadPlanWeather({ walls: usedWalls, crags: usedCrags, ice: usedIce }, { fetchFn: f.fetchFn, storage }); if (wx.ice?.ok !== false) wxKey = key; /* a failed ice answer is asked again next time (다시 시도) */ update({ wx: { ...wx, ice: wx.ice ?? EMPTY_WX.ice }, wxLoaded: true }); } catch { update({ wxLoaded: true }); /* keep the old wx; the row says it could not load */ }
    return state.wx;
  }

  // 전국 비 예보 지도: every natural crag with a position, asked once per list (its own storage key, so the nearby copy is never overwritten). Only the sheet calls this.
  let rainKey = '';
  let rainBusy = null; // one request at a time: sync and the one-shot subscriber can both ask in the same tick
  function loadRainMap() {
    return rainBusy ??= (async () => {
    const crags = mapPlaces(state.crags, null, { kind: 'crag' });
    const key = crags.map((c) => c.name).sort().join('|');
    if (key && key === rainKey && state.rainWx) return state.rainWx;
    if (state.rainLoaded) update({ rainLoaded: false });
    try {
      const r = await f.loadCragWeather(crags, { fetchFn: f.fetchFn, storage, cacheKey: CRAG_WX_ALL_KEY });
      if (r.ok) rainKey = key; // a failed or partial answer is asked again (다시 받기)
      update({ rainWx: { crag: r }, rainLoaded: true });
    } catch { update({ rainLoaded: true }); /* keep the old copy; the sheet says it could not load */ }
    return state.rainWx;
    })().finally(() => { rainBusy = null; });
  }

  async function boot() {
    update({ db: loadAll(storage, { today: clock().today }), ...clock() }); // plans show before any network answers
    const ok = (r, dflt) => (r.status === 'fulfilled' && r.value ? r.value : dflt);
    const [w, c, a, i] = await Promise.allSettled([f.fetchNational(f.fetchFn), f.fetchCrags(f.fetchFn), f.loadAliases({ fetchFn: f.fetchFn }), f.fetchIce ? f.fetchIce(f.fetchFn) : []]);
    const walls = ok(w, []);
    const official = ok(c, []);
    const pending = f.fetchPendingCrags ? await f.fetchPendingCrags(f.fetchFn, [...walls, ...official].map((x) => x.name)).catch(() => []) : [];
    const crags = [...official, ...pending]; // 대기 암장(이름·예전 좌표만)도 검색·기록되게
    const aliases = ok(a, new Map());
    const ice = ok(i, []); // 빙벽장은 자기 목록(crags에 섞지 않는다). 날씨(loadWx)에는 아직 안 넣는다(E6)
    update({ walls, crags, ice, aliases });
    try { await loadWx(); } finally { if (!state.wxLoaded) update({ wxLoaded: true }); }
    return state;
  }

  return { get, update, subscribe, boot, tick, reload, loadWx, loadRainMap, setRoute };
}
