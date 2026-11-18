// src/season.js — which place kinds are in season on a plan's date (계획판 제안 10: 분류별 기본 기간 표 + 수동 스위치). DOM 없음.
// The date is the plan's own 'YYYY-MM-DD' (browser-local calendar day); only its month-day is compared, so no time zone math.
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const KINDS = ['wall', 'crag', 'ice']; // 외벽 · 자연암장 · 빙벽장

// 기본값, 조정 가능. null = 한 해 내내. { from, to }는 'MM-DD'(둘 다 포함), from > to면 해를 넘는 기간.
// 빙벽: 2026년 개장은 1월 3일(호오스테이)~13일(구곡), 설악산 1월 30일. 12월 중순 계획부터 보이게 앞을 넉넉히, 끝은 2월 말(윤년 29일 포함).
export const DEFAULT_SEASONS = {
  wall: null,
  crag: null,
  ice: { from: '12-15', to: '02-29' },
};

const monthDay = (dateStr) => {
  const m = DATE_RE.exec(dateStr ?? '');
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return null;
  return `${m[2]}-${m[3]}`;
};

/** Is `kind` in season on `dateStr`? switches[kind]: 'on' = always, 'off' = never, anything else = the table. A bad date counts as in season. */
export function isActive(kind, dateStr, switches) {
  if (!KINDS.includes(kind)) return false;
  const sw = switches?.[kind];
  if (sw === 'on') return true;
  if (sw === 'off') return false;
  const range = DEFAULT_SEASONS[kind];
  if (!range) return true;
  const d = monthDay(dateStr);
  if (!d) return true;
  return range.from <= range.to ? d >= range.from && d <= range.to : d >= range.from || d <= range.to;
}

/** The kinds in season on `dateStr`, in KINDS order. */
export const activeKinds = (dateStr, switches) => KINDS.filter((k) => isActive(k, dateStr, switches));
