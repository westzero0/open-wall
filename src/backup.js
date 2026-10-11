// src/backup.js — 내 정보 › 기록 백업: when the log was last exported, and the one line that says so. No DOM.
// Importing a file is not a backup (the records are already here), so only a successful export is stamped.
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
