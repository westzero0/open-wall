// src/planner-sun.js — the detail screen's sun card: status pill above, the existing sun-scene picture (renderScene, untouched) with a
// ruler slider in the ground and a rock per discipline. Numbers come from plan-sun.js / dial.js; colours only from `--sc-*` / planner.css.
// The scene is drawn into a plain div (DOM, rebuilt when the time changes); the ruler is a Preact SVG laid over it with the same viewBox,
// so the slider thumb keeps focus while the picture is rebuilt.
import { html, useState, useEffect, useRef } from './planner-ui.js';
import { renderScene } from './sun-scene.js';
import { dialModel } from './dial.js';
import { dayWindow } from './sun.js';
import { sceneSky, forecastTrusted } from './weather.js';
import { hourFor } from './plan-view.js';
import { RULER, LIT_OP, SHADE_OP, LOW_SUN, minToX, xToMin, stepMin, startMin, tickList, nextShadeMin, pillOf, valueText, isNowPick } from './plan-sun.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const EX = 30; // the ground grows by this much to hold the ruler
const VB = { x: 0, y: 34, w: 360, h: 166 + EX }; // sun-scene.js crops to 360 x 166 from y 34; the ruler overlay uses the same box
const RY = 190; // ruler centre line (ground starts at 158)

// rocks (scene units; x 220-335, ground at 158). wall = the scene's own thin wall, left as drawn.
const ROCK = {
  single: { d: 'M238 158C236 142 243 130 241 116C239 98 249 82 266 76C283 70 299 78 305 95C311 111 306 125 311 141C313 149 313 154 315 158Z',
    cracks: ['M262 84C265 104 259 124 264 146', 'M285 80C289 100 283 122 287 146', 'M243 120C256 123 270 117 284 121', 'M270 76C274 84 272 92 276 98'] },
  multi: { d: 'M220 158C225 130 231 100 240 76C249 62 265 52 285 52C305 52 319 66 323 84C327 112 322 136 334 158Z',
    cracks: ['M234 124C238 104 243 92 250 80', 'M252 150C256 124 262 100 262 74', 'M300 60C304 84 302 110 308 140', 'M268 52C274 70 276 90 274 120'],
    route: 'M246 152C250 132 262 122 258 102C254 88 270 78 276 66L284 55' },
};

function swapRock(svg, kind) {
  const r = ROCK[kind === 'multi' ? 'multi' : kind === 'single' || kind === 'boulder' ? 'single' : null];
  const wall = svg.querySelector('.sc-wall');
  if (!r || !wall) return;
  svg.querySelector('.sc-face')?.remove();
  const g = el('g', { class: 'rk' });
  g.append(el('path', { d: r.d, class: 'sc-wall', 'stroke-linejoin': 'round' }));
  for (const c of r.cracks) g.append(el('path', { d: c, class: 'rk-crack' }));
  if (r.route) g.append(el('path', { d: r.route, class: 'rk-route' }), el('path', { d: 'M284 55L284 38', class: 'rk-pole' }), el('path', { d: 'M284 40L297 46L284 51Z', class: 'rk-flag' }), el('circle', { cx: 246, cy: 152, r: 2.4, class: 'rk-start' }));
  wall.replaceWith(g);
}

/** The scene for a moment, with the ground grown for the ruler and the rock of the discipline. null when the sun cannot be told. */
function buildScene(model, at, wx, kind) {
  const svg = renderScene(model, at, wx);
  if (!svg) return null;
  svg.setAttribute('viewBox', `${VB.x} ${VB.y} ${VB.w} ${VB.h}`);
  const ground = svg.querySelector('.sc-ground');
  ground.setAttribute('height', String(+ground.getAttribute('height') + EX));
  svg.querySelectorAll('.sc-lab.on-ground').forEach((n) => n.remove());
  if (model.lit && model.sun?.altitude < LOW_SUN) svg.querySelectorAll('.sc-lab').forEach((n) => { if (n.textContent.startsWith('고도')) n.remove(); }); // the pill says it
  if (!model.sun) svg.querySelectorAll('.sc-tick, .sc-lab.acc, .sc-now').forEach((n) => n.remove()); // the night arc would run through the ruler: the ruler is the time scale
  swapRock(svg, kind);
  return svg;
}

const dayAt = (date, min) => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d, 0, min); };
const HOURS = [9, 12, 15, 18];

/** SunCard({ place, resolved, plan, s, now, kind }) — place = resolved.wall ?? resolved.crag, kind = discipline symbol (wall | lead | boulder | single | multi) */
export function SunCard({ place, resolved, plan, s, now, kind }) {
  const [min, setMin] = useState(() => startMin(plan.min));
  const box = useRef(null);
  const ruler = useRef(null);
  const thumb = useRef(null);
  const drag = useRef(false);
  const at = dayAt(plan.date, min);
  const model = dialModel(place, at, { isNow: false, dayLabel: '' });
  const win = dayWindow(place, at);
  const nowD = new Date(now);
  const pill = pillOf(model, resolved.name, nextShadeMin(place, at), { isNow: isNowPick(plan.date, s.today, min, nowD.getHours() * 60 + nowD.getMinutes()), before: Boolean(win) && min < win.sunrise });
  const hr = hourFor(resolved, { date: plan.date, min }, s.wx, { now });
  const wx = hr && forecastTrusted(at, new Date(now), 3) ? sceneSky(hr.c) : null; // the sky follows the picked hour, like the weather cell does

  useEffect(() => {
    const svg = buildScene(model, at, wx, kind);
    if (box.current) box.current.replaceChildren(...(svg ? [svg] : []));
  }, [min, place, plan.date, wx, kind]);

  if (!pill) return null;
  const ticks = tickList(place, dayAt(plan.date, 0));
  const x = minToX(min);
  const pick = (e) => { const r = ruler.current.getBoundingClientRect(); setMin(xToMin(((e.clientX - r.left) / r.width) * VB.w)); };
  const key = (e) => {
    const to = { ArrowLeft: min - RULER.step, ArrowDown: min - RULER.step, ArrowRight: min + RULER.step, ArrowUp: min + RULER.step, PageDown: min - 60, PageUp: min + 60, Home: RULER.from, End: RULER.to }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    setMin(e.key === 'Home' || e.key === 'End' ? to : stepMin(min, to - min));
  };
  return html`<section class="sun" aria-label="해">
    <div class="sun-h"><span class=${'pill' + (pill.lit ? '' : ' sh')}>${pill.title}</span><small>${pill.note}</small></div>
    <div class="sun-fig">
      <div class="sun-sc" ref=${box}></div>
      <svg class="sun-rl" ref=${ruler} viewBox=${`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} focusable="false">
        <g class="rl-ticks" aria-hidden="true">${ticks.map((t) => html`<line key=${t.min} class=${t.long ? 'rl-t long' : 'rl-t'} x1=${t.x} x2=${t.x} y1=${RY - (t.long ? 8 : 5)} y2=${RY + (t.long ? 8 : 5)} opacity=${t.lit ? LIT_OP : SHADE_OP} />`)}
          ${HOURS.map((h) => html`<text key=${'h' + h} class="rl-h" x=${minToX(h * 60)} y=${RY + 26}>${h}시</text>`)}</g>
        <g class="rl-grab"
          onPointerDown=${(e) => { drag.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); pick(e); thumb.current?.focus({ preventScroll: true }); }}
          onPointerMove=${(e) => { if (drag.current) pick(e); }}
          onPointerUp=${() => { drag.current = false; }} onPointerCancel=${() => { drag.current = false; }}>
          <rect class="rl-hit" x=${VB.x} y=${RY - 26} width=${VB.w} height=${52} />
          <g class="rl-thumb" ref=${thumb} role="slider" tabindex="0" aria-label="시각" aria-orientation="horizontal"
            aria-valuemin=${RULER.from} aria-valuemax=${RULER.to} aria-valuenow=${min} aria-valuetext=${valueText(min, pill.lit)} onKeyDown=${key}>
            <circle class="rl-ring" cx=${x} cy=${RY} r=${18} />
            <circle class="rl-dot" cx=${x} cy=${RY} r=${13} />
            ${[-1, 1].map((d) => html`<path key=${d} class="rl-arr" d=${`M${x + d * 8 - d * 2.6} ${RY - 5.5}L${x + d * 8} ${RY}L${x + d * 8 - d * 2.6} ${RY + 5.5}`} />`)}
          </g>
        </g>
      </svg>
    </div>
  </section>`;
}
