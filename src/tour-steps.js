// 첫 방문 투어의 단계 정의와 선택. DOM 없음 (렌더는 tour.js).
export const TOUR_STEPS = [
  { id: 'time', target: '.scrub', title: '도착 시각', body: '도착 시각을 바꿔 보세요. 그 시각에 열린 곳이 바뀌어요.' },
  { id: 'sun', target: '.sunfilter', title: '양달·응달', body: '해가 드는 벽만, 그늘진 벽만 골라 봐요.' },
  { id: 'filters', target: '.filters', title: '조건', body: '3시간+는 오래 운동할 수 있는 곳, 가까운 순은 내 위치에서 가까운 곳이에요. 조건에서 더 세밀하게 걸러요.' },
  { id: 'bar', target: 'section.tgroup .row-btn .bar', title: '운영시간 막대', body: '가로 막대가 오늘 운영시간이에요. 주황은 해가 드는 시간이에요.' },
  { id: 'tabs', target: '.tabs', title: '보기 방식', body: '목록, 지도, 기록으로 바꿔 봐요.' },
  { id: 'help', target: '#helpBtn', title: '다시 보기', body: '헷갈리면 언제든 여기서 화면 읽는 법을 볼 수 있어요.' },
];

/** pickSteps(steps, isVisible) → the steps whose target is on screen, in order. */
export const pickSteps = (steps, isVisible) => steps.filter((s) => isVisible(s.target));
