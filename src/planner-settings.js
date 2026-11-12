// src/planner-settings.js — 설정 시트: 테마·글자 크기. Applies on tap (no save button), so the sheet has the X header.
// Writes go through handlers.savePrefs (planner.js → ui-state.js); no fetch, no storage here.
import { html, useState, usePlannerState } from './planner-ui.js';
import { Sheet } from './planner-sheet.js';
import { Chip } from './planner-parts.js';

const THEMES = [['auto', '자동'], ['light', '라이트'], ['dark', '다크']];
const SIZES = [['normal', '보통'], ['large', '크게'], ['xlarge', '더 크게']];

export function SettingsSheet({ store, handlers: h }) {
  const s = usePlannerState(store);
  const [fail, setFail] = useState(false);
  const [look, setLook] = useState(() => ({ theme: document.documentElement.dataset.theme ?? 'auto', textSize: document.documentElement.dataset.text ?? 'normal' }));
  if (s.route.screen !== 'settings') return null;
  const save = (patch) => setFail(h.savePrefs(patch)?.ok === false);
  const pickLook = (k, v) => { setLook((o) => ({ ...o, [k]: v })); save({ [k]: v }); };
  const group = (label, key, items) => html`<div class="p-field" role="group" aria-label=${label}><span class="lb">${label}</span>
    <div class="sel">${items.map(([v, t]) => html`<${Chip} key=${v} pressed=${look[key] === v} onClick=${() => pickLook(key, v)}>${t}<//>`)}</div></div>`;
  return html`<${Sheet} title="설정" onClose=${h.back}>
    <div class="wsh">
      ${group('테마', 'theme', THEMES)}
      ${group('글자 크기', 'textSize', SIZES)}
      <p class="err" role="alert">${fail ? '이 브라우저에는 저장되지 않아요' : ''}</p>
    </div>
  <//>`;
}
