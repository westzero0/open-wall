// src/planner-settings.js — 설정 시트: 테마·글자 크기, 피치 기록 가져오기. Applies on tap (no save button), so the sheet has the X header.
// Writes go through handlers.savePrefs (planner.js → ui-state.js); no fetch, no storage here.
import { html, useState, useRef, useEffect, usePlannerState } from './planner-ui.js';
import { Sheet } from './planner-sheet.js';
import { Chip } from './planner-parts.js';
import { MAX_FILE } from './record-import.js';

const THEMES = [['auto', '자동'], ['light', '라이트'], ['dark', '다크']];
const SIZES = [['normal', '보통'], ['large', '크게'], ['xlarge', '더 크게']];

// 피치 기록 가져오기 (spec 2026-11-18-record-format §6): pick files → counts first → 가져오기 saves. Reading files is the only I/O here; saving goes through h.importRecords.
// Only the counts that are not 0 (ui-designer 2026-11-18); words as in the spec §6.
const countLine = (r) => [
  r.created && `새 일정 ${r.created}`,
  r.linked && `연결 ${r.linked}${r.statusChanged ? `(상태가 바뀌는 것 ${r.statusChanged})` : ''}`,
  r.same && `이미 있음 ${r.same}`,
  r.bad && `못 읽은 파일 ${r.bad}`,
].filter(Boolean).join(' · ') || '가져올 기록이 없어요';
function RecordImport({ h, ready }) { // ready: the place lists have loaded (before that every record would land as a name-only place)
  const [st, setSt] = useState({ step: 'idle' }); // idle | preview { texts, counts } | done { counts, latestId } | fail
  const input = useRef(null), pickBtn = useRef(null), firstAct = useRef(null), result = useRef(null), moved = useRef(false);
  // The buttons that had focus disappear on each step: focus goes to the next thing to do (not on first render).
  useEffect(() => {
    if (!moved.current) return;
    const to = st.step === 'preview' ? firstAct : st.step === 'done' ? result : pickBtn;
    to.current?.focus();
  }, [st.step]);
  const go = (next) => { moved.current = true; setSt(next); };
  const pick = async (e) => {
    const files = [...(e.currentTarget.files ?? [])];
    e.currentTarget.value = ''; // the same file can be picked again
    if (!files.length) return;
    const texts = await Promise.all(files.map((f) => (f.size > MAX_FILE ? '' : f.text().catch(() => '')))); // too big: not read at all, counted as 못 읽은 파일
    go({ step: 'preview', texts, counts: h.importRecords(texts, true) });
  };
  const run = () => { const r = h.importRecords(st.texts, false); go(r.ok ? { step: 'done', counts: r, latestId: r.latestId } : { step: 'fail' }); };
  const nothing = st.counts && !st.counts.created && !st.counts.linked;
  return html`<div class="p-field imp" role="group" aria-label="피치 기록"><span class="lb">피치 기록</span>
    <input type="file" accept=".json,application/json" multiple hidden ref=${input} onChange=${pick} />
    ${st.step === 'preview' ? html`<p role="status">${countLine(st.counts)}</p>
      <div class="row2">${nothing ? null : html`<button type="button" class="btn p" ref=${firstAct} onClick=${run}>가져오기</button>`}<button type="button" class="btn" ref=${nothing ? firstAct : null} onClick=${() => go({ step: 'idle' })}>${nothing ? '닫기' : '취소'}</button></div>`
    : html`${st.step === 'done' && html`<p role="status" tabindex="-1" ref=${result}>가져왔어요. ${countLine(st.counts)}</p>${st.latestId && html`<button type="button" class="btn p" onClick=${() => h.go({ screen: 'plan', id: st.latestId })}>가져온 일정 보기</button>`}`}
      ${st.step === 'fail' && html`<p class="err" role="alert">이 브라우저에는 저장되지 않아 가져오지 못했어요</p>`}
      <button type="button" class="btn" ref=${pickBtn} disabled=${!ready} onClick=${() => input.current?.click()}>피치 기록 가져오기</button>
      <p>피치 기록 앱에서 저장한 파일을 가져와 지난 일정으로 만들어요</p>
      ${!ready && html`<p role="status">장소 목록을 불러오는 중이에요</p>`}`}
  </div>`;
}

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
      <${RecordImport} h=${h} ready=${s.walls.length > 0 || s.crags.length > 0} />
      <p class="err" role="alert">${fail ? '이 브라우저에는 저장되지 않아요' : ''}</p>
    </div>
  <//>`;
}
