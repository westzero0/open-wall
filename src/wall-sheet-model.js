// src/wall-sheet-model.js — what the wall sheet (src/wall-sheet.js) holds: its bottom tabs and the sections of the 이용 tab. No DOM.
// `avail` says which blocks the page could draw for this wall: { hours, fees, sun, board } (board: the one-line board is on, or the wall has reviews).

const SECTIONS = [
  { key: 'hours', title: '운영시간', kind: '운영시간' }, // `kind` is the report form's 종류 the section's 수정 요청 pre-fills
  { key: 'facility', title: '시설', kind: '기타' }, // the memo lines the card face does not show; only with such lines
  { key: 'fees', title: '요금', kind: '기타' },
  { key: 'parking', title: '주차', kind: '주차' },
];

export function sheetModel(m, avail) {
  const empty = {
    hours: !avail.hours,
    facility: false,
    fees: !avail.fees,
    // 주차 is an answer unless it is 확인 필요 with nothing else known (no fee, nearby lots, advice or own lot)
    parking: m.parking.word === '확인 필요' && !m.parkingMore.length && !m.parkingWhere.onsite.length,
  };
  return {
    tabs: [{ key: 'use', label: '이용' }, ...(avail.sun ? [{ key: 'sun', label: '양달' }] : []), { key: 'routes', label: '루트' }, ...(avail.board ? [{ key: 'board', label: '게시판' }] : [])],
    use: SECTIONS.filter((s) => s.key !== 'facility' || m.info.folded.length).map((s) => ({ ...s, empty: empty[s.key] })),
    checked: m.checked,
  };
}
