// src/wall-sheet-model.js — what the wall sheet (src/wall-sheet.js) holds: its bottom tabs and the sections of the 시간 and 이용 tabs. No DOM.
// `avail` says which blocks the page could draw for this wall: { hours, fees, sun, board } (board: the one-line board is on, or the wall has reviews).
// 시간 = when (the hours table and, with sun math, the seasonal sun on the same axis); 이용 = what and how (시설, 요금, 주차).

// the report kinds each tab offers, so 정보 제보 lists only what that tab shows (a tab not listed offers all)
export const TAB_KINDS = { time: ['운영시간', '임시휴무', '공지'], use: ['시설', '요금', '주차'], routes: ['세팅일', '루트 분포'], board: ['오픈채팅방', '기타'] };

const TIME = [
  { key: 'hours', title: '운영시간', kind: '운영시간' }, // `kind` is the report form's 종류 the section's 수정 요청 pre-fills
  { key: 'sun', title: '계절별 양달', kind: null, dated: false }, // computed from the wall's direction and terrain: no check date, nothing to report
];
const USE = [
  { key: 'specs', title: '외벽 제원', kind: '시설', dated: false }, // 높이 · 폭 · 권장 로프 · 루트 수 · 난이도 (card-model specs); only with a row
  { key: 'facility', title: '시설', kind: '시설', dated: false }, // the wall's own features (스피드월, 실내 지구력 …) and the memo lines the card face does not show
  { key: 'amenity', title: '편의시설', kind: '시설', dated: false }, // 화장실 · 샤워실 · 휴게실 …
  { key: 'fees', title: '입장 요금', kind: '요금' }, // 입장, so it is not taken for the parking fee below
  { key: 'parking', title: '주차', kind: '주차' },
];

// A long name with no space ("천안시도솔광장인공암벽장") may break where its kind of place begins, never inside a word:
// → [before, after] split ahead of the first of these words, or null (a name with a space, or none of them, keeps keep-all as it is).
const PLACE_WORDS = /인공암벽|스포츠클라이밍|클라이밍|암벽장|암벽/;
export function nameBreak(name) {
  if (/\s/.test(name)) return null;
  const i = name.search(PLACE_WORDS);
  return i > 0 ? [name.slice(0, i), name.slice(i)] : null;
}

export function sheetModel(m, avail) {
  const empty = {
    hours: !avail.hours,
    sun: false,
    specs: false,
    facility: false,
    amenity: false,
    fees: !avail.fees,
    // 주차 is an answer unless it is 확인 필요 with nothing else known (no fee, nearby lots, advice or own lot)
    parking: m.parking.word === '확인 필요' && !m.parkingMore.length && !m.parkingWhere.onsite.length,
  };
  const withEmpty = (s) => ({ ...s, empty: empty[s.key] });
  return {
    tabs: [{ key: 'time', label: '시간' }, { key: 'use', label: '이용' }, { key: 'routes', label: '루트' }, ...(avail.board ? [{ key: 'board', label: '게시판' }] : [])],
    time: TIME.filter((s) => s.key !== 'sun' || avail.sun).map(withEmpty),
    use: USE.filter((s) => ({ specs: m.specs?.length, facility: m.facilityFacts?.length || m.facilityRest?.length, amenity: m.amenities?.length })[s.key] ?? true).map(withEmpty),
    checked: m.checked,
  };
}
