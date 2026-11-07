// src/backup.js — 내 정보 › 기록 백업: when the log was last exported, and the one line that says so. No DOM.
// Importing a file is not a backup (the records are already here), so only a successful export is stamped.
import { MAX_TRIPS, cleanTrips, loadTrips, saveTrips } from './trips.js';
import { cleanHidden, loadHidden, saveHidden } from './projects.js';
export const BACKUP_KEY = 'open-wall:backup-at';

/** The saved export time (ms), or 0 when there is none or the value is not a positive whole number. `storage` may be null. */
export function loadBackupAt(storage) {
  try {
    const n = Number(storage.getItem(BACKUP_KEY));
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch { return 0; }
}
export function saveBackupAt(storage, now = Date.now()) {
  try { storage.setItem(BACKUP_KEY, String(now)); return true; } catch { return false; }
}

const dayStart = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

/** backupLine(count, at, now): "기록 12개 · 3일 전 백업" / "· 아직 백업한 적 없어요" / no records: "기록이 아직 없어요." */
export function backupLine(count, at, now = Date.now()) {
  if (!count) return '기록이 아직 없어요.';
  if (!at) return `기록 ${count}개 · 아직 백업한 적 없어요`;
  const days = Math.max(0, Math.round((dayStart(now) - dayStart(at)) / 864e5)); // calendar days; a clock set back reads as today
  return `기록 ${count}개 · ${days === 0 ? '오늘' : days === 1 ? '어제' : `${days}일 전`} 백업`;
}

// ---- 일정·프로젝트 숨김: 기록 백업 파일의 extra 칸에 같이 담는다. 가져온 값은 믿지 않고 cleanTrips/cleanHidden 을 다시 거친다.
export function exportExtra(storage, today) {
  return { trips: loadTrips(storage, today), hidden: loadHidden(storage) };
}
/** restoreExtra(storage, extra, today): 가져온 일정·숨김을 이 기기 것과 합친다(이 기기 것이 먼저; 일정은 id 가 같으면 이 기기 것). */
export function restoreExtra(storage, extra, today) {
  if (!extra || typeof extra !== 'object') return;
  const mine = loadTrips(storage, today);
  const ids = new Set(mine.map((t) => t.id));
  const fresh = cleanTrips(extra.trips, today).filter((t) => !ids.has(t.id)).slice(0, Math.max(0, MAX_TRIPS - mine.length)); // only the free seats: an imported trip never pushes out this device's own
  if (fresh.length) saveTrips(storage, [...mine, ...fresh], today);
  const hidden = loadHidden(storage);
  const more = cleanHidden(extra.hidden);
  if (more.length) saveHidden(storage, [...hidden, ...more]);
}
