// src/pin-picker.js — "지도에서 고르기": a sheet with a map under a fixed cross; pan the map until the cross sits on the wall, then 정하기.
// 지금 위치 only moves the map to where the device is; nothing is read into a field or sent until the person confirms with 정하기
// (docs/superpowers/specs/2026-10-30-contribution-fill-in-design.md: the position stays in memory, the value sent is the cross's spot, 4 decimals).
// Uses Leaflet and the same OpenStreetMap tiles as the main map; no new external host. DOM via el()/textContent only.
import { el } from './dom.js';

const KOREA = [36.3, 127.8];
const WALL_ZOOM = 16;

/** the device's position as {lat,lng}; rejects with a one-line reason (same wording as the list's 내 위치). */
export function currentPosition() {
  return new Promise((ok, no) => {
    if (!window.isSecureContext || !navigator.geolocation) {
      return no(new Error(window.isSecureContext ? '이 브라우저는 위치를 지원하지 않아요.' : 'https 주소에서만 내 위치를 쓸 수 있어요.'));
    }
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => no(new Error(e.code === 1 ? '위치 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요.' : '위치를 가져오지 못했어요. 잠시 뒤 다시 시도해 주세요.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

/**
 * openPinPicker({ title, start, onPick, locate }) → the dialog.
 * start {lat,lng}|null: where the map opens (the wall's known point); onPick({lat,lng}): the cross's spot, on 정하기;
 * locate(): Promise<{lat,lng}> (default currentPosition), injectable for tests.
 */
export function openPinPicker({ title, start = null, onPick, locate = currentPosition }) {
  const { L } = window;
  const back = document.activeElement; // the button that opened this: focus goes back to it on close
  const note = el('p', { class: 'sh-hint pp-note', role: 'status' }, '지도를 움직여 가운데 십자를 암장 앞에 맞춰 주세요. 지도가 어려우면 닫고 위도, 경도를 직접 적어도 돼요.');
  const mapBox = el('div', { class: 'pp-map', role: 'group', 'aria-label': '지도. 화살표 키로 움직여 가운데 십자를 암장 앞에 맞춰요' });
  const cross = el('div', { class: 'pp-cross', 'aria-hidden': 'true' });
  const here = el('button', { type: 'button', class: 'ws-ask pp-here' }, '지금 위치로 옮기기');
  const ok = el('button', { type: 'button', class: 'btn primary' }, '이 위치로 정하기');
  const close = el('button', { type: 'button', class: 'sh-close', 'data-close': '' }, '닫기');
  const dlg = el('dialog', { class: 'sheet pin-picker', 'aria-labelledby': 'pp-title' },
    el('form', { method: 'dialog' },
      el('div', { class: 'sh-head' }, el('h2', { id: 'pp-title', tabindex: '-1' }, `${title} 위치`)),
      L ? el('div', { class: 'pp-stage' }, mapBox, cross) : el('p', { class: 'sh-hint' }, '지도를 불러오지 못했어요. 위도, 경도를 직접 적어 주세요.'),
      note,
      el('div', { class: 'pp-actions' }, L ? here : null, L ? ok : null, close)));
  document.body.append(dlg);
  dlg.addEventListener('close', () => { map?.remove(); dlg.remove(); if (back?.isConnected) back.focus?.(); }, { once: true });
  close.addEventListener('click', () => dlg.close());

  let map = null;
  if (L) {
    map = L.map(mapBox, { scrollWheelZoom: true, zoomControl: true }).setView(start ? [start.lat, start.lng] : KOREA, start ? WALL_ZOOM : 7);
    map.attributionControl.setPosition('topright');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    ok.addEventListener('click', () => { const c = map.getCenter(); dlg.close(); onPick({ lat: c.lat, lng: c.lng }); });
    here.addEventListener('click', async () => {
      here.disabled = true;
      here.setAttribute('aria-busy', 'true');
      try {
        const p = await locate();
        map.setView([p.lat, p.lng], 18);
        note.textContent = '지금 있는 곳으로 옮겼어요. 십자가 암장 앞이 맞으면 정하기를 눌러 주세요.';
      } catch (e) {
        note.textContent = e.message;
      } finally {
        here.disabled = false;
        here.removeAttribute('aria-busy');
      }
    });
  }
  dlg.showModal();
  setTimeout(() => map?.invalidateSize(), 0); // the map was sized while the dialog was still closed
  return dlg;
}
