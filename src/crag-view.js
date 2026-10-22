// 싱글피치 목록과 펼친 카드를 그린다 (docs/superpowers/specs/2026-10-21-crag-ui-design.md 2절).
// 줄은 외벽 줄과 같은 마크업: 앞 양달 칩(그 시각 양달·응달, 날씨 단계는 li의 part/veil/wet) · 이름·지역 · 오른쪽 컨디션 글자 · ›, 둘째 줄은 그날 해 막대.
// 기온·하늘(해 박스 첫 줄), 장비, 루트 요약, 어프로치(주차 글자·도보 분, 누르면 어프로치 시트)는 펼친 카드에 둔다. 줄에는 거리를 쓰지 않는다(직선거리는 가는 길이 아니라서). 거리순일 때는 목록 띠만 `가까운 순`이라고 말한다.
// 컨디션은 예상일 뿐이라 단정하는 말은 쓰지 않고, 고지 문구는 crag-model.js의 것을 그대로 쓴다.
// 안쪽은 외벽 클래스(.l1·.rname·.bar·.sunband…)를 쓰지만 li·머리 버튼에는 .row/.row-btn/.rows를 붙이지 않는다(외벽 JS가 그것을 잡는다;
// style.css는 :is(.row, .crag-row)로 넓혀 같이 칠한다). DOM은 el()과 텍스트 노드만 쓴다.
import { el } from './dom.js';
import { cragCard, cragModel, COND_HINT_NO_DRY, COND_NOTE, FAR_NOTE, GEAR_BASIS } from './crag-model.js';
import { approachModel } from './crag-approach.js';
import { routeSummary, routeLineText } from './crag-grades.js';
import { forecastTrusted, skyKind } from './weather.js';

const FIT_WORD = { ok: '내 로프로 충분해요', short: '내 로프로는 모자라요' };
const SUN_WORD = { sun: '양달', shade: '응달', night: '해 진 시각', unknown: '방향 모름' };
const SUN_PIC = { sun: 'sun', shade: 'shade', night: 'shade', unknown: 'unknown' };
const p2 = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const minOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const mdOf = (key) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;
const pct = (x) => `${x * 100}%`;

const pic = (icon, name, fallback = null) => (icon ? icon(name) : fallback); // icon: app.js's icon(), absent in DOM-less use

// 최근 며칠의 강수: 지난 RAIN_PAST일 + 오늘 + 예보 RAIN_AHEAD일(8칸)을 막대로, 숫자는 aria-label로 읽힌다 (예보 날은 윤곽만).
// 날씨는 지난 7일 + 예보 7일을 받아 두고(컨디션 판정이 쓴다) 막대만 이 범위로 줄인다: 마르는 데 걸리는 날이 대개 5일 안이고, 사흘 뒤 예보는 믿기 어렵다.
const RAIN_PAST = 5;
const RAIN_AHEAD = 2;
const dayKey = (now, delta) => keyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta));
function rainBars(days, now) {
  if (!days || !days.size) return null;
  const today = keyOf(now);
  const from = dayKey(now, -RAIN_PAST);
  const to = dayKey(now, RAIN_AHEAD);
  const keys = [...days.keys()].filter((k) => k >= from && k <= to).sort();
  if (!keys.length) return null;
  const top = Math.max(10, ...keys.map((k) => days.get(k).mm)); // 10 mm가 막대 한 칸 가득, 더 많으면 그 날이 기준
  const wet = keys.filter((k) => days.get(k).mm > 0);
  const label = wet.length ? `일별 강수: ${wet.map((k) => `${mdOf(k)} ${Math.round(days.get(k).mm)}mm`).join(', ')}` : `지난 ${RAIN_PAST}일과 예보에 강수가 없어요`;
  const bars = keys.map((k) => {
    const b = el('span', { class: `crag-rain-day${k >= today ? ' is-fc' : ''}${k === today ? ' is-today' : ''}`, 'aria-hidden': 'true' });
    b.style.setProperty('--h', `${Math.max(days.get(k).mm > 0 ? 8 : 2, Math.round((days.get(k).mm / top) * 100))}%`);
    return b;
  });
  return el('div', { class: 'crag-rain', role: 'img', 'aria-label': label }, ...bars);
}

// 하루 막대(줄과 카드가 같이 쓴다): 외벽 .bar와 같은 마크업(.sunband 조각 + .tick)이지만 축은 일출~일몰이고 운영 초록이 없다:
// 양달은 .sunband, 응달은 .sunband.shade. 도착 시각에서 조각을 나눠 앞쪽은 .past(외벽 listBar의 sunBands 나누기와 같다).
// sun === 'unknown'이거나 구간이 없으면 null: 부르는 쪽이 '방향 정보 없음'을 쓴다.
export function dayBar(sun, bar, at) {
  if (sun === 'unknown' || !bar.length) return null;
  const from = minOf(bar[0].from);
  const end = minOf(bar.at(-1).to);
  const span = Math.max(1, end - from);
  const label = `해가 드는 시간 ${bar[0].from}~${bar.at(-1).to} · ${bar.map((s) => `${s.from}~${s.to} ${s.lit ? '양달' : '응달'}`).join(', ')}`;
  const now = at.getHours() * 60 + at.getMinutes();
  const segs = bar.flatMap((s) => {
    const a = minOf(s.from), b = minOf(s.to);
    return (now <= a ? [[a, b, false]] : now >= b ? [[a, b, true]] : [[a, now, true], [now, b, false]]).map(([x, y, past]) => {
      const e = el('span', { class: `sunband${s.lit ? '' : ' shade'}${past ? ' past' : ''}${x === from ? ' cap-l' : ''}${y === end ? ' cap-r' : ''}` });
      e.style.left = pct((x - from) / span);
      e.style.width = pct((y - x) / span);
      return e;
    });
  });
  const tick = now >= from && now <= end ? el('span', { class: 'tick' }) : null;
  if (tick) tick.style.left = pct((now - from) / span);
  return el('span', { class: 'bar', role: 'img', 'aria-label': label }, ...segs, tick);
}

// 해 박스: deps.sunBox(app.js의 외벽 해 박스를 크랙에 쓴 것; 장면·머리·날씨 첫 줄). 외벽 해 박스처럼 안에 하루 막대는 없다(막대는 줄 머리에 하나).
// deps.sunBox가 없으면(DOM 없는 테스트) 해 박스 없음
const sunBox = (c, at, deps) => (deps.sunBox ? deps.sunBox(c, at) : []);

// 날씨는 줄(li)의 클래스로 단다(외벽 .row와 같은 이름이라 외벽의 칩 규칙이 그대로 칠한다): 구름 조금 = part, 흐림·안개 = veil(양달 칩에만 구름),
// 비·눈·뇌우 = wet(우산). 예보가 없으면 없음.
// 이슬비(51–57, 어는 이슬비 포함)는 비가 아니라 흐림(veil)으로 본다: 0.2mm 이슬비에 우산 배지를 달지 않는다
export function skyClass(code) {
  const k = skyKind(code).kind;
  if (k === 'clear') return null;
  if (k === 'partly') return 'part';
  return k === 'cloud' || k === 'fog' || (code >= 51 && code <= 57) ? 'veil' : 'wet';
}
// 카드 해 박스 첫 줄의 하늘 말과 비 여부(app.js cragWxBox): 줄 배지와 같은 판정(skyClass)이라 이슬비는 비가 아니고 말도 '이슬비'
export const cragSky = (code) => ({ text: code >= 51 && code <= 57 ? '이슬비' : skyKind(code).text, rain: skyClass(code) === 'wet' });
const skyOf = (wx, at, now) => (wx && Number.isFinite(wx.c) && forecastTrusted(at, now) ? skyClass(wx.c) : null);
const SKY_WORD = { part: '구름 조금', veil: '흐려서 해가 거의 안 나요', wet: '비 예보' };

// 앞 양달 칩: 외벽 sunChip(app.js, deps로 받음)에 { tone, text }를 넘긴다. 하늘 말은 text에 붙인다(칩의 aria-label·title).
// deps가 없으면(DOM 없는 테스트) 같은 마크업을 여기서 만든다.
const sunWord = (sun, sky) => [SUN_WORD[sun] ?? SUN_WORD.unknown, sky && SKY_WORD[sky]].filter(Boolean).join(' · ');
function sunChipOf(sun, text, { sunChip, icon }) {
  const s = { tone: SUN_PIC[sun] ?? 'unknown', text };
  if (sunChip) return sunChip(s, false);
  return el('span', { class: `sunnow ${s.tone} pic`, role: 'img', 'aria-label': s.text, title: s.text }, pic(icon, s.tone));
}

// 칩 줄: 외벽 metaRow의 로프 칩과 같은 마크업, 알려 주기만 한다(개념도·루트는 아래 루트 줄이 연다)
function gearRow(c) {
  const g = c.gear;
  const chips = [g.rope && el('span', { class: 'chip rope' }, g.rope), g.rope && g.ownFit && el('span', { class: `chip rope ${g.ownFit}` }, FIT_WORD[g.ownFit]),
    g.quickdraws && el('span', { class: 'chip rope' }, g.quickdraws)].filter(Boolean);
  return chips.length ? el('p', { class: 'meta-row', title: GEAR_BASIS }, ...chips, el('span', { class: 'sr-only' }, ` (${GEAR_BASIS})`)) : null;
}

// 누르는 .irow(외벽 infoBlock의 주차 줄 마크업): 이름 칸 · 내용 · ›. data-opens: 시트가 닫힐 때 카드가 다시 그려졌으면 포커스가 돌아올 곳
function goRow(mk, kids, opens, onClick, label = null) {
  const b = el('button', { type: 'button', class: 'pv pv-go', 'data-opens': opens, 'aria-label': label },
    el('span', { class: 'pv-t' }, ...kids), el('span', { class: 'pv-arrow', 'aria-hidden': 'true' }, '›'));
  b.addEventListener('click', onClick);
  return el('div', { class: 'irow' }, el('span', { class: 'mk' }, mk), b);
}

// 루트 줄(칩 줄 바로 아래, 누르면 개념도·루트 시트): 루트표가 있으면 등급 요약(내 그레이드가 있으면 내 범위 개수), 개념도만 있으면 장수, 둘 다 없으면 줄 없음
function routeRow(name, topo, mine, onOpenRoutes) {
  const s = routeSummary(topo?.routes, mine);
  const text = s ? routeLineText(s) : topo?.topos?.length ? `개념도 ${topo.topos.length}장` : null;
  return text ? goRow('루트', [text], 'routes', () => onOpenRoutes(name)) : null;
}

// 컨디션 줄: 외벽 .irow의 값 칸(.pv) 안에 값(굵게) · 비 막대 · 보조 글(.pv-sub, 외벽 주차 줄의 주차장 이름처럼): 마르는 시간 말(dry_days 없는 곳)과 예상 고지.
// 비 막대는 값 칸 폭(이름 칸 오른쪽)에 맞춘다. 막대가 있으니 값 칸은 p가 아니라 div
function condRow(c, daily, now) {
  return el('div', { class: 'irow' }, el('span', { class: 'mk' }, '컨디션'),
    el('div', { class: `pv crag-cond-text is-${c.cond.state}` }, c.cond.text,
      rainBars(daily?.get(c.name), now),
      c.cond.why === 'no-dry-days' ? el('span', { class: 'pv-sub' }, COND_HINT_NO_DRY) : null, // 'recent': when the rain fell, not when the rock dries
      el('span', { class: 'pv-sub' }, c.cond.far ? `${COND_NOTE} · ${FAR_NOTE}` : COND_NOTE)));
}

// 주차 줄과 어프로치 줄(외벽 infoBlock의 주차 줄처럼 .irow 두 줄). 둘 다 누르면 어프로치 시트(주차가 첫 정지점; 요금·메모·주차장·길 띠·사진·저장은 시트에 있다).
// 주차 줄: 주차 칩만, 주차 데이터가 없으면 줄 없음. 어프로치 줄: 늘 있다 — 도보 N분, 분을 모르면 조용한 '도보 시간 미상';
// 시트가 없으면(모델 없음) 누르지 않는 줄이고, 자유 글(c.approach)이 있으면 그 아래에 둔다.
const quiet = (text) => el('span', { class: 'crag-quiet' }, text);
function approachRows(c, m, onOpenApproach) {
  const open = () => onOpenApproach(c.name);
  const walk = m?.totalMin > 0 ? `도보 ${m.totalMin}분` : null;
  const park = m?.park.has ? goRow('주차', [el('b', { class: `pk-word ${m.park.tone}` }, m.park.chip)], 'park', open, `주차 ${m.park.chip}, 어프로치 보기`) : null; // the wall's 주차 word (.pk-word good/warn/muted)
  const appr = m ? goRow('어프로치', [walk ?? quiet('도보 시간 미상')], 'approach', open, `어프로치 ${walk ?? '도보 시간 미상'}, 어프로치 보기`)
    : el('div', { class: 'irow' }, el('span', { class: 'mk' }, '어프로치'), el('p', { class: 'pv' }, quiet('도보 시간 미상')));
  return [park, appr, !m && c.approach ? el('p', { class: 'crag-text' }, c.approach) : null];
}

// 근처 외벽 줄(외벽 카드의 근처 장비점 줄 gearRow와 같은 마크업): deps.near(c) → { line, onOpen(opener) } | null(60km 안에 외벽이 없으면 줄 없음).
// 누르면 근처 외벽 시트(app.js; 장비점 시트와 같은 #gear-sheet). 아이콘은 route(산길)
function nearRow(c, { near, icon }) {
  const n = near?.(c);
  if (!n) return null;
  return goRow('근처 외벽', [el('span', { class: 'gear-ic', 'aria-hidden': 'true' }, icon ? icon('route') : null), n.line], 'near', (e) => n.onOpen(e?.currentTarget ?? null));
}

// 사진이 없는(또는 못 받은) 열린 카드의 맨 앞: 외벽 rowDetails의 .ph-hero에서 카메라만 뺀 것. 발에 그날 해(일출–일몰)
const phHero = (c) => el('div', { class: 'ph-hero' }, el('div', { class: 'rhero-cap' }, el('small', {}, c.hero.lead), el('b', {}, c.hero.text)));

// 펼친 카드(외벽 카드 순서: 정보 줄 → 해 박스 → 맨 아래 버튼): (사진 머리 = 줄 머리의 이름·지역) · 아이콘 줄(즐겨찾기·길찾기·공유) · 주의 · 칩 줄 · 루트 줄 ·
// 컨디션 · 비 막대 · 주차 줄 · 어프로치 줄 · 근처 외벽 줄 · 해 박스 · 후기. 다녀왔어요(deps.been이 있을 때만)는 외벽 카드처럼 해 카드(.sc)의 발(.sc-actions > .sc-frame)에,
// 해 카드가 없으면 후기 뒤의 .go-row에 들어간다.
// 후기 머리는 외벽 blogBox의 머리(희노애Rock 후기 · 참고용; 운영시간 말은 크랙에 없어 뺀다). 최대 3개라 '더 보기' 없음: blogBox는 부르지 않고 마크업만 쓴다.
// 2단계: 게시판 탭이 생기면 후기는 그 탭 아래로 옮긴다.
function cardEl(c, at, deps) {
  const { now, daily, routes, mine, onOpenRoutes, onOpenApproach, been, onReport } = deps;
  const sunParts = sunBox(c, at, deps);
  const sunCard = been ? sunParts.find((x) => x.classList?.contains('sc')) : null;
  sunCard?.append(el('div', { class: 'sc-actions' }, el('div', { class: 'sc-frame' }, been(c.name)))); // the wall card's foot (one outlined frame); 암장 정보 자세히 joins it later
  return [
    deps.links?.(c) ?? null,
    c.caution ? el('p', { class: 'crag-caution' }, c.caution) : null,
    gearRow(c),
    routeRow(c.name, routes?.get(c.name), mine, onOpenRoutes),
    condRow(c, daily, now),
    ...approachRows(c, approachModel(c.crag), onOpenApproach),
    nearRow(c, deps),
    ...sunParts,
    c.blog.length ? el('div', { class: 'blog' },
      el('p', { class: 'blog-h' }, el('b', {}, '희노애Rock 후기'), ' 참고용'),
      el('ul', { class: 'blog-list' }, ...c.blog.map((b) => el('li', {}, el('a', { href: b.url, target: '_blank', rel: 'noopener noreferrer' },
        el('span', { class: 'bt' }, b.title), b.date ? el('span', { class: 'bd' }, b.date) : null))))) : null,
    been && !sunCard ? el('div', { class: 'go-row' }, been(c.name)) : null,
    onReport ? reportRow(c.name, onReport) : null,
  ].filter(Boolean);
}

// 정보 수정 요청: the wall card's quiet .help-row link at the card's very end (no 오픈채팅 추가 for a crag); app.js passes onReport only with config.reportEndpoint
function reportRow(name, onReport) {
  const b = el('button', { type: 'button', class: 'help-link' }, '정보 수정 요청');
  b.addEventListener('click', () => onReport(name));
  return el('div', { class: 'help-row' }, b);
}

/**
 * renderCragBoard(host, rows, at, deps) — redraws host (#crag-board) with one row per cragList row.
 * rows: cragList's output. deps: { now, daily, hourly, ropeM, links(card) → Node | null (app.js's linkBar: ♥ · 길찾기 · 공유, the card's icon strip),
 *   sunBox(card, at) → Node[] (app.js's wall sun box on the crag, the weather its first line; optional: no sun box otherwise), openName, onOpen(name | null),
 *   enterName (the row the user just opened: its card plays the wall's .expand opening once; a redraw does not), isNow (the band's 지금 / 이 시각에),
 *   showDistance (the list is sorted by distance: only the band says 가까운 순; a row shows no distance — a straight line is not a way to get there), byMine (the list is sorted by 내 그레이드 루트 수), icon(name) → svg (app.js; optional),
 *   favs: names with a ♥ (the wall's 즐겨찾기 store; the row's .rfav mark), empty: { national, clear } (the wall's empty box buttons: 전국으로 보기 / 조건 지우기),
 *   sunChip({ tone, text }, veiled) → Node (app.js's wall chip; optional, a same-markup fallback otherwise),
 *   onOpenApproach(name), routes: Map name → crag-routes entry, onOpenRoutes(name), mine: 내 그레이드 { from, to } | null (the 루트 row's count),
 *   rowPhoto(card, li, onFail) → Node (app.js's wall rowPhoto; optional, the .ph-hero block otherwise),
 *   been(name) → Node (app.js's beenBtn: 다녀왔어요, the 기록 추가 sheet with this crag fixed; the foot of the sun card (.sc-actions > .sc-frame), or a .go-row when there is no .sc; optional),
 *   near(card) → { line, onOpen(opener) } | null (the 근처 외벽 row after 어프로치; app.js's cragNear: walls within 60 km; optional: no row without it),
 *   onReport(name) (the 정보 수정 요청 link at the card's end opens the report sheet for this crag; optional: no link without it) }.
 * Only the open row gets a card.
 */
export function renderCragBoard(host, rows, at, deps) {
  const { now = new Date(), daily = null, hourly = null, ropeM = 0, openName = null, enterName = null, onOpen = () => {}, showDistance = false, byMine = false, isNow = true, favs = [], empty = {}, icon = null } = deps;
  const cardDeps = { now, daily, links: deps.links ?? null, sunBox: deps.sunBox ?? null, onOpenApproach: deps.onOpenApproach ?? (() => {}), routes: deps.routes ?? null, mine: deps.mine ?? null, onOpenRoutes: deps.onOpenRoutes ?? (() => {}), been: deps.been ?? null, onReport: deps.onReport ?? null, near: deps.near ?? null, icon };
  const items = rows.map((r, i) => {
    const open = r.name === openName;
    const id = `crag-card-${i}`;
    const bar = dayBar(r.sun, cragModel(r.crag, at).bar, at);
    const sky = skyOf(r.wx, at, now); // one weather value: the li class the wall chip rules read
    // the wall row's grammar (.l1 > chip, name, .rsub, .left, ›; then .bar) on crag- outer classes: the wall JS never sees this row
    const sunText = sunWord(r.sun, sky);
    // the row shows the short condition (room for the region at 375px); the long one is an sr-only supplement to the visible text (the wall row's a11yNotes way)
    const long = r.cond.short && r.cond.short !== r.cond.text ? el('span', { class: 'sr-only' }, `, ${r.cond.text}`) : null;
    const head = el('button', { type: 'button', class: 'crag-head', 'aria-expanded': String(open), 'aria-controls': id, 'data-crag': r.name },
      el('span', { class: 'l1' },
        sunChipOf(r.sun, sunText, deps),
        el('span', { class: 'rfav', 'data-favmark': r.name, role: 'img', 'aria-label': '즐겨찾기', hidden: favs.includes(r.name) ? null : '' }, '♥'), // the wall row's mark: app.js syncFavs shows/hides it in place
        el('span', { class: 'rname', title: r.name }, r.name),
        el('span', { class: 'rsub' }, r.region ? el('span', { class: 'rmeta', title: r.region }, r.region) : null),
        el('span', { class: `left is-${r.cond.state}` }, r.cond.short ?? r.cond.text, long),
        el('span', { class: 'row-go', 'aria-hidden': 'true' }, '›')),
      bar ?? el('span', { class: 'crag-nodir' }, '방향 정보 없음'));
    head.addEventListener('click', () => onOpen(open ? null : r.name));
    const card = open ? cragCard(r.crag, at, { now, daily, hourly, ropeM }) : null;
    // the open row wears its photo like the wall row (deps.rowPhoto = app.js rowPhoto, under the head in grid 1/1); no photo → .ph-hero opens the card
    const photo = Boolean(card?.photo && deps.rowPhoto);
    // the wall row's .expand > .expand-in (style.css widens .row.is-open > .expand to the crag row): only the open row has one
    const body = open ? el('div', { class: 'expand-in crag-body' }, photo ? null : phHero(card), ...cardEl(card, at, cardDeps)) : null;
    const li = el('li', { class: `crag-row${open ? ' is-open' : ''}${open && r.name === enterName ? ' enter' : ''}${photo ? ' has-photo' : ''}${sky ? ` ${sky}` : ''}` });
    // the first photo failed: rowPhoto took has-photo and the photo away, the hero block takes its place
    li.append(...(photo ? [deps.rowPhoto(card, li, () => body.prepend(phHero(card)))] : []), head, ...(body ? [el('div', { class: 'expand', id }, body)] : []));
    return li;
  });
  // the wall's group heading (h2.band: what is listed · the order) and its empty box (.empty with the .clear-filters buttons; app.js handles the clicks)
  const order = showDistance ? '가까운 순' : byMine ? '내 그레이드 루트 많은 순' : '컨디션 좋은 순';
  host.replaceChildren(
    el('h2', { class: 'band' }, el('span', {}, `${isNow ? '지금' : '이 시각에'} 볼 수 있는 곳 · ${order}`), el('span', { class: 'count' }, String(items.length))),
    items.length ? el('ul', { class: 'crag-rows' }, ...items) : el('p', { class: 'empty' }, '조건에 맞는 싱글피치가 없어요',
      empty.national ? el('button', { type: 'button', class: 'clear-filters to-national' }, '전국으로 보기') : null,
      empty.clear ? el('button', { type: 'button', class: 'clear-filters' }, '조건 지우기') : null));
}
