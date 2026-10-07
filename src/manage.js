// src/manage.js
import { exportJson, keepGeo, mergeWalls, normalizeWall, parseJson } from './store.js';
import { CSV_HEADERS, csvToWalls, parseCsv, wallToRow } from './csv.js';
import { state, setWalls } from './state.js';

const $ = (id) => document.getElementById(id);
const DAY_HINT = '09:00-18:00 / 휴무 / 비움';
const HINTS = {
  월: DAY_HINT, 화: DAY_HINT, 수: DAY_HINT, 목: DAY_HINT, 금: DAY_HINT, 토: DAY_HINT, 일: DAY_HINT,
  동절기: '없음 / 휴장 / 변경', 동절시간: '10:00-16:00', 동절실내안내: '실내 리드벽 운영 · 예약 2부제', 태그: '리드;볼더', 임시휴장일: '2026-10-09;2026-10-10',
  우천규칙: 'O 면 있음', 방향: 'N NE E SE S SW W NW', 확인일: '2026-09-20', 주차: '무료 / 유료 / 없음 / 모름',
};

let editingName = null; // null while adding a new wall

function download(filename, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function openEditor(wall) {
  editingName = wall ? wall.name : null;
  const values = wall ? wallToRow(wall) : CSV_HEADERS.map(() => '');
  $('editFields').replaceChildren(
    ...CSV_HEADERS.map((header, i) => {
      const label = document.createElement('label');
      label.textContent = header;
      const input = document.createElement('input');
      input.value = values[i];
      input.placeholder = HINTS[header] ?? '';
      if (header === '이름') input.required = true;
      label.append(input);
      return label;
    }),
  );
  $('editor').showModal();
}

$('addWall').addEventListener('click', () => openEditor(null));
document.addEventListener('wall:edit', (e) => openEditor(state.walls.find((w) => w.name === e.detail)));
document.addEventListener('wall:delete', (e) => {
  if (confirm(`'${e.detail}'을(를) 삭제할까요?`)) setWalls(state.walls.filter((w) => w.name !== e.detail));
});

$('editForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.submitter?.value !== 'save') return $('editor').close();
  const values = [...$('editFields').querySelectorAll('input')].map((i) => i.value);
  const { walls: parsed, errors } = csvToWalls([CSV_HEADERS, values]);
  if (errors.length) return alert(errors.join('\n'));
  const wall = keepGeo(
    state.walls.find((w) => w.name === editingName),
    normalizeWall(parsed[0]),
  );
  if (state.walls.some((w) => w.name === wall.name && w.name !== editingName)) {
    return alert('같은 이름의 외벽이 이미 있어요');
  }
  setWalls(
    editingName === null
      ? [...state.walls, wall]
      : state.walls.map((w) => (w.name === editingName ? wall : w)),
  );
  $('editor').close();
});

function report(res, extra = [], updatedLabel = '덮어씀') {
  alert([`추가 ${res.added}곳, ${updatedLabel} ${res.updated}곳, 건너뜀 ${res.skipped}곳`, ...extra].join('\n'));
}

async function readIncoming(file) {
  if (/\.json$/i.test(file.name)) return { walls: parseJson(await file.text()), errors: [] };
  let csv;
  if (/\.csv$/i.test(file.name)) csv = await file.text();
  else {
    if (typeof XLSX === 'undefined') throw new Error('엑셀 읽기 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인하거나 CSV로 저장해 가져오세요.');
    const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    csv = XLSX.utils.sheet_to_csv(book.Sheets[book.SheetNames[0]], { dateNF: 'yyyy-mm-dd' });
  }
  return csvToWalls(parseCsv(csv));
}

$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const { walls: incoming, errors } = await readIncoming(file);
    const res = mergeWalls(state.walls, incoming, 'overwrite');
    setWalls(res.walls);
    report(res, errors);
  } catch (err) {
    alert(`가져오지 못했어요: ${err.message}`);
  }
});

$('loadNational').addEventListener('click', async () => {
  try {
    const list = parseJson(await (await fetch('data/national.json')).text());
    const res = mergeWalls(state.walls, list, 'skip');
    setWalls(res.walls);
    report(res, [], '새 정보 보강'); // skip mode only fills what an existing wall lacks
  } catch (err) {
    alert(`불러오지 못했어요: ${err.message}`);
  }
});

$('csvTemplate').addEventListener('click', () =>
  download('외벽_양식.csv', `﻿${CSV_HEADERS.join(',')}\n`, 'text/csv;charset=utf-8'));
$('exportJson').addEventListener('click', () =>
  download('open-wall.json', exportJson(state.walls), 'application/json'));
