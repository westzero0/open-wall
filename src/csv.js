import { orderIntervals } from './hours.js';
import { isDateStr } from './store.js';

const DAY_COLS = [['mon', '월'], ['tue', '화'], ['wed', '수'], ['thu', '목'], ['fri', '금'], ['sat', '토'], ['sun', '일']];
const WINTER = { 없음: 'none', 휴장: 'closed', 변경: 'changed' };
const FACINGS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const PARKING_KO = { 무료: 'free', 유료: 'paid', 없음: 'none', 모름: 'unknown' };
const PARKING_LABEL = Object.fromEntries(Object.entries(PARKING_KO).map(([ko, en]) => [en, ko]));
const VENUE_KO = { 실외: 'outdoor', 실내: 'indoor', 실내외: 'both' };
const VENUE_LABEL = Object.fromEntries(Object.entries(VENUE_KO).map(([ko, en]) => [en, ko]));

export const CSV_HEADERS = [
  '이름', '지역', '높이', '태그', '메모', '확인일',
  ...DAY_COLS.map(([, label]) => label),
  '동절기', '동절시작월', '동절끝월', '동절시간', '동절실내안내',
  '임시휴장일', '우천규칙', '전화', '인스타', '네이버지도', '공지사이트', '방향', '위도', '경도', '주차', '주차메모',
  '구분', // added last; an older CSV without it still imports (empty = keep the stored value / outdoor)
  '공휴일', '격주휴무', // same: absent or empty keeps the stored rule (keepGeo)
];
const HOLIDAY_KO = { 주말: 'weekend', 휴무: 'closed', 평일: 'weekday' };
const HOLIDAY_LABEL = Object.fromEntries(Object.entries(HOLIDAY_KO).map(([ko, en]) => [en, ko]));
const DAY_KO_KEY = Object.fromEntries(DAY_COLS.map(([k, ko]) => [ko, k]));

// '일 2,4; 토 1' → [{ day: 'sun', nth: [2, 4] }, { day: 'sat', nth: [1] }]
function nthList(s) {
  return list(s).map((item) => {
    const m = item.match(/^([월화수목금토일])\s*([1-5](?:\s*,\s*[1-5])*)$/);
    if (!m) throw new Error(`격주휴무 형식 오류: ${item} (예: 일 2,4)`);
    return { day: DAY_KO_KEY[m[1]], nth: m[2].split(',').map(Number) };
  });
}
const nthText = (rules) => (rules ?? []).map((r) => `${DAY_COLS.find(([k]) => k === r.day)[1]} ${r.nth.join(',')}`).join('; ');

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

// '' -> undefined (not entered), '휴무' -> null, 'H:MM-HH:MM' -> [open, close],
// 'a-b; c-d' -> [[a, b], [c, d]] (break times)
function interval(t) {
  const m = t.match(/^(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})$/);
  if (!m) throw new Error(`시간 형식 오류: ${t}`);
  const times = [m[1].padStart(5, '0'), m[2].padStart(5, '0')];
  for (const x of times) {
    const [h, min] = x.split(':').map(Number);
    if (min > 59 || h > 24 || (h === 24 && min !== 0)) throw new Error(`시간 형식 오류: ${t}`);
  }
  return times;
}

function range(s) {
  const t = (s ?? '').trim();
  if (!t) return undefined;
  if (t === '휴무') return null;
  const parts = t.split(';').map((x) => x.trim());
  const times = parts.map(interval);
  if (times.length === 1) return times[0];
  const ordered = orderIntervals(times);
  // out of order is also an error (not silently sorted)
  if (!ordered || ordered.some((p, i) => p !== times[i])) {
    throw new Error(`시간 구간이 겹치거나 순서가 맞지 않아요: ${t}`);
  }
  return ordered;
}

const list = (s) => (s ? s.split(';').map((x) => x.trim()).filter(Boolean) : []);
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined));
const num = (s) => (s === '' ? undefined : Number(s));

// The one winter time of a wall whose non-closed winter days all share it; undefined when they differ.
function uniformWinterTime(hours) {
  const vals = Object.values(hours ?? {}).filter(Boolean);
  return vals.length && vals.every((v) => JSON.stringify(v) === JSON.stringify(vals[0])) ? vals[0] : undefined;
}

// opts.prevWinterHours(name): the stored per-day winter hours, kept when the row has no single winter time.
export function csvToWalls(rows, opts = {}) {
  const [header = [], ...body] = rows;
  const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const walls = [];
  const errors = [];

  body.forEach((r, n) => {
    const get = (k) => (r[col[k]] ?? '').trim();
    try {
      if (!get('이름')) throw new Error('이름이 비어 있어요');

      const hours = {};
      for (const [key, label] of DAY_COLS) {
        const v = range(get(label));
        if (v !== undefined) hours[key] = v;
      }

      // The CSV format carries ONE winter time, applied to every day that is not closed in normal hours.
      const wlabel = get('동절기');
      if (wlabel && !Object.hasOwn(WINTER, wlabel)) throw new Error('동절기는 없음/휴장/변경 중 하나여야 해요');
      const winter = { type: WINTER[wlabel] ?? 'none' };
      if (winter.type !== 'none') {
        if (!get('동절시작월') || !get('동절끝월')) throw new Error('동절기 시작월·끝월이 필요해요');
        winter.from_month = Number(get('동절시작월'));
        winter.to_month = Number(get('동절끝월'));
        for (const m of [winter.from_month, winter.to_month]) {
          if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error('동절기 월은 1~12 정수여야 해요');
        }
      }
      if (winter.type === 'changed') {
        const t = range(get('동절시간'));
        const prev = t ? undefined : opts.prevWinterHours?.(get('이름'));
        if (!t && !prev) throw new Error('동절기 시간이 필요해요 (요일마다 다른 동절기 시간은 수정 창에서만 유지돼요)');
        // a normally-closed day stays closed in winter
        winter.hours = t ? Object.fromEntries(DAY_COLS.map(([k]) => [k, hours[k] === null ? null : t])) : prev;
      }

      if (get('동절실내안내')) {
        if (winter.type === 'none') throw new Error('동절실내안내는 동절기가 있을 때만 쓸 수 있어요');
        winter.indoor_note = get('동절실내안내');
      }

      const closed_dates = list(get('임시휴장일'));
      const badDate = closed_dates.find((d) => !isDateStr(d));
      if (badDate) throw new Error(`임시휴장일은 YYYY-MM-DD 형식이어야 해요: ${badDate}`);

      const facing = get('방향');
      if (facing && !FACINGS.includes(facing)) throw new Error(`방향 오류: ${facing}`);
      const lat = num(get('위도'));
      const lng = num(get('경도'));
      if ((lat !== undefined && !(Math.abs(lat) <= 90)) || (lng !== undefined && !(Math.abs(lng) <= 180))) {
        throw new Error('위도·경도 범위 오류');
      }
      const height = get('높이') ? Number(get('높이')) : null;
      if (height !== null && !(Number.isFinite(height) && height > 0)) throw new Error('높이는 0보다 큰 숫자여야 해요');

      const pk = get('주차');
      const pkNote = get('주차메모');
      if (pk && !Object.hasOwn(PARKING_KO, pk)) throw new Error('주차는 무료/유료/없음/모름 중 하나여야 해요');
      const parking = pk || pkNote ? compact({ status: pk ? PARKING_KO[pk] : 'unknown', note: pkNote }) : null;
      const venue = get('구분');
      if (venue && !Object.hasOwn(VENUE_KO, venue)) throw new Error('구분은 실외/실내/실내외 중 하나여야 해요');
      const holiday = get('공휴일');
      if (holiday && !Object.hasOwn(HOLIDAY_KO, holiday)) throw new Error('공휴일은 주말/휴무/평일 중 하나여야 해요');
      const nth_closed = nthList(get('격주휴무'));

      walls.push({
        name: get('이름'),
        region: get('지역'),
        height_m: height,
        tags: list(get('태그')),
        memo: get('메모'),
        checked_at: get('확인일') || null,
        hours,
        winter,
        exceptions: { closed_dates, rain_rule: get('우천규칙').toUpperCase() === 'O', ...(nth_closed.length ? { nth_closed } : {}) },
        contact: compact({
          phone: get('전화'), instagram: get('인스타'), naver_map: get('네이버지도'), notice_url: get('공지사이트'),
        }),
        sun: compact({ facing, lat, lng }),
        ...(parking ? { parking } : {}),
        ...(venue ? { venue: VENUE_KO[venue] } : {}),
        ...(holiday ? { holiday: HOLIDAY_KO[holiday] } : {}),
      });
    } catch (e) {
      errors.push(`행 ${n + 2}: ${e.message}`);
    }
  });
  return { walls, errors };
}

const fmt = (v) => (v === undefined ? '' : v === null ? '휴무' : (typeof v[0] === 'string' ? [v] : v).map(([a, b]) => `${a}-${b}`).join('; '));

export function wallToRow(w) {
  // One winter time is written only when every open winter day shares it; per-day times stay in the stored wall.
  const h = w.hours ?? {};
  const win = w.winter ?? { type: 'none' };
  const winterTime = win.type === 'changed' ? uniformWinterTime(win.hours) : undefined;
  const o = {
    이름: w.name, 지역: w.region ?? '', 높이: w.height_m ?? '', 태그: (w.tags ?? []).join(';'),
    메모: w.memo ?? '', 확인일: w.checked_at ?? '',
    ...Object.fromEntries(DAY_COLS.map(([k, label]) => [label, fmt(h[k])])),
    동절기: Object.keys(WINTER).find((label) => WINTER[label] === win.type) ?? '없음',
    동절시작월: win.from_month ?? '', 동절끝월: win.to_month ?? '', 동절시간: fmt(winterTime),
    동절실내안내: win.indoor_note ?? '',
    임시휴장일: (w.exceptions?.closed_dates ?? []).join(';'),
    우천규칙: w.exceptions?.rain_rule ? 'O' : '',
    전화: w.contact?.phone ?? '', 인스타: w.contact?.instagram ?? '',
    네이버지도: w.contact?.naver_map ?? '', 공지사이트: w.contact?.notice_url ?? '',
    방향: w.sun?.facing ?? '', 위도: w.sun?.lat ?? '', 경도: w.sun?.lng ?? '',
    주차: w.parking ? PARKING_LABEL[w.parking.status] : '',
    주차메모: w.parking?.note ?? '',
    구분: VENUE_LABEL[w.venue] ?? '',
    공휴일: HOLIDAY_LABEL[w.holiday] ?? '',
    격주휴무: nthText(w.exceptions?.nth_closed),
  };
  return CSV_HEADERS.map((k) => String(o[k]));
}
