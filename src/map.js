// src/map.js — Leaflet wrapper (global `L` from vendor/leaflet/leaflet.js). No DOM outside `container`.
import { mapPins, shortName } from './viewmodel.js';

const SEOUL = [37.5665, 126.978];
const FIT = { padding: [30, 30], maxZoom: 12 };
const LABEL_ZOOM = 13; // pin names only from street level; below it they would cover the map
const RANK = { soon: 0, open: 0, closed: 1, unknown: 2 }; // whose name wins when two would overlap
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
 * createMap(container, {onSelect, onError, onOk, covered, coveredTop}) → {select(name|null), setRows(rows, at), setUser(latlng|null), refresh(), fitAll()}
 * covered(): px of the map's foot hidden by the selected card; a tapped pin is panned above it.
 * coveredTop(): px of the map's top hidden by the page's sticky controls; the pin stays below them.
 * select(name|null): select a wall's pin from outside (e.g. the card's close button) without a click.
 * From zoom LABEL_ZOOM the pins carry their short names; names that would overlap are hidden.
 * onSelect(row|null, fromClick): a pin was clicked (row), the empty map was clicked (null), or
 * setRows refreshed/dropped the selected wall (fromClick = false). onError(): tiles never loaded.
 * Throws when Leaflet is missing; the caller shows the fallback message.
 */
export function createMap(container, { onSelect, onError = () => {}, onOk = () => {}, covered = () => 0, coveredTop = () => 0 }) {
  const { L } = window;
  if (!L) throw new Error('Leaflet not loaded');
  const map = L.map(container, { scrollWheelZoom: false }).setView(SEOUL, 10);
  map.attributionControl.setPosition('topright'); // the selected card covers the foot; the credit stays visible
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
  // Names beside the pins at LABEL_ZOOM+. A name that would overlap one already shown is hidden:
  // the selected wall first, then open, closed, unknown. The content is a text node, never HTML.
  const labels = () => {
    const on = map.getZoom() >= LABEL_ZOOM;
    markers.forEach((m, i) => {
      if (!on) return m.unbindTooltip();
      if (m.getTooltip()) return;
      const t = document.createElement('span');
      t.textContent = shortName(pins[i].row.wall);
      m.bindTooltip(t, { permanent: true, direction: 'right', offset: [10, 0], className: 'pin-label', opacity: 1 });
    });
    if (!on) return;
    const first = (i) => (pins[i].row.wall.name === selected ? -1 : RANK[pins[i].pin]);
    const kept = [];
    for (const i of markers.map((_, i) => i).sort((a, b) => first(a) - first(b))) {
      const box = markers[i].getTooltip()?.getElement();
      if (!box) continue;
      box.style.visibility = '';
      const r = box.getBoundingClientRect();
      const hit = kept.some((k) => r.left < k.right && k.left < r.right && r.top < k.bottom && k.top < r.bottom);
      box.style.visibility = hit ? 'hidden' : '';
      if (!hit) kept.push(r);
    }
  };

  const select = (name, fromClick) => {
    selected = name;
    restyle();
    labels();
    const p = pins.find((x) => x.row.wall.name === name);
    markers[pins.indexOf(p)]?.bringToFront();
    onSelect(p?.row ?? null, fromClick, at);
    // the selected card covers the map's foot: keep the tapped pin above it
    if (p && fromClick) {
      map.panInside([p.lat, p.lng], {
        paddingTopLeft: [24, coveredTop() + 24], paddingBottomRight: [24, covered() + 40], // the pin clears the card's edge by more than its own ring
        animate: !matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
    }
  };

  map.on('click', () => selected && select(null, true));
  map.on('zoomend', labels);
  dark.addEventListener('change', restyle);
  new MutationObserver(restyle).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); // 내 정보 › 화면

  const bounds = () => {
    const pts = pins.map((p) => [p.lat, p.lng]);
    if (user) pts.push(user.getLatLng());
    return pts.length ? L.latLngBounds(pts) : null;
  };

  return {
    select: (name) => select(name, false),
    setRows(rows, when) {
      at = when;
      pins = mapPins(rows).pins;
      layer.clearLayers();
      const pick = (p) => () => select(p.row.wall.name, true);
      // drawn in order, so every visible pin sits above every hit area:
      // 44px invisible hit areas, then 양달 rings (shape, not only color), then the pins
      for (const p of pins) {
        L.circleMarker([p.lat, p.lng], { radius: 22, stroke: false, fillOpacity: 0, bubblingMouseEvents: false })
          .on('click', pick(p)).addTo(layer);
      }
      for (const p of pins) {
        if (p.row.lit !== true || (p.pin !== 'open' && p.pin !== 'soon')) continue;
        L.circleMarker([p.lat, p.lng], { radius: 16, weight: 3, color: cssVar('--pin-sun'), fill: false, interactive: false }).addTo(layer);
      }
      markers = pins.map((p) => L.circleMarker([p.lat, p.lng], { bubblingMouseEvents: false, ...pinStyle(p, false) })
        .on('click', pick(p))
        .addTo(layer));
      user?.bringToFront();
      if (selected) select(pins.some((p) => p.row.wall.name === selected) ? selected : null, false);
      else labels();
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
      labels(); // measured again now that the map is visible
    },
    fitAll() {
      const b = bounds();
      if (b) map.fitBounds(b, { ...FIT, animate: fitted ? undefined : false });
      else map.setView(SEOUL, 10);
      fitted = true;
    },
  };
}
