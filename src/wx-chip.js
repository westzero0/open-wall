// src/wx-chip.js — which picture the weather chip at the front of a list row wears (no DOM). The app draws it, this decides it.
import { wxKind, skyVeils } from './weather.js';

export const WX_WORD = { rain: '비', snow: '눈', storm: '뇌우', wind: '강풍', cold: '한파', heat: '폭염', cloud: '흐림' };
export const WX_ICON = { rain: 'sky-rain', snow: 'snow', storm: 'sky-storm', wind: 'wind', cold: 'thermo-cold', heat: 'thermo-hot', cloud: 'sky-cloud' };

/**
 * chipOf({ indoor, trusted, h, night, noWet, noWind }) → { pic, warn, word, t, label }
 * word: the warning word (WX_WORD) when warn, else null.
 * h: pickHour result {t, c, g} or null. trusted: forecastTrusted(at, now). pic: 'indoor' | 'none' | 'sun' | 'moon' | 'sky-cloud' | WX_ICON value.
 * warn: a weather worth a warning colour. t: rounded temperature, NaN when the chip tells none (실내 · 예보 없음).
 * Order: 실내 > no forecast > wxKind (비·눈·뇌우 > 강풍 > 폭염 > 한파) > 흐림 > 맑은 밤 > 맑음.
 */
export function chipOf({ indoor = false, trusted = false, h = null, night = false, noWet = false, noWind = false } = {}) {
  if (indoor) return { pic: 'indoor', warn: false, word: null, t: NaN, label: '실내' };
  if (!trusted || !h) return { pic: 'none', warn: false, word: null, t: NaN, label: '예보 없음' };
  const t = Math.round(h.t);
  const kind = wxKind(h, { noWet, noWind });
  const [pic, warn, word] = kind ? [WX_ICON[kind], true, WX_WORD[kind]]
    : skyVeils(h.c) ? ['sky-cloud', false, WX_WORD.cloud]
    : [night ? 'moon' : 'sun', false, '맑음'];
  return { pic, warn, word: warn ? word : null, t: Number.isFinite(t) ? t : NaN, label: Number.isFinite(t) ? `${word} · ${t}도` : word };
}

// fcChip(fc): the same chip from a 싱글피치 row's forecast {t, kind} | null (crag-view passes it to the app's sunChip). kind 'cloud' = 흐림, null = 맑음 (no night there).
export function fcChip(fc) {
  if (!fc) return { pic: 'none', warn: false, word: null, t: NaN, label: '예보 없음' };
  const t = Number.isFinite(fc.t) ? Math.round(fc.t) : NaN;
  const word = fc.kind ? WX_WORD[fc.kind] : '맑음';
  const warn = !!fc.kind && fc.kind !== 'cloud';
  return { pic: fc.kind ? WX_ICON[fc.kind] : 'sun', warn, word: warn ? WX_WORD[fc.kind] : null, t, label: Number.isFinite(t) ? `${word} · ${t}도` : word };
}
