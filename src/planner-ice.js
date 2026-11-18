// src/planner-ice.js — 빙벽장 시트: the 14-day temperature chart, the conditions it met, the `!` help, reservation and place facts.
// Draws what plan-ice-sheet.js made (words and 0~1 coordinates); nothing is worked out here. No fetch, no storage.
import { html, useState } from './planner-ui.js';
import { Sheet } from './planner-sheet.js';
import { Chip, IconButton, LinkButton, ButtonRow, Note } from './planner-parts.js';
import { iceSheetModel, ICE_HELP, ICE_SOURCES, ICE_HELP_DAILY_NOTE, ICE_HELP_CLOSING, exampleDays, iceChart } from './plan-ice-sheet.js';
import { wallPageId } from './share-id.js';
import { Icon } from './planner-icons.js';

// the drawing area inside a 300x150 box (labels sit left of and below it)
const W = 300, H = 150, L = 30, R = 292, T = 16, B = 126;
const px = (x) => L + x * (R - L);
const py = (y) => T + y * (B - T);
const DAY = 86400000;
const adjacent = (a, b) => Math.round((Date.parse(`${b.date}T00:00Z`) - Date.parse(`${a.date}T00:00Z`)) / DAY) === 1;

/** The chart. example: no dates, no today line, no legend; "예시" in the corner. */
export function IceChart({ chart, example = false }) {
  if (!chart) return null;
  const ds = chart.days;
  const half = (px(ds[0].x) - L); // half a slot: the first day sits half a slot from the left edge
  const step = ds.length > 8 ? 3 : 1; // every third day: at larger text sizes every other one touches
  const segs = ds.slice(1).map((d, i) => ({ a: ds[i], b: d })).filter(({ a, b }) => adjacent(a, b));
  const anyFc = ds.some((d) => d.forecast), anyRain = ds.some((d) => d.rain), anyBand = ds.some((d) => d.counted);
  return html`<figure class="ice-chart">
    <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${example ? '예시 그래프' : chart.summary}>
      ${ds.filter((d) => d.counted).map((d) => html`<rect key=${'b' + d.date} class="ic-band" x=${px(d.x) - half - 0.3} y=${T} width=${half * 2 + 0.6} height=${B - T} />`)}
      ${chart.lines.map((l) => html`<g key=${'l' + l.t}><line class="ic-ref" x1=${L} x2=${R} y1=${py(l.y)} y2=${py(l.y)} /><text class="ic-lab" x=${L - 4} y=${py(l.y) + 4} text-anchor="end">${l.t}°</text></g>`)}
      ${!example && chart.todayX !== null && html`<g><line class="ic-today" x1=${px(chart.todayX)} x2=${px(chart.todayX)} y1=${T - 4} y2=${B} /><text class="ic-lab" x=${px(chart.todayX)} y=${T - 6} text-anchor="middle">오늘</text></g>`}
      ${segs.map(({ a, b }) => html`<line key=${'s' + a.date} class=${'ic-seg' + (a.forecast || b.forecast ? ' fc' : '')} x1=${px(a.x)} y1=${py(a.yMin)} x2=${px(b.x)} y2=${py(b.yMin)} />`)}
      ${ds.map((d) => html`<g key=${'d' + d.date} class=${'ic-day' + (d.forecast ? ' fc' : '') + (d.marked ? ' mk' : '')}>
        ${d.marked && html`<rect class="ic-mark" x=${px(d.x) - half} y=${T} width=${half * 2} height=${B - T} />`}
        ${d.yMax !== null && html`<line class="ic-bar" x1=${px(d.x)} x2=${px(d.x)} y1=${py(d.yMax)} y2=${py(d.yMin)} />`}
        ${d.yMax !== null && html`<circle class="ic-dot" cx=${px(d.x)} cy=${py(d.yMax)} r="2" />`}
        <circle class="ic-dot lo" cx=${px(d.x)} cy=${py(d.yMin)} r="2.6" />
        ${d.rain && html`<path class="ic-rain" d=${`M${px(d.x)} ${py(d.yMin) + 6}l-2.6 4.2a2.6 2.6 0 1 0 5.2 0z`} />`}
      </g>`)}
      ${!example && ds.map((d, i) => (i % step === 0 ? html`<text key=${'t' + d.date} class="ic-lab" x=${px(d.x)} y=${H - 8} text-anchor="middle">${d.label}</text>` : null))}
      ${example && html`<text class="ic-lab" x=${L} y=${T - 4}>예시</text>`}
    </svg>
    ${!example && html`<figcaption class="ic-legend">
      ${anyBand && html`<span><i class="lg band"></i>조건을 센 기간</span>`}
      ${anyFc && html`<span><i class="lg fc"></i>예보</span>`}
      ${anyRain && html`<span><svg class="lg" viewBox="0 0 10 12" aria-hidden="true"><path d="M5 1l-3 5a3 3 0 1 0 6 0z" /></svg>비</span>`}
    </figcaption>`}
  </figure>`;
}

/** The `!` help: four flows, the example of the pressed one, the number sources. dots: ids of flows the recent temperatures match. */
export function IceHelp({ dots }) {
  const [id, setId] = useState(ICE_HELP[0].id);
  const cur = ICE_HELP.find((x) => x.id === id) ?? ICE_HELP[0];
  return html`<section class="ice-help" aria-label="결빙 조건 도움말">
    <div class="sel" role="group" aria-label="기온 흐름">${ICE_HELP.map((x) => html`<${Chip} key=${x.id} pressed=${x.id === id} onClick=${() => setId(x.id)}>${x.chip}${dots.has(x.id) && html`<i class="ice-dot" aria-hidden="true"></i><span class="vh"> 최근 기온에 해당</span>`}<//>`)}</div>
    ${dots.size > 0 && html`<p class="ice-dotnote"><i class="ice-dot" aria-hidden="true"></i> 최근 기온에 해당</p>`}
    <${IceChart} chart=${iceChart(exampleDays(cur), { today: '9999-12-31' })} example />
    <p>${cur.text}</p>
    <h4 class="lbl">숫자의 근거</h4>
    <dl class="facts">${ICE_SOURCES.map((x) => html`<dt key=${'k' + x.id}>${x.k}</dt><dd key=${'v' + x.id}>${x.v}</dd>`)}</dl>
    <${Note}>${ICE_HELP_DAILY_NOTE}<//>
    <${Note}>${ICE_HELP_CLOSING}<//>
  </section>`;
}

const noon = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d ?? ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };

/** place: an ice venue (not the mountain). s: planner state. h: handlers. */
export function IceSheet({ place, s, h }) {
  const [mark, setMark] = useState([]);
  const [help, setHelp] = useState(false);
  const id = wallPageId(place);
  const ctx = s.wallCtx ?? {};
  const base = ctx.date ?? s.today;
  const byId = (x) => [s.ice, s.crags, s.walls].flatMap((l) => l ?? []).find((w) => w && wallPageId(w) === x) ?? null;
  const m = iceSheetModel(place, { date: ctx.date ?? null, today: s.today, wx: s.wx, wxLoaded: s.wxLoaded, byId, at: noon(base), mark });
  const c = m.cond;
  const top = [m.kind, m.region, m.season?.line].filter(Boolean).join(' · ');
  const pick = (dates) => setMark((cur) => (cur.length === dates.length && dates.every((d, i) => cur[i] === d) ? [] : dates));
  const met = c.rows.some((r) => r.dates.length > 0);
  const create = () => { h.replace({ screen: 'home' }); h.onAdd({ place: { kind: 'official', id } }); };
  return html`<${Sheet} key=${'w:' + id} title=${m.name} onClose=${h.back}>
    <div class="wsh">
      ${top && html`<p class="wl-top">${top}</p>`}
      ${m.season?.notice && html`<div class="ice-notice"><${Note}>${m.season.notice.line}${m.season.notice.checked ? ` · ${m.season.notice.checked}` : ''}<//>${m.season.notice.url && html`<${LinkButton} href=${m.season.notice.url} external aria-label=${`${m.season.notice.linkText} (새 창)`}>${m.season.notice.linkText} ↗<//>`}</div>`}
      ${m.season?.past.length > 0 && html`<ul class="ice-past">${m.season.past.map((t, i) => html`<li key=${i}>${t}</li>`)}</ul>`}
      ${m.reserve && html`<section class="rsv" aria-labelledby="is-rsv"><h3 id="is-rsv" class="lbl">예약</h3>
        <p class="rsv-line">${m.reserve.line}</p>
        ${m.reserve.note && html`<${Note} class="rsv-at n">${m.reserve.note}<//>`}
        ${m.reserve.checked && html`<${Note} class="rsv-at n">${m.reserve.checked}<//>`}
        <div class="rsv-acts"><${LinkButton} href=${m.reserve.url} external aria-label=${`${m.reserve.name ?? '예약 사이트'} (새 창)`}>${m.reserve.name ?? '예약 사이트'} ↗<//></div></section>`}
      <section class="ice-facts" aria-labelledby="is-cond">
        <div class="ice-head"><h3 id="is-cond" class="lbl">결빙 조건</h3>
          <${IconButton} name="help" label="결빙 조건 도움말" aria-expanded=${help ? 'true' : 'false'} onClick=${() => setHelp(!help)} /></div>
        ${help && html`<${IceHelp} dots=${c.dots} />`}
        ${c.state === 'ok' && html`<p class="wx n">${c.period}</p>`}
        ${c.state === 'nodata' && html`<p class="wx" role="status">${c.message}</p>`}
        ${(c.state === 'nopos' || c.state === 'loading') && html`<p class="wx" role="status">${c.message}</p>`}
        ${c.state === 'failed' && html`<p class="wx" role="status">${c.message}</p><button type="button" class="btn" onClick=${h.retryWx}>다시 시도</button>`}
        <${IceChart} chart=${c.chart} />
        ${c.state === 'ok' && html`
          ${!met && html`<p class="wx">해당 조건 없음</p>`}
          ${c.rows.length > 0 && html`<ul class="ice-rows">${c.rows.map((r) => html`<li key=${r.id}>${r.dates.length > 0
            ? html`<button type="button" class="ice-row" aria-pressed=${mark.length > 0 && r.dates.every((d, i) => mark[i] === d) && mark.length === r.dates.length ? 'true' : 'false'} onClick=${() => pick(r.dates)}><b>${r.k}</b><span class="n">${r.v}</span>${r.note && html`<small>${r.note}</small>`}${mark.length > 0 && r.dates.every((d, i) => mark[i] === d) && mark.length === r.dates.length && html`<small>그래프에 표시 중</small>`}<${Icon} name="next" /></button>`
            : html`<div class="ice-row"><b>${r.k}</b><span class="n">${r.v}</span></div>`}</li>`)}</ul>`}
          ${c.trendText && html`<p class="wx n"><b>일 최저</b> ${c.trendText}</p>`}
          <p class="wx">${c.closing}</p>`}
      </section>
      ${m.facts.length > 0 && html`<section aria-labelledby="is-fact"><h3 id="is-fact" class="lbl">장소 정보</h3><dl class="facts">${m.facts.map((f) => html`<dt key=${'k' + f.k}>${f.k}</dt><dd key=${'v' + f.k}>${f.v}</dd>`)}</dl></section>`}
      ${!ctx.from && html`<${ButtonRow}><button type="button" class="btn p" onClick=${create}>이 빙벽장으로 일정 잡기</button><//>`}
    </div>
  <//>`;
}
