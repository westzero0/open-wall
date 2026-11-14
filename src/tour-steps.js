// 첫 방문 투어의 단계 정의와 선택. DOM 없음 (렌더는 tour.js).
// sample: 열린 곳이 없는 시간대에는 실제 카드가 없으므로, 화면의 다른 줄을 복제한 예시 카드 안에서 이 선택자를 짚는다. forceSample: 실제 카드가 있어도 예시를 쓴다. badge: 예시 줄에 날씨 배지를 붙인다.
export const TOUR_STEPS = [
  { id: 'time', target: '#arrivePill', title: '도착 시각', body: '이 알약을 눌러 도착 시각을 정하면, 그때 문 연 암장이 위에 떠요.' },
  { id: 'find', target: '[data-home="find"]', title: '외벽 더 찾기', body: '전체 목록과 시간표가 여기에 있어요. 눌러서 도착 시각과 조건을 바꾸면 그때 문 연 외벽이 떠요.' },
  // forceSample + badge: 날씨 배지는 날씨가 나쁜 날에만 실제 줄에 붙으므로, 늘 예시 카드로 보여 준다(지금 목록에 나오는 배지 종류를 따라 비 > 돌풍 > 구름)
  { id: 'chip', target: 'section.tgroup .row-btn .sunnow', sample: '.sunnow', forceSample: true, badge: true, title: '해 아이콘과 날씨', body: '칩 아래 숫자는 그 시각 예보 기온이에요. 비·눈·강풍·한파·폭염이면 칩 오른쪽 위에 작은 배지가 붙어요.' },
  { id: 'row', target: 'section.tgroup .row-btn', sample: '.row-btn', title: '암장 줄', body: '막대는 운영시간, 주황은 양달 구간, 오른쪽 숫자는 운동할 수 있는 시간이에요. 누르면 카드가 열려요.' },
  { id: 'tabs', target: '#homeView', title: '보기 방식', body: '목록과 지도를 오가요.' },
];

/** pickSteps(steps, isVisible) → the steps whose target is on screen, in order. */
export const pickSteps = (steps, isVisible) => steps.filter((s) => isVisible(s.target));
