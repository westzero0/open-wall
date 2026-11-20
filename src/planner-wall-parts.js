// src/planner-wall-parts.js — the 외벽 page's pieces drawn in Preact with the 외벽 app's own class names (sheet.css): hours grid, seasonal sun,
// fee table, 제원 · 시설, parking, route bars, hourly weather. Numbers come from viewmodel.js / card-model.js / routes.js (no DOM there);
// this file only draws. No fetch, no storage.
import { html, useState } from './planner-ui.js';
import { Note } from './planner-parts.js';
import { Icon } from './planner-icons.js';
import { tightParens } from './dom.js';
import { AXIS_LABELS, DAYPARTS, axisFrac, barSegments, dayBar, dayLine, dayText, fmtMin, formatRanges, groupWeekRows, seasonSun, weeklyHours, winterSpan, NTH_KO } from './viewmodel.js';
import { tagGapMin, estimatePlotPx } from './axis-gap.js';
import { RAIN_MM, hoursAhead } from './weather.js';

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const axisX = (min) => `${axisFrac(min) * 100}%`;
const clipDay = (list) => list.map(([a, b]) => [a, Math.min(b, 1440)]).filter(([a, b]) => axisFrac(b) > axisFrac(a));
const overlapOf = (a, b) => a.flatMap(([s, e]) => b.map(([x, y]) => [Math.max(s, x), Math.min(e, y)])).filter(([s, e]) => e > s);
const capCls = (a, b, open) => `${open.some(([x]) => x === a) ? ' cap-l' : ''}${open.some(([, y]) => y === b) ? ' cap-r' : ''}`;
const hourWord = (m) => (m % 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : String(m / 60));
const Span = ({ cls, a, b }) => html`<span class=${cls} style=${`left:${axisX(a)};width:${(axisFrac(b) - axisFrac(a)) * 100}%`}></span>`;
const BarLabel = ({ a, b, text, endsAtBreak }) => {
  const room = `calc(100% - ${text.length}ch - 6px)`;
  const pos = endsAtBreak ? `right:min(${(1 - axisFrac(b)) * 100}%, ${room})` : `left:min(${axisFrac(a) * 100}%, ${room})`;
  return html`<span class="g-txt" style=${pos}>${text}</span>`;
};
const minuteOf = (d) => d.getHours() * 60 + d.getMinutes();

/** The 06–24 axis; with nowMin the time tag replaces the numbers next to it (as the 외벽 app's gridAxis). */
function Axis({ nowMin = null, plotPx = null }) {
  const scale = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
  const px = plotPx ?? estimatePlotPx(Math.min(window.innerWidth, 720), scale);
  const gap = tagGapMin(px, scale, 8), gapDp = tagGapMin(px, scale, 14);
  return html`<div class="g-axis" aria-hidden="true">
    ${AXIS_LABELS.filter((h) => nowMin == null || Math.abs(h * 60 - nowMin) >= gap).map((h) => html`<span key=${h} class=${h === 6 ? 'first' : h === 24 ? 'last' : null} style=${`left:${axisX(h * 60)}`}>${String(h).padStart(2, '0')}</span>`)}
    ${DAYPARTS.filter((d) => nowMin == null || Math.abs((d.from + d.to) * 30 - nowMin) >= gapDp).map((d) => html`<span key=${d.text} class="dp" style=${`left:${axisX((d.from + d.to) * 30)}`}>${d.text}</span>`)}
    ${nowMin != null && html`<span class="nowtag" style=${`left:${axisX(nowMin)}`}>${fmtMin(nowMin)}</span>`}
  </div>`;
}

/** 요일별 운영시간 (the 외벽 app's hoursGrid, without dragging the axis): 하계/동계 switch, one row per group of days, today's row with the time line and sun. */
export function HoursGrid({ wall, at, closureFull = null, pick, onPick }) {
  const wk = weeklyHours(wall, at, pick);
  if (!wk.rows.length) return null;
  const ws = winterSpan(wall);
  const live = !wk.preview;
  const nowMin = minuteOf(at);
  const bar = live ? dayBar(wall, at) : null;
  const sunOn = bar?.sun ? overlapOf(bar.open, bar.sun) : [];
  const day = live ? dayLine(wall, at) : null;
  const weekRows = groupWeekRows(wk.rows);
  const anyOpen = weekRows.some((r) => !r.closed && r.intervals.length);
  const quiet = anyOpen ? weekRows.filter((r) => r.closed && !r.today && r.key !== 'winter') : [];
  const breaks = [...new Map(wk.rows.flatMap((r) => r.breaks).map((b) => [formatRanges([b]), b])).entries()].sort(([, a], [, b]) => a[0] - b[0]).map(([t]) => t);
  const shutSeason = wk.rows.every((r) => r.key === 'winter');
  const notes = shutSeason ? [] : [
    closureFull ? `${closureFull.k} ${closureFull.v}` : quiet.length ? `휴무 ${quiet.map((r) => r.days).join(' · ')}` : null,
    breaks.length ? `휴게 ${breaks.join(', ')}` : null,
    ...wk.rows.filter((r) => r.nth).map((r) => `${r.nth.map((n) => NTH_KO[n]).join('·')} ${r.days}요일 휴무`),
    wall.holiday === 'weekend' && !closureFull ? '공휴일은 토요일 시간 · 정기휴무 요일과 겹치면 휴무로 표시' : null,
  ].filter(Boolean);
  const susp = wall.suspended;
  const season = (k, label, months) => {
    const shut = k === 'winter' && ws.closed;
    return html`<button key=${k} type="button" aria-pressed=${String(wk.season === k)} class=${shut ? 'shut' : null} aria-label=${`${label} ${months ?? '연중'}${shut ? ' 외벽 휴무' : ''}`} onClick=${() => onPick(k === weeklyHours(wall, at).season ? null : k)}>
      <span class="sw-k">${label}</span>${months && html`<span class="sw-m">${months}</span>`}</button>`;
  };
  return html`<section class="hgrid" aria-label="요일별 운영시간">
    ${wk.hasWinter && ws && html`<div class="g-segrow"><div class="g-seg" role="group" aria-label="계절 운영시간">${season('summer', '하계', ws.summer)}${season('winter', '동계', ws.winter)}</div></div>`}
    ${susp && html`<p class="g-lead susp">임시 휴관 중이라 아래 시간은 재개 후 기준이에요.</p>`}
    ${!susp && (live ? (day.closed && html`<p class="g-lead">${dayText(at)} <b>${day.full ?? day.text}</b></p>`) : html`<p class="g-lead preview">${wk.season === 'winter' ? '동계' : '하계'} 시간표 미리 보기</p>`)}
    <${Axis} nowMin=${live ? nowMin : null} />
    ${live && html`<div class="g-body" role="list"><div class="g-plot" aria-hidden="true">${[9, 12, 15, 18, 21].map((h) => html`<span key=${h} class="gl" style=${`left:${axisX(h * 60)}`}></span>`)}<span class="nowl" style=${`left:${axisX(nowMin)}`}></span></div>${rows()}</div>`}
    ${!live && html`<div class="g-body" role="list"><div class="g-plot" aria-hidden="true">${[9, 12, 15, 18, 21].map((h) => html`<span key=${h} class="gl" style=${`left:${axisX(h * 60)}`}></span>`)}</div>${rows()}</div>`}
    ${notes.length > 0 && html`<ul class="g-notes">${notes.map((n) => html`<li key=${n}>${n}</li>`)}</ul>`}
  </section>`;

  function rows() {
    return weekRows.filter((r) => !(r.key === 'hol' && r.text === '운영 미확인') && !quiet.includes(r)).map((r) => {
      const open = clipDay(r.intervals);
      const shut = Boolean(r.today && day?.closed && open.length);
      let trk;
      if (r.closed) trk = html`<span class="g-closed">${r.text}</span>`;
      else if (!open.length) trk = html`<span class="g-closed none">${r.text}</span>`;
      else {
        const bars = r.today && live ? barSegments(open, nowMin) : open.map(([a, b]) => [a, b, false]);
        const parts = r.text.split(', ');
        const stretches = r.intervals.map(([a, b0], i) => [a, Math.min(b0, 1440), parts[i]]).filter(([a, b, text]) => text && axisFrac(b) > axisFrac(a));
        trk = html`${bars.map(([a, b, past], i, all) => html`<${Span} key=${'b' + i} cls=${`g-bar${past ? ' past' : ''}${all[i + 1]?.[0] === b ? ' j-end' : ''}${all[i - 1]?.[1] === a ? ' j-start' : ''}`} a=${a} b=${b} />`)}
          ${clipDay(r.breaks).map(([a, b], i) => html`<${Span} key=${'k' + i} cls="g-brk" a=${a} b=${b} />`)}
          ${stretches.length > 1 ? html`<span class="g-note">${stretches.map(([a, b]) => `${hourWord(a)}–${hourWord(b)}`).join(' · ')}시</span>`
            : stretches.map(([a, b, text], i) => html`<${BarLabel} key=${'t' + i} a=${a} b=${b} text=${text} endsAtBreak=${i < stretches.length - 1} />`)}`;
      }
      const sunBands = r.today && bar?.sun ? clipDay(sunOn).flatMap(([a, b]) => (nowMin <= a ? [[a, b, false]] : nowMin >= b ? [[a, b, true]] : [[a, nowMin, true], [nowMin, b, false]])) : [];
      const said = `${r.days}${r.today ? (r.members > 1 ? '(오늘 포함)' : '(오늘)') : ''} ${r.text}${r.breaks.length ? `, 휴게 ${formatRanges(r.breaks)}` : ''}${shut ? `, 오늘은 ${day.text}` : ''}`;
      return html`<div key=${r.key ?? r.days} class=${`g-row${r.today ? ' g-today' : ''}${shut ? ' shut' : ''}`} role="listitem" aria-label=${said}>
        <span class="g-lab" aria-hidden="true">${r.days.replace(/·/g, '·​').replace(/–/g, '–⁠')}</span>
        <span class="g-wrap" aria-hidden="true"><span class="g-trk">${trk}${shut && html`<span class="g-closed">${day.text}</span>`}
          ${sunBands.map(([a, b, past], i) => html`<${Span} key=${'s' + i} cls=${`g-sunon${past ? ' past' : ''}${capCls(a, b, open)}`} a=${a} b=${b} />`)}</span></span></div>`;
    });
  }
}

/** 계절별 양달: 여름 / 봄·가을 / 겨울, each a bar against that season's hours. null without sun math or when every season is shut. */
export function SeasonSun({ wall, at, pick, hasGrid, noSun }) {
  if (noSun) return null;
  const sel = weeklyHours(wall, at, pick).season;
  const all = seasonSun(wall, at);
  const rows = all.some((r) => r.winter === (sel === 'winter')) ? all.filter((r) => r.winter === (sel === 'winter')) : all;
  if (rows.every((s) => s.shut)) return null;
  const line = (s) => {
    const open = s.open.length > 0;
    const shown = open ? s.on : s.windows;
    const sunText = s.closed ? '휴무' : shown.length ? formatRanges(shown).replaceAll(', ', ' · ') : open ? '운영 중 양달 없음' : '하루 종일 응달';
    return { sunText, hint: s.closed ? '' : s.unknown ? ' · 시간 미입력' : '', open };
  };
  return html`<section class="ssun" aria-label=${`계절마다 양달인 시간, ${DAY_KO[at.getDay()]}요일 운영시간 기준`}>
    ${hasGrid ? html`<h4 class="ssun-h">계절별 양달</h4>` : html`<${Axis} />`}
    ${rows.map((s) => {
      const { sunText, hint, open } = line(s);
      const openClip = clipDay(s.open);
      const on = clipDay(s.on);
      return html`<div key=${s.name} class=${`s-row${s.current ? ' cur' : ''}`} aria-hidden="true">
        <span class="g-lab"><b>${s.name}</b>${s.current && html`<small>지금</small>`}</span>
        <div class="s-main"><span class="g-trk">${openClip.map(([a, b], i) => html`<${Span} key=${'o' + i} cls="g-bar" a=${a} b=${b} />`)}${on.map(([a, b], i) => html`<${Span} key=${'n' + i} cls=${`g-sunon${capCls(a, b, openClip)}`} a=${a} b=${b} />`)}
          ${open && s.on.length ? on.map(([a, b], i, arr) => html`<${BarLabel} key=${'l' + i} a=${a} b=${b} text=${formatRanges([[a, b]])} endsAtBreak=${i < arr.length - 1} />`) : html`<span class="g-note">${sunText}${hint}</span>`}</span></div></div>`;
    })}
    <ul class="vh" aria-label="계절별 양달 시간, 운영 중 예상">${rows.map((s) => { const { sunText, hint } = line(s); return html`<li key=${s.name} class=${s.current ? 'cur' : null}>${s.name} ${sunText}${hint}</li>`; })}</ul>
    ${!hasGrid && html`<p class="ws-chk end">벽 방향·지형으로 계산한 예상이에요. 건물·나무·구름·오버행은 반영하지 않아요.</p>`}
  </section>`;
}

/** The one legend of the 운영시간 part (the hours bars and the seasonal bars share it). */
export function TimeLegend({ sun, hatch }) {
  return html`<ul class="g-key ws-legend"><li><i class="k-bar"></i>운영</li>${sun && html`<li><i class="k-sunon"></i>운영 중 양달 구간</li>`}${hatch && html`<li><i class="k-hatch"></i>휴게·휴무</li>`}</ul>`;
}

/** A section card (.ws-sec): title row + body. */
export const Card = ({ title, empty, sec, children }) => html`<section class=${`ws-sec${empty ? ' empty' : ''}`} aria-label=${title} data-sec=${sec}>${title && html`<div class="ws-sec-h"><h3>${title}</h3></div>`}${children}</section>`;

/** An empty part's dotted invitation. ask = vnode (the 알려 주기 button) or null. */
export const Empty = ({ title, sub, ask }) => html`<div class="ws-empty"><p>${title}</p><p class="ws-empty-sub">${sub}</p>${ask}</div>`;

/** The 요금 part: fees = plan-wall.js wallFees() → the fee table (rows from card-model.js feeTable) or the free / unsure line. */
export function FeeTable({ fees }) {
  const { table: t, free, until, unsure } = fees;
  const line = (free || unsure) && html`<p class="f-free"><b>${unsure ? '요금 확인 필요' : '무료'}</b>${until && html`<span class="f-note"> · ${until}까지</span>`}</p>`;
  if (!t) return html`<section class="fees" aria-label="요금">${line}</section>`;
  const span = t.wide ? 3 : 2;
  const val = (r, text, attrs) => (r.times
    ? html`<td ...${attrs} class=${`${attrs.class} f-times`}>${text.split(' · ').map((p) => html`<span>${p.split(' ').flatMap((w, i) => [i ? ' ' : '', ...w.split(/(?<=~)/).map((h) => html`<span class="f-nb">${h}</span>`)])}</span>`)}</td>`
    : html`<td ...${attrs}>${text}</td>`);
  const rows = [];
  t.items.forEach((it, k) => {
    if (it.noteOnly) { rows.push(html`<tr key=${'n' + k}><th scope="row">${it.item}</th><td colspan=${span} class="f-note">${tightParens(it.note)}</td></tr>`); return; }
    const head = it.groupCols ? 1 : 0;
    let first = true;
    const start = () => { if (!first) return null; first = false; return html`<th scope="rowgroup" rowspan=${head + it.rows.length}>${it.item}</th>`; };
    if (it.groupCols) rows.push(html`<tr key=${'g' + k} class="f-sub">${start()}<td class="f-who"></td>${it.groupCols.map((g) => html`<th scope="col" class="f-gh">${g}</th>`)}</tr>`);
    it.rows.forEach((r, j) => {
      const who = r.group ? html`<td class="f-who"><div class="f-pg"><span class=${r.dup ? 'f-dup' : 'f-w'}>${r.who}</span><span>${r.group}</span></div></td>` : html`<td class="f-who">${r.who}</td>`;
      const cells = r.cells ? r.cells.map((c) => html`<td class="f-won">${c}</td>`)
        : r.all !== undefined ? val(r, r.all, t.wide ? { colspan: '2', class: 'f-all' } : { class: 'f-won' })
        : [val(r, r.weekday, { class: 'f-won' }), val(r, r.weekend, { class: 'f-won' })];
      rows.push(html`<tr key=${`r${k}-${j}`}>${start()}${who}${cells}</tr>`);
    });
    if (it.note) rows.push(html`<tr key=${'t' + k}><td colspan=${span + 1} class="f-note">${tightParens(it.note)}</td></tr>`);
  });
  return html`<section class="fees" aria-label="요금">${line}
    <table><thead><tr><th>구분</th><th>대상</th>${t.wide ? (t.split ? html`<th>평일</th><th>휴일</th>` : html`<th colspan="2">요금</th>`) : html`<th>요금</th>`}</tr></thead><tbody>${rows}</tbody></table>
    ${t.discount && html`<p class="f-disc">${t.discount}</p>`}</section>`;
}

/** 외벽 제원 · 시설 (the 외벽 app's specsList; the blanks are one 알려 주기 row, `ask`, not a fill form per blank). */
export function SpecsList({ m, ask }) {
  const row = (k, v, note) => html`<li key=${k + v}><span class="mk" aria-hidden=${k ? null : 'true'}>${k}</span><span class="mv">${tightParens(v)}${note && html`<small class="sp-note">${note}</small>`}</span></li>`;
  const env = m.facilityRest.filter((l) => l.group === '이용환경');
  const rest = m.facilityRest.filter((l) => l.group !== '이용환경');
  const free = rest.filter((l) => !l.label);
  const rows = [
    ...m.specs.map((x) => row(x.k, x.v, x.note)),
    m.facilityFacts.length > 0 && row('벽 구성', m.facilityFacts.join(' · ')),
    m.amenities.length > 0 && row('편의시설', m.amenities.map((l) => l.value).join(' · ')),
    env.length > 0 && row('이용 환경', env.map((l) => l.value).join(' · ')),
    ...rest.filter((l) => l.label).map((l) => row(l.label, l.value)),
    ...free.map((l, i) => row(i ? '' : '안내', l.value)),
  ].filter(Boolean);
  return html`<div class="ws-info">${rows.length > 0 && html`<ul class="memo-list info">${rows}</ul>`}${ask}</div>`;
}

/** 주차 (the 외벽 app's sheetParking): the word and the wall's own lot, the priced table, the rest. */
export function Parking({ m }) {
  const { onsite } = m.parkingWhere;
  const f = m.parkingFees;
  const solo = Boolean(f && f.rows.length === 1 && f.rows[0].own);
  const hasRule = Boolean(solo && (f.rows[0].first || f.rows[0].step));
  const hasNote = Boolean(f && f.rows.some((r) => r.free || r.note));
  const colCount = (solo ? 0 : 1) + (hasRule ? 2 : 0) + 2 + (hasNote ? 1 : 0);
  const NOTE_MAX = 24;
  const table = f && html`<div class="pfee-wrap" role="region" aria-label="주차장별 계산한 요금" tabindex="0"><table class="pfee">
    <caption>${`계산한 주차 요금 · ${f.hours}시간 기준`}</caption>
    <thead><tr>${!solo && html`<th scope="col">주차장</th>`}${hasRule && html`<th scope="col">${f.rows[0].first?.head ?? '최초'}</th><th scope="col">${f.rows[0].step?.head ?? '이후'}</th>`}<th scope="col">${f.hours}시간</th><th scope="col">하루</th>${hasNote && html`<th scope="col" class="pf-note">비고</th>`}</tr></thead>
    <tbody>${f.rows.flatMap((r, i) => {
      const note = [r.free, r.note].filter(Boolean).join(' · ');
      const long = note.length > NOTE_MAX;
      const go = html`<a class="pf-go" href=${`https://map.kakao.com/link/search/${encodeURIComponent(`${m.name} ${r.name}`)}`} target="_blank" rel="noopener noreferrer" aria-label=${`${r.name}${r.walk_min ? ` 도보 ${r.walk_min}분` : ''} 카카오맵에서 길찾기 (새 창)`}><${Icon} name="next" /><span>${r.walk_min ? `도보 ${r.walk_min}분 · 길찾기 ›` : '길찾기 ›'}</span></a>`;
      const cells = r.flat ? html`<td colspan=${colCount - (solo ? 0 : 1)} class="pf-flat">${r.cells.at(-1)}${note && !long && html`<span class="pf-cond"> (${note})</span>`}</td>`
        : html`${hasRule && html`<td>${r.first?.cell ?? '–'}</td><td>${r.step?.cell ?? '–'}</td>`}<td>${r.cells[Math.max(0, f.cols.indexOf(f.hours))]}</td><td>${r.cells.at(-1)}</td>${hasNote && html`<td class="pf-note">${(long ? '' : note) || '–'}</td>`}`;
      return [html`<tr key=${'p' + i} class=${long ? 'pf-has-more' : null}>${!solo && html`<th scope="row">${r.name}${go}</th>`}${cells}</tr>`, long && html`<tr key=${'m' + i} class="pf-more"><td colspan=${colCount}>${note}</td></tr>`];
    })}</tbody></table></div>`;
  const rows = m.parkingMore.filter(({ k }) => !(f && k === '요금')).map(({ k, v }) => html`<p key=${k} class="pnear"><span class="pn-k">${k}</span>${tightParens(v)}</p>`);
  return html`<div><p class="pv"><b class=${`pk-word ${m.parking.tone}`}>${m.parking.word}</b>${onsite.length > 0 && ` · ${onsite.join(' · ')}`}</p>${table}${rows}</div>`;
}

/** 루트 분포 bars (routes.js routeView): a chip per section when the count is by section. */
export function RouteBars({ v, setting }) {
  const [key, setKey] = useState(v.first);
  const x = v.views.find((a) => a.key === key) ?? v.views[0];
  return html`<section class="ws-sec" aria-label="루트"><div class="ws-sec-h"><h3>루트</h3></div>
    ${v.views.length > 1 && html`<div class="rt-chips rt-scroll" role="group" aria-label="벽 고르기">${v.views.map((a) => html`<button key=${a.key} type="button" class="rt-chip" aria-pressed=${String(a.key === x.key)} onClick=${() => setKey(a.key)}>${a.label}</button>`)}</div>`}
    <div class=${`rt-bars${v.stale ? ' stale' : ''}`}><ul class="gy-list">${x.rows.map((r) => html`<li key=${r.label} class=${r.mine ? 'mine' : null}><span class="gy-g">${r.label}</span><span class="gy-trk" aria-hidden="true"><span class="gy-bar" style=${`width:${r.frac * 100}%`}></span></span><span class="gy-n">${String(r.n)}</span></li>`)}</ul></div>
    <p class="rt-total" aria-live="polite">총 ${x.total}개</p>
    ${setting && html`<p class="ws-chk end">${setting}</p>`}<p class="ws-chk end">${v.head}</p></section>`;
}

/** The next hours' temperature and rain (the 외벽 app's .wxb-hrs line). hours = the wall's forecast Map (s.wx.hourly.get(name)). */
export function HourlyLine({ hours, at }) {
  const hrs = hours ? hoursAhead(hours, at, 6) : [];
  if (!hrs.length) return null;
  return html`<ul class="wxb-hrs ws-wx-hrs" aria-label="시간별 기온·강수">${hrs.map((a) => html`<li key=${a.label}><span>${a.label}</span><b>${a.t}°</b>${a.r >= RAIN_MM && html`<small>${a.r < 10 ? Math.round(a.r * 10) / 10 : Math.round(a.r)}mm</small>`}</li>`)}</ul>`;
}

export { Note };
