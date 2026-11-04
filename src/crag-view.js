// 싱글피치 목록과 펼친 카드를 그린다 (docs/superpowers/specs/2026-10-21-crag-ui-design.md 2절).
// 줄은 외벽 줄과 같은 마크업: 앞 양달 칩(그 시각 양달·응달, 날씨 단계는 li의 part/veil/wet) · 이름·지역 · 오른쪽 컨디션 글자 · ›, 둘째 줄은 그날 해 막대.
// 기온·하늘(해 박스 첫 줄), 장비 칩, 컨디션·루트·주차·어프로치 줄(누르면 암장 시트의 컨디션·루트·가는 길 탭, deps.onOpenSheet)은 펼친 카드에 둔다. 줄에는 거리를 쓰지 않는다(직선거리는 가는 길이 아니라서). 거리순일 때는 목록 띠만 `가까운 순`이라고 말한다.
// 컨디션은 예상일 뿐이라 단정하는 말은 쓰지 않고, 고지 문구는 crag-model.js의 것을 그대로 쓴다.
// 안쪽은 외벽 클래스(.l1·.rname·.bar·.sunband…)를 쓰지만 li·머리 버튼에는 .row/.row-btn/.rows를 붙이지 않는다(외벽 JS가 그것을 잡는다;
// style.css는 :is(.row, .crag-row)로 넓혀 같이 칠한다). DOM은 el()과 텍스트 노드만 쓴다.
import { el } from './dom.js';
import { boardRow, chipBar, dock, gaugeEnds, goRow, infoRow, noticeLine, placeholderHero, remainPill } from './card-parts.js';
import { cragCard, cragModel, COND_HINT_NO_DRY, COND_NOTE, FAR_NOTE, GEAR_BASIS } from './crag-model.js';
import { approachModel } from './crag-approach.js';
import { routeSummary } from './crag-grades.js';
import { forecastTrusted, skyKind, wxKind } from './weather.js';

const SHORT_ROPE = '내 로프로는 모자라요'; // read out with the rope chip when my rope is too short (the chip itself shows the ! icon, as on the wall card)
const SUN_WORD = { sun: '양달', shade: '응달', night: '해 진 시각', unknown: '방향 모름' };
const SUN_PIC = { sun: 'sun', shade: 'shade', night: 'shade', unknown: 'unknown' };
const minOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const pct = (x) => `${x * 100}%`;

const pic = (icon, name, fallback = null) => (icon ? icon(name) : fallback); // icon: app.js's icon(), absent in DOM-less use

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
// fc: {t, kind} (the 외벽 row's forecast on the chip, card-parts wxSet)
function sunChipOf(sun, text, { sunChip, icon }, fc = null) {
  const s = { tone: SUN_PIC[sun] ?? 'unknown', text };
  if (sunChip) return sunChip(s, fc);
  return el('span', { class: `sunnow ${s.tone} pic`, role: 'img', 'aria-label': s.text, title: s.text }, pic(icon, s.tone));
}

// 칩 줄: 외벽 카드의 chipBar(로프·퀵드로 칩 + 내 루트 수). 외벽 칩처럼 누르면 시트가 열린다(to: 개념도·루트 탭; open = onOpenSheet). 열 루트 탭이 없으면 알려 주기만 한다.
// 내 루트 N개: 내 그레이드를 정했고 루트표가 있을 때만(루트 줄의 값과 같은 숫자를 맨 위로 올린 것, 새 데이터 없음).
// 내 로프가 모자랄 때만 로프 칩이 경고색 + ! 아이콘(외벽 카드와 같다), 참고용 말은 칩의 title과 읽어 주는 말에 붙는다.
function gearChips(c, icon, summary = null, open = null, hasRoutes = false) {
  const mineCount = summary?.mineCount ?? null;
  const g = c.gear;
  const short = g.rope && g.ownFit === 'short'; // only a rope too short is told, on the chip: no 'enough' chip (the wall card says nothing then either)
  // 로프 60m · 퀵드로 10개: the rope and the quickdraws in one chip (each said '… 이상' alone; the note keeps that, 참고용); one of them alone keeps its own words
  const rope = /(\d+)m/.exec(g.rope ?? '')?.[1], qd = /(\d+)/.exec(g.quickdraws ?? '')?.[1];
  const gear = rope && qd ? { text: `로프 ${rope}m · 퀵드로 ${qd}개`, icon: short ? 'alert' : 'carabiner' }
    : g.rope ? { text: g.rope, icon: short ? 'alert' : 'route' } : g.quickdraws ? { text: g.quickdraws, icon: 'carabiner' } : null;
  const chips = [
    summary && { kind: 'count', icon: 'route', tone: 'plain', text: `루트 ${summary.total}개`, to: 'routes' }, // 루트 24개: the count that was the 루트 row's value; it opens the 루트 tab
    gear && { kind: 'size', icon: gear.icon, tone: short ? 'warn' : 'plain', text: gear.text, note: [short ? SHORT_ROPE : null, rope && qd ? '로프·퀵드로 모두 이상' : null, GEAR_BASIS].filter(Boolean).join(' · '), to: 'routes' },
    mineCount !== null && { kind: 'mine', tone: 'plain', text: `내 루트 ${mineCount}개`, to: 'routes' },
  ].filter(Boolean).map((chip) => (open && (chip.to !== 'routes' || hasRoutes) ? chip : { ...chip, to: null })); // a chip that opens the 루트 tab needs one (the rope / quickdraws come from the crag's own fields)
  return chipBar(chips, { icon: icon ?? (() => null), pick: (to, b) => open?.(to, b) });
}

// 누르면 암장 시트가 그 탭으로 열리는 줄(외벽 카드의 운영·이용 줄처럼 goRow): open(name, tab, button)
const sheetRow = (c, open, mk, kids, opens, tab, label = null) => goRow(mk, kids, opens, (e) => open(c.name, tab, e?.currentTarget ?? null), label);

// 루트 줄: 루트표가 있으면 줄이 없다(칩 줄의 `루트 N개` 칩이 개수를 말하고 루트 탭을 연다), 개념도만 있으면 장수, 둘 다 없으면 '아직 몰라요 · 알려 주기 ›'(제보 시트; 제보 길이 없으면 줄 없음)
function routeRow(c, topo, summary, open, onReport) {
  if (summary) return null;
  const text = topo?.topos?.length ? `개념도 ${topo.topos.length}장` : null;
  if (text) return sheetRow(c, open, '루트', [text], 'routes', 'routes');
  return onReport ? infoRow('루트', { empty: true }, { opens: 'routes', ask: () => onReport(c.name, '루트·개념도') }) : null;
}

// 컨디션 줄: 값(굵게) + 보조 글(.pv-sub): 마르는 시간 말(dry_days 없는 곳)과 예상 고지. 비 막대·시간별 표는 시트의 컨디션 탭에 있다.
// 젖음 계산(cond.basis 'wetness')이면 근거 한 문장(whyLine)이 상태 바로 아래 보조 글로 들어간다(사용자 결정 2026-11-01: 해 박스가 아니라 컨디션 줄).
function condRow(c, open, why = null) {
  const note = c.cond.far ? `${COND_NOTE} · ${FAR_NOTE}` : COND_NOTE;
  const hint = c.cond.why === 'no-dry-days' ? COND_HINT_NO_DRY : null; // 'recent': when the rain fell, not when the rock dries
  return sheetRow(c, open, '컨디션',
    [el('span', { class: `crag-cond-text is-${c.cond.state}` }, c.cond.text), hint && el('span', { class: 'pv-sub' }, hint), why && el('span', { class: 'pv-sub' }, why), el('span', { class: 'pv-sub' }, note)], 'cond', 'cond',
    `컨디션 ${c.cond.text}. ${[hint, why, note].filter(Boolean).join('. ')}. 자세히 보기`);
}

// 근거 한 문장: 판정을 가장 크게 움직인 항(설계 13절), 첫 줄만. 나머지(일사 미반영 등)는 시트 컨디션 탭에 있다.
export const whyLine = (c) => (c.cond.basis === 'wetness' ? c.cond.evidence?.[0]?.text ?? null : null);

// 가는 길 줄(시트의 가는 길 탭 이름과 같다; 주차 + 걸린 분을 한 줄에): 주차 글자(외벽 주차 줄의 색 글자 .pk-word) · 발자국 아이콘 + N분. 누르면 시트의 가는 길 탭(주차가 첫 정지점;
// 요금·메모·주차장·길 띠·사진·저장은 시트에 있다). 주차 데이터도 걸린 분도 없으면 조용한 '소요 시간 미상', 시트가 없으면(모델 없음) 누르지 않는 줄이고, 자유 글(c.approach)이 있으면 그 아래에 둔다.
const quiet = (text) => el('span', { class: 'crag-quiet' }, text);
function approachRows(c, m, open, icon) {
  const walkMin = m?.totalMin > 0 ? m.totalMin : null;
  const parking = m?.park.has ? el('b', { class: `pk-word ${m.park.tone}` }, m.park.chip) : null; // the wall's 주차 word (.pk-word good/warn/muted)
  const walk = walkMin ? el('span', { class: 'crag-walk' }, icon?.('walk') ?? null, `${walkMin}분`) : null; // footprints + 15분
  const kids = parking && walk ? [el('span', { class: 'crag-way' }, parking, el('span', { 'aria-hidden': 'true' }, '·'), walk)] : [parking ?? walk ?? quiet('소요 시간 미상')];
  const say = `가는 길 ${[parking?.textContent, walkMin ? `걸어서 ${walkMin}분` : null].filter(Boolean).join(', ') || '소요 시간 미상'}, 자세히 보기`;
  const way = m ? sheetRow(c, open, '가는 길', kids, 'way', 'way', say)
    : el('div', { class: 'irow' }, el('span', { class: 'mk' }, '가는 길'), el('p', { class: 'pv' }, quiet('소요 시간 미상')));
  return [way, !m && c.approach ? el('p', { class: 'crag-text' }, c.approach) : null];
}

// 게시판 줄: 게시판 허용 목록에 있으면 외벽 카드의 boardRow, 허용 목록에는 없고 블로그 후기만 있으면 '블로그 후기 N개', 둘 다 없으면 줄 없음
function boardLine(c, open, listed) {
  const blog = c.blog.length ? { posts: c.blog } : null;
  if (listed) return boardRow(null, { name: c.name, open: (b) => open(c.name, 'board', b), blog });
  return blog ? sheetRow(c, open, '게시판', [`블로그 후기 ${blog.posts.length}개`], 'board', 'board') : null;
}

// 근처 외벽 줄(외벽 카드의 근처 장비점 줄 gearRow와 같은 마크업): deps.near(c) → { line, onOpen(opener) } | null(60km 안에 외벽이 없으면 줄 없음).
// 누르면 근처 외벽 시트(app.js; 장비점 시트와 같은 #gear-sheet). 아이콘은 route(산길)
function nearRow(c, { near, icon }) {
  const n = near?.(c);
  if (!n) return null;
  return goRow('근처', [el('span', { class: 'gear-ic', 'aria-hidden': 'true' }, icon ? icon('route') : null), n.line], 'near', (e) => n.onOpen(e?.currentTarget ?? null));
}

// 펼친 카드(외벽 카드 순서: 사진 머리 → dock → 칩·주의 → 정보 줄 → 해 박스 → 맨 아래 링크): 사진 머리는 줄 머리의 이름·지역(♥는 머리, 공유는 사진 모서리)
// · dock(길찾기 · 공유 · 다녀왔어요, 외벽 카드와 같은 부품; 전화는 자연암장에 없다) · 주의 · 칩 줄 · 컨디션 · 루트 · 주차 · 어프로치 · 게시판 · 근처 · 해 박스. 후기 목록은 시트의 게시판 탭에 있다(카드에는 줄 하나).
// 변형: 주의 줄이 칩보다 앞이다(외벽은 칩 다음에 휴무안내). 낙석·출입 주의는 가기 전에 먼저 읽혀야 해서.
function cardEl(c, at, deps) {
  const { routes, mine, onOpenSheet, boardListed, been, onReport } = deps;
  const go = deps.nav?.(c) ?? null; // 길찾기 (app.js navButton; none without a position)
  const visit = been?.(c.name) ?? null;
  const summary = routeSummary(routes?.get(c.name)?.routes, mine); // the route table's count (and 내 그레이드 count), or null
  const approach = approachModel(c.crag);
  return [
    go || visit ? dock(go, visit, null, deps.share?.(c.name) ?? null) : null,
    c.caution ? noticeLine({ tone: 'sure', text: c.caution }, { mk: '주의' }) : null, // a caution is told as plainly as a confirmed closing, under its own word
    gearChips(c, deps.icon, summary, onOpenSheet ? (tab, b) => onOpenSheet(c.name, tab, b) : null, Boolean(routes?.get(c.name)?.routes?.length || routes?.get(c.name)?.topos?.length)),
    condRow(c, onOpenSheet, whyLine(c)),
    routeRow(c, routes?.get(c.name), summary, onOpenSheet, onReport),
    ...approachRows(c, approach, onOpenSheet, deps.icon),
    boardLine(c, onOpenSheet, boardListed?.(c.name) ?? false),
    nearRow(c, deps),
    ...sunBox(c, at, deps),
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
 * rows: cragList's output. deps: { now, daily, hourly, ropeM, fav(name) → Node (app.js favBtn: the ♥ button beside the row head, as on the wall row; optional), share(name) → Node (app.js shareBtn drawn as the dock's square, as on the wall card; optional),
 *   nav(card) → Node | null (app.js navButton on the card's 길찾기 link: the dock's first button; optional),
 *   sunBox(card, at) → Node[] (app.js's wall sun box on the crag, the weather its first line; optional: no sun box otherwise), openName, onOpen(name | null),
 *   enterName (the row the user just opened: its card plays the wall's .expand opening once; a redraw does not), isNow (the band's 지금 / 이 시각에),
 *   showDistance (the list is sorted by distance: only the band says 가까운 순; a row shows no distance — a straight line is not a way to get there), byMine (the list is sorted by 내 그레이드 루트 수), icon(name) → svg (app.js; optional),
 *   empty: { national, clear } (the wall's empty box buttons: 전국으로 보기 / 조건 지우기),
 *   sunChip({ tone, text }, fc: {t, kind} | null) → Node (app.js's wall chip; optional, a same-markup fallback otherwise),
 *   onOpenSheet(name, tab, button) (the 컨디션 · 루트 · 주차 · 어프로치 · 게시판 rows open the crag's sheet on that tab: cond / routes / way / board), boardListed(name) (the crag is on the board's allowed list: its 게시판 row is the wall's 한 줄 row; else only 블로그 후기 N개, or no row),
 *   routes: Map name → crag-routes entry, mine: 내 그레이드 { from, to } | null (the 루트 row's count),
 *   rowPhoto(card, li, onFail) → Node (app.js's wall rowPhoto; optional, the .ph-hero block otherwise),
 *   camera(name) → Node | null (app.js's cameraBtn, the first photo's button on the .ph-hero block; optional: no camera without it),
 *   been(name) → Node (app.js's beenBtn: 다녀왔어요, the 기록 추가 sheet with this crag fixed; the dock's second button (with 길찾기 first); optional),
 *   near(card) → { line, onOpen(opener) } | null (the 근처 외벽 row after 게시판; app.js's cragNear: walls within 60 km; optional: no row without it),
 *   onReport(name, kind?) (the 정보 수정 요청 link at the card's end, and the 루트 row with nothing to show, open the report sheet for this crag; optional: no link without it) }.
 * Only the open row gets a card.
 */
export function renderCragBoard(host, rows, at, deps) {
  const { now = new Date(), daily = null, hourly = null, wet = null, ropeM = 0, openName = null, enterName = null, onOpen = () => {}, showDistance = false, byMine = false, isNow = true, empty = {}, icon = null } = deps;
  const cardDeps = { now, daily, nav: deps.nav ?? null, share: deps.share ?? null, sunBox: deps.sunBox ?? null, onOpenSheet: deps.onOpenSheet ?? (() => {}), boardListed: deps.boardListed ?? null, routes: deps.routes ?? null, mine: deps.mine ?? null, been: deps.been ?? null, onReport: deps.onReport ?? null, near: deps.near ?? null, icon };
  const items = rows.map((r, i) => {
    const open = r.name === openName;
    const id = `crag-card-${i}`;
    const segs = cragModel(r.crag, at).bar;
    const bar = dayBar(r.sun, segs, at);
    const ends = bar ? gaugeEnds({ open: [[minOf(segs[0].from), minOf(segs.at(-1).to)]], nowMin: at.getHours() * 60 + at.getMinutes() }, [minOf(segs[0].from), minOf(segs.at(-1).to)]) : null; // sunrise and sunset under the bar's ends (shown once the card is open, like the wall's)
    const heart = deps.fav?.(r.name) ?? null;
    heart?.classList.add('row-fav'); // the wall row's ♥ button, over the room .rfav-gap leaves
    const phHero = (c) => placeholderHero({ ...c, hoursOnGauge: Boolean(ends) }, deps.camera?.(r.name) ?? null, null); // the wall card's hero block with its camera (share is in the dock); the sun window is under the bar once it has ends, so the block does not say it twice
    const sky = skyOf(r.wx, at, now); // one weather value: the li class the wall chip rules read
    // the wall row's grammar (.l1 > chip, name, .rsub, .left, ›; then .bar) on crag- outer classes: the wall JS never sees this row
    const trusted = Boolean(r.wx) && Number.isFinite(r.wx.t) && forecastTrusted(at, now);
    const fc = trusted ? { t: Math.round(r.wx.t), kind: wxKind({ t: r.wx.t, c: sky === 'wet' ? r.wx.c : NaN }) ?? (sky === 'veil' && r.sun === 'sun' ? 'cloud' : null) } : null; // 이슬비 is a 흐림 here, not a rain badge (skyClass)
    const sunText = sunWord(r.sun, fc?.kind ? null : sky); // the chip's weather word is the label's own
    // the row's pill carries both wordings (the wall's remainPill): the short one on a narrow screen (room for the region at 375px), the long one wide; the long one is always read
    const head = el('button', { type: 'button', class: 'crag-head', 'aria-expanded': String(open), 'aria-controls': id, 'data-crag': r.name },
      el('span', { class: 'l1' },
        sunChipOf(r.sun, sunText, deps, fc),
        el('span', { class: 'rfav-gap', 'aria-hidden': 'true' }), // the room for the ♥ that sits over it (a button of its own: it cannot live inside the row's button)
        el('span', { class: 'rname', title: r.name }, r.name),
        el('span', { class: 'rsub' }, r.region ? el('span', { class: 'rmeta', title: r.region }, r.region) : null),
        el('span', { class: `left is-${r.cond.state}` }, remainPill({ short: r.cond.short ?? r.cond.text, long: r.cond.text })), // the wall's pill: the short wording on a narrow screen, the long one wide (both read aloud as the wall's do)
        el('span', { class: 'row-go', 'aria-hidden': 'true' }, '›')),
      bar ?? el('span', { class: 'crag-nodir' }, '방향 정보 없음'), ends);
    head.addEventListener('click', () => onOpen(open ? null : r.name));
    const card = open ? cragCard(r.crag, at, { now, daily, hourly, wet, ropeM }) : null;
    // the open row wears its photo like the wall row (deps.rowPhoto = app.js rowPhoto, under the head in grid 1/1); no photo → .ph-hero opens the card
    const photo = Boolean(card?.photo && deps.rowPhoto);
    // the wall row's .expand > .expand-in (style.css widens .row.is-open > .expand to the crag row): only the open row has one
    const body = open ? el('div', { class: 'expand-in crag-body' }, photo ? null : phHero(card), ...cardEl(card, at, cardDeps)) : null;
    const li = el('li', { class: `crag-row${open ? ' is-open' : ''}${open && r.name === enterName ? ' enter' : ''}${photo ? ' has-photo' : ''}${sky ? ` ${sky}` : ''}` });
    li.wallName = r.name; // src/wall-sheet.js finds the row to give the focus back to when its sheet closes
    // the first photo failed: rowPhoto took has-photo and the photo away, the hero block takes its place
    li.append(...(photo ? [deps.rowPhoto(card, li, () => body.prepend(phHero(card)))] : []), head, ...(heart ? [heart] : []), ...(body ? [el('div', { class: 'expand', id }, body)] : []));
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

/**
 * appendPendingRows(host, pending) — '검토 중' 제보 줄(crag-submit-rows.js pendingRows)을 싱글피치 목록 끝에 붙인다. 줄 문법은 위 줄과 같고(.l1 · 이름 · .left 알약),
 * 해·날씨·컨디션 줄은 없다. 누르면 시트 없이 안내 한 줄만 펼친다.
 */
export function appendPendingRows(host, pending) {
  if (!pending.length) return;
  let ul = host.querySelector('ul.crag-rows');
  if (!ul) { ul = el('ul', { class: 'crag-rows' }); host.append(ul); } // the empty box and its buttons stay above
  for (const p of pending) {
    const note = el('span', { class: 'crag-nodir' }, p.note); // added on tap, removed on the next (display:block would beat [hidden])
    const head = el('button', { type: 'button', class: 'crag-head', 'aria-expanded': 'false' },
      el('span', { class: 'l1' },
        el('span', { class: 'rname', title: p.name }, p.name),
        el('span', { class: 'left is-unknown' }, remainPill({ short: p.short, long: p.chip }))),
      el('span', { class: 'crag-nodir' }, p.sunLabel ? `${p.sun} · ${p.sunLabel}` : p.sun));
    head.addEventListener('click', () => { const open = !note.isConnected; if (open) head.append(note); else note.remove(); head.setAttribute('aria-expanded', String(open)); });
    ul.append(el('li', { class: 'crag-row crag-pending' }, head));
  }
}
