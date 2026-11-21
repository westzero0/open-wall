// src/planner-routes.js — the route-recording parts: 완등 방식 버튼, 고른 루트 줄, 루트 고르기(찾기·구역·묶음·새 루트). Moved as-is from planner-record.js (D3).
// Every tap saves through the caller's patchList / handlers (no fetch, no storage here).
import { html, useState } from './planner-ui.js';
import { Note } from './planner-parts.js';
import { Icon } from './planner-icons.js';
import { styleOptions, STYLE_NAME } from './plan-fields.js';
import { NOTE_MAX } from './plan-model.js';
import { GRADES, gradeLabel, routeGradeLabel } from './grades.js';
import { pickRoutes, norm } from './plan-routes.js';
import { pitchCount, pitchLines } from './crag-routes.js';
import { ascentKey, ascentOf, putAscent, dropAscent, patchAscent, ascentLine, MAX_ASCENTS } from './plan-record.js';
import { SAVE_FAIL } from './plan-sheet.js';
import { findNote, ROUTE_NOTE_MAX } from './route-notes.js';

export const SORTS = [['no', '번호순'], ['grade', '쉬운 순'], ['gradeDesc', '어려운 순']];
const keyOf = (route) => ascentKey({ routeId: route.id ?? null, routeName: route.name });
export const FULL_NOTE = '20개까지 적을 수 있어요';

/** 완등 방식 버튼 줄(하나 누르면 onPick(방식, 이미 그 방식인지)). cur = 이 루트의 기록 줄(없으면 null), 20개가 차면 새 줄은 못 만든다. */
export function StyleButtons({ hist, cur, full, onPick }) {
  return html`<div class="sel">${[...styleOptions(hist), 'tried'].map((st) => {
    const on = Boolean(cur) && (st === 'tried' ? cur.result === 'tried' : cur.result === 'sent' && cur.style === st);
    return html`<button type="button" key=${st} aria-pressed=${on ? 'true' : 'false'} disabled=${!cur && full} onClick=${() => onPick(st, on)}>${st === 'tried' ? '시도만' : STYLE_NAME[st]}</button>`;
  })}</div>`;
}

// One line of the record's 오른 루트: name + grade, the day's result under it. Tapping the row opens 방식 / 시도 횟수 / 메모 / 기록에서 빼기 (no 빼기 on the closed row: too busy).
// cragId: the 메모 is the 루트 메모 (one per route, every day, h.saveRouteNote); the day's ascent note stays read-only.
// No crag (a 내 암장 / typed place): the 메모 is the day's ascent note as before.
export function Chosen({ a, grade, hist, full, patchList, cragId, notes, h, onErr, btn }) {
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
  const drop = () => { patchList(dropAscent, key); setTimeout(() => btn?.current?.focus(), 0); }; // the row disappears: focus goes to the search field
  return html`<div class=${open ? 'ac open' : 'ac'}>
    <div class="pick-row" role="group" aria-label="고른 루트">
      <button type="button" class="pick" aria-expanded=${open ? 'true' : 'false'} onClick=${() => setOpen(!open)}>
        <span class="rt"><b>${a.routeName}</b>${grade && html`<span class="grade n">${grade}</span>`}</span><small>${ascentLine(a)}</small></button>
      </div>
    ${routeNote && !open && html`<p class="nt">${routeNote}</p>`}
    ${open && html`<${StyleButtons} hist=${hist} cur=${a} full=${full} onPick=${(st, on) => { if (on) drop(); else patchList(putAscent, ascentOf({ id: a.routeId, name: a.routeName }, st)); }} />
      ${routeNote != null && a.note && html`<p class="nt-day">그날 메모: ${a.note}</p>`}
      ${a.result === 'tried' && html`<div class="step"><button type="button" class="sq" aria-label="시도 횟수 줄이기" disabled=${a.tries <= 1} onClick=${() => patchList(patchAscent, key, { tries: a.tries - 1 })}>−</button>
        <b class="n">${a.tries}</b><button type="button" class="sq" aria-label="시도 횟수 늘리기" disabled=${a.tries >= 99} onClick=${() => patchList(patchAscent, key, { tries: a.tries + 1 })}>＋</button></div>`}
      <label class="lb" for=${'nt-' + key}>${routeNote != null ? '나만 보는 루트 메모' : '나만 보는 메모'}</label>
      <input id=${'nt-' + key} class="in-t" maxlength=${routeNote != null ? ROUTE_NOTE_MAX : NOTE_MAX} value=${note} onInput=${(e) => setNote(e.target.value)} onBlur=${save} />
      <div class="acts"><button type="button" class="txt" onClick=${drop}>기록에서 빼기</button></div>`}
  </div>`;
}

// lead: a node drawn first in the list (the place page's 오늘 한 루트 group); hideChosen: its routes are not repeated below (a search still lists everything).
// The sheet body: search, 구역 chips, 이어서 도전 / 내가 추가한 루트 / 이 암장의 루트 (one flat list while searching), 새 루트 row.
// place: 'crag:<id>' | 'mine:<id>' | null (a typed-name place keeps a new route in this record only). mine: this place's 내 루트.
export function RoutePicker({ routes, multi = false, rec, history, patchList, cragId, notes, place, mine, h, onErr, area: areaIn, onArea, lead = null, hideChosen = false }) {
  const [query, setQuery] = useState('');
  const [areaOwn, setAreaOwn] = useState(null);
  const area = onArea ? areaIn : areaOwn; // the place page owns the 구역 (its 개념도 follows the chip); the record sheet keeps its own
  const setArea = onArea ?? setAreaOwn;
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
      ${open && multi && r.route.pitches && html`<ol class="pl">${pitchLines(r.route).map((l, i) => html`<li key=${l}>${l}${r.route.pitches[i]?.note && html`<span class="pl-note">${r.route.pitches[i].note}</span>`}</li>`)}</ol>`}
      ${open && html`<${StyleButtons} hist=${history.get(r.route.id)} cur=${curOf(r.route)} full=${full} onPick=${(st, on) => mark(r.route, st, on)} />`}
      ${open && isMine && html`<div class="acts"><button type="button" class="txt" onClick=${() => { if (h.removeMyRoute(r.route.mineId)?.ok === false) onErr(SAVE_FAIL); else { setOpenKey(null); document.getElementById('rq')?.focus(); } }}>내 루트에서 지우기</button></div>`}</div>`;
  };
  const shown = hideChosen && !searching ? rows.filter((r) => !r.chosen) : rows;
  const proj = shown.filter((r) => r.section === 'project');
  const mineRows = shown.filter((r) => r.section === 'mine');
  const rest = shown.filter((r) => r.section === 'all');
  const heads = !searching && [proj, mineRows, rest].filter((g) => g.length).length + (lead ? 1 : 0) > 1; // 묶음 머리글은 묶음이 둘 이상일 때만, 검색 중엔 한 목록
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
      ${!searching && lead}
      ${!heads && sortBtn && html`<div class="lbl srt-h">${sortBtn}</div>`}
      ${heads && proj.length > 0 && html`<h3 class="lbl">이어서 도전</h3>`}${proj.map(rowOf)}
      ${heads && mineRows.length > 0 && html`<h3 class="lbl">내가 추가한 루트</h3>`}${mineRows.map(rowOf)}
      ${heads && rest.length > 0 && html`<h3 class=${'lbl' + (sortBtn ? ' srt-h' : '')}>이 암장의 루트${sortBtn}</h3>`}${rest.map(rowOf)}
    </div>
  </div>`;
}
