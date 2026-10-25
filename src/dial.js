// Sun compass model (no DOM): the view of someone standing in front of the wall, wall = up.
import { isSunlit, sunPosition } from './sun.js';
import { horizonAt } from './shadow.js';
import { fmtMin, formatRanges, sunIntervals } from './viewmodel.js';

const FACING = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const DIR8 = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
const REL8 = ['앞쪽(벽 너머)', '오른쪽 앞', '오른쪽', '오른쪽 뒤', '바로 뒤', '왼쪽 뒤', '왼쪽', '왼쪽 앞'];
const WHY = { facing: '벽 뒤쪽으로 넘어가요', terrain: '산에 가려져요', night: '해가 너무 낮아요' };
const SEOUL = { lat: 37.5665, lng: 126.978 }; // same fallback as isSunlit
const mod = (a) => ((a % 360) + 360) % 360;
const step8 = (a) => Math.round(mod(a) / 45) % 8;

export const relName = (rel) => REL8[step8(rel)];
export const dirName = (az) => DIR8[step8(az)];

const dayAt = (at, min) => new Date(at.getFullYear(), at.getMonth(), at.getDate(), 0, Math.min(Math.max(min, 0), 1439));

const windowsOf = sunIntervals;

function sentenceOf(lit, sp, isNow) {
  const b = (text) => ({ text, bold: true });
  const t = (text) => ({ text });
  if (lit.reason === 'indoor') return [t('실내암벽이라 양달·응달이 없어요.')];
  if (lit.lit === null) return [t('벽 방향을 몰라서 양달·응달을 계산할 수 없어요.')];
  if (lit.reason === 'override') return [t('직접 입력한 시간 기준으로 '), b(lit.lit ? '양달' : '응달'), t('이에요.')];
  if (!sp || sp.altitude <= 0) return [t(`${isNow ? '지금은' : '이 시각에는'} 해가 지평선 아래에 있어요. 응달이에요.`)];
  // one short line: why, then the word (where the sun is stands in the picture; no degrees)
  switch (lit.reason) {
    case 'sun': return [t('해가 등 뒤에서 벽을 비춰요. '), b('양달'), t('이에요.')];
    case 'facing': return [t('해가 벽 뒤쪽이라 '), b('응달'), t('이에요.')];
    case 'terrain': return [t('해가 낮아서 '), b('산'), t('에 가려져요. '), b('응달'), t('이에요.')];
    case 'night': return [t('해가 낮아서 '), b('응달'), t('이에요.')];
    default: return [];
  }
}

/**
 * sunHeadOf(d, verdict, at, isNow) → the sun card's top line as plain data: { chip, tone, key }.
 * chip "19:00 현재 응달" (a picked time: "19:00 기준 응달"); tone lit | dark | na; key (null when there is nothing to say):
 * { k, ranges } = a label and the sunny ranges ("운영 중 양달" 10:10–17:30), or { text } = one short line ("하루 종일 응달").
 * verdict: sunVerdict() of the open day (sun only inside the open hours), null for a day with no hours.
 */
export function sunHeadOf(d, verdict, at, isNow) {
  if (d.state === 'unknown') return { chip: '계산 불가', tone: 'na', key: null };
  const day = d.dayLabel === '오늘' ? '' : `${d.dayLabel} `;
  const time = fmtMin(at.getHours() * 60 + at.getMinutes());
  const key = verdict
    ? (verdict.on.length ? { k: `${day}운영 중 양달`, ranges: verdict.on.map((w) => formatRanges([w])) } : { text: `${day}${verdict.text}` })
    : d.windows.length ? { k: `${day}양달`, ranges: d.windows.map((w) => formatRanges([w])) } : { text: `${day}하루 종일 응달` };
  return { chip: `${time} ${isNow ? '현재' : '기준'} ${d.lit ? '양달' : '응달'}`, tone: d.lit ? 'lit' : 'dark', key };
}

// pick: { isNow, dayLabel } describes the picked moment for wording ('지금/오늘' only when it really is).
export function dialModel(wall, at, { isNow = true, dayLabel = '오늘' } = {}) {
  const lit = isSunlit(wall, at);
  const facing = FACING[wall.sun?.facing] ?? null;
  const ahead = facing === null ? null : mod(facing + 180);
  const relOf = (az) => mod(az - (ahead ?? 0));
  const pos = (p) => ({ rel: relOf(p.azimuth), radius: 1 - p.altitude / 90 });
  const lat = wall.sun?.lat ?? SEOUL.lat;
  const lng = wall.sun?.lng ?? SEOUL.lng;
  const sp = lit.lit === null ? null : sunPosition(at, lat, lng);
  const up = sp && sp.altitude > 0;

  const path = [];
  if (sp) for (let m = 300; m <= 1260; m += 20) { const p = sunPosition(dayAt(at, m), lat, lng); if (p.altitude > 0) path.push(pos(p)); }
  const hills = wall.shadow && lit.lit !== null && lit.reason !== 'override' ? Array.from({ length: 72 }, (_, i) => ({ rel: relOf(i * 5), radius: 1 - horizonAt(wall.shadow, i * 5) / 90 })) : null;

  const known = lit.lit !== null;
  const windows = known ? windowsOf(wall, at) : [];
  const why = { before: '응달이에요', after: '응달이에요' };
  if (windows.length) {
    const reasonAt = (m) => WHY[isSunlit(wall, dayAt(at, m)).reason];
    why.before = reasonAt(windows[0][0] - 10) ?? why.before;
    why.after = reasonAt(windows[windows.length - 1][1] + 10) ?? why.after;
  }

  const state = !known ? 'unknown' : lit.reason;
  return {
    state,
    lit: lit.lit,
    facing,
    ahead,
    sun: up ? { ...pos(sp), altitude: sp.altitude, azimuth: sp.azimuth } : null,
    path,
    hills,
    horizonAtSun: up && wall.shadow ? horizonAt(wall.shadow, sp.azimuth) : null,
    windows,
    why,
    dayLabel,
    sentence: sentenceOf(lit, sp, isNow),
  };
}

export { seasonWindows } from './viewmodel.js';
