// 첫 방문 투어의 단계 정의와 선택. DOM 없음 (렌더는 tour.js).
export const TOUR_STEPS = [
  { id: 'time', target: '.scrub', title: '도착 시각', body: '슬라이더로 도착 시각을 바꾸면, 그 시각에 열린 암장만 보여요.' },
  { id: 'sun', target: '.sunfilter', title: '양달 · 응달', body: '해가 드는 벽만, 그늘진 벽만 골라 볼 수 있어요.' },
  { id: 'filters', target: '.filters', title: '빠른 필터', body: '3시간 넘게 운동할 곳, 가까운 순, 그 밖의 조건을 골라요.' },
  { id: 'bar', target: 'section.tgroup .row-btn .bar', title: '운영시간 막대', body: '막대는 오늘 운영시간이에요. 세로선이 내 도착 시각, 주황은 해가 드는 시간이에요.' },
  { id: 'tabs', target: '.tabs', title: '보기 방식', body: '목록, 지도, 내 기록을 오가요.' },
  { id: 'help', target: '#helpBtn', title: '다시 보기', body: '헷갈리면 여기서 화면 보는 법을 다시 볼 수 있어요.' },
];

/** pickSteps(steps, isVisible) → the steps whose target is on screen, in order. */
export const pickSteps = (steps, isVisible) => steps.filter((s) => isVisible(s.target));
