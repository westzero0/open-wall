// src/home-arrive.js — 홈 도착 시각 알약의 문구 (docs/superpowers/plans/2026-11-07-home-slider-to-sheet.md 3a). The slider lives in the 외벽 더 찾기 sheet;
// the pill on the 시간표 머리 says what it is set to. Pure, no DOM: at = the picked moment (Date), now = the clock, isNow = a live pick.
import { dayText, fmtMin } from './viewmodel.js';
import { ymd } from './time.js';

/** arriveLabel(at, now, isNow) → '21:00 도착' (live: the next whole hour; 내일 보기 from 23:01) | '09:05 도착' (today: no date, the chip says it) | '11/9(월) 14:00 도착'. */
export function arriveLabel(at, now, isNow) {
  if (isNow) { // 시안 ④: a live pick reads as the next whole hour (the slider's own steps); at 23시 and later there is none to pick, so the pill points to the next day (the 내일 chip)
    const h = now.getHours() + (now.getMinutes() ? 1 : 0);
    return h > 23 ? '내일 보기' : `${fmtMin(h * 60)} 도착`;
  }
  const day = ymd(at) === ymd(now) ? '' : `${dayText(at)} `;
  return `${day}${fmtMin(at.getHours() * 60 + at.getMinutes())} 도착`;
}

/**
 * openStateText(status, at) → the open state in the words of the 홈 '열린 외벽' line's end, also the map card's first line (one source, docs/system/experience.md):
 * '열림 · 22시까지' | '열림' | '14시에 열어요' | '내일 10시에 열어요' | '닫힘'; null when there is nothing to say (no timetable, 임시 휴관: the card's own pill says it).
 * status: hours.js wallStatus; at: the picked moment.
 */
export function openStateText(status, at) {
  if (status?.state === 'open') return status.closeAt ? `열림 · ${new Date(status.closeAt).getHours()}시까지` : '열림';
  if (status?.state !== 'closed' || status.suspended) return null;
  const next = status.nextOpenAt ? new Date(status.nextOpenAt) : null;
  if (!next) return '닫힘';
  const days = Math.round((new Date(ymd(next)) - new Date(ymd(at))) / 864e5);
  return days === 0 ? `${next.getHours()}시에 열어요` : days === 1 ? `내일 ${next.getHours()}시에 열어요` : '닫힘';
}
