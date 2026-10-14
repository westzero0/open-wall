// src/climber-content.js — 클라이머 유형 8종의 문구. Data only: no DOM, no imports. Source: docs/superpowers/specs/2026-10-14-climber-test-content-draft.md
// safety: the one line the 폭발 types carry (they are the ones who may skip a warm-up); null for the rest.
// tint: the colour of the stage the character stands on (the card picture and the result screen).
// wall: the stage is one face of an outdoor wall — the 해벽 sun hangs behind the character (sun.x: % of the stage width from the left, the sun is 40% wide;
// sun.lift: the part of its diameter above the top edge) and the logo's leaning slab throws shade down the side `shade` ('l' | 'r'). One picture per type.
// tip: which tail the 오늘의 팁 gets (climber-test.js tipText).
export const TYPES = Object.freeze({
  owl: {
    animal: '올빼미', tint: '#c7dad5', wall: { sun: { x: 3, lift: 0.25 }, shade: 'r' }, name: '관찰하는 분석가형', nick: '오르기 전에 이미 한 번 올랐다',
    strengths: ['루트를 눈으로 먼저 푼다', '혼자 집중하는 시간이 오래 간다'],
    caution: '너무 오래 보다 보면 정작 팔이 식어요', shine: '복잡한 루트 앞에서 한 동작씩 풀어 갈 때',
    safety: null, tip: 'plan',
  },
  spider: {
    animal: '거미', tint: '#e0e3db', wall: { sun: { x: 56, lift: 0.15 }, shade: 'l' }, name: '동선 설계 장인형', nick: '계산은 끝났다, 이제 한 방',
    strengths: ['한 번의 시도에 계획을 몰아넣는다', '홀드를 가장 효율적으로 쓴다'],
    caution: '계획이 틀어지면 잠깐 멈칫해요', shine: '오래 붙잡던 문제를 마침내 풀 때',
    safety: '한 방 전에는 몸풀기와 장비 확인은 꼭.', tip: 'plan',
  },
  goat: {
    animal: '산양', tint: '#f6dfbd', wall: { sun: { x: 54, lift: 0.25 }, shade: 'l' }, name: '든든한 페이스메이커형', nick: '지치지 않는 암장의 페이스메이커',
    strengths: ['함께 오르는 사람의 속도를 맞춰 준다', '꾸준히 안정적으로 오른다'],
    caution: '남을 챙기느라 내 루트를 미루기 쉬워요', shine: '처음 온 친구와 같이 오를 때',
    safety: null, tip: 'team',
  },
  otter: {
    animal: '수달', tint: '#d3dee6', wall: { sun: { x: 4, lift: 0.2 }, shade: 'r' }, name: '작전회의 팀플러형', nick: '벽 밑에서 이미 완등한 작전반장',
    strengths: ['같이 루트를 읽고 의견을 모은다', '한 번에 에너지를 쏟는다'],
    caution: '회의가 길어지면 몸이 식어요', shine: '여럿이 한 문제를 돌아가며 풀 때',
    safety: '다 같이 점검하고 올라가면 더 든든해요.', tip: 'team',
  },
  gecko: {
    animal: '도마뱀', tint: '#dfe7bf', wall: { sun: { x: 56, lift: 0.2 }, shade: 'l' }, name: '말없이 착 붙는 타입', nick: '어느새 벽 위에 있었다',
    strengths: ['몸이 먼저 길을 안다', '조용히 오래 붙어 있는다'],
    caution: '쉬는 것도 잊을 만큼 집중해요', shine: '몸에 맞는 루트에서 흐름을 탈 때',
    safety: null, tip: 'solo',
  },
  cat: {
    animal: '고양이', tint: '#f0cfd9', wall: { sun: { x: 4, lift: 0.25 }, shade: 'r' }, name: '갑자기 날아오르는 타입', nick: '아무도 못 본 사이에 정상',
    strengths: ['감각으로 동작을 만든다', '폭발적인 한 동작이 나온다'],
    caution: '컨디션이 안 맞는 날엔 확 가라앉아요', shine: '다이나믹한 동작이 필요한 루트에서',
    safety: '도약 전에는 낙하 지점과 주변을 꼭 확인해요.', tip: 'solo',
  },
  raccoon: {
    animal: '너구리', tint: '#f3e7b4', wall: { sun: { x: 54, lift: 0.15 }, shade: 'l' }, name: '어디서든 어울리는 인싸형', nick: '암장 인싸, 누구와도 한 팀',
    strengths: ['분위기를 편하게 만든다', '누구와도 꾸준히 즐겁게 오른다'],
    caution: '이야기가 길어져 오르는 시간이 줄어요', shine: '모르는 사람과 한 문제를 같이 풀 때',
    safety: null, tip: 'social',
  },
  squirrel: {
    animal: '다람쥐', tint: '#f8d9c0', wall: { sun: { x: 30, lift: 0.3 }, shade: 'r' }, name: '먼저 붙고 보는 돌격형', nick: '신나면 소리부터 나오는 돌격대장',
    strengths: ['분위기를 끌어올린다', '터지는 날엔 아무도 못 막는다'],
    caution: '신나서 몸풀기를 건너뛰고 싶을 때가 있어요', shine: '친구들 응원 속에서 도전할 때',
    safety: '신날수록 몸풀기와 장비 확인은 먼저!', tip: 'social',
  },
});

export const DISCLAIMER = '재미로 보는 테스트예요. 실제 성격이나 실력과는 관계없어요.';
