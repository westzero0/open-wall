// src/safety-view.js — the 안전수칙 sheet, opened from the header icon, and its 약속 button.
// The pledge is one day, kept in this browser only (pledge.js); it is shown with textContent.
import { dayLabel, loadPledge, savePledge } from './pledge.js';
import { ymd } from './time.js';

const $ = (id) => document.getElementById(id);
const store = () => { try { return localStorage; } catch { return null; } };

export function createSafetyView() {
  const dlg = $('safety-sheet');
  const opener = $('safetyBtn');
  const note = $('sf-note');
  const NOTE = note.textContent;

  function draw() {
    const s = store();
    const day = s && loadPledge(s);
    $('sf-pledge').hidden = !!day;
    $('sf-pledged').hidden = !day;
    if (day) $('sf-pledged-day').textContent = dayLabel(day);
  }

  opener.addEventListener('click', () => {
    note.textContent = NOTE;
    draw();
    dlg.showModal();
    dlg.scrollTop = 0; // the browser scrolls to the focused pledge button at the foot: start from the title
  });
  dlg.addEventListener('close', () => opener.focus());
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close()); // the backdrop

  $('sf-pledge').addEventListener('click', () => {
    const s = store();
    if (s && savePledge(s, ymd(new Date()))) {
      draw();
      $('sf-pledged').focus(); // the button that had the focus is gone
    } else note.textContent = '이 브라우저에는 저장하지 못했어요. 수칙은 그대로 지켜 주세요.';
  });
}
