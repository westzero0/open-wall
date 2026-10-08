// src/view-state.js — what the list screen shows right now, apart from the saved filters (ui-state.js): the picked
// moment and whether it follows the clock (live), the one open row and its folded parts, the minute tick's skip rule,
// the position and the note under the list. Memory only, never saved. No DOM and no clock of its own: `now` comes in
// with each event. app.js keeps one state object, sends events through `step`, runs the follow-ups and draws.
import { ymd } from './time.js';
import { fmtMin, isLivePick, sliderValue } from './viewmodel.js';

const minuteOf = (d) => d.getHours() * 60 + d.getMinutes();

// The open row and everything that belongs to it: the 더 보기 fold, the 안내 overflow, the 운영시간/계절별 양달 tab,
// and a season previewed in the hours grid (wall name → 'summer'/'winter'). Opening, closing or losing a row resets all.
const CLOSED = Object.freeze({ openName: null, openState: null, moreOpen: false, infoOpen: false, moreTab: 0, season: Object.freeze({}) });

// date ('YYYY-MM-DD', '' when the input was cleared) and min (slider minutes) are the picked moment; read only while not live.
export const initialView = () => ({ live: true, date: '', min: 0, ...CLOSED, origin: null, locateNote: '' });

// The open row is kept across a re-render only while a row of that wall is still shown in the same group.
export const keepOpenRow = (rows, name, state) => rows.some((r) => r.wall.name === name && r.status.state === state);

// The live minute tick skips a re-render that would pull something from under the user: not live, a hidden
// page, the map card's "자세히" open, or focus on a control the re-render can't give back (map card, 조건 지우기).
export const skipTick = ({ live, hidden, detailsOpen, focusHeld }) => !live || hidden || detailsOpen || focusHeld;

/**
 * clockView(vs, now) → {date, min, at}: what the date input and the slider show, and the moment the list is drawn for.
 * Live: today and the real minute (the slider rests at its end before 06:00 / after 23:30, `at` keeps the real time).
 * Picked: the inputs as they were left; `at` is an Invalid Date when the date was cleared.
 */
export function clockView(vs, now) {
  if (!vs.live) return { date: vs.date, min: vs.min, at: new Date(`${vs.date}T${fmtMin(vs.min)}`) };
  const at = new Date(now);
  at.setSeconds(0, 0);
  return { date: ymd(now), min: sliderValue(minuteOf(now)), at };
}

const pick = (vs, date, min, now) => ({ vs: { ...vs, date, min, live: isLivePick(date, min, now) }, fx: ['render'] });

/**
 * step(vs, event, now) → {vs, fx}: the next state and the follow-ups, in order, for app.js to run.
 * fx: 'render' (draw the list), 'crowd' (read the 혼잡도 CSV if due), 'sortDistance' (save 가까운 순),
 * 'setUser' (put the position on the map). Unknown events throw.
 *
 * Events:
 *   pick {date, min}        the date input or the slider moved; live again only on the clock's own day and 10-minute step
 *   moment {date: Date, min} jump to a moment (이번 주말 추천, 같이 가요 link): same as picking it on the inputs
 *   now                     지금으로
 *   tick {hidden, detailsOpen, focusHeld}  the minute tick / page shown again: fx is empty when it is skipped
 *   toggle {name, state}    a row button: opens that row (closing any other) or closes it when it is the open one
 *   reveal {name, state}    open a row from elsewhere (share link, map card, 내 암장, 기록)
 *   shown {rows}            the rows just built for drawing: the open row is forgotten once it is filtered out or
 *                           has moved to another group (open → closed at a later time)
 *   more {open}, info, tab {n}, season {name, pick, current}  the open row's folded parts
 *   sort                    the sort changed by hand: the old location note goes
 *   located {origin, sort}  a position came in; sort: asked by 가까운 순 / 내 위치 (else the 기록 sheet asked)
 *   locateFailed {why, sort} no position; only the list's own request shows `why` under the list
 */
export function step(vs, ev, now) {
  switch (ev.type) {
    case 'pick': return pick(vs, ev.date, ev.min, now);
    case 'moment': return pick(vs, ymd(ev.date), sliderValue(ev.min), now);
    case 'now': return { vs: { ...vs, live: true }, fx: ['render'] };
    case 'tick': return { vs, fx: skipTick({ live: vs.live, ...ev }) ? [] : ['crowd', 'render'] };
    case 'toggle': return { vs: { ...vs, ...CLOSED, ...(vs.openName === ev.name ? {} : { openName: ev.name, openState: ev.state }) }, fx: [] };
    case 'reveal': return { vs: { ...vs, ...CLOSED, openName: ev.name, openState: ev.state }, fx: ['render'] };
    case 'shown': return { vs: !vs.openName || keepOpenRow(ev.rows, vs.openName, vs.openState) ? vs : { ...vs, ...CLOSED }, fx: [] };
    case 'more': return { vs: { ...vs, moreOpen: ev.open }, fx: [] };
    case 'info': return { vs: { ...vs, infoOpen: !vs.infoOpen }, fx: [] };
    case 'tab': return { vs: { ...vs, moreTab: ev.n }, fx: [] };
    case 'season': { // tapping the picked day's own season ends the preview
      const season = { ...vs.season };
      if (ev.pick === ev.current) delete season[ev.name];
      else season[ev.name] = ev.pick;
      return { vs: { ...vs, season }, fx: [] };
    }
    case 'sort': return { vs: { ...vs, locateNote: '' }, fx: [] };
    case 'located': return ev.sort
      ? { vs: { ...vs, origin: ev.origin, locateNote: '내 위치를 기준으로 가까운 순으로 정렬했어요. 직선거리예요.' }, fx: ['sortDistance', 'render', 'setUser'] }
      : { vs: { ...vs, origin: ev.origin }, fx: ['render', 'setUser'] };
    case 'locateFailed': return ev.sort ? { vs: { ...vs, locateNote: ev.why }, fx: ['render'] } : { vs, fx: [] };
    default: throw new Error(`view-state: unknown event ${ev.type}`);
  }
}
