// 첫 방문 투어의 단계 정의와 선택. DOM 없음 (렌더는 tour.js).
// sample: 열린 곳이 없는 시간대에는 실제 카드가 없으므로, 화면의 다른 줄을 복제한 예시 카드 안에서 이 선택자를 짚는다. forceSample: 실제 카드가 있어도 예시를 쓴다. veil: 예시 줄에 '흐림' 표시를 붙인다.
export const TOUR_STEPS = [
  { id: 'time', target: '.scrub', title: '도착 시각', body: '슬라이더로 도착 시각을 바꾸면, 그 시각에 문 연 암장이 위에 모여요.' },
  { id: 'filters', target: '.filters', title: '걸러 보기', body: '왼쪽 해 아이콘은 양달·응달만, 검색창은 이름·지역으로 찾아요. 검색창의 핀은 가까운 순, ‘조건’은 3시간+ 같은 조건이에요.' },
  // forceSample + veil: 날씨 배지는 흐린 날에만 실제 줄에 붙으므로, 늘 예시 카드(구름 붙인 양달 줄)로 보여 준다
  { id: 'chip', target: 'section.tgroup .row-btn .sunnow', sample: '.sunnow', forceSample: true, veil: true, title: '해 아이콘과 날씨', body: '왼쪽 아이콘은 양달·응달·방향 모름·실내예요. 양달 칩의 배지는 도착 시각의 날씨 예보(오늘·내일만)로, 구름은 흐림, 우산은 비예요.' },
  { id: 'row', target: 'section.tgroup .row-btn', sample: '.row-btn', title: '암장 줄', body: '막대는 운영시간(세로선 = 도착 시각, 주황 = 해 드는 시간), 오른쪽 숫자는 도착 후 운동할 수 있는 시간이에요. 누르면 카드가 펼쳐져요.' },
  { id: 'tabs', target: '.tabs', title: '보기 방식', body: '목록은 지금 갈 곳, 지도는 위치, 기록은 다녀온 암장이에요.' },
  { id: 'help', target: '#helpBtn', title: '화면 읽는 법', body: '헷갈리면 여기서 화면 읽는 법을 다시 볼 수 있어요.' },
];

/** pickSteps(steps, isVisible) → the steps whose target is on screen, in order. */
export const pickSteps = (steps, isVisible) => steps.filter((s) => isVisible(s.target));
