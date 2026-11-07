// src/home-arrive.js — 홈 도착 시각 알약의 문구 (docs/superpowers/plans/2026-11-07-home-slider-to-sheet.md 3a). The slider lives in the 외벽 더 찾기 sheet;
// the pill on the 시간표 머리 says what it is set to. Pure, no DOM: at = the picked moment (Date), now = the clock, isNow = a live pick.
import { dayText, fmtMin } from './viewmodel.js';
import { ymd } from './time.js';

/** arriveLabel(at, now, isNow) → '오늘 21:00 도착' (live: the next whole hour; 내일 보기 from 23:01) | '오늘 09:05 도착' | '11/9(월) 14:00 도착'. */
export function arriveLabel(at, now, isNow) {
  if (isNow) { // 시안 ④: a live pick reads as the next whole hour (the slider's own steps); at 23시 and later there is none to pick, so the pill points to the next day (the 내일 chip)
    const h = now.getHours() + (now.getMinutes() ? 1 : 0);
    return h > 23 ? '내일 보기' : `오늘 ${fmtMin(h * 60)} 도착`;
  }
  const day = ymd(at) === ymd(now) ? '오늘' : dayText(at);
  return `${day} ${fmtMin(at.getHours() * 60 + at.getMinutes())} 도착`;
}
