// src/planner-new.js — 일정 만들기/고치기 sheet. Only date + place are required; save is enabled whenever draftReady, no modal before saving.
// Storage writes go through handlers (planner.js); the optional new-wall report goes through plan-report-api (never partner names).
import { html, useState, useRef, useEffect, usePlannerState } from './planner-ui.js';
import { Sheet, NameAdd } from './planner-sheet.js';
import { PartnerRow } from './planner-partners.js';
import { comingWeekend } from './trips.js';
import { searchPlaces, resolvePlace, listChoices } from './plan-place.js';
import { activeKinds } from './season.js';
import { draftReady, addMine } from './plan-draft.js';
import { randomId } from './plan-model.js';
import { offerFor, reportInput, dismiss, markReported } from './plan-report.js';
import { sendNewWall, REPORT_OK, REPORT_LATER, OFFER_ASK } from './plan-report-api.js';
import { config } from './config.js';
import { findWall, openLabel, utilLinks } from './plan-wall.js';
import { findIce } from './plan-ice-sheet.js';
import { LinkButton, Note } from './planner-parts.js';
import { minFromTime, timeFromMin, planFromDraft, draftDirty, dowText, isPastDate, PAST_NOTE, UNSAVED_NOTE, SAVE_FAIL } from './plan-sheet.js';

const util = utilLinks(config.utilUrl);
const NAME_ONLY_PICKED = '이름만 적은 곳'; // the picked name-only place's state line (a new name-only place is no longer made here: the sheet adds a 내 암장 instead; old saved ones still read)
const KIND_LABEL = { wall: '외벽', crag: '자연암장', ice: '빙벽장' };
const reportOn = () => /^https?:\/\//.test(config.reportEndpoint ?? '');

function MineForm({ initName = '', onAdd, onCancel }) {
  const nameEl = useRef(null);
  const regionEl = useRef(null);
  useEffect(() => { (initName ? regionEl : nameEl).current?.focus(); }, []);
  const [f, setF] = useState({ name: initName, region: '', venue: '', address: '' });
  const set = (k) => (e) => { const v = e.target.value; setF((o) => ({ ...o, [k]: v })); };
  return html`<div class="f">
    <h3>새 장소 추가</h3>
    <label for="mn">이름</label><input id="mn" class="in-t" ref=${nameEl} value=${f.name} onInput=${set('name')} />
    <label for="mr">지역 (선택)</label><input id="mr" class="in-t" ref=${regionEl} value=${f.region} onInput=${set('region')} />
    <span class="lb">구분 (선택)</span>
    <div class="sel">${[['indoor', '실내'], ['outdoor', '야외']].map(([v, t]) => html`<button type="button" key=${v} aria-pressed=${f.venue === v ? 'true' : 'false'}
      onClick=${() => setF((o) => ({ ...o, venue: o.venue === v ? '' : v }))}>${t}</button>`)}</div>
    <label for="ma">주소 (선택)</label><input id="ma" class="in-t" value=${f.address} onInput=${set('address')} />
    <div class="row2"><button type="button" class="btn p" disabled=${!f.name.trim()} onClick=${() => onAdd(f)}>추가</button><button type="button" class="btn" onClick=${onCancel}>취소</button></div>
  </div>`;
}

function Offer({ saved, h, state, setState }) { // state (null | 'busy' | 'sent' | 'later') lives in PlanForm: the sheet's X / Esc need it to tell "dismissed" from "answered"
  const send = async () => {
    setState('busy');
    const r = await sendNewWall(reportInput(saved.resolved));
    if (r.state === 'sent') h.saveSettings(markReported(saved.settings, saved.offer.key));
    setState(r.state === 'sent' ? 'sent' : 'later');
  };
  return html`<div class="f">
    ${state === 'sent' ? html`<p role="status">${REPORT_OK}</p>` : state === 'later' ? html`<p role="status">${REPORT_LATER}</p>`
      : html`<${Note}>${OFFER_ASK}<//>`}
    ${state !== 'sent' && html`<div class="row2 foot"><button type="button" class="btn p" disabled=${state === 'busy'} onClick=${send}>알리기</button></div>`}
  </div>`;
}

function PlanForm({ s, plan, h }) {
  const ctx = { walls: s.walls, crags: s.crags, ice: s.ice, mine: s.db.mine, aliases: s.aliases };
  const r0 = plan ? resolvePlace(plan.place, { ...ctx, savedName: plan.placeName }) : null;
  const preset = plan ? null : s.preset; // a new plan may start from a bridge (?new&wall=) or the calendar
  const [date, setDate] = useState(plan?.date ?? preset?.date ?? comingWeekend(s.today).sat);
  const [time, setTime] = useState(plan ? timeFromMin(plan.min) : '');
  const p0 = preset?.place ? resolvePlace(preset.place, ctx) : null;
  const [query, setQuery] = useState(r0?.name ?? p0?.name ?? '');
  const [picked, setPicked] = useState(plan?.place ?? (p0 ? preset.place : null));
  const [partnerIds, setPartnerIds] = useState(plan?.partnerIds ?? []);
  const [mineSeed, setMineSeed] = useState(null); // 새 장소 추가 form: null = closed, else the name it opens with
  const mineOpen = mineSeed !== null;
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(null);
  const [offerState, setOfferState] = useState(null);
  const init = useRef({ date, time, query, partnerIds });
  const place = picked; // typed text alone is not a place: it only counts once picked from the list (the 이름만 쓰기 row picks a name-only place)
  const draft = { date, min: minFromTime(time), place, partnerIds };
  const [browse, setBrowse] = useState(null); // the 목록 chip picked ('wall' | 'crag' | 'ice')
  const searching = !!query.trim();
  const kinds = searching || picked ? [] : activeKinds(date, config.season).filter((k) => listChoices(ctx, [k]).length); // a kind with no places gets no chip
  const open = kinds.includes(browse) ? browse : null; // a chip that went out of season with the date closes its list
  const noDupAdd = (r) => (r[0]?.place.kind === 'name' ? r : r.filter((x) => x.place.kind !== 'name')); // an exact-name place is in the list (it sorts before the name row): then no 새 장소로 추가 row
  const toAdd = (r) => (r.place.kind === 'name' ? { ...r, label: `"${r.place.name}" 새 장소로 추가`, sub: '이름만 적어도 돼요' } : r); // the typed-name row opens the 새 장소 추가 form instead of making a name-only place
  const rows = mineOpen ? [] : searching && !picked ? noDupAdd(searchPlaces(query, ctx)).slice(0, 8).map(toAdd) : open ? listChoices(ctx, [open]) : [];
  const focusBtn = useRef(false); // after a pick / 추가 the box is gone: focus goes to 바꾸기
  const rowEl = useRef(null);
  useEffect(() => { if (focusBtn.current && picked) { focusBtn.current = false; rowEl.current?.querySelector('button[aria-label="장소 바꾸기"]')?.focus(); } });
  const focusIn = useRef(false); // 바꾸기 → the box comes back and takes focus
  const infoOf = (row, chosen) => { // a list row's (or the picked place's) 정보 target and its "지역 · 열림" line
    const w = row.place.kind === 'official' ? findWall(s.walls, row.place.id) : null; // a crag or a name has no hours: no open label, no 정보 button
    const iw = !w && row.place.kind === 'official' ? findIce(s.ice, row.place.id) : null; // a 빙벽장 has a sheet too (no open hours)
    const op = w ? openLabel(w, date, minFromTime(time)) : '';
    const shut = /닫힘|쉼|휴관/.test(op); // closed on that day/time: bold, no colour
    const rsub = chosen && row.place.kind === 'mine' ? (s.db.mine.find((m) => m.id === row.place.id)?.region || '내가 추가한 곳') : row.sub; // a picked 내 암장: its region, else who made it
    const sub = chosen && row.place.kind === 'name' ? NAME_ONLY_PICKED : html`${rsub}${rsub && op ? ' · ' : ''}${shut ? html`<span class="op-no">${op}</span>` : op}`;
    return { has: !!(w || iw), sub };
  };
  const prow = picked ? listChoices(ctx).find((r) => r.place.kind === picked.kind && r.place.id === picked.id) ?? { label: query || picked.name || resolvePlace(picked, ctx).name || '', sub: '', place: picked } : null;
  const hint = !picked && !mineOpen && (searching ? rows.some((r) => r.place.kind !== 'name') ? 'pick' : '' : 'empty'); // why 저장 is off: nothing picked yet
  const linkRow = util && html`<div class="p-row-links"><${LinkButton} href=${util.list}>열린 암장 둘러보기 ›<//><${LinkButton} href=${util.map}>지도로 보기 ›<//></div>`; // chip list: above the long list; search: under it
  const links = !mineOpen && (searching || open); // the helper links appear only while searching or with a chip's list open

  const pick = (row) => { if (row.place.kind === 'name') { setMineSeed(row.place.name); return; } focusBtn.current = true; setPicked(row.place); setQuery(row.label); };
  const [manage, setManage] = useState(false);
  const hm = { ...h, removePartner: (id) => { h.removePartner(id); setPartnerIds((ids) => ids.filter((x) => x !== id)); if (s.db.partners.length <= 1) setManage(false); } }; // a deleted name leaves this draft too
  const togglePartner = (id) => setPartnerIds(partnerIds.includes(id) ? partnerIds.filter((x) => x !== id) : [...partnerIds, id]);
  const addPartner = (name) => {
    const id = randomId();
    if (h.savePartner({ id, name })?.ok === false) { setErr(SAVE_FAIL); return; }
    setPartnerIds([...partnerIds, id]);
  };
  const addMineWall = (f) => {
    const m = addMine(f, { authorId: '', id: randomId() });
    if (!m || h.saveMine(m)?.ok === false) { setErr(SAVE_FAIL); return; }
    setErr(''); setPicked({ kind: 'mine', id: m.id, name: m.name }); setQuery(m.name); setMineSeed(null); focusBtn.current = true;
  };
  const save = () => {
    const resolved = resolvePlace(place, { ...ctx, savedName: place?.name });
    const next = planFromDraft(plan, draft, { id: plan?.id ?? randomId(), now: Date.now(), resolved });
    if (!next || h.savePlan(next)?.ok === false) { setErr(SAVE_FAIL); return; }
    setErr('');
    const cur = h.getState(); // savePlan reloaded: judge the offer on what is stored
    const res = resolvePlace(next.place, { walls: cur.walls, crags: cur.crags, ice: cur.ice, mine: cur.db.mine, aliases: cur.aliases, savedName: next.placeName });
    const offer = reportOn() ? offerFor(next, res, cur.db.settings, cur.walls.length > 0) : null;
    if (offer) setSaved({ offer, resolved: res, settings: cur.db.settings });
    else h.onClose();
  };

  // closing the offer without answering = dismiss; after a failed send we keep it open for the next time ("나중에 다시 알릴게요")
  const dirty = !saved && draftDirty({ date, time, query, partnerIds }, init.current);
  const close = () => {
    if (saved && offerState === null) h.saveSettings(dismiss(saved.settings, saved.offer.key));
    h.onClose(!saved && dirty ? { notice: UNSAVED_NOTE } : undefined); // closed with typed values and no save: say so in one line
  };

  return html`<${Sheet} title=${saved ? '저장했어요' : plan ? '일정 고치기' : '일정 만들기'} onClose=${close} keepOnBackdrop=${dirty}>
    ${saved ? html`<${Offer} saved=${saved} h=${h} state=${offerState} setState=${setOfferState} />` : html`
    <div class="row2 stack">
      <div class="f"><label for="dt">날짜${dowText(date) && ` · ${dowText(date)}`}</label><input id="dt" class="in-t" type="date" value=${date} onInput=${(e) => setDate(e.target.value)} /></div>
      <div class="f"><label for="tm">시각 (선택)</label><input id="tm" class="in-t" type="time" value=${time} onInput=${(e) => setTime(e.target.value)} /></div>
    </div>
    ${isPastDate(date, s.today) && html`<${Note} role="status">${PAST_NOTE}<//>`}
    ${prow ? html`<div class="f"><span class="lb">장소</span>
      <div class="pick-row" role="group" aria-label="고른 장소" ref=${rowEl}><div class="pick static">${prow.label}<small>${infoOf(prow, true).sub}</small></div>
        ${infoOf(prow).has && html`<${LinkButton} aria-label=${prow.label + ' 암장 정보'} onClick=${() => h.openWall(picked.id, { from: 'search', date, min: minFromTime(time) })}>암장 정보<//>`}
        <${LinkButton} aria-label="장소 바꾸기" onClick=${() => { focusIn.current = true; setPicked(null); setQuery(''); }}>바꾸기<//></div></div>`
    : html`${!mineOpen && html`<div class="f"><label for="pl">장소</label>
      <input id="pl" class="in-t" value=${query} placeholder="암장 이름이나 지역" enterkeyhint="search" autocomplete="off" autofocus=${!plan}
        ref=${(el) => { if (el && focusIn.current) { focusIn.current = false; el.focus(); } }} onInput=${(e) => setQuery(e.target.value)} />
      ${kinds.length > 0 && html`<div class="sel kinds" role="group" aria-label="분류별 목록">${kinds.map((k) => html`<button type="button" key=${k}
        aria-pressed=${open === k ? 'true' : 'false'} onClick=${() => setBrowse(open === k ? null : k)}>${KIND_LABEL[k]}</button>`)}</div>`}</div>`}
    ${open && links && html`<div><button type="button" class="txt" onClick=${() => setMineSeed('')}>＋ 새 장소 추가</button></div>`}
    ${open && links && linkRow}
    <div class=${open ? 'picks list' : 'picks'}>${rows.map((row, i) => html`<div class="pick-row" key=${row.key}>
        <button type="button" class=${'pick' + (searching && i === 0 ? ' first' : '')} onClick=${() => pick(row)}>${row.label}<small>${infoOf(row).sub}</small></button>
        ${infoOf(row).has && html`<${LinkButton} aria-label=${row.label + ' 암장 정보'} onClick=${() => h.openWall(row.place.id, { from: 'search', date, min: minFromTime(time) })}>암장 정보<//>`}
      </div>`)}</div>
    ${hint === 'pick' && html`<${Note} id="pl-hint" role="status">목록에서 골라 주세요<//>`}
    ${mineOpen && html`<${MineForm} initName=${mineSeed} onAdd=${addMineWall} onCancel=${() => { focusIn.current = true; setMineSeed(null); }} />`}
    ${!open && links && linkRow}`}
    <div class="f"><div class="f-hd"><span class="lb">동행 (선택)</span>
      ${s.db.partners.length > 0 && html`<button type="button" class="txt" aria-expanded=${manage ? 'true' : 'false'} onClick=${() => setManage(!manage)}>${manage ? '완료' : '관리'}</button>`}</div>
      ${manage && s.db.partners.length > 0
        ? html`<ul class="prs">${s.db.partners.map((p) => html`<${PartnerRow} key=${p.id} p=${p} h=${hm} fail=${() => setErr(SAVE_FAIL)} />`)}</ul>`
        : html`<div class="sel prt">${s.db.partners.map((p) => { const on = partnerIds.includes(p.id); return html`<button type="button" key=${p.id} aria-pressed=${on ? 'true' : 'false'} onClick=${() => togglePartner(p.id)}>${p.name}${on && html`<span class="x" aria-hidden="true">×</span>`}</button>`; })}</div>`}
      <${NameAdd} onAdd=${addPartner} /></div>
    ${hint === 'empty' && html`<${Note} id="pl-hint" role="status">장소를 골라 주세요<//>`}
    <p class="err" role="alert">${err}</p>
    ${!mineOpen && html`<div class="row2 foot"><button type="button" class="btn p" disabled=${!draftReady(draft)} aria-describedby=${!draftReady(draft) && hint ? 'pl-hint' : undefined} onClick=${save}>저장</button></div>`}`}
  <//>`;
}

export function PlanSheet({ store, handlers }) {
  const s = usePlannerState(store);
  if (s.sheet !== 'new' && s.sheet !== 'edit') return null;
  const plan = s.sheet === 'edit' ? s.db.plans.find((p) => p.id === s.editId) : null;
  if (s.sheet === 'edit' && !plan) return null;
  return html`<${PlanForm} key=${s.sheet + (s.editId ?? '')} s=${s} plan=${plan} h=${handlers} />`;
}
