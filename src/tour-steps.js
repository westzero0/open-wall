// 첫 방문 투어의 단계 정의와 선택. DOM 없음 (렌더는 tour.js).
// sample: 열린 곳이 없는 시간대에는 실제 카드가 없으므로, 화면의 다른 줄을 복제한 예시 카드 안에서 이 선택자를 짚는다. extend: 같은 줄의 이 요소까지 한 구멍으로 묶는다(날씨 칩 + 남은 시간). forceSample: 실제 카드가 있어도 예시를 쓴다. veil: 예시 줄에 '흐림' 표시를 붙인다.
export const TOUR_STEPS = [
  { id: 'time', target: '.scrub', title: '도착 시각', body: '슬라이더로 도착 시각을 바꾸면, 그 시각에 문 연 암장이 위에 모여요.' },
  { id: 'sun', target: '.sunfilter', title: '양달 · 응달', body: '왼쪽 해 아이콘은 양달(해 드는 벽)만, 오른쪽은 응달(그늘진 벽)만 모아 봐요.' },
  { id: 'filters', target: '.filters', title: '찾기와 조건', body: '암장 이름이나 지역으로 찾고, ‘조건’에서 3시간+·가까운 순·기온 같은 조건을 골라요.' },
  // forceSample + veil: 구름 배지는 흐린 날에만 실제 줄에 붙으므로, 늘 예시 카드(구름 붙인 양달 줄)로 보여 준다
  { id: 'chip', target: 'section.tgroup .row-btn .sunnow', sample: '.sunnow', forceSample: true, veil: true, title: '해 아이콘', body: '왼쪽 아이콘은 양달·응달·방향 모름·실내예요. 양달에 구름이 붙으면 흐려서 해가 거의 안 나요.' },
  { id: 'row', target: 'section.tgroup .row-btn .left', sample: '.left', title: '남은 시간', body: '줄 오른쪽 ‘3시간’은 도착 시각부터 문 닫을 때까지 운동할 수 있는 시간이에요(카드를 열면 ‘3시간 가능’). 아이콘에 우산이 붙으면 그 시각 비 예보예요.' },
  { id: 'bar', target: 'section.tgroup .row-btn .bar', sample: '.bar', title: '운영시간 막대', body: '막대는 오늘 운영시간이에요. 세로선이 내 도착 시각, 주황은 해가 드는 시간이에요.' },
  { id: 'tabs', target: '.tabs', title: '보기 방식', body: '목록은 지금 갈 곳, 지도는 위치, 기록은 다녀온 암장이에요.' },
  { id: 'help', target: '#helpBtn', title: '화면 읽는 법', body: '헷갈리면 여기서 화면 읽는 법을 다시 볼 수 있어요.' },
];

/** pickSteps(steps, isVisible) → the steps whose target is on screen, in order. */
export const pickSteps = (steps, isVisible) => steps.filter((s) => isVisible(s.target));
