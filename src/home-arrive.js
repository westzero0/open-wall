// src/home-arrive.js — 홈 '열린 외벽' 줄·지도 카드 첫 줄의 열림 상태 문구. Pure, no DOM.
import { ymd } from './time.js';

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
