// src/planner-state.js — framework-agnostic boot/state for the planner. No DOM, no framework: the view layer (Preact, Task 12b+)
// subscribes and renders. storage and every fetch function are injected; nothing here touches fetch/localStorage directly.
import { loadAll, loadAliases as realLoadAliases } from './plan-api.js';
import { fetchNational as realFetchNational, fetchCrags as realFetchCrags } from './store.js';
import { loadPlanWeather as realLoadPlanWeather } from './plan-weather.js';
import { resolvePlace } from './plan-place.js';
import { ymd } from './time.js';

const EMPTY_WX = { hourly: new Map(), crag: { daily: new Map(), hourly: new Map(), wet: new Map(), ok: true }, ok: true };

/**
 * createPlannerState({ storage, fetchFns, now }) → { get, update, subscribe, boot, tick }
 * - storage: { getItem, setItem }. fetchFns (all optional, default = the real modules): { fetchNational, fetchCrags, loadAliases, loadPlanWeather, fetchFn }.
 * - now: () => Date (default: new Date()).
 * state: { db, walls, crags, aliases, wx, today, nowMin, expandedId, dismissedAuto, detailId, wxLoaded } (detailId = the plan whose detail is open, or null)
 *
 * CONTRACT for the view layer: tick() changes nowMin every minute and notifies. A render triggered by it must patch text only and
 * must NOT re-create elements that hold focus (document.activeElement inside a row => leave that row's DOM alone; experience.md
 * "주기적 재렌더가 포커스를 날림"). Keep keys stable so the framework diffs instead of remounting.
 */
export function createPlannerState({ storage, fetchFns = {}, now = () => new Date() } = {}) {
  const f = {
    fetchNational: realFetchNational, fetchCrags: realFetchCrags, loadAliases: realLoadAliases, loadPlanWeather: realLoadPlanWeather, ...fetchFns,
  };
  const clock = () => { const d = now(); return { today: ymd(d), nowMin: d.getHours() * 60 + d.getMinutes() }; };
  let state = {
    db: loadAll(storage, { today: clock().today }), walls: [], crags: [], aliases: new Map(), wx: EMPTY_WX, ...clock(), expandedId: null, dismissedAuto: new Set(), detailId: null, wxLoaded: false,
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

  /** Re-read storage (after a save through plan-api) without touching the network. */
  const reload = () => update({ db: loadAll(storage, { today: state.today }) });

  // weather for the places plans use; re-run after plans change (same places = no new request)
  let wxKey = '';
  async function loadWx() {
    const { walls, crags, aliases } = state;
    const usedWalls = [];
    const usedCrags = [];
    for (const p of state.db.plans) {
      const r = resolvePlace(p.place, { walls, crags, mine: state.db.mine, aliases, savedName: p.placeName });
      if (r.kind === 'wall' && r.located && !usedWalls.includes(r.wall)) usedWalls.push(r.wall);
      else if (r.kind === 'crag' && r.located && !usedCrags.includes(r.crag)) usedCrags.push(r.crag);
    }
    const key = [...usedWalls.map((w) => 'w:' + w.name), ...usedCrags.map((c) => 'c:' + c.name)].sort().join('|');
    if (!key || key === wxKey) { if (!state.wxLoaded) update({ wxLoaded: true }); return state.wx; }
    if (state.wxLoaded) update({ wxLoaded: false }); // a new place: its forecast is on its way
    try { const wx = await f.loadPlanWeather({ walls: usedWalls, crags: usedCrags }, { fetchFn: f.fetchFn, storage }); wxKey = key; update({ wx, wxLoaded: true }); } catch { update({ wxLoaded: true }); /* keep the old wx; the row says it could not load */ }
    return state.wx;
  }

  async function boot() {
    update({ db: loadAll(storage, { today: clock().today }), ...clock() }); // plans show before any network answers
    const ok = (r, dflt) => (r.status === 'fulfilled' && r.value ? r.value : dflt);
    const [w, c, a] = await Promise.allSettled([f.fetchNational(f.fetchFn), f.fetchCrags(f.fetchFn), f.loadAliases({ fetchFn: f.fetchFn })]);
    const walls = ok(w, []);
    const crags = ok(c, []);
    const aliases = ok(a, new Map());
    update({ walls, crags, aliases });
    try { await loadWx(); } finally { if (!state.wxLoaded) update({ wxLoaded: true }); }
    return state;
  }

  return { get, update, subscribe, boot, tick, reload, loadWx };
}
