// src/plan-places.js — rows for the 암장 tab (walls + natural crags lists). No DOM.
import { searchPicks, shortName } from './viewmodel.js';
import { openLabel } from './plan-wall.js';
import { cragRow } from './crag-model.js';
import { wallPageId } from './share-id.js';

export const COND_ORDER = { good: 0, drying: 1, recent: 1, rain: 2, wet: 2, frozen: 2, out: 3, unknown: 4 };
const byName = (a, b) => a.name.localeCompare(b.name, 'ko');

/** '그 시간 열림' → '지금 열림', '그 시간 닫힘' → '지금 닫힘'; the rest as is. */
export const wallOpenWord = (label) => (label === '그 시간 열림' ? '지금 열림' : label === '그 시간 닫힘' ? '지금 닫힘' : label);

const SHUT = /닫힘|쉼|휴관/;
const NO_HOURS = '운영시간 정보 없음';
const REST = '그 밖';
/** Group headings per list: [heading, ranks it holds]; the order is the display order. 정보 없음 = COND_SHORT.unknown in crag-model.js (not exported). */
export const WALL_GROUPS = [['지금 열림', [0]], [REST, [1, 2]], [NO_HOURS, [3]]];
export const CRAG_GROUPS = [['좋아 보여요', [0]], [REST, [1, 2]], ['정보 없음', [3, 4]]];
/** groupRows(rows, groups) → [{ label, rows }] in table order, empty groups left out (rows are already sorted by rank). */
export const groupRows = (rows, groups) => groups.map(([label, ranks]) => ({ label, rows: rows.filter((r) => ranks.includes(r.rank)) })).filter((g) => g.rows.length);
/** The row's own words under its heading: '' when its heading already says it ('그 밖' rows never match, so they keep the full reason). */
export const leadWord = (r, word, groups) => (groups.find(([, ranks]) => ranks.includes(r.rank))?.[0] === word ? '' : word);
const openRank = (open) => (open === '지금 열림' ? 0 : open === '지금 닫힘' ? 1 : SHUT.test(open) ? 2 : 3); // closed now before closed that day; unknown last

/** min must be a finite minute of the day (null min gives '그날 HH:MM~…', which ranks as unknown). wallRows(walls, {date, min, q}) → [{id, name, region, open, shut, rank}]: open first, closed next, unknown hours last; 가나다 within. */
export function wallRows(walls, { date, min, q = '' } = {}) {
  return searchPicks(walls, q)
    .map(({ wall: w }) => {
      const open = wallOpenWord(openLabel(w, date, min)) || NO_HOURS;
      return { id: wallPageId(w), name: shortName(w), region: w.region ?? '', open, shut: SHUT.test(open), rank: openRank(open) };
    })
    .sort((a, b) => a.rank - b.rank || byName(a, b));
}

/** cragRows(crags, wx, {at, now, q}) (q: case-insensitive substring of name/region; empty = all) → [{id, name, region, typeLabel, short, text, state, rank}]; wx = {daily, hourly, wet} or null. */
export function cragRows(crags, wx, { at, now, q = '' } = {}) {
  const k = q.trim().toLowerCase();
  return crags
    .map((c) => {
      const r = cragRow(c, at, { now, ...(wx ?? {}) });
      return { id: wallPageId(c), name: r.name, region: r.region, typeLabel: r.typeLabel, short: r.cond.short, text: r.cond.text, state: r.cond.state, rank: COND_ORDER[r.cond.state] ?? 4 };
    })
    .filter((r) => !k || `${r.name} ${r.region}`.toLowerCase().includes(k))
    .sort((a, b) => a.rank - b.rank || byName(a, b));
}
