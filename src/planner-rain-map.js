// src/planner-rain-map.js — "전국 비 예보 보기" sheet (D3b): per-시·도 count of crags with no rain forecast that day, as a map (Leaflet, loaded late)
// and a list; 바꾸기 changes the plan's place. Judgement lives in rain-map.js; weather comes through h.loadRainMap. No fetch/storage here.
import { html, render, useState, useEffect, useRef } from './planner-ui.js';
import { Sheet } from './planner-sheet.js';
import { Icon, DisciplineIcon } from './planner-icons.js';
import { changePlace } from './plan-actions.js';
import { dayParts, LOADING } from './plan-view.js';
import { mapPlaces, rainRegions, rainRow, rainMapView, pinText, pinFace, MODES } from './rain-map.js';

const CREDIT = html`날씨 예보 <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo.com (CC BY 4.0)</a>`;
const regionSummary = (r) => (r.unknown >= r.total ? '예보 없음' : `${r.total}곳 중 ${r.dry}곳 비 예보 없음`);
const pinLabel = (r, mode = 'dry') => {
  const label = MODES.find(([k]) => k === mode)[1];
  return `${r.sido} ${mode === 'dry' ? regionSummary(r) : `${label} ${pinFace(r, mode).text}`}${r.here ? ', 원래 장소' : ''}`;
};

let leaflet = null;
/** Leaflet from the same origin (vendor/leaflet), loaded once on first use; a failure clears itself so the next open tries again. */
export function loadLeaflet() {
  if (typeof window !== 'undefined' && window.L) return Promise.resolve(window.L);
  leaflet ??= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'vendor/leaflet/leaflet.css';
    const js = document.createElement('script');
    js.src = 'vendor/leaflet/leaflet.js';
    const fail = () => { css.remove(); js.remove(); leaflet = null; reject(new Error('leaflet')); };
    js.onload = () => (window.L ? resolve(window.L) : fail());
    js.onerror = fail;
    document.head.append(css, js);
  });
  return leaflet;
}

/** The map: pins carry pinText (dry/total); a pin press opens that region's rows. Leaflet or tiles failing leaves nothing here and the list keeps working. */
function RainMap({ regions, allRain, mode, onPin }) {
  const box = useRef(null);
  const pick = useRef(onPin);
  pick.current = onPin;
  const [off, setOff] = useState(false);
  const live = useRef({ pins: [], regions, allRain, mode });
  live.current.regions = regions; live.current.allRain = allRain; live.current.mode = mode;
  const paint = () => { // the pin's face: name over value (+ sky icon); the dry mode shows a rain icon only when every judged crag has rain
    const { pins, regions: rs, allRain: ar, mode: md } = live.current;
    pins.forEach(({ el, i }) => {
      const r = rs[i], f = pinFace(r, md), icon = f.icon ?? (md === 'dry' && ar ? 'rain' : null);
      el.setAttribute('aria-label', pinLabel(r, md));
      render(html`<span class="rm-nm">${r.sido}</span><span class="rm-v">${icon && html`<${Icon} name=${icon} cls="rm-ic" />`}<span class="rm-n">${f.text}</span></span>`, el);
    });
  };
  const sig = regions.map((r) => `${r.sido}:${pinText(r)}`).join('|');
  useEffect(() => {
    let map = null, dead = false;
    loadLeaflet().then((L) => {
      if (dead || !box.current) return;
      map = L.map(box.current, { scrollWheelZoom: false }).setView([36.5, 127.8], 7); // a view first: markers get their element only once the map has one (the pin text is set on it below)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
      const pts = [];
      live.current.pins = [];
      regions.forEach((r, i) => {
        if (!r.at) return;
        const m = L.marker([r.at.lat, r.at.lng], { icon: L.divIcon({ className: 'rm-pin' + (r.here ? ' here' : ''), html: '', iconSize: [52, 52] }), keyboard: true, zIndexOffset: r.here ? 1000 : 0 }).addTo(map); // the original place's pin stays on top where pins overlap
        const el = m.getElement();
        if (el) live.current.pins.push({ el, i });
        m.on('click', () => pick.current(i));
        pts.push([r.at.lat, r.at.lng]);
      });
      paint();
      if (pts.length) map.fitBounds(pts, { padding: [32, 32], maxZoom: 9 });
      setTimeout(() => map?.invalidateSize(), 0); // the dialog was still opening when the box was measured
    }).catch(() => { if (!dead) setOff(true); });
    return () => { dead = true; map?.remove(); };
  }, [sig]);
  useEffect(paint, [mode]);
  return off ? null : html`<div class="rm-map" ref=${box} role="group" aria-label="전국 비 예보 지도"></div>`;
}

/** The sheet's content without any hook (so a test can read the vnode): `open` = index of the opened region, onOpen(i|null) toggles it. */
export function RainMapView({ plan, v, s, now, h, open, onOpen, onClose, mode = 'dry', onMode = () => {} }) {
  const places = mapPlaces(s.crags, plan, v.resolved);
  const regions = rainRegions(places, s.rainWx, plan, { origin: v.resolved, now });
  const view = rainMapView(regions, { loaded: s.rainLoaded, ok: s.rainWx?.crag?.ok === true, plan, now });
  const p = dayParts(plan.date);
  const showMap = view.kind === 'ok' || view.kind === 'all-rain';
  const row = (a) => html`<li class="alt" key=${a.key}>
      <${DisciplineIcon} kind=${a.symbol} cls="sy" />
      <div class="ab"><b>${a.name}</b>${a.sub && html`<em>${a.sub}</em>`}</div>
      ${a.canSwap && html`<button type="button" class="p-link" aria-label=${`${a.name} 이곳으로 바꾸기`} onClick=${() => { h.savePlan(changePlace(plan, a.place, a.placeName)); onClose(); }}>바꾸기</button>`}
    </li>`;
  return html`<${Sheet} title=${`${p.month}월 ${p.day}일 비 예보`} onClose=${onClose}>
    <div class="rm">
      ${view.far && html`<p class="note rm-far">${view.far}</p>`}
      ${view.kind === 'loading' && html`<p class="rm-state" role="status">${LOADING}</p>`}
      ${view.kind === 'failed' && html`<p class="rm-state" role="status">예보를 불러오지 못했어요</p>
        <button type="button" class="p-link rm-retry" onClick=${() => h.loadRainMap()}>다시 받기</button>`}
      ${showMap && html`<div class="rm-modes" role="group" aria-label="지도에 보일 값">${MODES.map(([k, label]) => html`<button type="button" class="rm-mode" key=${k} aria-pressed=${mode === k} onClick=${() => onMode(k)}>${label}</button>`)}</div>`}
      ${showMap && html`<${RainMap} regions=${regions} allRain=${view.kind === 'all-rain'} mode=${mode} onPin=${(i) => { onOpen(i); }} />`}
      ${view.kind === 'all-rain' && html`<p class="rm-state">이날은 등반지가 있는 모든 지역에 비 예보가 있어요</p>`}
      ${showMap && html`<p class="rm-sum">${view.summary}</p>
        <ul class="rm-list">${regions.map((r, i) => html`<li class=${'rm-reg' + (r.here ? ' here' : '')} id=${`rm-r-${i}`} key=${r.sido}>
          <button type="button" class="rm-head" aria-expanded=${open === i} aria-label=${pinLabel(r)} onClick=${() => onOpen(open === i ? null : i)}>
            <span class="rm-sido">${r.sido}</span><span class="rm-cnt">${pinText(r)}</span>
          </button>
          ${open === i && html`<ul class="rm-rows">${r.places.map((x) => row(rainRow(x, v.resolved)))}</ul>`}
        </li>`)}</ul>`}
      <p class="rm-credit">${CREDIT}</p>
    </div><//>`;
}

/** props: plan, v (rowView), s (planner state), now, h, onClose */
export function RainMapSheet({ plan, v, s, now, h, onClose }) {
  const [open, setOpen] = useState(null);
  const [mode, setMode] = useState('dry');
  useEffect(() => { h.loadRainMap(); }, []);
  const toggle = (i) => {
    setOpen(i);
    if (i != null) requestAnimationFrame(() => document.getElementById(`rm-r-${i}`)?.scrollIntoView?.({ block: 'nearest' }));
  };
  return RainMapView({ plan, v, s, now, h, open, onOpen: toggle, onClose, mode, onMode: setMode });
}
