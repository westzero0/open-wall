// Route picker logic for the planner record (no DOM). Matching: 번호 > 이름 앞 > 초성 앞 > 이름 포함 > 초성 포함.
import { sortRoutes } from './crag-routes.js';

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

/** 한글 음절은 초성만, 그 밖은 그대로(영문 소문자). */
export function choseong(text) {
  let out = '';
  for (const ch of String(text ?? '').normalize('NFC').toLowerCase()) {
    const c = ch.codePointAt(0);
    out += c >= 0xac00 && c <= 0xd7a3 ? CHO[Math.floor((c - 0xac00) / 588)] : ch;
  }
  return out;
}

const norm = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, '');
const JAMO_ONLY = /^[ㄱ-ㅎ]+$/;

function tier(route, q, jamo) {
  const digits = q.replace(/^#/, '');
  if (route.no != null && /^\d+$/.test(digits)) {
    const n = String(route.no);
    if (n === digits) return 0;
    if (n.startsWith(digits)) return 1; // number prefix: '12' finds 12, 120-129, not 112
  }
  const name = norm(route.name);
  if (name.startsWith(q)) return 2;
  const cho = choseong(name);
  if (jamo && cho.startsWith(q)) return 3;
  if (name.includes(q)) return 4;
  if (jamo && cho.includes(q)) return 5;
  return -1;
}

export function pickRoutes(routes, { query = '', area = null, sort = 'no', history = new Map(), chosen = new Map() } = {}) {
  const all = Array.isArray(routes) ? routes : [];
  const areaSet = new Set(all.map((r) => r.area).filter(Boolean));
  const areas = areaSet.size >= 2 ? [...areaSet] : [];
  const q = norm(query);
  const pool = area ? all.filter((r) => r.area === area) : all;
  const mk = (route, section) => ({
    route, section, project: isProject(route), chosen: chosen.get(route.id) ?? null,
  });
  const isProject = (r) => { const h = history.get(r.id); return !!h && h.tried > 0 && !h.sent; };

  let rows;
  if (!q) {
    const proj = pool.filter(isProject).sort((a, b) => history.get(b.id).tried - history.get(a.id).tried || (a.no ?? Infinity) - (b.no ?? Infinity));
    const rest = pool.filter((r) => !isProject(r));
    const sorted = sort === 'grade' ? sortRoutes(rest, 'grade', 1) : sort === 'gradeDesc' ? sortRoutes(rest, 'grade', -1) : sortRoutes(rest, 'no', 1);
    rows = [...proj.map((r) => mk(r, 'project')), ...sorted.map((r) => mk(r, 'all'))];
  } else {
    const jamo = JAMO_ONLY.test(q);
    rows = pool
      .map((r) => [tier(r, q, jamo), r])
      .filter(([t]) => t >= 0)
      .sort((a, b) => a[0] - b[0] || (a[1].no ?? Infinity) - (b[1].no ?? Infinity))
      .map(([, r]) => mk(r, 'all'));
  }
  const raw = String(query ?? '').normalize('NFC').trim();
  const custom = raw && !all.some((r) => norm(r.name) === q) ? raw : null;
  return { rows, areas, custom };
}
