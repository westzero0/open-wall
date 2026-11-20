// src/planner-record.js — what opens under 기록하기 after 갔다 / 못 갔다 (spec §5·§6): crowd question, per-discipline fields, route picker, miss reason.
// Every tap saves through handlers.savePlan (nothing to "finish"); 저장 only closes. Network only via handlers (sendCrowd from plan-crowd-api, loadRoutes).
import { html, useState, useEffect, useRef, usePlannerState } from './planner-ui.js';
import { Sheet } from './planner-sheet.js';
import { Note } from './planner-parts.js';
import { saveRecord, markMissed, dropAscents } from './plan-actions.js';
import { fieldsKeyOf, ICE_FEEL } from './plan-fields.js';
import { iceDayTemp, iceTempWords } from './plan-ice.js';
import { MISS_REASONS, MEMO_MAX, ICE_FEELS, ICE_LINE_LEN } from './plan-model.js';
import { GRADES, gradeLabel, routeGradeLabel } from './grades.js';
import { shouldAsk, skipped, answered } from './plan-crowd.js';
import { sendCrowd } from './plan-crowd-api.js';
import { LEVELS, askable, crowdReady } from './crowd.js';
import { REPORT_OK } from './plan-report-api.js';
import { placeKeyOf, routesAt, findMyRoute } from './my-routes.js';
import { ascentKey, ascentSummary, historyMap, MAX_ASCENTS } from './plan-record.js';
import { Chosen, RoutePicker, FULL_NOTE } from './planner-routes.js';
import { timeText } from './plan-view.js';
import { SAVE_FAIL } from './plan-sheet.js';
import { config } from './config.js';
import { wallPageId } from './share-id.js';

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

/** 빙벽 기록: 얼음 상태 칩(하나, 다시 누르면 풀림) + 한 줄(blur에 저장) + 그날 기온(자료 있을 때만, 읽기 전용). */
function IceFields({ ice, id, patchIce }) {
  const [v, setV] = useState(ice.line);
  const temp = iceTempWords(ice);
  return html`<div class="f"><span class="lb">얼음 상태</span><div class="sel">${ICE_FEELS.map((f) => html`<button type="button" key=${f}
      aria-pressed=${ice.feel === f ? 'true' : 'false'} onClick=${() => patchIce({ feel: ice.feel === f ? null : f })}>${ICE_FEEL[f]}</button>`)}</div></div>
    <div class="f"><label for=${id}>얼음에 대해 한 줄 (선택)</label>
      <input id=${id} class="in-t" maxlength=${ICE_LINE_LEN} placeholder="예: 왼쪽 아래 물 흐름, 위쪽은 얇음" value=${v}
        onInput=${(e) => setV(e.target.value)} onBlur=${() => { if (v !== ice.line) patchIce({ line: v }); }} /></div>
    ${temp.length > 0 && html`<div class="f"><span class="lb">그날 기온</span><p class="n">${temp.join(' · ')} (지역 날씨 자료)</p></div>`}`;
}


/** 루트 시트: <암장 이름> 루트. Every tap saves into the record already; 완료 only closes. */
function RouteSheet({ title, onClose, err, ...pickerProps }) {
  const n = pickerProps.rec.ascents.length;
  return html`<${Sheet} title=${`${title} 루트`} onClose=${onClose}>
    <${RoutePicker} ...${pickerProps} />
    <p class="err" role="alert">${err}</p>
    <div class="row2 foot"><button type="button" class="btn p" onClick=${onClose}>${n ? `${n}개 골랐어요 · 완료` : '완료'}</button></div>
  <//>`;
}

/** A typed-name / 내 암장 place has no place page: the route sheet stays as it was (spec). */
function TypedFields({ rec, resolved, plans, notes, planId, place: cur, myRoutes, err, h, patch, onErr }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const btn = useRef(null);
  const was = useRef(false);
  useEffect(() => { let on = true; h.loadRoutes().then((d) => { if (on) setData(d); }); return () => { on = false; }; }, []);
  useEffect(() => { if (was.current && !open) btn.current?.focus(); was.current = open; }, [open]); // the sheet closed: back to the button that opened it
  const routes = data?.[resolved.name]?.routes ?? [];
  const place = placeKeyOf({ cragId: null, place: cur });
  const mine = place ? routesAt(myRoutes, place) : [];
  const history = historyMap(plans, planId, routes);
  const gradeOf = new Map(routes.map((r) => [r.id, r.grade]));
  const gradeFor = (a) => { if (a.routeId) return gradeOf.get(a.routeId); const g = place && findMyRoute(myRoutes, place, a.routeName)?.grade; return g ? routeGradeLabel(g) : null; };
  const patchList = (fn, ...args) => patch({ ascents: fn(rec.ascents, ...args) });
  const full = rec.ascents.length >= MAX_ASCENTS;
  return html`${rec.ascents.length > 0 && html`<div class="f"><span class="lb">오른 루트 ${rec.ascents.length}</span>
      ${rec.ascents.map((a) => html`<${Chosen} key=${ascentKey(a)} a=${a} grade=${gradeFor(a)} hist=${history.get(a.routeId)} full=${full} patchList=${patchList} cragId=${null} notes=${notes} h=${h} onErr=${onErr} btn=${btn} />`)}</div>`}
    <div class="f"><button type="button" class="btn" ref=${btn} onClick=${() => setOpen(true)}>${rec.ascents.length ? '루트 더 고르기' : '루트 고르기'}</button>
      ${full && html`<${Note}>${FULL_NOTE}<//>`}</div>
    ${open && html`<${RouteSheet} title=${resolved.name} onClose=${() => setOpen(false)} err=${err} routes=${routes} multi=${false} rec=${rec} history=${history} patchList=${patchList} cragId=${null} notes=${notes} place=${place} mine=${mine} h=${h} onErr=${onErr} />`}`;
}

/** 자연암장: one line (what is recorded) + 루트 기록 › → the place page's 루트 tab with this plan as the target. Closing it hands focus back here (the page is a <dialog>). */
function CragFields({ rec, resolved, planId, date, h, ...rest }) {
  const crag = resolved.crag;
  if (!crag) return html`<${TypedFields} rec=${rec} resolved=${resolved} planId=${planId} h=${h} ...${rest} />`;
  return html`<div class="f"><span class="lb">오른 루트</span><p class="n">${ascentSummary(rec.ascents)}</p>
    <button type="button" class="btn" onClick=${() => h.openWall(wallPageId(crag), { from: 'record', planId, date })}>루트 기록 ›</button></div>`;
}

/** props: plan, kind ('went'|'missed'), resolved, done(), store, handlers. Mounted by planner.js through Home's renderRecordExtra. */
export function RecordExtra({ plan, kind, resolved, done, store, handlers: h }) {
  const s = usePlannerState(store);
  const [err, setErr] = useState('');
  const [keep, setKeep] = useState(false); // 두기: only the 'erase the routes?' question folds
  const cur = s.db.plans.find((p) => p.id === plan.id) ?? plan;
  const key = fieldsKeyOf(resolved, cur);
  const rec = cur.record;
  const commit = (next) => setErr(h.savePlan(next)?.ok === false ? SAVE_FAIL : '');
  const latest = () => h.getState().db.plans.find((p) => p.id === plan.id) ?? cur;
  const patch = (p) => { const l = latest(); commit(saveRecord(l, { ...l.record, ...p }, key)); };
  // that day's temperature rides along; null (no data any more) leaves what was written untouched
  const withTemp = (ice) => { const t = iceDayTemp(resolved, cur, s.wx); return t ? { ...ice, tmin: t.tmin ?? ice.tmin, tmax: t.tmax ?? ice.tmax } : ice; };
  const patchIce = (p) => patch({ ice: withTemp({ ...latest().record.ice, ...p }) });

  if (kind === 'missed') {
    const n = rec.ascents.length;
    return html`<div class="rx">${n > 0 && !keep && html`<div class="f"><span class="lb">기록한 루트 ${n}개는 지울까요?</span>
      <div class="sel"><button type="button" onClick=${() => commit(dropAscents(latest()))}>지우기</button><button type="button" onClick=${() => setKeep(true)}>두기</button></div></div>`}
      <div class="f"><span class="lb">이유가 있나요?</span><div class="sel">${MISS_REASONS.map((r) => html`<button type="button" key=${r}
      aria-pressed=${rec.missReason === r ? 'true' : 'false'} onClick=${() => { commit(markMissed(latest(), r)); done(); }}>${r}</button>`)}</div></div>
      <p class="err" role="alert">${err}</p>
      <div class="acts"><button type="button" class="txt" onClick=${done}>${rec.missReason ? '닫기' : '건너뛰기'}</button></div></div>`;
  }
  return html`<div class="rx">
    <${Crowd} plan=${cur} resolved=${resolved} s=${s} h=${h} />
    ${key === 'wall' && html`<${WallFields} rec=${rec} patch=${patch} />`}
    ${key === 'crag' && html`<${CragFields} rec=${rec} resolved=${resolved} plans=${s.db.plans} notes=${s.db.routeNotes} myRoutes=${s.db.myRoutes} planId=${cur.id} date=${cur.date} place=${cur.place} err=${err} h=${h} patch=${patch} onErr=${setErr} />`}
    ${key === 'ice' && html`<${IceFields} ice=${rec.ice} id=${'ri-' + cur.id} patchIce=${patchIce} />`}
    <${TextField} id=${'rm-' + cur.id} label="메모 (선택)" value=${rec.memo} max=${MEMO_MAX} placeholder=${key === 'ice' ? '얼음 말고, 그날 어땠는지' : '그날 어땠는지 한 줄'} onSave=${(memo) => patch({ memo })} />
    <p class="err" role="alert">${err}</p>
    <div class="row2"><button type="button" class="btn p" onClick=${() => { if (key === 'ice') patchIce({}); done(); h.flash?.('기록했어요. 지난 일정에서 볼 수 있어요'); }}>저장</button></div>
  </div>`;
}
