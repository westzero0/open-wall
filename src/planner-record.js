// src/planner-record.js — what opens under 기록하기 after 갔다 / 못 갔다 (spec §5·§6): crowd question, per-discipline fields, route picker, miss reason.
// Every tap saves through handlers.savePlan (nothing to "finish"); 저장 only closes. Network only via handlers (sendCrowd from plan-crowd-api, loadRoutes).
import { html, useState, useEffect, useRef, usePlannerState } from './planner-ui.js';
import { Sheet } from './planner-sheet.js';
import { Note } from './planner-parts.js';
import { Icon } from './planner-icons.js';
import { saveRecord, markMissed } from './plan-actions.js';
import { fieldsKeyOf, styleOptions, STYLE_NAME, ICE_FEEL } from './plan-fields.js';
import { iceDayTemp, iceTempWords } from './plan-ice.js';
import { MISS_REASONS, MEMO_MAX, NOTE_MAX, ICE_FEELS, ICE_LINE_LEN } from './plan-model.js';
import { GRADES, gradeLabel, routeGradeLabel } from './grades.js';
import { shouldAsk, skipped, answered } from './plan-crowd.js';
import { sendCrowd } from './plan-crowd-api.js';
import { LEVELS, askable, crowdReady } from './crowd.js';
import { REPORT_OK } from './plan-report-api.js';
import { pickRoutes, norm } from './plan-routes.js';
import { placeKeyOf, routesAt, findMyRoute } from './my-routes.js';
import { pitchCount, pitchLines } from './crag-routes.js';
import { ascentKey, ascentOf, putAscent, dropAscent, patchAscent, ascentLine, historyMap, MAX_ASCENTS } from './plan-record.js';
import { timeText } from './plan-view.js';
import { SAVE_FAIL } from './plan-sheet.js';
import { config } from './config.js';
import { findNote, ROUTE_NOTE_MAX } from './route-notes.js';
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

const SORTS = [['no', '번호순'], ['grade', '쉬운 순'], ['gradeDesc', '어려운 순']];
const keyOf = (route) => ascentKey({ routeId: route.id ?? null, routeName: route.name });
const FULL_NOTE = '20개까지 적을 수 있어요';

/** 완등 방식 버튼 줄(하나 누르면 onPick(방식, 이미 그 방식인지)). cur = 이 루트의 기록 줄(없으면 null), 20개가 차면 새 줄은 못 만든다. */
function StyleButtons({ hist, cur, full, onPick }) {
  return html`<div class="sel">${[...styleOptions(hist), 'tried'].map((st) => {
    const on = Boolean(cur) && (st === 'tried' ? cur.result === 'tried' : cur.result === 'sent' && cur.style === st);
    return html`<button type="button" key=${st} aria-pressed=${on ? 'true' : 'false'} disabled=${!cur && full} onClick=${() => onPick(st, on)}>${st === 'tried' ? '시도만' : STYLE_NAME[st]}</button>`;
  })}</div>`;
}

// One line of the record's 오른 루트: name + grade, the day's result under it. Tapping the row opens 방식 / 시도 횟수 / 메모 / 기록에서 빼기 (no 빼기 on the closed row: too busy).
// cragId: the 메모 is the 루트 메모 (one per route, every day, h.saveRouteNote); the day's ascent note stays read-only.
// No crag (a 내 암장 / typed place): the 메모 is the day's ascent note as before.
function Chosen({ a, grade, hist, full, patchList, cragId, notes, h, onErr, btn }) {
  const key = ascentKey(a);
  const routeNote = cragId ? findNote(notes, { cragId, routeId: a.routeId, routeName: a.routeName })?.text ?? '' : null;
  const saved = routeNote ?? a.note ?? '';
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(saved);
  const save = () => {
    if (note === saved) return;
    if (routeNote == null) { patchList(patchAscent, key, { note }); return; }
    onErr(h.saveRouteNote({ cragId, routeId: a.routeId, routeName: a.routeName, text: note })?.ok === false ? SAVE_FAIL : '');
  };
  return html`<div class=${open ? 'ac open' : 'ac'}>
    <div class="pick-row" role="group" aria-label="고른 루트">
      <button type="button" class="pick" aria-expanded=${open ? 'true' : 'false'} onClick=${() => setOpen(!open)}>
        <span class="rt"><b>${a.routeName}</b>${grade && html`<span class="grade n">${grade}</span>`}</span><small>${ascentLine(a)}</small></button>
      </div>
    ${routeNote && !open && html`<p class="nt">${routeNote}</p>`}
    ${open && html`<${StyleButtons} hist=${hist} cur=${a} full=${full} onPick=${(st, on) => { if (!on) patchList(putAscent, ascentOf({ id: a.routeId, name: a.routeName }, st)); }} />
      ${routeNote != null && a.note && html`<p class="nt-day">그날 메모: ${a.note}</p>`}
      ${a.result === 'tried' && html`<div class="step"><button type="button" class="sq" aria-label="시도 횟수 줄이기" disabled=${a.tries <= 1} onClick=${() => patchList(patchAscent, key, { tries: a.tries - 1 })}>−</button>
        <b class="n">${a.tries}</b><button type="button" class="sq" aria-label="시도 횟수 늘리기" disabled=${a.tries >= 99} onClick=${() => patchList(patchAscent, key, { tries: a.tries + 1 })}>＋</button></div>`}
      <label class="lb" for=${'nt-' + key}>${routeNote != null ? '나만 보는 루트 메모' : '나만 보는 메모'}</label>
      <input id=${'nt-' + key} class="in-t" maxlength=${routeNote != null ? ROUTE_NOTE_MAX : NOTE_MAX} value=${note} onInput=${(e) => setNote(e.target.value)} onBlur=${save} />
      <div class="acts"><button type="button" class="txt" onClick=${() => { patchList(dropAscent, key); setTimeout(() => btn?.current?.focus(), 0); }}>기록에서 빼기</button></div>`}
  </div>`;
}

// The sheet body: search, 구역 chips, 이어서 도전 / 내가 추가한 루트 / 이 암장의 루트 (one flat list while searching), 새 루트 row.
// place: 'crag:<id>' | 'mine:<id>' | null (a typed-name place keeps a new route in this record only). mine: this place's 내 루트.
function RoutePicker({ routes, multi = false, rec, history, patchList, cragId, notes, place, mine, h, onErr }) {
  const [query, setQuery] = useState('');
  const [area, setArea] = useState(null);
  const [sort, setSort] = useState('no');
  const [openKey, setOpenKey] = useState(null); // the row whose style buttons are showing
  const [newGrade, setNewGrade] = useState(null); // 새 루트: 등급 (선택)
  const chosen = new Map(rec.ascents.filter((a) => a.routeId).map((a) => [a.routeId, a]));
  const chosenByName = new Map(rec.ascents.filter((a) => !a.routeId).map((a) => [norm(a.routeName), a]));
  const { rows, areas, custom } = pickRoutes(routes, { query, area, sort, history, chosen, mine, chosenByName });
  const full = rec.ascents.length >= MAX_ASCENTS; // ponytail: same 20-line ceiling as the stored record
  const searching = Boolean(query.trim());
  const toggle = (k) => { setOpenKey(openKey === k ? null : k); setNewGrade(null); };
  const curOf = (route) => rec.ascents.find((a) => ascentKey(a) === keyOf(route)) ?? null;
  const mark = (route, style, already) => {
    patchList(...(already ? [dropAscent, keyOf(route)] : [putAscent, ascentOf(route, style)]));
    setOpenKey(null);
  };
  const addNew = (style) => { // 내 루트로 저장 → 오늘 기록에 줄 → 펼침·검색어 비움
    if (place && h.saveMyRoute({ place, name: custom, grade: newGrade })?.ok === false) { onErr(SAVE_FAIL); return; }
    patchList(putAscent, ascentOf({ id: null, name: custom }, style));
    setOpenKey(null); setNewGrade(null); setQuery('');
  };
  const rkey = (r) => r.route.id ?? 'm:' + r.route.mineId;
  const rowOf = (r) => {
    const k = rkey(r);
    const isMine = r.route.mineId != null;
    const open = openKey === k;
    const pc = isMine ? null : pitchCount(r.route, multi);
    const t = cragId && findNote(notes, { cragId, routeId: r.route.id, routeName: r.route.name })?.text;
    return html`<div class="rrow" key=${k}>
      <button type="button" class="pick" aria-expanded=${open ? 'true' : 'false'} onClick=${() => toggle(k)}>
        <span class="rg"><span class="grade n">${r.route.no ?? ''}</span><b>${r.route.name}</b><b class="n">${isMine ? (r.route.grade ? routeGradeLabel(r.route.grade) : '') : r.route.grade ?? ''}</b>
          ${pc && html`<small>${pc}</small>`}
          ${r.chosen && html`<small><b class="op-no">${ascentLine(r.chosen)}</b></small>`}
          ${t && html`<small class="nt">${t}</small>`}</span></button>
      ${open && multi && r.route.pitches && html`<ol class="pl">${pitchLines(r.route).map((l) => html`<li key=${l}>${l}</li>`)}</ol>`}
      ${open && html`<${StyleButtons} hist=${history.get(r.route.id)} cur=${curOf(r.route)} full=${full} onPick=${(st, on) => mark(r.route, st, on)} />`}
      ${open && isMine && html`<div class="acts"><button type="button" class="txt" onClick=${() => { if (h.removeMyRoute(r.route.mineId)?.ok === false) onErr(SAVE_FAIL); else { setOpenKey(null); document.getElementById('rq')?.focus(); } }}>내 루트에서 지우기</button></div>`}</div>`;
  };
  const proj = rows.filter((r) => r.section === 'project');
  const mineRows = rows.filter((r) => r.section === 'mine');
  const rest = rows.filter((r) => r.section === 'all');
  const heads = !searching && [proj, mineRows, rest].filter((g) => g.length).length > 1; // 묶음 머리글은 묶음이 둘 이상일 때만, 검색 중엔 한 목록
  const sortable = routes.length > 1 && !searching && rest.length > 0; // ponytail: while searching the order is by match, so no sort button
  const sortLabel = SORTS.find(([k]) => k === sort)[1];
  const sortBtn = sortable && html`<button type="button" class="srt" aria-label=${`정렬 바꾸기, 지금 ${sortLabel}`} onClick=${() => setSort(SORTS[(SORTS.findIndex(([k]) => k === sort) + 1) % SORTS.length][0])}><${Icon} name="sort" />${sortLabel}</button>`;
  const cKey = 'n:' + custom;
  return html`<div class="f">
    <label for="rq">${routes.length ? '루트 찾기 (번호·이름·초성)' : '루트 이름'}</label>
    <input id="rq" class="in-t" value=${query} autocomplete="off" onInput=${(e) => setQuery(e.target.value)} />
    ${areas.length > 0 && html`<div class="sel">${[null, ...areas].map((a) => html`<button type="button" key=${a ?? 'all'} aria-pressed=${area === a ? 'true' : 'false'} onClick=${() => setArea(a)}>${a ?? '전체'}</button>`)}</div>`}
    ${full && html`<${Note}>${FULL_NOTE}<//>`}
    ${custom && html`<div class="rrow"><button type="button" class="pick first" aria-expanded=${openKey === cKey ? 'true' : 'false'} onClick=${() => toggle(cKey)}>"${custom}" 새 루트로 추가<small>${place ? '이름만 적어도 돼요' : '이 기록에만 남아요'}</small></button>
      ${openKey === cKey && html`${place && html`<span class="lb">등급 (선택)</span><div class="sel">${GRADES.map((g) => html`<button type="button" key=${g} aria-pressed=${newGrade === g ? 'true' : 'false'} onClick=${() => setNewGrade(newGrade === g ? null : g)}>${gradeLabel(g)}</button>`)}</div>`}
        <span class="lb">완등 방식</span><${StyleButtons} hist=${null} cur=${null} full=${full} onPick=${addNew} />`}</div>`}
    <div class="places">
      ${!heads && sortBtn && html`<div class="lbl srt-h">${sortBtn}</div>`}
      ${heads && proj.length > 0 && html`<h3 class="lbl">이어서 도전</h3>`}${proj.map(rowOf)}
      ${heads && mineRows.length > 0 && html`<h3 class="lbl">내가 추가한 루트</h3>`}${mineRows.map(rowOf)}
      ${heads && rest.length > 0 && html`<h3 class=${'lbl' + (sortBtn ? ' srt-h' : '')}>이 암장의 루트${sortBtn}</h3>`}${rest.map(rowOf)}
    </div>
  </div>`;
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

function CragFields({ rec, resolved, plans, notes, planId, place: cur, myRoutes, err, h, patch, onErr }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const btn = useRef(null);
  const was = useRef(false);
  useEffect(() => { let on = true; h.loadRoutes().then((d) => { if (on) setData(d); }); return () => { on = false; }; }, []);
  useEffect(() => { if (was.current && !open) btn.current?.focus(); was.current = open; }, [open]); // the sheet closed: back to the button that opened it
  const crag = resolved.crag;
  const routes = data?.[crag?.name ?? resolved.name]?.routes ?? [];
  const cragId = crag ? wallPageId(crag) : null;
  const place = placeKeyOf({ cragId, place: cur });
  const mine = place ? routesAt(myRoutes, place) : [];
  useEffect(() => { if (cragId && routes.length) h.adoptRoutes(cragId, routes); }, [data]); // typed routes now in the list take its routeId
  const history = historyMap(plans, planId, routes);
  const gradeOf = new Map(routes.map((r) => [r.id, r.grade]));
  const gradeFor = (a) => { if (a.routeId) return gradeOf.get(a.routeId); const g = place && findMyRoute(myRoutes, place, a.routeName)?.grade; return g ? routeGradeLabel(g) : null; };
  const patchList = (fn, ...args) => patch({ ascents: fn(rec.ascents, ...args) });
  const full = rec.ascents.length >= MAX_ASCENTS;
  return html`${rec.ascents.length > 0 && html`<div class="f"><span class="lb">오른 루트 ${rec.ascents.length}</span>
      ${rec.ascents.map((a) => html`<${Chosen} key=${ascentKey(a)} a=${a} grade=${gradeFor(a)} hist=${history.get(a.routeId)} full=${full} patchList=${patchList} cragId=${cragId} notes=${notes} h=${h} onErr=${onErr} btn=${btn} />`)}</div>`}
    <div class="f"><button type="button" class="btn" ref=${btn} onClick=${() => setOpen(true)}>${rec.ascents.length ? '루트 더 고르기' : '루트 고르기'}</button>
      ${full && html`<${Note}>${FULL_NOTE}<//>`}</div>
    ${open && html`<${RouteSheet} title=${crag?.name ?? resolved.name} onClose=${() => setOpen(false)} err=${err} routes=${routes} multi=${crag?.type === 'multi'} rec=${rec} history=${history} patchList=${patchList} cragId=${cragId} notes=${notes} place=${place} mine=${mine} h=${h} onErr=${onErr} />`}`;
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
  // that day's temperature rides along; null (no data any more) leaves what was written untouched
  const withTemp = (ice) => { const t = iceDayTemp(resolved, cur, s.wx); return t ? { ...ice, tmin: t.tmin ?? ice.tmin, tmax: t.tmax ?? ice.tmax } : ice; };
  const patchIce = (p) => patch({ ice: withTemp({ ...latest().record.ice, ...p }) });

  if (kind === 'missed') {
    return html`<div class="rx"><div class="f"><span class="lb">이유가 있나요?</span><div class="sel">${MISS_REASONS.map((r) => html`<button type="button" key=${r}
      aria-pressed=${rec.missReason === r ? 'true' : 'false'} onClick=${() => { commit(markMissed(latest(), r)); done(); }}>${r}</button>`)}</div></div>
      <p class="err" role="alert">${err}</p>
      <div class="acts"><button type="button" class="txt" onClick=${done}>${rec.missReason ? '닫기' : '건너뛰기'}</button></div></div>`;
  }
  return html`<div class="rx">
    <${Crowd} plan=${cur} resolved=${resolved} s=${s} h=${h} />
    ${key === 'wall' && html`<${WallFields} rec=${rec} patch=${patch} />`}
    ${key === 'crag' && html`<${CragFields} rec=${rec} resolved=${resolved} plans=${s.db.plans} notes=${s.db.routeNotes} myRoutes=${s.db.myRoutes} planId=${cur.id} place=${cur.place} err=${err} h=${h} patch=${patch} onErr=${setErr} />`}
    ${key === 'ice' && html`<${IceFields} ice=${rec.ice} id=${'ri-' + cur.id} patchIce=${patchIce} />`}
    <${TextField} id=${'rm-' + cur.id} label="메모 (선택)" value=${rec.memo} max=${MEMO_MAX} placeholder=${key === 'ice' ? '얼음 말고, 그날 어땠는지' : '그날 어땠는지 한 줄'} onSave=${(memo) => patch({ memo })} />
    <p class="err" role="alert">${err}</p>
    <div class="row2"><button type="button" class="btn p" onClick=${() => { if (key === 'ice') patchIce({}); done(); h.flash?.('기록했어요. 지난 일정에서 볼 수 있어요'); }}>저장</button></div>
  </div>`;
}
