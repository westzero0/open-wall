// App settings. reportEndpoint: where "정보가 달라요" reports POST (a published Google Form); empty hides the button.
// reportFormUrl: the same form's public page, offered when the POST fails.
const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSeHoY2hxvyWLwhbZPejt0UTTQemXEy5hz86d6kElmYJkCkK-w';
export const config = { reportEndpoint: `${FORM}/formResponse`, reportFormUrl: `${FORM}/viewform` };
