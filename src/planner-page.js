// src/planner-page.js — the place page's frame (full screen <dialog>: sky head, tab panels side by side, plan row, bottom tabs), the segment row and the report sheet.
// It does not know what kind of place it holds: panels come in as vnodes. No fetch, no storage (reports go through plan-report-api.js).
import { html, useState, useEffect, useRef } from './planner-ui.js';
import { Icon } from './planner-icons.js';
import { Sheet } from './planner-sheet.js';
import { Chip } from './planner-parts.js';
import { segStep } from './seg-nav.js';
import { sendPlaceReport, REPORT_OK, REPORT_LATER } from './plan-report-api.js';
import { MAX_BODY } from './report.js';

// the head folds to its words while a panel is read down, and unfolds at its top (same numbers as the 외벽 app's wall-sheet.js)
export const COMPACT_ON = 48, COMPACT_EXTRA = 120, COMPACT_OFF = 8;
/** foldNext(cur, { top, over }) → is the head folded: top = the panel's scrollTop, over = scrollHeight − clientHeight. Between the two thresholds it keeps cur. */
export function foldNext(cur, { top, over }) {
  if (top < COMPACT_OFF) return false;
  if (top > COMPACT_ON && over > COMPACT_EXTRA) return true;
  return cur;
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** PlacePage({ title, top, sky, tabs, tab, onTab, panels, planRow, onBack, onReport, notice })
 *  sky = { tone: 'k-lit'|'k-lit low'|'k-shade'|'k-night'|'k-none', sunT: 0..1, chip } · tabs = [{ key, label, empty }] · panels = { [key]: vnode } · planRow = vnode | null · onReport absent = no 알려 주기. */
export function PlacePage({ title, top = '', sky = {}, tabs, tab, onTab, panels, planRow = null, onBack, onReport = null, notice = '' }) {
  const dlg = useRef(null);
  const titleEl = useRef(null);
  const body = useRef(null);
  const tabEls = useRef([]);
  const gone = useRef(false);
  const cur = useRef(tab);
  const [compact, setCompact] = useState(false);
  const keys = tabs.map((t) => t.key);
  const solo = tabs.length === 0; // no tabs: panels.solo alone, no bottom row
  cur.current = tab;

  useEffect(() => {
    const d = dlg.current;
    const opener = document.activeElement; // the unmount path (browser 뒤로) gets no native focus return: give it back to the opener ourselves
    if (d && !d.open) { d.showModal(); titleEl.current?.focus(); }
    return () => {
      gone.current = true; if (d?.open) d.close();
      if (opener?.isConnected && opener !== document.body && (document.activeElement === document.body || !document.activeElement)) opener.focus();
    };
  }, []);

  // the tab (from the address) is in view: scroll the row to it. A swipe that settled there already has it, so nothing moves.
  const first = useRef(true);
  useEffect(() => {
    const b = body.current, i = keys.indexOf(tab);
    if (!b || i < 0 || !b.clientWidth) return;
    if (Math.abs(b.scrollLeft - i * b.clientWidth) > 2) b.scrollTo({ left: i * b.clientWidth, behavior: first.current || reduced() ? 'instant' : 'smooth' });
    first.current = false;
    const p = b.children[i];
    if (p && p.scrollTop < COMPACT_OFF) setCompact(false);
  }, [tab, keys.join('|')]);

  // a swipe: when it stops, the panel in view is the tab (scrollend where there is one, else a short quiet time)
  const timer = useRef(0);
  const settle = () => {
    const b = body.current;
    if (!b || !b.clientWidth) return;
    const near = Math.max(0, Math.min(keys.length - 1, Math.round(b.scrollLeft / b.clientWidth)));
    if (keys[near] !== cur.current) onTab(keys[near]);
  };
  const onBodyScroll = (e) => {
    if (e.target === body.current) { clearTimeout(timer.current); timer.current = setTimeout(settle, 110); return; }
    const p = e.target;
    if (!p.classList?.contains('pp-panel')) return;
    setCompact((c) => foldNext(c, { top: p.scrollTop, over: p.scrollHeight - p.clientHeight }));
  };
  useEffect(() => {
    const b = body.current;
    b?.addEventListener('scrollend', settle);
    return () => b?.removeEventListener('scrollend', settle);
  }, [keys.join('|')]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const press = (key) => {
    if (key !== tab) { const p = body.current?.children[keys.indexOf(key)]; if (p) p.scrollTop = 0; } // each tab starts at its top
    onTab(key);
  };
  const keyDown = (e) => {
    const next = segStep(keys, tab, e.key);
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    if (next !== tab) { tabEls.current[keys.indexOf(next)]?.focus(); press(next); }
  };

  const toneCls = sky.tone ?? 'k-none';
  return html`<dialog ref=${dlg} class="pp-page is-wall" aria-labelledby="pp-title" onClose=${() => { if (!gone.current) onBack(); }}>
    <header class=${`sh-sky ${toneCls}${compact ? ' is-compact' : ''}`} style=${`--sun-t:${sky.sunT ?? 0.5}`}>
      <div class="sk-txt"><h1 id="pp-title" class="sk-title" tabindex="-1" ref=${titleEl}>${title}</h1>
        ${(top || sky.chip) && html`<p class="sk-sub">${top}${sky.chip && html`<span class="sk-chip">${sky.chip}</span>`}</p>`}</div>
      <div class="sk-act">
        ${onReport && html`<button type="button" class="sk-rep" onClick=${onReport}>알려 주기</button>`}
        <button type="button" class="sk-ok" aria-label="뒤로" onClick=${() => dlg.current?.close()}><${Icon} name="x" /></button></div>
      <div class="sk-scene" aria-hidden="true"><span class="sk-disc"></span><span class="sk-slab"></span><span class="sk-ground"></span></div>
    </header>
    <div class="pp-body" ref=${body} onScrollCapture=${onBodyScroll}>
      ${solo && html`<div class="pp-panel">${panels.solo}</div>`}
      ${tabs.map((t) => html`<div key=${t.key} class="pp-panel" role="tabpanel" id=${'pp-p-' + t.key} aria-labelledby=${'pp-t-' + t.key} inert=${t.key !== tab}>${panels[t.key]}</div>`)}
    </div>
    <div class="pp-note"><p class="n notice" role="status">${notice}</p></div>
    ${planRow && html`<div class="pp-plan">${planRow}</div>`}
    ${!solo && html`<div class="ws-tabs" role="tablist" aria-label="암장 정보 보기">
      ${tabs.map((t, i) => html`<button key=${t.key} type="button" role="tab" id=${'pp-t-' + t.key} aria-controls=${'pp-p-' + t.key} aria-selected=${t.key === tab ? 'true' : 'false'}
        tabindex=${t.key === tab ? 0 : -1} ref=${(n) => { tabEls.current[i] = n; }} onClick=${() => press(t.key)} onKeyDown=${keyDown}><span class="ws-tl">${t.label}</span></button>`)}
    </div>`}
  </dialog>`;
}

/** Segments({ items: [{ key, label }], cur, onPick, label }) — a row of text buttons (sheet.css .sx-seg); ←/→/Home/End move, only the chosen one is in the tab order. The caller holds `cur` and shows the matching part. */
export function Segments({ items, cur, onPick, label, idPrefix = 'sx' }) {
  const keys = items.map((i) => i.key);
  const refs = useRef([]);
  const keyDown = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next = segStep(keys, cur, e.key);
    if (next !== cur) { refs.current[keys.indexOf(next)]?.focus(); onPick(next); }
  };
  return html`<div class="sx-seg" role="tablist" aria-label=${label}>
    ${items.map((i, n) => html`<button key=${i.key} type="button" role="tab" id=${`${idPrefix}-${i.key}`} aria-controls=${`${idPrefix}-${i.key}-p`} aria-selected=${i.key === cur ? 'true' : 'false'}
      tabindex=${i.key === cur ? 0 : -1} ref=${(el) => { refs.current[n] = el; }} onClick=${() => onPick(i.key)} onKeyDown=${keyDown}>${i.label}</button>`)}
  </div>`;
}

/** PlaceReportSheet({ wallName, kinds, crag, onClose }) — 무엇(칩, 하나뿐이면 미리 고름) + 내용 + 보내기. Only opened while reportOn(). */
export function PlaceReportSheet({ wallName, kinds, crag = false, onClose }) {
  const [kind, setKind] = useState(kinds.length === 1 ? kinds[0] : '');
  const [text, setText] = useState('');
  const [state, setState] = useState(''); // '' | 'busy' | 'sent' | 'later'
  const ok = Boolean(kind) && text.trim().length > 0 && state !== 'busy' && state !== 'sent';
  const send = async () => {
    if (!ok) return;
    setState('busy');
    const r = await sendPlaceReport({ name: wallName, kind, body: text }, { crag });
    setState(r.state === 'sent' ? 'sent' : 'later');
  };
  return html`<${Sheet} title="알려 주기" onClose=${onClose} keepOnBackdrop=${true}>
    <div class="p-field pr"><span class="lb" id="pr-k">무엇이 달라졌나요</span>
      <div class="sel" role="group" aria-labelledby="pr-k">${kinds.map((k) => html`<${Chip} key=${k} pressed=${kind === k} onClick=${() => setKind(k)}>${k}<//>`)}</div></div>
    <div class="p-field pr"><label for="pr-t">내용</label>
      <textarea id="pr-t" class="in-t" rows="4" maxlength=${MAX_BODY} value=${text} onInput=${(e) => setText(e.target.value)}></textarea></div>
    ${state && state !== 'busy' && html`<p role="status">${state === 'sent' ? REPORT_OK : REPORT_LATER}</p>`}
    <div class="p-row pr"><button type="button" class="btn p" disabled=${!ok} onClick=${send}>보내기</button></div>
  <//>`;
}
