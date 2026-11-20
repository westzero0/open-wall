// 첫 방문 투어의 단계 정의와 선택. DOM 없음 (렌더는 tour.js).
// sample: 열린 곳이 없는 시간대에는 실제 카드가 없으므로, 화면의 다른 줄을 복제한 예시 카드 안에서 이 선택자를 짚는다. forceSample: 실제 카드가 있어도 예시를 쓴다. badge: 예시 줄에 날씨 배지를 붙인다.
export const TOUR_STEPS = [
  { id: 'find', target: '#findQ', title: '외벽 찾기', body: '이름이나 지역으로 바로 찾을 수 있어요. 아래 목록에는 도착 시각에 문 연 외벽이 나와요.' },
  { id: 'time', target: '.scrub', title: '도착 시각', body: '여기서 도착 시각을 정하면, 그때 열려 있는 곳이 아래에 나와요.' },
  { id: 'chip', target: 'section.tgroup .row-btn .sunnow', sample: '.sunnow', title: '날씨 칩', body: '칩은 그 시각의 날씨, 아래 숫자는 예보 기온이에요. 비·눈·강풍처럼 조심할 날씨는 붉은색으로 보여요.' },
  { id: 'row', target: 'section.tgroup .row-btn', sample: '.row-btn', title: '암장 줄', body: '막대는 운영시간, 오른쪽 숫자는 운동할 수 있는 시간이에요. 누르면 카드가 열려요.' },
  { id: 'tabs', target: '#homeView', title: '보기 방식', body: '목록과 지도를 오가요.' },
];

/** pickSteps(steps, isVisible) → the steps whose target is on screen, in order. */
export const pickSteps = (steps, isVisible) => steps.filter((s) => isVisible(s.target));
