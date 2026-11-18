// src/ice-model.js — an ice venue's season lines: last seasons' opening days, this season's status and opening notice. DOM 없음, 저장소 없음.
// Spec: docs/superpowers/specs/2026-11-16-ice-venues.md §4. 문구는 이 파일에서만 만든다. 모르는 칸은 말하지 않는다(공지가 "없다"고 말하지도 않는다).
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The season (the year whose January the winter reaches) a date falls in: July on counts for next year. '2026-11-16' → 2027, '2026-01-13' → 2026. null for a bad date. */
export function seasonOf(dateStr) {
  const m = DATE_RE.exec(dateStr ?? '');
  return m ? +m[1] + (+m[2] >= 7 ? 1 : 0) : null;
}

const md = (s) => { const m = DATE_RE.exec(s ?? ''); return m ? `${+m[2]}월 ${+m[3]}일` : ''; };
const STATUS_TEXT = { open: '운영', not_open: '미개장', suspended: '운영 중지' };

/** '2026 시즌' */
export const seasonLabel = (season) => `${season} 시즌`;

/** One line for a season row: '1월 13일 개장' / '운영' / '미개장' / '운영 중지'. */
export function statusLine(row) {
  if (row.status === 'open' && row.opened) return `${md(row.opened)} 개장`;
  return STATUS_TEXT[row.status] ?? '';
}

const rowOf = (place, season) => (place?.ice_seasons ?? []).find((r) => r.season === season) ?? null;

/**
 * iceSeasonRows(place, today, byId) → { current, past }
 * current: the row of seasonOf(today) or null; past: earlier seasons' rows, latest first. A row is
 * { season, label, status, text, opened, noticeUrl, noticeOn, note }. A waterfall (parentId) takes opened_on and the notice of the
 * same season from its mountain when its own row lacks them (one level up); status is never inherited — each waterfall is open or not on its own.
 * A season the place has no row for, but its mountain has, shows only if the place has a row of its own (a mountain's season says nothing about a venue that never listed it).
 */
export function iceSeasonRows(place, today, byId) {
  const parent = place?.parentId && typeof byId === 'function' ? byId(place.parentId) : null;
  const up = parent && parent !== place ? parent : null;
  const rows = (place?.ice_seasons ?? []).map((r) => {
    const p = up ? rowOf(up, r.season) : null;
    const row = {
      season: r.season, label: seasonLabel(r.season), status: r.status,
      opened: r.opened_on ?? (r.status === 'open' ? p?.opened_on : null) ?? null,
      noticeUrl: r.notice_url ?? p?.notice_url ?? null,
      noticeOn: r.notice_url ? r.notice_on ?? null : p?.notice_url ? p.notice_on ?? null : null,
      note: r.note ?? null,
    };
    return { ...row, text: statusLine(row) };
  });
  const now = seasonOf(today);
  return { current: rows.find((r) => r.season === now) ?? null, past: rows.filter((r) => now === null || r.season < now).sort((a, b) => b.season - a.season) };
}

/** '2026 시즌 · 1월 13일 개장' — a past season's line. */
export const pastLine = (row) => `${row.label} · ${row.text}`;

/** → { line, linkText, checked } for this season's opening notice, or null when there is none (nothing is said then). */
export function noticeCopy(row) {
  if (!row?.noticeUrl) return null;
  return { line: '올해 개장 공지가 올라왔어요', linkText: '공지 원문', url: row.noticeUrl, checked: row.noticeOn ? `${md(row.noticeOn)}에 확인한 내용이에요` : null };
}
