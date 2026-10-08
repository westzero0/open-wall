// 이벤트 랭킹 (beta-board): count the reports the owner approved per nickname, and read the published file back.
// Pure logic, no DOM. data/contributors.json is public and the app treats it as untrusted input (parseContributors).
import { isDateStr } from './store.js';
import { cleanNick } from './report.js';

// What the ranking counts: approved (beta-review), not a 임시휴무 (time-boxed, not a gap filled), and a nickname given.
// Lives here, not in admin-logic.js: the public page imports this file and must not reach an admin module.
export const countsForRanking = (r) => !!r && r.review === 'approved' && r.kind !== '임시휴무' && typeof r.nick === 'string' && r.nick !== '';

export const MAX_ROWS = 200;
export const MAX_COUNT = 9999;

const byCountThenName = (a, b) => b.count - a.count || a.nick.localeCompare(b.nick, 'ko');

// reports: parseReports items with `review` merged in. -> [{ nick, count }], most first, ties by name.
export function countContributors(reports) {
  const n = new Map();
  for (const r of reports) if (countsForRanking(r)) n.set(r.nick, (n.get(r.nick) ?? 0) + 1);
  return [...n].map(([nick, count]) => ({ nick, count })).sort(byCountThenName);
}

// Competition ranking: 1, 1, 3. rows must already be sorted by count.
export function withRanks(rows) {
  let rank = 0;
  return rows.map((r, i) => ({ ...r, rank: (rank = i > 0 && r.count === rows[i - 1].count ? rank : i + 1) }));
}

// The file the build tool writes. until: the last day the ranking is shown.
export function buildContributors(reports, { until, today }) {
  if (!isDateStr(until)) throw new Error('until은 YYYY-MM-DD 형식의 실제 날짜여야 해요');
  return { updated: today, until, rows: countContributors(reports) };
}

// The app reads the published file: anything off is dropped row by row, a broken file or an ended event is null.
export function parseContributors(raw, today) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!isDateStr(raw.updated) || !isDateStr(raw.until) || !Array.isArray(raw.rows) || raw.rows.length > MAX_ROWS) return null;
  if (today > raw.until) return null;
  const seen = new Set();
  const rows = [];
  for (const r of raw.rows) {
    if (!r || typeof r !== 'object' || typeof r.nick !== 'string') continue;
    if (!r.nick || cleanNick(r.nick) !== r.nick || seen.has(r.nick)) continue; // the nickname must survive the form's own cleaning unchanged
    if (!Number.isInteger(r.count) || r.count < 1 || r.count > MAX_COUNT) continue;
    seen.add(r.nick);
    rows.push({ nick: r.nick, count: r.count });
  }
  return { updated: raw.updated, until: raw.until, rows: withRanks(rows.sort(byCountThenName)) };
}
