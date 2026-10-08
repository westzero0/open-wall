// Sun compass model (no DOM): the view of someone standing in front of the wall, wall = up.
import { isSunlit, sunPosition } from './sun.js';
import { horizonAt } from './shadow.js';
import { sunIntervals } from './viewmodel.js';

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

function sentenceOf(lit, sp, rel, wall, isNow) {
  const b = (text) => ({ text, bold: true });
  const t = (text) => ({ text });
  if (lit.reason === 'indoor') return [t('실내암벽이라 양달·응달을 계산하지 않아요.')];
  if (lit.lit === null) return [t('이 암장은 벽이 어느 쪽을 보는지 몰라서 양달인지 응달인지 계산할 수 없어요.')];
  if (lit.reason === 'override') return [t('직접 입력한 시간 기준으로 '), b(lit.lit ? '양달' : '응달'), t('이에요.')];
  if (!sp || sp.altitude <= 0) return [t(`${isNow ? '지금은' : '이 시각에는'} 해가 지평선 아래에 있어요. 응달이에요.`)];
  const head = [t('벽을 마주 보고 서면 해는 '), b(relName(rel)), t(` 하늘에 있어요(${dirName(sp.azimuth)}쪽).`)];
  // plain words only: no degrees in the sentence (the picture shows the height)
  switch (lit.reason) {
    case 'sun': return [...head, t(' 해가 등 뒤쪽에서 벽을 비추니 '), b('양달'), t('이에요.')];
    case 'facing': return [...head, t(' 해가 벽 뒤쪽이라 벽은 '), b('응달'), t('이에요.')];
    case 'terrain': return [...head, t(' 그런데 해가 낮아서 그쪽 '), b('산'), t('에 가려져요. '), b('응달'), t('이에요.')];
    case 'night': return [...head, t(' 해가 낮아서 '), b('응달'), t('이에요.')];
    default: return [];
  }
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
    sentence: sentenceOf(lit, sp, up ? relOf(sp.azimuth) : 0, wall, isNow),
  };
}

export { seasonWindows } from './viewmodel.js';
