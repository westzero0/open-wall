// App settings. reportEndpoint: where "정보 수정 요청" reports POST (a published Google Form); empty hides the button.
// reportFormUrl: the same form's public page, offered when the POST fails.
const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSeHoY2hxvyWLwhbZPejt0UTTQemXEy5hz86d6kElmYJkCkK-w';
// 혼잡도 (docs/crowd-setup.md): crowdEndpoint + crowdFields — the form that takes 여유/보통/혼잡 (empty hides the question
// in the 기록 추가 sheet); crowdFields.when — the form's 방문시각 entry (empty: the form's own timestamp stands for it);
// crowdCsvUrl — that sheet's tab published as CSV (제보시각, 암장, 단계, 방문시각; empty hides the chip).
export const config = {
  reportEndpoint: `${FORM}/formResponse`, reportFormUrl: `${FORM}/viewform`,
  crowdEndpoint: '', crowdFields: { wall: '', level: '', kind: '', when: '' }, crowdCsvUrl: '',
};
