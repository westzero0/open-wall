// src/planner-new.js — 일정 만들기/고치기 sheet. Only date + place are required; save is enabled whenever draftReady, no modal before saving.
// Storage writes go through handlers (planner.js); the optional new-wall report goes through plan-report-api (never partner names).
import { html, useState, useRef, usePlannerState } from './planner-ui.js';
import { Sheet, NameAdd } from './planner-sheet.js';
import { comingWeekend } from './trips.js';
import { searchPlaces, resolvePlace } from './plan-place.js';
import { draftReady, addMine } from './plan-draft.js';
import { randomId } from './plan-model.js';
import { offerFor, reportInput, dismiss, markReported } from './plan-report.js';
import { sendNewWall, REPORT_OK, REPORT_LATER, OFFER_ASK, NAME_ONLY_NOTE } from './plan-report-api.js';
import { config } from './config.js';
import { findWall, openLabel, utilLinks } from './plan-wall.js';
import { LinkButton } from './planner-parts.js';
import { minFromTime, timeFromMin, placeOf, planFromDraft, draftDirty, UNSAVED_NOTE, SAVE_FAIL } from './plan-sheet.js';

const util = utilLinks(config.utilUrl);
const reportOn = () => /^https?:\/\//.test(config.reportEndpoint ?? '');

function MineForm({ onAdd, onCancel }) {
  const [f, setF] = useState({ name: '', region: '', venue: '', address: '' });
  const set = (k) => (e) => { const v = e.target.value; setF((o) => ({ ...o, [k]: v })); };
  return html`<div class="f">
    <label for="mn">이름</label><input id="mn" class="in-t" value=${f.name} onInput=${set('name')} />
    <label for="mr">지역 (선택)</label><input id="mr" class="in-t" value=${f.region} onInput=${set('region')} />
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
      : html`<p>${OFFER_ASK}</p>`}
    ${state !== 'sent' && html`<div class="row2 foot"><button type="button" class="btn p" disabled=${state === 'busy'} onClick=${send}>알리기</button></div>`}
  </div>`;
}

function PlanForm({ s, plan, h }) {
  const ctx = { walls: s.walls, crags: s.crags, mine: s.db.mine, aliases: s.aliases };
  const r0 = plan ? resolvePlace(plan.place, { ...ctx, savedName: plan.placeName }) : null;
  const preset = plan ? null : s.preset; // a new plan may start from a bridge (?new&wall=) or the calendar
  const [date, setDate] = useState(plan?.date ?? preset?.date ?? comingWeekend(s.today).sat);
  const [time, setTime] = useState(plan ? timeFromMin(plan.min) : '');
  const p0 = preset?.place ? resolvePlace(preset.place, ctx) : null;
  const [query, setQuery] = useState(r0?.name ?? p0?.name ?? '');
  const [picked, setPicked] = useState(plan?.place ?? (p0 ? preset.place : null));
  const [partnerIds, setPartnerIds] = useState(plan?.partnerIds ?? []);
  const [mineOpen, setMineOpen] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(null);
  const [offerState, setOfferState] = useState(null);
  const init = useRef({ date, time, query, partnerIds });
  const place = placeOf(picked, query, ctx);
  const draft = { date, min: minFromTime(time), place, partnerIds };
  const rows = query.trim() && !picked ? searchPlaces(query, ctx).slice(0, 8) : [];

  const pick = (row) => { setPicked(row.place); setQuery(row.place.kind === 'name' ? row.place.name : row.label); };
  const togglePartner = (id) => setPartnerIds(partnerIds.includes(id) ? partnerIds.filter((x) => x !== id) : [...partnerIds, id]);
  const addPartner = (name) => {
    const id = randomId();
    if (h.savePartner({ id, name })?.ok === false) { setErr(SAVE_FAIL); return; }
    setPartnerIds([...partnerIds, id]);
  };
  const addMineWall = (f) => {
    const m = addMine(f, { authorId: '', id: randomId() });
    if (!m || h.saveMine(m)?.ok === false) { setErr(SAVE_FAIL); return; }
    setErr(''); setPicked({ kind: 'mine', id: m.id, name: m.name }); setQuery(m.name); setMineOpen(false);
  };
  const save = () => {
    const resolved = resolvePlace(place, { ...ctx, savedName: place?.name });
    const next = planFromDraft(plan, draft, { id: plan?.id ?? randomId(), now: Date.now(), resolved });
    if (!next || h.savePlan(next)?.ok === false) { setErr(SAVE_FAIL); return; }
    setErr('');
    const cur = h.getState(); // savePlan reloaded: judge the offer on what is stored
    const res = resolvePlace(next.place, { walls: cur.walls, crags: cur.crags, mine: cur.db.mine, aliases: cur.aliases, savedName: next.placeName });
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

  return html`<${Sheet} title=${saved ? '저장했어요' : plan ? '일정 고치기' : '일정 만들기'} onClose=${close} onSave=${saved ? undefined : save} keepOnBackdrop=${dirty} saveDisabled=${!draftReady(draft)}>
    ${saved ? html`<${Offer} saved=${saved} h=${h} state=${offerState} setState=${setOfferState} />` : html`
    <div class="row2 stack">
      <div class="f"><label for="dt">날짜</label><input id="dt" class="in-t" type="date" value=${date} onInput=${(e) => setDate(e.target.value)} /></div>
      <div class="f"><label for="tm">시각 (선택)</label><input id="tm" class="in-t" type="time" value=${time} onInput=${(e) => setTime(e.target.value)} /></div>
    </div>
    <div class="f"><label for="pl">장소</label>
      <input id="pl" class="in-t" value=${query} aria-label="장소 검색" autocomplete="off" autofocus=${!plan} onInput=${(e) => { setQuery(e.target.value); setPicked(null); }} /></div>
    <div class="picks">${rows.map((row, i) => {
      const w = row.place.kind === 'official' ? findWall(s.walls, row.place.id) : null; // a crag or a name has no hours: no open label, no 정보 button
      const open = w ? openLabel(w, date, minFromTime(time)) : '';
      const shut = /닫힘|쉼|휴관/.test(open); // closed on that day/time: bold, no colour
      const sub = row.key.startsWith('name:') ? NAME_ONLY_NOTE : html`${row.sub}${row.sub && open ? ' · ' : ''}${shut ? html`<span class="op-no">${open}</span>` : open}`;
      return html`<div class="pick-row" key=${row.key}>
        <button type="button" class=${'pick' + (i === 0 ? ' first' : '')} onClick=${() => pick(row)}>${row.label}<small>${sub}</small></button>
        ${w && html`<${LinkButton} aria-label=${row.label + ' 정보'} onClick=${() => h.openWall(row.place.id, { from: 'search', date, min: minFromTime(time) })}>정보<//>`}
      </div>`;
    })}</div>
    ${mineOpen ? html`<${MineForm} onAdd=${addMineWall} onCancel=${() => setMineOpen(false)} />`
      : html`<button type="button" class="txt" onClick=${() => setMineOpen(true)}>내 암장 추가</button>`}
    ${util && html`<div class="p-row-links"><${LinkButton} href=${util.list} external>열린 암장 둘러보기 ›<//><${LinkButton} href=${util.map} external>지도로 보기 ›<//></div>`}
    <div class="f"><span class="lb">동행 (선택)</span>
      <div class="sel">${s.db.partners.map((p) => html`<button type="button" key=${p.id} aria-pressed=${partnerIds.includes(p.id) ? 'true' : 'false'} onClick=${() => togglePartner(p.id)}>${p.name}</button>`)}</div>
      <${NameAdd} onAdd=${addPartner} /></div>
    <p class="err" role="alert">${err}</p>
    <div class="row2 foot"><button type="button" class="btn p" disabled=${!draftReady(draft)} onClick=${save}>저장</button></div>`}
  <//>`;
}

export function PlanSheet({ store, handlers }) {
  const s = usePlannerState(store);
  if (s.sheet !== 'new' && s.sheet !== 'edit') return null;
  const plan = s.sheet === 'edit' ? s.db.plans.find((p) => p.id === s.editId) : null;
  if (s.sheet === 'edit' && !plan) return null;
  return html`<${PlanForm} key=${s.sheet + (s.editId ?? '')} s=${s} plan=${plan} h=${handlers} />`;
}
