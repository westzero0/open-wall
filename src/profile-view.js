// src/profile-view.js — the 내 정보 sheet: 닉네임, 화면 (자동/라이트/다크), 기록 백업, 제보 폼 링크, 앱 정보 link (opens the 앱 정보 sheet).
// 내 지역 sits in this sheet too, but app.js draws and handles it (it is a list filter).
import { config } from './config.js';
import { backupLine, loadBackupAt } from './backup.js';
import { currentInstallMode, promptInstall } from './install.js';
import { entryHref, externalOpenUrl } from './inapp.js';
import { MAX_NICK, NICK_KEY, cleanNick, loadNick, nickLocked, nickMode } from './report.js';

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
  const readNick = () => { try { return loadNick(localStorage.getItem(NICK_KEY)); } catch { return ''; } };
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
      try { v ? localStorage.setItem(NICK_KEY, v) : localStorage.removeItem(NICK_KEY); } catch { /* private mode: not remembered */ }
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
      const locked = nickLocked(mode, nickIn.value);
      nickIn.readOnly = locked;
      $('pfNickLabel').textContent = locked ? '닉네임 (이벤트 중에는 바꿀 수 없어요)' : `닉네임 (${MAX_NICK}자까지)`;
      saveRow.hidden = mode !== 'required' || locked;
      disarm();
    };
  }

  $('meBtn').addEventListener('click', () => {
    if (mode !== 'off') showNick();
    form.elements.theme.value = getTheme();
    form.elements.textSize.value = getTextSize();
    let store = null; try { store = localStorage; } catch { /* blocked: no backup date */ }
    status.textContent = backupLine(getLogCount(), loadBackupAt(store)); // the next export or import replaces it with its own message
    const how = currentInstallMode();
    $('pfInstallRow').hidden = how === 'none';
    $('pfInstall').hidden = how !== 'prompt';
    $('pfInstallIos').hidden = how !== 'ios';
    $('pfInstallOpen').hidden = how !== 'inapp';
    dlg.showModal();
  });
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close()); // the backdrop
  form.addEventListener('change', (e) => {
    if (e.target.name === 'theme') setTheme(e.target.value);
    if (e.target.name === 'textSize') setTextSize(e.target.value);
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
  about.addEventListener('click', (e) => e.target === about && about.close()); // the backdrop
  const openAbout = (from) => { aboutOpener = from; about.showModal(); };
  $('aboutOpen').addEventListener('click', (e) => openAbout(e.currentTarget));
  $('pfAbout').addEventListener('click', (e) => {
    e.preventDefault();
    dlg.close();
    openAbout($('meBtn'));
  });
}
