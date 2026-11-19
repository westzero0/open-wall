// src/plan-places.js — rows for the 암장 tab (walls + natural crags lists). No DOM.
import { searchPicks, shortName } from './viewmodel.js';
import { openLabel } from './plan-wall.js';
import { cragRow } from './crag-model.js';
import { wallPageId } from './share-id.js';

export const COND_ORDER = { good: 0, drying: 1, recent: 1, rain: 2, out: 3, unknown: 4 };
const byName = (a, b) => a.name.localeCompare(b.name, 'ko');

/** '그 시간 열림' → '지금 열림', '그 시간 닫힘' → '지금 닫힘'; the rest as is. */
export const wallOpenWord = (label) => (label === '그 시간 열림' ? '지금 열림' : label === '그 시간 닫힘' ? '지금 닫힘' : label);

const SHUT = /닫힘|쉼|휴관/;
const NO_HOURS = '운영시간 정보 없음';
const openRank = (open) => (open === '지금 열림' ? 0 : open === '지금 닫힘' ? 1 : SHUT.test(open) ? 2 : 3); // closed now before closed that day; unknown last

/** min must be a finite minute of the day (null min gives '그날 HH:MM~…', which ranks as unknown). wallRows(walls, {date, min, q}) → [{id, name, region, open, shut}]: open first, closed next, unknown hours last; 가나다 within. */
export function wallRows(walls, { date, min, q = '' } = {}) {
  return searchPicks(walls, q)
    .map(({ wall: w }) => {
      const open = wallOpenWord(openLabel(w, date, min)) || NO_HOURS;
      return { id: wallPageId(w), name: shortName(w), region: w.region ?? '', open, shut: SHUT.test(open) };
    })
    .sort((a, b) => openRank(a.open) - openRank(b.open) || byName(a, b));
}

/** cragRows(crags, wx, {at, now}) → [{id, name, region, typeLabel, short, text, state}]; wx = {daily, hourly, wet} or null. */
export function cragRows(crags, wx, { at, now } = {}) {
  return crags
    .map((c) => {
      const r = cragRow(c, at, { now, ...(wx ?? {}) });
      return { id: wallPageId(c), name: r.name, region: r.region, typeLabel: r.typeLabel, short: r.cond.short, text: r.cond.text, state: r.cond.state };
    })
    .sort((a, b) => (COND_ORDER[a.state] ?? 4) - (COND_ORDER[b.state] ?? 4) || byName(a, b));
}
