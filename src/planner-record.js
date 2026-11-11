// src/planner-record.js — what opens under 기록하기 after 갔다 / 못 갔다 (spec §5·§6): crowd question, per-discipline fields, route picker, miss reason.
// Every tap saves through handlers.savePlan (nothing to "finish"); 저장 only closes. Network only via handlers (sendCrowd from plan-crowd-api, loadRoutes).
import { html, useState, useEffect, usePlannerState } from './planner-ui.js';
import { saveRecord, markMissed } from './plan-actions.js';
import { fieldsKeyOf, styleOptions, STYLE_NAME } from './plan-fields.js';
import { MISS_REASONS, MEMO_MAX, NOTE_MAX } from './plan-model.js';
import { GRADES, gradeLabel } from './grades.js';
import { shouldAsk, skipped, answered } from './plan-crowd.js';
import { sendCrowd } from './plan-crowd-api.js';
import { LEVELS, askable, crowdReady } from './crowd.js';
import { REPORT_OK } from './plan-report-api.js';
import { pickRoutes } from './plan-routes.js';
import { ascentKey, ascentOf, putAscent, dropAscent, patchAscent, ascentLabel, historyMap, MAX_ASCENTS } from './plan-record.js';
import { timeText } from './plan-view.js';
import { SAVE_FAIL } from './plan-sheet.js';
import { config } from './config.js';

const CROWD_FAIL = '보내지 못했어요. 잠시 뒤 다시 눌러 주세요';

/** 그때 사람 많았나요? — asked once, only for a registered wall, skippable (three skips in a row = never again, plan-crowd). */
function Crowd({ plan, resolved, s, h }) {
  const [ask] = useState(() => shouldAsk(plan, resolved, { settings: s.db.settings, sent: h.getSent(), ready: crowdReady(config.crowdEndpoint, config.crowdFields) })
    && askable(plan.date, timeText(plan.min))); // decided once on open: answering must not make the line vanish before it says thanks
  const [st, setSt] = useState(null); // null | 'busy' | 'ok' | 'fail' | 'skip'
  if (!ask || st === 'skip') return null;
  const latest = () => h.getState().db.plans.find((p) => p.id === plan.id) ?? plan;
  const asked = () => { const p = latest(); h.savePlan({ ...p, record: { ...p.record, crowdAsked: true } }); };
  const send = async (level) => {
    setSt('busy');
    const r = await sendCrowd({ resolved, plan: latest(), level, sent: h.getSent() });
    if (!r.ok) { setSt('fail'); return; }
    h.saveSent(r.sent);
    h.saveSettings(answered(h.getState().db.settings));
    asked();
    setSt('ok');
  };
  const skip = () => { h.saveSettings(skipped(h.getState().db.settings)); asked(); setSt('skip'); };
  if (st === 'ok') return html`<p class="n" role="status">${REPORT_OK}</p>`;
  return html`<div class="f"><span class="lb">그때 사람 많았나요?</span>
    <div class="sel">${LEVELS.map((l) => html`<button type="button" key=${l} disabled=${st === 'busy'} onClick=${() => send(l)}>${l}</button>`)}
      <button type="button" disabled=${st === 'busy'} onClick=${skip}>건너뛰기</button></div>
    <p class="err" role="alert">${st === 'fail' ? CROWD_FAIL : ''}</p></div>`;
}

function Stepper({ label, value, max, onChange }) {
  return html`<div class="f"><span class="lb">${label}</span><div class="step">
    <button type="button" class="sq" aria-label=${label + ' 줄이기'} disabled=${value <= 0} onClick=${() => onChange(value - 1)}>−</button><b class="n">${value}</b>
    <button type="button" class="sq" aria-label=${label + ' 늘리기'} disabled=${value >= max} onClick=${() => onChange(value + 1)}>＋</button></div></div>`;
}

/** Text saved when the field loses focus (so typing never re-saves per key and a tap on 저장 still sees it). */
function TextField({ id, label, value, max, rows = 2, placeholder = '', onSave }) {
  const [v, setV] = useState(value);
  return html`<div class="f"><label for=${id}>${label}</label>
    <textarea id=${id} class="in-t" rows=${rows} maxlength=${max} placeholder=${placeholder} value=${v}
      onInput=${(e) => setV(e.target.value)} onBlur=${() => { if (v !== value) onSave(v); }}></textarea></div>`;
}

function WallFields({ rec, patch }) {
  return html`<${Stepper} label="시도" value=${rec.attempts} max=${99} onChange=${(n) => patch({ attempts: n })} />
    <${Stepper} label="완등" value=${rec.sends} max=${rec.attempts} onChange=${(n) => patch({ sends: n })} />
    <div class="f"><span class="lb">가장 어려운 등급</span><div class="sel">${GRADES.map((g) => html`<button type="button" key=${g}
      aria-pressed=${rec.hardest === g ? 'true' : 'false'} onClick=${() => patch({ hardest: rec.hardest === g ? null : g })}>${gradeLabel(g)}</button>`)}</div></div>`;
}

const SORTS = [['no', '번호'], ['grade', '쉬운 순'], ['gradeDesc', '어려운 순']];
const keyOf = (route) => ascentKey({ routeId: route.id ?? null, routeName: route.name });

function Chosen({ a, grade, patchList }) {
  const key = ascentKey(a);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(a.note ?? '');
  return html`<div class="ac">
    <div class="rt"><b>${a.routeName}</b>${grade && html`<span class="grade n">${grade}</span>`}</div>
    <p class="n">${ascentLabel(a)}</p>
    ${a.result === 'tried' && html`<div class="step"><button type="button" class="sq" aria-label="시도 횟수 줄이기" disabled=${a.tries <= 1} onClick=${() => patchList(patchAscent, key, { tries: a.tries - 1 })}>−</button>
      <b class="n">${a.tries}</b><button type="button" class="sq" aria-label="시도 횟수 늘리기" disabled=${a.tries >= 99} onClick=${() => patchList(patchAscent, key, { tries: a.tries + 1 })}>＋</button></div>`}
    <div class="acts">
      <button type="button" class="txt" aria-expanded=${noteOpen ? 'true' : 'false'} onClick=${() => setNoteOpen(!noteOpen)}>메모</button>
      <button type="button" class="txt" onClick=${() => patchList(dropAscent, key)}>빼기</button></div>
    ${noteOpen && html`<label class="lb" for=${'nt-' + key}>나만 보는 메모</label>
      <input id=${'nt-' + key} class="in-t" maxlength=${NOTE_MAX} value=${note} onInput=${(e) => setNote(e.target.value)}
        onBlur=${() => { if (note !== (a.note ?? '')) patchList(patchAscent, key, { note }); }} />`}
  </div>`;
}

function RoutePicker({ routes, rec, plans, planId, patchList }) {
  const [query, setQuery] = useState('');
  const [area, setArea] = useState(null);
  const [sort, setSort] = useState('no');
  const [openKey, setOpenKey] = useState(null); // the row whose style buttons are showing
  const history = historyMap(plans, planId, routes);
  const chosen = new Map(rec.ascents.filter((a) => a.routeId).map((a) => [a.routeId, a]));
  const { rows, areas, custom } = pickRoutes(routes, { query, area, sort, history, chosen });
  const full = rec.ascents.length >= MAX_ASCENTS; // ponytail: same 20-line ceiling as the stored record
  const mark = (route, style, already) => {
    patchList(...(already ? [dropAscent, keyOf(route)] : [putAscent, ascentOf(route, style)]));
    setOpenKey(null);
  };
  const styles = (route, hist) => {
    const cur = rec.ascents.find((a) => ascentKey(a) === keyOf(route));
    return html`<div class="sel">${[...styleOptions(hist), 'tried'].map((st) => {
      const on = Boolean(cur) && (st === 'tried' ? cur.result === 'tried' : cur.result === 'sent' && cur.style === st);
      return html`<button type="button" key=${st} aria-pressed=${on ? 'true' : 'false'} disabled=${!cur && full} onClick=${() => mark(route, st, on)}>${st === 'tried' ? '시도만' : STYLE_NAME[st]}</button>`;
    })}</div>`;
  };
  const rowOf = (r) => html`<div key=${r.route.id}>
    <button type="button" class="pick" aria-expanded=${openKey === r.route.id ? 'true' : 'false'} onClick=${() => setOpenKey(openKey === r.route.id ? null : r.route.id)}>
      <span class="rt"><b>${r.route.name}</b><span class="grade n">${[r.route.no != null && '#' + r.route.no, r.route.grade].filter(Boolean).join(' ')}</span></span>
      ${r.chosen && html`<small>${ascentLabel(r.chosen)}</small>`}</button>
    ${openKey === r.route.id && styles(r.route, history.get(r.route.id))}</div>`;
  const proj = rows.filter((r) => r.section === 'project');
  const rest = rows.filter((r) => r.section !== 'project');
  const cKey = 'n:' + custom;
  return html`<div class="f">
    <label for="rq">${routes.length ? '루트 찾기 (번호·이름·초성)' : '루트 이름'}</label>
    <input id="rq" class="in-t" value=${query} autocomplete="off" onInput=${(e) => setQuery(e.target.value)} />
    ${areas.length > 0 && html`<div class="sel">${[null, ...areas].map((a) => html`<button type="button" key=${a ?? 'all'} aria-pressed=${area === a ? 'true' : 'false'} onClick=${() => setArea(a)}>${a ?? '전체'}</button>`)}</div>`}
    ${routes.length > 0 && !query.trim() && html`<div class="sel">${SORTS.map(([k, t]) => html`<button type="button" key=${k} aria-pressed=${sort === k ? 'true' : 'false'} onClick=${() => setSort(k)}>${t}</button>`)}</div>`}
    ${custom && html`<div><button type="button" class="pick first" aria-expanded=${openKey === cKey ? 'true' : 'false'} onClick=${() => setOpenKey(openKey === cKey ? null : cKey)}>"${custom}" 이름만 쓰기</button>
      ${openKey === cKey && styles({ id: null, name: custom }, null)}</div>`}
    <div class="rts">${proj.length > 0 && html`<div class="lb">이어서 도전</div>${proj.map(rowOf)}`}
    ${rest.length > 0 && proj.length > 0 && html`<div class="lb">이 암장의 루트</div>`}
    ${rest.map(rowOf)}</div>
  </div>`;
}

function CragFields({ rec, resolved, plans, planId, h, patch }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  useEffect(() => { let on = true; h.loadRoutes().then((d) => { if (on) setData(d); }); return () => { on = false; }; }, []);
  const routes = data?.[resolved.crag?.name ?? resolved.name]?.routes ?? [];
  const gradeOf = new Map(routes.map((r) => [r.id, r.grade]));
  const patchList = (fn, ...args) => patch({ ascents: fn(rec.ascents, ...args) });
  return html`${rec.ascents.length > 0 && html`<div class="f"><span class="lb">오른 루트</span>
      ${rec.ascents.map((a) => html`<${Chosen} key=${ascentKey(a)} a=${a} grade=${gradeOf.get(a.routeId)} patchList=${patchList} />`)}</div>`}
    <div class="f"><button type="button" class="btn" aria-expanded=${open ? 'true' : 'false'} onClick=${() => setOpen(!open)}>오른 루트 추가</button></div>
    ${open && html`<${RoutePicker} routes=${routes} rec=${rec} plans=${plans} planId=${planId} patchList=${patchList} />`}`;
}

/** props: plan, kind ('went'|'missed'), resolved, done(), store, handlers. Mounted by planner.js through Home's renderRecordExtra. */
export function RecordExtra({ plan, kind, resolved, done, store, handlers: h }) {
  const s = usePlannerState(store);
  const [err, setErr] = useState('');
  const cur = s.db.plans.find((p) => p.id === plan.id) ?? plan;
  const key = fieldsKeyOf(resolved, cur);
  const rec = cur.record;
  const commit = (next) => setErr(h.savePlan(next)?.ok === false ? SAVE_FAIL : '');
  const latest = () => h.getState().db.plans.find((p) => p.id === plan.id) ?? cur;
  const patch = (p) => { const l = latest(); commit(saveRecord(l, { ...l.record, ...p }, key)); };

  if (kind === 'missed') {
    return html`<div class="rx"><div class="f"><span class="lb">이유가 있나요?</span><div class="sel">${MISS_REASONS.map((r) => html`<button type="button" key=${r}
      aria-pressed=${rec.missReason === r ? 'true' : 'false'} onClick=${() => { commit(markMissed(latest(), r)); done(); }}>${r}</button>`)}</div></div>
      <p class="err" role="alert">${err}</p>
      <div class="acts"><button type="button" class="txt" onClick=${done}>${rec.missReason ? '닫기' : '건너뛰기'}</button></div></div>`;
  }
  return html`<div class="rx">
    <${Crowd} plan=${cur} resolved=${resolved} s=${s} h=${h} />
    ${key === 'wall' && html`<${WallFields} rec=${rec} patch=${patch} />`}
    ${key === 'crag' && html`<${CragFields} rec=${rec} resolved=${resolved} plans=${s.db.plans} planId=${cur.id} h=${h} patch=${patch} />`}
    <${TextField} id=${'rm-' + cur.id} label="메모 (선택)" value=${rec.memo} max=${MEMO_MAX} placeholder="오늘 어땠는지 한 줄" onSave=${(memo) => patch({ memo })} />
    <p class="err" role="alert">${err}</p>
    <div class="row2"><button type="button" class="btn p" onClick=${done}>저장</button></div>
  </div>`;
}
