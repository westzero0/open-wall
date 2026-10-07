// src/map.js — Leaflet wrapper (global `L` from vendor/leaflet/leaflet.js). No DOM outside `container`.
import { mapPins } from './viewmodel.js';

const SEOUL = [37.5665, 126.978];
const FIT = { padding: [30, 30], maxZoom: 12 };
const dark = matchMedia('(prefers-color-scheme: dark)');
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Shape carries the meaning as well as color: open = filled, soon = filled with a thick ring,
// closed = smaller filled, unknown = hollow ring, approximate position = dashed outline.
function pinStyle({ pin, approx }, selected) {
  const edge = cssVar('--pin-edge');
  const s = {
    open: { radius: 9, weight: 2, color: edge, fillColor: cssVar('--pin-open'), fillOpacity: 1 },
    soon: { radius: 9, weight: 4, color: edge, fillColor: cssVar('--pin-soon'), fillOpacity: 1 },
    closed: { radius: 7, weight: 2, color: edge, fillColor: cssVar('--pin-closed'), fillOpacity: 1 },
    unknown: { radius: 7, weight: 3, color: cssVar('--pin-unknown'), fillOpacity: 0 },
  }[pin];
  s.dashArray = approx ? '3 3' : null;
  if (selected) {
    s.radius += 3;
    s.weight += 2;
  }
  return s;
}

/**
 * createMap(container, {onSelect, onError}) → {setRows(rows, at), setUser(latlng|null), refresh(), fitAll()}
 * onSelect(row|null, fromClick): a pin was clicked (row), the empty map was clicked (null), or
 * setRows refreshed/dropped the selected wall (fromClick = false). onError(): tiles never loaded.
 * Throws when Leaflet is missing; the caller shows the fallback message.
 */
export function createMap(container, { onSelect, onError = () => {}, onOk = () => {} }) {
  const { L } = window;
  if (!L) throw new Error('Leaflet not loaded');
  const map = L.map(container, { scrollWheelZoom: false }).setView(SEOUL, 10);
  let tilesOk = false;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  })
    .on('tileload', () => { tilesOk = true; onOk(); })
    .on('tileerror', () => tilesOk || onError())
    .addTo(map);

  const layer = L.layerGroup().addTo(map);
  let pins = [];
  let markers = [];
  let selected = null; // wall name
  let user = null;
  let at = null;
  let fitted = false; // first fit is instant; later ones may animate

  const restyle = () => {
    markers.forEach((m, i) => m.setStyle(pinStyle(pins[i], pins[i].row.wall.name === selected)));
    user?.setStyle({ color: '#fff', fillColor: cssVar('--pin-me') });
  };
  const select = (name, fromClick) => {
    selected = name;
    restyle();
    const p = pins.find((x) => x.row.wall.name === name);
    markers[pins.indexOf(p)]?.bringToFront();
    onSelect(p?.row ?? null, fromClick, at);
  };

  map.on('click', () => selected && select(null, true));
  dark.addEventListener('change', restyle);

  const bounds = () => {
    const pts = pins.map((p) => [p.lat, p.lng]);
    if (user) pts.push(user.getLatLng());
    return pts.length ? L.latLngBounds(pts) : null;
  };

  return {
    setRows(rows, when) {
      at = when;
      pins = mapPins(rows).pins;
      layer.clearLayers();
      markers = pins.map((p) => L.circleMarker([p.lat, p.lng], { bubblingMouseEvents: false, ...pinStyle(p, false) })
        .on('click', () => select(p.row.wall.name, true))
        .addTo(layer));
      user?.bringToFront();
      if (selected) select(pins.some((p) => p.row.wall.name === selected) ? selected : null, false);
    },
    setUser(latlng) {
      user?.remove();
      user = latlng
        ? L.circleMarker(latlng, { radius: 6, weight: 2, color: '#fff', fillColor: cssVar('--pin-me'), fillOpacity: 1, interactive: false }).addTo(map)
        : null;
      if (user && fitted && container.offsetParent) map.flyToBounds(bounds(), FIT);
    },
    refresh() {
      map.invalidateSize();
      restyle();
    },
    fitAll() {
      const b = bounds();
      if (b) map.fitBounds(b, { ...FIT, animate: fitted ? undefined : false });
      else map.setView(SEOUL, 10);
      fitted = true;
    },
  };
}
