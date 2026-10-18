#!/usr/bin/env node
// qa/check-integrity.mjs — 배포 전에 돌리는 정적 무결성 검사. 의존성 없음(Node 18+), 파일을 바꾸지 않는다.
//   node qa/check-integrity.mjs          # 오류가 있으면 종료 코드 1
//   node qa/check-integrity.mjs --strict # 경고도 오류로 친다
//
// 오류(ERROR): 배포하면 실제로 깨지는 것
//   - 버전 해시 불일치: version.json · sw.js 의 CACHE · index.html 의 ?v= 와 importmap
//   - 존재하지 않는 파일을 가리키는 import / href / src / url() / manifest 아이콘 / 사진
//   - CSP 에 없는 인라인 스크립트(브라우저가 막아서 앱이 안 뜬다)
//   - importmap 에 없는 모듈(버전 없는 주소로 불러와 옛 파일이 캐시에 남는다)
//   - 공유 페이지(w/)가 없는 암장을 가리킴, national.json 의 깨진 값
// 경고(WARN): 지워도 되는지 사람이 봐야 하는 것
//   - 어디서도 가져오지 않는 모듈, 어디서도 참조하지 않는 에셋·사진, CSP 에 남은 쓰지 않는 해시

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');
const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const exists = (p) => existsSync(join(ROOT, p));
function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = posix.join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out); else out.push(rel);
  }
  return out;
}

// 'a/b.html' 에서 본 href → 저장소 기준 경로. 바깥 주소·앵커·data: 등은 null.
function target(fromFile, ref) {
  if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref) || ref.includes('${')) return null;
  const clean = ref.split(/[?#]/)[0];
  if (!clean) return null;
  const abs = clean.startsWith('/') ? clean.slice(1) : posix.join(posix.dirname(fromFile), clean);
  const norm = posix.normalize(abs);
  return norm === '.' || norm === '' || norm.endsWith('/') ? posix.join(norm, 'index.html') : norm;
}
const check = (fromFile, ref, what) => {
  const t = target(fromFile, ref);
  if (t === null) return;
  const real = exists(t) && statSync(join(ROOT, t)).isDirectory() ? posix.join(t, 'index.html') : t;
  if (!exists(real)) err(`${fromFile}: ${what} → '${ref}' 가 없어요 (${real})`);
};

const htmlFiles = ['index.html', '404.html', ...walk('w').filter((f) => f.endsWith('.html'))];
const srcFiles = walk('src').filter((f) => f.endsWith('.js'));

// ── 1. 버전 해시: version.json · sw.js · index.html ──────────────────────────
const version = JSON.parse(read('version.json')).v;
const swCache = /const CACHE = 'haebyeok-shell-([^']+)'/.exec(read('sw.js'))?.[1];
if (!version) err('version.json: v 가 비어 있어요');
if (swCache !== version) err(`sw.js CACHE 'haebyeok-shell-${swCache}' ≠ version.json v '${version}' (사용자 폰에 옛 화면이 남아요)`);
const indexHtml = read('index.html');
const vRefs = new Set([...indexHtml.matchAll(/\?v=([0-9A-Za-z]+)/g)].map((m) => m[1]));
for (const v of vRefs) if (v !== version) err(`index.html: ?v=${v} ≠ version.json v '${version}'`);
if (vRefs.size === 0) warn('index.html: ?v= 가 하나도 없어요(캐시 무효화가 안 돼요)');

// ── 2. 인라인 스크립트 ↔ CSP 해시, importmap ─────────────────────────────────
const csp = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(indexHtml)?.[1] ?? '';
const cspHashes = new Set([...csp.matchAll(/'sha256-([^']+)'/g)].map((m) => m[1]));
const inline = [...indexHtml.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)];
const usedHashes = new Set();
let importmap = null;
for (const [, attrs, body] of inline) {
  const h = createHash('sha256').update(body).digest('base64');
  if (/type="importmap"/.test(attrs)) importmap = JSON.parse(body).imports;
  if (cspHashes.has(h)) usedHashes.add(h);
  else err(`index.html: 인라인 <script${attrs}> (${body.slice(0, 40).replace(/\s+/g, ' ')}…) 의 해시 sha256-${h} 가 CSP 에 없어요 → 브라우저가 막아요`);
}
for (const h of cspHashes) if (!usedHashes.has(h)) warn(`index.html: CSP 의 sha256-${h} 는 쓰는 인라인 스크립트가 없어요(남은 해시)`);

// ── 3. 모듈 import 가 가리키는 파일, importmap 범위 ──────────────────────────
const importedBy = new Map(); // 'src/x.js' → Set(가져오는 파일)
const note = (to, by) => { if (!importedBy.has(to)) importedBy.set(to, new Set()); importedBy.get(to).add(by); };
const IMPORT_RES = [
  /(?:^|[;\s}])(?:import|export)\s[^'"`;]*?\sfrom\s*['"]([^'"]+)['"]/g,
  /(?:^|[;\s}])import\s*['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
];
for (const f of srcFiles) {
  const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
  for (const re of IMPORT_RES) for (const m of code.matchAll(re)) {
    const spec = m[1];
    if (!/^(?:\.{0,2}\/)/.test(spec)) { warn(`${f}: 해석할 수 없는 import '${spec}'(번들러 없이는 안 돼요)`); continue; }
    const t = target(f, spec);
    if (t === null) continue;
    if (!exists(t)) err(`${f}: import '${spec}' 가 없어요 (${t})`);
    else note(t, f);
  }
}
// 문서가 직접 불러오는 스크립트도 "쓰는 모듈"이다.
const loadedByHtml = new Set();
for (const f of htmlFiles) {
  const html = read(f);
  for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) { const t = target(f, m[1]); if (t) loadedByHtml.add(t); }
}
if (importmap) {
  for (const [k, v] of Object.entries(importmap)) {
    check('index.html', k, `importmap 키`);
    check('index.html', v, `importmap 값`);
    if (k.split('?')[0] !== v.split('?')[0]) err(`importmap: '${k}' → '${v}' 파일이 달라요`);
  }
  const mapped = new Set(Object.keys(importmap).map((k) => target('index.html', k)));
  for (const [to, by] of importedBy) {
    if (to.startsWith('src/') && !mapped.has(to)) err(`${to}: ${[...by].slice(0, 2).join(', ')} 가 가져오는데 importmap 에 없어요(?v= 없이 불러와 옛 파일이 캐시에 남아요)`);
  }
}
for (const f of srcFiles) if (!importedBy.has(f) && !loadedByHtml.has(f)) warn(`${f}: 어디서도 가져오지 않는 파일이에요(안 쓰면 지워도 돼요)`);

// ── 4. HTML · CSS · manifest · sw.js 의 파일 참조 ─────────────────────────────
for (const f of htmlFiles) {
  const html = read(f).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (m) => m.match(/^<script[^>]*>/)[0]); // 인라인 코드 안의 문자열은 제외
  for (const m of html.matchAll(/\s(?:href|src|poster)="([^"]*)"/g)) check(f, m[1], '참조');
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) for (const part of m[1].split(',')) check(f, part.trim().split(/\s+/)[0], 'srcset');
  for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) check(f, m[1], 'url()');
}
for (const m of read('style.css').matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) check('style.css', m[1], 'url()');
const manifest = JSON.parse(read('manifest.webmanifest'));
for (const i of manifest.icons ?? []) check('manifest.webmanifest', i.src, '아이콘');
check('manifest.webmanifest', manifest.start_url, 'start_url');
// 코드 안에 문자열로 적힌 에셋·데이터 경로. 없어도 앱이 알아서 숨기는 선택 파일은 뺀다(src/contrib-view.js, src/store.js, src/config.js 의 스위치).
const OPTIONAL = new Set(['data/contributors.json', 'data/single-pitch.json']);
for (const f of [...srcFiles, 'sw.js']) {
  for (const m of read(f).matchAll(/['"`]((?:\.{1,2}\/)?(?:assets|data|vendor)\/[A-Za-z0-9_./-]+\.[a-z0-9]{2,5})['"`]/g)) {
    const spec = m[1];
    const t = f.startsWith('src/') ? (spec.startsWith('.') ? target(f, spec) : spec) : spec;
    if (t && !OPTIONAL.has(t) && !exists(t)) err(`${f}: 코드에 적힌 경로 '${spec}' 가 없어요`);
  }
}

// ── 5. 공유 페이지(w/)와 암장 데이터(data/national.json) ──────────────────────
const national = JSON.parse(read('data/national.json'));
const walls = national.walls ?? [];
const names = new Set();
for (const [i, w] of walls.entries()) {
  const tag = `data/national.json: walls[${i}] '${w?.name}'`;
  if (!w?.name || typeof w.name !== 'string') { err(`${tag}: name 이 없어요`); continue; }
  if (names.has(w.name)) err(`${tag}: 이름이 중복돼요`);
  names.add(w.name);
  const { lat, lng } = w.location ?? w.sun ?? {}; // 좌표는 location, 없으면 sun 에 있다
  if (lat === undefined && lng === undefined) warn(`${tag}: 좌표(location · sun)가 없어요(지도·거리순에서 빠져요)`);
  else if (typeof lat !== 'number' || typeof lng !== 'number' || lat < 32.5 || lat > 39 || lng < 124 || lng > 132.5) err(`${tag}: 좌표가 숫자가 아니거나 한국 밖이에요 (${lat}, ${lng})`);
  if (w.photo && !exists(posix.join('data', w.photo))) err(`${tag}: 사진 data/${w.photo} 가 없어요`);
  if (w.checked_at && !/^\d{4}-\d{2}-\d{2}$/.test(w.checked_at)) err(`${tag}: checked_at '${w.checked_at}' 형식이 YYYY-MM-DD 가 아니에요`);
}
const shared = new Map();
for (const f of walk('w').filter((p) => p.endsWith('/index.html'))) {
  const m = /location\.replace\('[^']*\?wall=([^'&]+)/.exec(read(f));
  if (!m) { err(`${f}: 앱으로 보내는 ?wall= 리다이렉트가 없어요`); continue; }
  const name = decodeURIComponent(m[1]);
  if (!names.has(name)) err(`${f}: '${name}' 암장이 national.json 에 없어요(죽은 공유 링크)`);
  if (shared.has(name)) err(`${f}: '${name}' 공유 페이지가 ${shared.get(name)} 와 중복돼요`);
  shared.set(name, f);
}
for (const n of names) if (!shared.has(n)) warn(`w/: '${n}' 암장은 공유 페이지가 없어요`);

// ── 6. 어디서도 참조하지 않는 에셋 · 사진 ─────────────────────────────────────
const corpusFiles = [...htmlFiles, ...srcFiles, 'style.css', 'sw.js', 'manifest.webmanifest', 'data/national.json', 'README.md'];
const corpus = corpusFiles.map((f) => (f === 'index.html' ? read(f).replace(/<script type="importmap">[\s\S]*?<\/script>/, '') : read(f))).join('\n');
const assets = [...walk('assets'), ...walk('data/photos')].filter((f) => !/\.(?:md|txt)$/i.test(f) && !posix.basename(f).startsWith('.'));
const dynamicDirs = new Set(); // 이름을 조립해서 부르는 폴더(예: climbers/${key}.png)는 확정할 수 없다
for (const m of corpus.matchAll(/(assets\/[A-Za-z0-9_-]+\/)\$\{/g)) dynamicDirs.add(m[1]);
for (const f of assets) {
  const base = posix.basename(f);
  if (corpus.includes(base)) continue;
  const dir = [...dynamicDirs].find((d) => f.startsWith(d));
  if (dir) continue;
  warn(`${f}: 어디서도 참조하지 않아요(안 쓰면 지워도 돼요)`);
}

// ── 결과 ─────────────────────────────────────────────────────────────────────
const out = (label, list) => { if (list.length) { console.log(`\n${label} (${list.length})`); for (const m of list) console.log(`  - ${m}`); } };
out('ERROR', errors);
out('WARN', warns);
console.log(`\n검사: HTML ${htmlFiles.length}개 · 모듈 ${srcFiles.length}개 · 암장 ${walls.length}곳 · 공유 페이지 ${shared.size}개 · 버전 ${version}`);
console.log(errors.length || (STRICT && warns.length) ? `✗ 실패 — 오류 ${errors.length}, 경고 ${warns.length}` : `✓ 통과 — 오류 0, 경고 ${warns.length}`);
process.exit(errors.length || (STRICT && warns.length) ? 1 : 0);
