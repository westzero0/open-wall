// src/profile-view.js — the 내 정보 sheet: 닉네임, 화면 (자동/라이트/다크), 기록 백업, 제보 폼 링크, 앱 정보 link (opens the 앱 정보 sheet).
// 내 지역 sits in this sheet too, but app.js draws and handles it (it is a list filter).
import { config, fillOn } from './config.js';
import { buildLabel } from './build-label.js';
import { backupLine, loadBackupAt } from './backup.js';
import { currentInstallMode, promptInstall } from './install.js';
import { entryHref, externalOpenUrl } from './inapp.js';
import { MAX_NICK, NICK_KEY, cleanNick, loadNick, nickLocked, nickMode } from './report.js';
import { GRADES, gradeLabel } from './grades.js';
import { loadMyGrade, saveMyGrade } from './my-grade.js';
import { safeStorage, getStr, setStr, removeStr } from './storage.js';
import { loadTapCount } from './tap.js';
import { filledWallCount } from './fill-store.js';

const $ = (id) => document.getElementById(id);

// html[data-theme] wins over prefers-color-scheme (style.css). The header logo's dark <source> follows it as well.
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  for (const s of document.querySelectorAll('source[media*="prefers-color-scheme"], source[data-scheme]')) {
    s.dataset.scheme ??= s.media;
    s.media = theme === 'dark' ? 'all' : theme === 'light' ? 'not all' : s.dataset.scheme;
  }
}

export function applyTextSize(size) {
  if (size === 'large' || size === 'xlarge') document.documentElement.dataset.text = size;
  else delete document.documentElement.dataset.text;
}

/** createProfileView({getTheme, setTheme, getTextSize, setTextSize, exportFile, importFile, getLogCount}): wires the static sheet in index.html. */
export function createProfileView({ getTheme, setTheme, getTextSize, setTextSize, exportFile, importFile, getLogCount = () => 0, getWallNames = () => [] }) {
  const dlg = $('profile');
  const form = dlg.querySelector('form');
  const status = $('logBackupStatus');

  // 닉네임: the same open-wall:nick the report sheet uses; shown only while the report form has a nickname question.
  const mode = nickMode(config);
  const nickIn = $('pfNick');
  const readNick = () => { try { return loadNick(getStr(NICK_KEY)); } catch { return ''; } };
  let showNick = () => {}; // set below when the nickname row exists
  if (mode !== 'off') {
    $('pfNickRow').hidden = false;
    $('pfNickLabel').textContent = `닉네임 (${MAX_NICK}자까지)`;
    nickIn.maxLength = MAX_NICK;
    // Saved cleaned, shown as saved. Not only on `change` (it needs the field to lose focus): closing the sheet by the backdrop,
    // the back button or swiping the app away while the field is focused never fires it, so the last typed name was lost.
    const commitNick = () => {
      const v = cleanNick(nickIn.value);
      nickIn.value = v;
      if (v) setStr(NICK_KEY, v); else removeStr(NICK_KEY); // private mode: not remembered
    };
    // While the ranking runs the nickname is saved by the button alone (a second press confirms: it cannot be changed afterwards),
    // never as a side effect of closing the sheet. Outside the ranking it is still saved on change / close.
    const saveNick = () => {
      if (nickIn.readOnly || mode === 'required') return; // locked: the saved name stays
      commitNick();
    };
    nickIn.addEventListener('change', saveNick);
    dlg.addEventListener('close', saveNick);
    document.addEventListener('visibilitychange', () => { if (dlg.open && document.visibilityState === 'hidden') saveNick(); });
    const saveRow = $('pfNickSaveRow'), saveBtn = $('pfNickSave'), hint = $('pfNickHint');
    let armed = false;
    const disarm = () => { armed = false; saveBtn.textContent = '닉네임 저장'; hint.textContent = ''; };
    nickIn.addEventListener('input', disarm);
    saveBtn.addEventListener('click', () => {
      const v = cleanNick(nickIn.value);
      if (!v) { hint.textContent = '닉네임을 적어 주세요.'; return; }
      if (!armed) { armed = true; saveBtn.textContent = `‘${v}’로 저장할까요?`; hint.textContent = '이벤트 중에는 바꿀 수 없어요. 괜찮으면 한 번 더 눌러 주세요.'; return; }
      commitNick();
      disarm();
      showNick();
      hint.textContent = '저장했어요.';
    });
    showNick = () => { // also run when the sheet opens
      nickIn.value = readNick();
      const tc = safeStorage() ? loadTapCount(safeStorage()) : 0; // 제보자 · N회: a count only, no rank or badge (tap reports; this device)
      $('pfTapCount').hidden = !tc;
      $('pfTapCount').textContent = tc ? `제보자 · ${tc}회` : '';
      const locked = nickLocked(mode, nickIn.value);
      nickIn.readOnly = locked;
      $('pfNickLabel').textContent = locked ? '닉네임 (이벤트 중에는 바꿀 수 없어요)' : `닉네임 (${MAX_NICK}자까지)`;
      saveRow.hidden = mode !== 'required' || locked;
      disarm();
    };
  }

  // 내 그레이드: the range the 루트 tab draws stronger (src/my-grade.js, this browser only). The first box says where it starts (or 정하지 않음),
  // the second where it ends; every change is saved cleaned, and the boxes show what was saved (a reversed pair comes back in order).
  const gFrom = $('pfGradeFrom');
  const gTo = $('pfGradeTo');
  const options = (sel, first) => sel.replaceChildren(...[...(first ? [['', first]] : []), ...GRADES.map((g) => [g, gradeLabel(g)])].map(([v, t]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = t;
    return o;
  }));
  options(gFrom, '정하지 않음');
  options(gTo, '');
  const showGrade = () => {
    const st = safeStorage(); // blocked: nothing saved
    const r = st ? loadMyGrade(st) : null;
    gFrom.value = r?.from ?? '';
    gTo.value = r?.to ?? gTo.options[0].value;
    gTo.disabled = !r;
  };
  const commitGrade = () => {
    const from = gFrom.value;
    try { saveMyGrade(safeStorage(), from ? { from, to: gTo.disabled ? from : gTo.value } : null); } catch { /* blocked: not remembered */ }
    showGrade();
  };

  // 나 / 설정: two screens under tabs in the header; the pane slides in from the side the tab sits on
  const tabs = [$('pfTabMe'), $('pfTabSet')];
  const panes = [$('pfPaneMe'), $('pfPaneSet')];
  const showTab = (i, slide = true) => {
    const was = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    panes.forEach((p, k) => { p.inert = k !== i; p.classList.toggle('off', k !== i); p.classList.remove('from-r', 'from-l'); }); // not [hidden]: it stays in the stack so the sheet keeps the taller pane's height
    if (slide && was !== i) panes[i].classList.add(i > was ? 'from-r' : 'from-l');
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showTab(i));
    t.addEventListener('keydown', (e) => {
      const to = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? 0 : -1;
      if (to < 0) return;
      e.preventDefault(); showTab(to); tabs[to].focus();
    });
  });

  $('meBtn').addEventListener('click', () => {
    if (mode !== 'off') showNick();
    showGrade();
    form.elements.theme.value = getTheme();
    form.elements.textSize.value = getTextSize();
    const store = safeStorage(); // blocked: no backup date
    status.textContent = backupLine(getLogCount(), loadBackupAt(store)); // the next export or import replaces it with its own message
    const filled = fillOn() ? filledWallCount({ get: getStr }) : 0; // 빈칸 채우기: only once it is on and this device filled something
    $('pfFills').hidden = !filled;
    $('pfFills').textContent = filled ? `내가 채운 암장 ${filled}곳` : '';
    const how = currentInstallMode();
    $('pfInstallRow').hidden = how === 'none';
    $('pfInstall').hidden = how !== 'prompt';
    $('pfInstallIos').hidden = how !== 'ios';
    $('pfInstallOpen').hidden = how !== 'inapp';
    showTab(0, false);
    dlg.showModal();
  });
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close()); // the backdrop
  form.addEventListener('change', (e) => {
    if (e.target.name === 'theme') setTheme(e.target.value);
    if (e.target.name === 'textSize') setTextSize(e.target.value);
    if (e.target === gFrom || e.target === gTo) commitGrade();
  });

  $('pfInstallOpen').addEventListener('click', () => { location.href = externalOpenUrl(entryHref); });
  $('pfInstall').addEventListener('click', async () => { if (await promptInstall()) $('pfInstallRow').hidden = true; });
  $('logExport').addEventListener('click', () => { status.textContent = exportFile(); });
  $('logImport').addEventListener('click', () => $('logImportFile').click());
  $('logImportFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // the same file can be picked again
    status.textContent = await importFile(file);
  });

  if (config.reportEndpoint) { // 정보 제보하기 opens the report sheet with a wall picker (the sheet itself falls back to the form link)
    $('pfReportRow').hidden = false;
    $('pfReport').addEventListener('click', () => {
      dlg.close();
      document.dispatchEvent(new CustomEvent('wall:report', { detail: { name: '', names: getWallNames() } }));
    });
  }
  // 앱 정보 sheet: opened from the footer and from 내 정보; focus returns to whatever opened it
  const about = $('about-sheet');
  let aboutOpener = null;
  about.addEventListener('close', () => aboutOpener?.focus());
  const build = buildLabel(); // stamped by the deploy; a dev copy has none
  if (build && config.stage === 'beta') { $('foot-build-id').textContent = build; $('foot-build').hidden = false; } // so a feedback says which version it saw; gone when the stage opens
  const openAbout = (from) => { aboutOpener = from; about.showModal(); };
  $('aboutOpen').addEventListener('click', (e) => openAbout(e.currentTarget));
  $('pfAbout').addEventListener('click', (e) => {
    e.preventDefault();
    dlg.close();
    openAbout($('meBtn'));
  });
}
