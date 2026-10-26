// App settings. reportEndpoint: where "정보 수정 요청" reports POST (a published Google Form); empty hides the button.
// reportFormUrl: the same form's public page, offered when the POST fails.
const CROWD_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdlHLBmAq8qJP_TQm78r-tNLY3QeFFKhQQtpMrRb0fklSFNhQ'; // 해벽 혼잡도 제보
const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSeHoY2hxvyWLwhbZPejt0UTTQemXEy5hz86d6kElmYJkCkK-w';
// 혼잡도 (docs/crowd-setup.md): crowdEndpoint + crowdFields — the form that takes 여유/보통/혼잡 (empty hides the question
// in the 기록 추가 sheet); crowdFields.when — the form's 방문시각 entry (empty: the form's own timestamp stands for it);
// crowdCsvUrl — that sheet's tab published as CSV (제보시각, 암장, 단계, 방문시각; empty hides the chip).
// 닉네임 (docs/superpowers/specs/2026-10-08-beta-form.md): reportNickEntry — the report form's 닉네임 entry (empty: no field, nothing sent);
// nickRequired — true while the ranking event runs; set false after it (the field stays, a report no longer needs a nickname).
// 한 줄 타임라인 (docs/superpowers/specs/2026-10-09-wall-board-design.md): boardUrl — the Worker origin; empty = the feature is off, no request is made.
// 싱글피치: singlePitch — data/single-pitch.json 로드 스위치(docs/superpowers/specs/2026-10-12-single-pitch-design.md). false면 요청을 보내지 않는다.
// 클라이머 유형 테스트: climberTest — 켜면 내 정보 시트에 진입 행·첫 방문 카드가 생긴다(docs/superpowers/specs/2026-10-14-climber-test-design.md).
// assets/climbers/에 캐릭터 8장이 다 들어가기 전에는 켜지 않는다(test/climber-assets.test.js가 켠 상태에서 확인).
// 공지 제보 (docs/prd/notice-links-spec.md 3번, 중단): noticeReport — 켜면 제보 시트에 '공지' 선택이 생긴다. 기본은 꺼 둠(이용자 제보를 기대하지 않기로 함).
// 공개 단계 (docs/superpowers/specs/2026-10-21-home-simplify-design.md): stage — 'beta'는 클라이머 유형 테스트와 이번 주말 추천을 숨기고, 'open'이면 연다.
// 기록 탭(달력·카드·도장)은 stage와 무관하게 사람마다 기록 수로 열린다(docs/superpowers/specs/2026-10-21-staged-opening.md). src/stage.js가 읽는다.
// 기록 탭 한 줄 요약의 야외 횟수: 야외가 열리기 전에는 false(코드에만 두고 화면에는 안 보인다).
export const config = {
  showOutdoorCount: false,
  stage: 'beta',
  noticeReport: false,
  climberTest: true,
  singlePitch: false,
  boardUrl: 'https://open-wall-board.westzero0103.workers.dev',
  reportEndpoint: `${FORM}/formResponse`, reportFormUrl: `${FORM}/viewform`,
  reportNickEntry: 'entry.1516503630', nickRequired: true,
  statsCode: 'haebyeok', // GoatCounter 사이트 코드(src/stats.js); 비우면 통계를 보내지 않는다
  crowdEndpoint: `${CROWD_FORM}/formResponse`,
  crowdFields: { wall: 'entry.1128962446', level: 'entry.1535482151', kind: '', when: 'entry.1240200685' },
  crowdCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRo5ix5HkR_u07cMefjHVC_8XbrZ89w-JN3eCQAbcpRRBSLEibj4KnTP9sDCXQHFsJUdJkUjGr3kkCz/pub?gid=324204039&single=true&output=csv',
};
