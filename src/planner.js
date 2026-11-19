// src/planner.js — planner.html entry: flag check, saved screen prefs, state boot, Preact mount.
// Screens: planner-home.js (+ planner-row.js, planner-record.js), sheets planner-new.js / planner-partners.js / planner-card.js.
import './stats.js'; // 방문 통계(PostHog): 불러오면 스스로 시작한다. 이벤트는 아래 stats:* 문서 이벤트로만 받는다
import { plannerOn } from './config.js';
import { legacyTarget } from './legacy-link.js';
import { safeStorage, getStr } from './storage.js';
import { UI_KEY, cleanTheme, cleanTextSize, loadUi, saveUi } from './ui-state.js';
import { createPlannerState } from './planner-state.js';
import { savePlan, removePlan, savePartner, removePartner, saveMine, saveSettings, loadSent, saveSent, saveRouteNote, saveMyRoute, removeMyRoute, adoptAndSave, importRecords } from './plan-api.js';
import { wallPageId } from './share-id.js';
import { loadCragRoutes } from './crag-routes.js';
import { loadCrowdReports } from './plan-crowd-api.js';
import { resolveFor, todayText } from './plan-view.js';
import { parseRoute, routeHref } from './planner-route.js';
import { findWall } from './plan-wall.js';
import { TabBar } from './planner-parts.js';
import { Home } from './planner-home.js';
import { Calendar } from './planner-calendar.js';
import { Places } from './planner-places.js';
import { WallSheet } from './planner-wall.js';
import { SettingsSheet } from './planner-settings.js';
import { Icon } from './planner-icons.js';
import { PlanSheet } from './planner-new.js';
import { PartnersSheet } from './planner-partners.js';
import { RecordExtra } from './planner-record.js';
import { CardSheet } from './planner-card.js';
import { html, render, usePlannerState } from './planner-ui.js';

function Notice({ store }) { // the live region stays mounted (empty) so a screen reader announces the text when it appears
  const s = usePlannerState(store);
  return html`<p class="n notice" role="status">${s.notice || ''}</p>`;
}

// bottom tabs: only on the two top-level screens (not on a plan's detail)
function Tabs({ store }) {
  const s = usePlannerState(store);
  const sc = s.route.screen;
  if (s.detailId || !['home', 'calendar', 'crags', 'walls'].includes(sc)) return null;
  return html`<${TabBar} current=${sc === 'crags' || sc === 'walls' ? 'places' : sc} />`;
}

const app = document.getElementById('app');
app.tabIndex = -1; // focus target after a sheet closes (see onClose)
app.dataset.home = '';

// planner.html has no inline script, and boot-theme.js only covers auto+night: apply a manually chosen theme / text size here.
function applyPrefs(ui = null) {
  if (!ui) { try { ui = JSON.parse(getStr(UI_KEY)); } catch { /* broken saved value → defaults */ } }
  const root = document.documentElement;
  const theme = cleanTheme(ui?.theme);
  if (theme !== 'auto') root.dataset.theme = theme; else delete root.dataset.theme; // auto / normal: no attribute
  const size = cleanTextSize(ui?.textSize);
  if (size !== 'normal') root.dataset.text = size; else delete root.dataset.text;
}

// Handlers the screens call. Storage writes go through plan-api only; every write is followed by reload() (+ weather/crowd for new places).
// onAdd/onEdit/onCard only set a state flag; the sheets that read it (new / edit / card) are separate screens.
function makeHandlers(store, storage) {
  let navigated = false; // true once the visitor moved inside the app in this session: then back() can use history
  const flash = (notice) => { store.update({ notice }); setTimeout(() => store.update({ notice: '' }), 4000); };
  let crowdKey = '';
  async function loadCrowd() { // once per set of wall names (cache per boot)
    const s = store.get();
    const names = [...new Set(s.db.plans.map((p) => resolveFor(p, s)).filter((r) => r.kind === 'wall').map((r) => r.name))].sort();
    const key = names.join('|');
    if (!names.length || key === crowdKey) return;
    const crowd = await loadCrowdReports({ names });
    if (crowd.length) { crowdKey = key; store.update({ crowd }); } // an empty answer (offline) is retried next time
  }
  let routesP = null; // crag routes json: fetched once, on the first crag record that opens
  const loadRoutes = () => {
    const crags = store.get().crags;
    if (!routesP || (!routesP.crags && crags.length)) routesP = Object.assign(loadCragRoutes({ crags }), { crags: crags.length > 0 });
    return routesP;
  };
  const stat = (name) => document.dispatchEvent(new CustomEvent(name)); // stats.js counts the name only (no place, date or text)
  const reloaded = (r) => { store.reload(); return r; };
  // The flag sheets (new / edit / partners / card) have no address: opening one pushes a same-URL history entry, so 뒤로 closes the sheet
  // instead of leaving the app (settings and the wall sheet use their #/ address for the same). The mark tells our entry from a stale one after a reload.
  let sheetMark = 0;
  const openSheet = (patch) => { if (!store.get().sheet) { sheetMark = Date.now(); history.pushState({ sheet: sheetMark }, ''); } store.update(patch); };
  window.addEventListener('popstate', () => {
    if (!store.get().sheet || history.state?.sheet === sheetMark) return; // back from a wall sheet opened inside the sheet lands on our entry: keep it
    sheetMark = 0;
    const d = [...document.querySelectorAll('dialog.sheet[open]')].pop(); // the sheet's own close path (its "저장하지 않았어요" note) → onClose
    if (d) d.close(); else store.update({ sheet: null, editId: null, preset: null });
  });
  const after = (r) => { store.reload(); store.loadWx(); loadCrowd(); return r; };
  return {
    loadCrowd,
    loadRoutes,
    getSent: () => loadSent(storage),
    saveSent: (v) => saveSent(storage, v),
    flash,
    markNav: () => { navigated = true; },
    go: (route) => { navigated = true; location.hash = routeHref(route); },
    replace: (route) => location.replace(routeHref(route)),
    back: () => { if (navigated) history.back(); else location.replace(routeHref({ screen: 'home' })); },
    openWall: (id, ctx) => { store.update({ wallCtx: { from: ctx?.from ?? null, planId: ctx?.planId ?? null, date: ctx?.date ?? null, min: Number.isFinite(ctx?.min) ? ctx.min : null } }); navigated = true; location.hash = routeHref({ screen: 'wall', id }); },
    retryWx: () => store.loadWx(),
    loadRainMap: () => store.loadRainMap(),
    swapWall: (id) => location.replace(routeHref({ screen: 'wall', id })), // nearby → nearby: one entry, so 뒤로 leaves the sheet at once
    onAdd: (preset) => { stat('stats:plan-start'); openSheet({ sheet: 'new', editId: null, preset: preset ?? null }); },
    onEdit: (id) => openSheet({ sheet: 'edit', editId: id }),
    onPartners: () => openSheet({ sheet: 'partners' }),
    onSettings: () => { navigated = true; location.hash = routeHref({ screen: 'settings' }); }, // an address, so 뒤로·새로고침 work like the wall sheet
    // 테마·글자 크기: written to open-wall:ui (the old app reads the same keys). Without storage the screen still changes for this visit → { ok: false }.
    savePrefs: (patch) => {
      const ui = loadUi(storage);
      if (patch.theme !== undefined) ui.theme = cleanTheme(patch.theme);
      if (patch.textSize !== undefined) ui.textSize = cleanTextSize(patch.textSize);
      applyPrefs(ui);
      let ok = false;
      try {
        saveUi(storage, ui);
        const back = JSON.parse(storage.getItem(UI_KEY));
        ok = back?.theme === ui.theme && back?.textSize === ui.textSize;
      } catch { ok = false; }
      return { ok };
    },
    onClose: (extra) => { // extra: { notice } = a one-line note shown above the list for a few seconds
      store.update({ sheet: null, editId: null, preset: null, ...extra });
      if (sheetMark && history.state?.sheet === sheetMark) { sheetMark = 0; history.back(); } // closed by ✕ / 저장 / Esc: drop the entry openSheet pushed (no hash change, so no re-route)
      if (extra?.notice) setTimeout(() => store.update({ notice: '' }), 4000);
      // the sheet unmounts on the next render; if its opener is gone focus would fall to <body>: park it on #app
      setTimeout(() => { if (document.activeElement === document.body || !document.activeElement) document.getElementById('app')?.focus(); }, 0);
    },
    getState: store.get,
    onCard: (id) => openSheet({ sheet: 'card', cardId: id }),
    savePlan: (plan) => {
      const was = store.get().db.plans.find((p) => p.id === plan.id)?.status;
      const r = savePlan(storage, plan, { today: store.get().today });
      if (r?.ok !== false && plan.status === '갔다' && was !== '갔다') stat('stats:plan-done'); // 다녀옴으로 마침 (once per plan: only on the change)
      return after(r);
    },
    removePlan: (id) => { const r = after(removePlan(storage, id)); if (r?.ok !== false) flash('지웠어요'); return r; }, // one line above the tab bar for 4 s (no undo)
    // not plan-related: only re-read storage
    savePartner: (p) => reloaded(savePartner(storage, p)),
    removePartner: (id) => reloaded(removePartner(storage, id)),
    saveMine: (m) => reloaded(saveMine(storage, m)),
    saveSettings: (patch) => reloaded(saveSettings(storage, patch)),
    saveRouteNote: (note) => reloaded(saveRouteNote(storage, note)),
    saveMyRoute: (r) => reloaded(saveMyRoute(storage, r)),
    removeMyRoute: (id) => reloaded(removeMyRoute(storage, id)),
    importRecords: (texts, dryRun) => { // 피치 기록 파일: dryRun counts only; a save reloads (and asks weather for any new place)
      const s = store.get();
      const r = importRecords(storage, texts, { walls: s.walls, crags: s.crags, ice: s.ice, aliases: s.aliases }, { today: s.today, dryRun });
      return dryRun ? r : after(r);
    },
    // typed routes of this crag that the route list now has: their notes and ascents take the routeId (a failed write is retried next open)
    adoptRoutes: (cragId, routes) => {
      const s = store.get();
      const inCrag = (p) => { const c = resolveFor(p, s).crag; return Boolean(c) && wallPageId(c) === cragId; };
      if (adoptAndSave(storage, cragId, routes, inCrag, { today: s.today }).saved) store.reload();
    },
  };
}

async function main() {
  const old = legacyTarget(location.pathname, location.search, location.hash); // an old ?wall=/?crag= link: the old app (walls.html) still answers it
  if (old) { location.replace(old); return; }
  if (!plannerOn()) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = '일정 기능은 아직 열리지 않았어요';
    app.append(p);
    return;
  }
  applyPrefs();
  const storage = safeStorage();
  const store = createPlannerState({ storage });
  const handlers = makeHandlers(store, storage);
  const stamp = document.getElementById('today');
  const paint = (s) => { // 11월은 좁은 화면에서 접힌다(.mo): 큰 글자 320px에서 날짜가 설정 아이콘에 닿지 않게
    if (!stamp) return;
    const [mo, ...rest] = todayText(s.today).split(' ');
    const m = document.createElement('span'); m.className = 'mo'; m.textContent = mo + ' ';
    stamp.replaceChildren(m, rest.join(' '));
  };
  paint(store.get());
  store.subscribe(paint);
  const renderRecordExtra = (plan, o) => html`<${RecordExtra} plan=${plan} kind=${o.kind} resolved=${o.resolved} done=${o.done} store=${store} handlers=${handlers} />`;
  // the address decides the screen: hash → store.route. An unknown plan id goes home with a note.
  let cragsAsked = false;
  const wantsRain = (s) => s.route.screen === 'wall' && !s.rainWx && !s.wx?.crag?.daily?.has?.(s.crags.find((c) => wallPageId(c) === s.route.id)?.name) && s.crags.some((c) => wallPageId(c) === s.route.id);
  const sync = () => {
    const r = parseRoute(location.hash, location.search);
    if (r.screen === 'plan' && !store.get().db.plans.some((p) => p.id === r.id)) { handlers.replace({ screen: 'home' }); handlers.flash('일정을 찾을 수 없어요'); return; }
    const prev = store.get().route.screen;
    store.setRoute(r);
    if (r.screen === 'crags' && store.get().crags.length) { cragsAsked = true; store.loadRainMap(); } // never with an empty list (it would cache the empty key)
    if (wantsRain(store.get())) store.loadRainMap(); // a crag sheet opened without the rain map (list not visited)
    if (r.screen === 'wall' && store.get().ice.length) store.loadWx(); // an ice venue's sheet asks for its own temperatures (before boot the list is empty: boot's own loadWx covers an address that opens a sheet)
    const h = location.hash;
    if (h && h !== '#' && h !== routeHref(r)) handlers.replace(r); // a broken or unknown address: the screen is home, so the bar says so too
    if (prev === 'settings' && r.screen !== 'settings') setTimeout(() => { if (document.activeElement === document.body || !document.activeElement) document.getElementById('settings')?.focus(); }, 0); // closed by 뒤로: the native close no longer returns focus to the gear
  };
  window.addEventListener('hashchange', () => { handlers.markNav(); sync(); });
  sync();
  // opened #/crags before boot: the list arrives later, ask the weather once then (loadRainMap itself notifies, so the flag stops a loop)
  store.subscribe((s) => {
    if (cragsAsked || !s.crags.length || !(s.route.screen === 'crags' || wantsRain(s))) return;
    cragsAsked = true;
    store.loadRainMap();
  });
  // the open plan was deleted: leave quietly, park focus on #app (its opener is gone)
  store.subscribe((s) => {
    if (s.base.screen === 'plan' && !s.db.plans.some((p) => p.id === s.base.id)) { handlers.replace({ screen: 'home' }); setTimeout(() => app.focus(), 0); }
  });
  render(html`<${Notice} store=${store} /><${Tabs} store=${store} /><${Home} store=${store} handlers=${handlers} renderRecordExtra=${renderRecordExtra} /><${Calendar} store=${store} handlers=${handlers} /><${Places} store=${store} handlers=${handlers} /><${PlanSheet} store=${store} handlers=${handlers} /><${WallSheet} store=${store} handlers=${handlers} /><${SettingsSheet} store=${store} handlers=${handlers} /><${PartnersSheet} store=${store} handlers=${handlers} /><${CardSheet} store=${store} handlers=${handlers} />`, app);
  const gear = document.getElementById('settings'); // header button: static in index.html, icon and click are attached here (no inline handler under the CSP)
  if (gear) { render(html`<${Icon} name="gear" />`, gear); gear.addEventListener('click', handlers.onSettings); }
  store.boot().then(() => {
    handlers.loadCrowd();
    const wallId = parseRoute(location.hash, location.search).newWall; // ?new[&wall=<id>]: the utility page's bridge to a new plan
    if (wallId === null) return;
    history.replaceState(null, '', location.pathname + location.hash); // before onAdd: its pushed entry must sit on the clean address
    handlers.onAdd(findWall(store.get().walls, wallId) ? { place: { kind: 'official', id: wallId } } : undefined);
  });
  setInterval(store.tick, 60000);
}
main();
