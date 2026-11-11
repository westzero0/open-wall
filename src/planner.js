// src/planner.js — planner.html entry: flag check, saved screen prefs, state boot, Preact mount.
// Screens: planner-home.js (+ planner-row.js, planner-record.js), sheets planner-new.js / planner-partners.js / planner-card.js.
import './stats.js'; // 방문 통계(PostHog): 불러오면 스스로 시작한다. 이벤트는 아래 stats:* 문서 이벤트로만 받는다
import { plannerOn } from './config.js';
import { safeStorage, getStr } from './storage.js';
import { UI_KEY, cleanTheme, cleanTextSize } from './ui-state.js';
import { createPlannerState } from './planner-state.js';
import { savePlan, removePlan, savePartner, removePartner, saveMine, saveSettings, loadSent, saveSent } from './plan-api.js';
import { loadCragRoutes } from './crag-routes.js';
import { loadCrowdReports } from './plan-crowd-api.js';
import { resolveFor, todayText } from './plan-view.js';
import { Home } from './planner-home.js';
import { PlanSheet } from './planner-new.js';
import { PartnersSheet } from './planner-partners.js';
import { RecordExtra } from './planner-record.js';
import { CardSheet } from './planner-card.js';
import { html, render } from './planner-ui.js';

const app = document.getElementById('app');
app.tabIndex = -1; // focus target after a sheet closes (see onClose)
app.dataset.home = '';

// planner.html has no inline script, and boot-theme.js only covers auto+night: apply a manually chosen theme / text size here.
function applyPrefs() {
  let ui = null;
  try { ui = JSON.parse(getStr(UI_KEY)); } catch { /* broken saved value → defaults */ }
  const root = document.documentElement;
  const theme = cleanTheme(ui?.theme);
  if (theme !== 'auto') root.dataset.theme = theme;
  const size = cleanTextSize(ui?.textSize);
  if (size !== 'normal') root.dataset.text = size;
}

// Handlers the screens call. Storage writes go through plan-api only; every write is followed by reload() (+ weather/crowd for new places).
// onAdd/onEdit/onCard only set a state flag; the sheets that read it (new / edit / card) are separate screens.
function makeHandlers(store, storage) {
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
  const after = (r) => { store.reload(); store.loadWx(); loadCrowd(); return r; };
  return {
    loadCrowd,
    loadRoutes,
    getSent: () => loadSent(storage),
    saveSent: (v) => saveSent(storage, v),
    onAdd: () => { stat('stats:plan-start'); store.update({ sheet: 'new', editId: null }); },
    onEdit: (id) => store.update({ sheet: 'edit', editId: id }),
    onPartners: () => store.update({ sheet: 'partners' }),
    onClose: () => {
      store.update({ sheet: null, editId: null });
      // the sheet unmounts on the next render; if its opener is gone focus would fall to <body>: park it on #app
      setTimeout(() => { if (document.activeElement === document.body || !document.activeElement) document.getElementById('app')?.focus(); }, 0);
    },
    getState: store.get,
    onCard: (id) => store.update({ sheet: 'card', cardId: id }),
    savePlan: (plan) => {
      const was = store.get().db.plans.find((p) => p.id === plan.id)?.status;
      const r = savePlan(storage, plan, { today: store.get().today });
      if (r?.ok !== false && plan.status === '갔다' && was !== '갔다') stat('stats:plan-done'); // 다녀옴으로 마침 (once per plan: only on the change)
      return after(r);
    },
    removePlan: (id) => after(removePlan(storage, id)),
    // not plan-related: only re-read storage
    savePartner: (p) => reloaded(savePartner(storage, p)),
    removePartner: (id) => reloaded(removePartner(storage, id)),
    saveMine: (m) => reloaded(saveMine(storage, m)),
    saveSettings: (patch) => reloaded(saveSettings(storage, patch)),
  };
}

async function main() {
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
  const paint = (s) => { if (stamp) stamp.textContent = todayText(s.today); };
  paint(store.get());
  store.subscribe(paint);
  const renderRecordExtra = (plan, o) => html`<${RecordExtra} plan=${plan} kind=${o.kind} resolved=${o.resolved} done=${o.done} store=${store} handlers=${handlers} />`;
  render(html`<${Home} store=${store} handlers=${handlers} renderRecordExtra=${renderRecordExtra} /><${PlanSheet} store=${store} handlers=${handlers} /><${PartnersSheet} store=${store} handlers=${handlers} /><${CardSheet} store=${store} handlers=${handlers} />`, app);
  store.boot().then(handlers.loadCrowd);
  setInterval(store.tick, 60000);
}
main();
