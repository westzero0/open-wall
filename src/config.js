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
export const config = {
  boardUrl: '',
  reportEndpoint: `${FORM}/formResponse`, reportFormUrl: `${FORM}/viewform`,
  reportNickEntry: 'entry.1516503630', nickRequired: true,
  statsCode: 'haebyeok', // GoatCounter 사이트 코드(src/stats.js); 비우면 통계를 보내지 않는다
  crowdEndpoint: `${CROWD_FORM}/formResponse`,
  crowdFields: { wall: 'entry.1128962446', level: 'entry.1535482151', kind: '', when: 'entry.1240200685' },
  crowdCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRo5ix5HkR_u07cMefjHVC_8XbrZ89w-JN3eCQAbcpRRBSLEibj4KnTP9sDCXQHFsJUdJkUjGr3kkCz/pub?gid=324204039&single=true&output=csv',
};
