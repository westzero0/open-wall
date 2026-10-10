// src/profile-view.js — the 내 정보 sheet: 닉네임, 화면 (자동/라이트/다크), 기록 백업, 제보 폼 링크, 앱 정보 link (opens the 앱 정보 sheet).
// 내 지역 sits in this sheet too, but app.js draws and handles it (it is a list filter).
import { config } from './config.js';
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

/** createProfileView({getTheme, setTheme, exportFile, importFile}): wires the static sheet in index.html. */
export function createProfileView({ getTheme, setTheme, exportFile, importFile }) {
  const dlg = $('profile');
  const form = dlg.querySelector('form');
  const status = $('logBackupStatus');

  // 닉네임: the same open-wall:nick the report sheet uses; shown only while the report form has a nickname question.
  const mode = nickMode(config);
  const nickIn = $('pfNick');
  const readNick = () => { try { return loadNick(localStorage.getItem(NICK_KEY)); } catch { return ''; } };
  if (mode !== 'off') {
    $('pfNickRow').hidden = false;
    $('pfNickLabel').textContent = `닉네임 (${MAX_NICK}자까지)`;
    nickIn.maxLength = MAX_NICK;
    nickIn.addEventListener('change', () => { // saved cleaned, shown as saved
      const v = cleanNick(nickIn.value);
      nickIn.value = v;
      try { v ? localStorage.setItem(NICK_KEY, v) : localStorage.removeItem(NICK_KEY); } catch { /* private mode: not remembered */ }
    });
  }

  $('meBtn').addEventListener('click', () => {
    if (mode !== 'off') {
      nickIn.value = readNick();
      const locked = nickLocked(mode, nickIn.value);
      nickIn.readOnly = locked;
      $('pfNickLabel').textContent = locked ? '닉네임 (이벤트 중에는 바꿀 수 없어요)' : `닉네임 (${MAX_NICK}자까지)`;
    }
    form.elements.theme.value = getTheme();
    status.textContent = '';
    dlg.showModal();
  });
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close()); // the backdrop
  form.addEventListener('change', (e) => {
    if (e.target.name === 'theme') setTheme(e.target.value);
  });

  $('logExport').addEventListener('click', () => { status.textContent = exportFile(); });
  $('logImport').addEventListener('click', () => $('logImportFile').click());
  $('logImportFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // the same file can be picked again
    status.textContent = await importFile(file);
  });

  if (config.reportFormUrl) { // fixed constant, not user input
    $('pfReport').href = config.reportFormUrl;
    $('pfReportRow').hidden = false;
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
