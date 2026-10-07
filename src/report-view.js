// Report sheet: opens on wall:report, posts to the Google Form (no-cors: the response is unreadable, only a network error counts as failure).
import { config } from './config.js';
import { MAX_BODY, buildPayload, cooldownLeft, validateReport } from './report.js';

const dlg = document.getElementById('report');
if (dlg) {
  const f = dlg.querySelector('form');
  const status = dlg.querySelector('.rp-status');
  const alt = dlg.querySelector('.rp-alt');
  const KEY = 'open-wall:report-ts';
  const get = () => { try { return Number(localStorage.getItem(KEY)); } catch { return NaN; } };
  const set = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode: no cooldown */ } };
  let wallName = '';
  const nameEl = dlg.querySelector('.rp-name');
  const say = (msg) => { status.textContent = msg; };

  f.elements.body.maxLength = MAX_BODY;
  alt.href = config.reportFormUrl; // fixed constant, not user input

  document.addEventListener('wall:report', (e) => {
    f.reset();
    wallName = e.detail; nameEl.textContent = e.detail; // read-only text, never typed
    f.elements.send.disabled = false;
    alt.hidden = true;
    say('');
    dlg.showModal();
  });
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (f.elements.send.disabled) return;
    const v = validateReport({
      name: wallName, kind: f.elements.kind.value, body: f.elements.body.value,
      note: f.elements.note.value, hp: f.elements.website.value,
    });
    if (!v.ok) return say(v.error);
    const wait = cooldownLeft(get(), Date.now());
    if (wait) return say(`${Math.ceil(wait / 1000)}초 뒤에 다시 보낼 수 있어요.`);
    f.elements.send.disabled = true;
    if (!v.honeypot) {
      try {
        await fetch(config.reportEndpoint, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: buildPayload(v.report),
        });
      } catch {
        f.elements.send.disabled = false;
        alt.hidden = false;
        return say('보내지 못했어요. 연결을 확인하거나 아래 링크로 직접 제보해 주세요.');
      }
      set();
    }
    say('제보 고맙습니다. 확인 후 반영해요.');
  });
}
