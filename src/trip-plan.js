// src/trip-plan.js — 일정 카드의 날씨 머리 (시안 home-v3 ①⑧, docs/superpowers/plans/2026-11-07-home-align-new-home.md): the headline sentence and the two weather cells
// (the trip's first day and the day after). Pure: the forecast is the place's parseDaily day Map. A day with no forecast is "예보 없음", never "no rain". No DOM.
import { dayParts } from './log.js';
import { dayKey, dayWeather } from './weather.js';

const NO_FC_NOTE = '가까워지면 이 카드에 보여요.'; // D-7+ (시안 new-home2 ②: 날씨 칸 없이 한 줄)
const next = (date) => { const [y, m, d] = date.split('-').map(Number); return dayKey(new Date(y, m - 1, d + 1)); };
const md = (date) => { const p = dayParts(date); return `${p.dow} ${p.month}/${p.day}`; };

function cell(date, f) {
  const wx = dayWeather(f);
  const t = Number.isFinite(f?.tmax) ? `${Math.round(f.tmax)}°` : null;
  if (!f) return { day: md(date), text: '예보 없음', glyph: 'calendar', known: false, rain: false };
  const word = wx.rain ? (f.p !== null && f.p >= 50 ? `비 ${Math.round(f.p)}%` : `비 ${Math.round(f.mm)}mm`) : '비 예보 없음';
  return { day: md(date), text: [word, t].filter(Boolean).join(' · '), glyph: wx.rain ? 'sky-rain' : 'sun', known: true, rain: wx.rain };
}

/** planHead(from, forecast) → { headline, cells: [first day, next day], note } for an outdoor trip starting on `from` ('YYYY-MM-DD'); forecast: Map day → { mm, p, g, tmax? } or undefined. */
export function planHead(from, forecast) {
  const days = [from, next(from)];
  const cells = days.map((d) => cell(d, forecast?.get(d)));
  const [a, b] = cells;
  const dow = days.map((d) => dayParts(d).dow);
  if (!a.known) return { headline: '날씨는 6일 앞까지만 나와요', cells: [], note: NO_FC_NOTE }; // 예보가 없는 날은 칸 없이(맑다고 말하지 않는다)
  const headline = false ? ''
    : a.rain && b.known && !b.rain ? `${dow[0]}요일은 비, ${dow[1]}요일은 비 소식이 없어요`
    : a.rain && b.rain ? `${dow[0]}·${dow[1]}요일 모두 비 예보예요`
    : a.rain ? `${dow[0]}요일은 비 예보가 있어요`
    : `${dow[0]}요일은 비 소식이 없어요`;
  return { headline, cells, note: a.known ? null : NO_FC_NOTE };
}
