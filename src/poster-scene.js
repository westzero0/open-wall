// src/poster-scene.js — the picture a card is set on when there is no photo (sky, far ridge, rock face), the time-of-day palettes,
// and the legibility decision (veil strength and ink) for any ground. Pure apart from drawScene; made on this device, nothing is sent.
export const DOME_KEY = 'open-wall:poster-dome';

// the four skies: rgb triples; glow is [rgb, strength]; the numbers come from the approved mockups (dusk, day) and the same recipe darker (dawn, night)
export const PALETTES = {
  dawn: { top: [22, 32, 64], mid: [110, 88, 120], low: [178, 124, 116], glow: [[240, 150, 110], 0.38], sun: [0.3, 0.38], cloud: [170, 140, 150], haze: [84, 70, 98], rock: [88, 68, 76], rim: [200, 130, 110] },
  day: { top: [34, 52, 82], mid: [84, 108, 136], low: [128, 148, 164], glow: [[206, 218, 232], 0.2], sun: [0.72, 0.3], cloud: [150, 164, 180], haze: [72, 88, 110], rock: [76, 82, 92], rim: [140, 160, 180] },
  dusk: { top: [41, 66, 110], mid: [158, 100, 95], low: [201, 138, 102], glow: [[255, 183, 110], 0.51], sun: [0.2, 0.42], cloud: [214, 156, 126], haze: [150, 122, 134], rock: [188, 128, 92], rim: [255, 190, 130] }, // the mockup's gold, held back in the sky (cream type must hold on it) and the sun set low at the left
  night: { top: [6, 10, 24], mid: [18, 28, 52], low: [40, 52, 84], glow: [[120, 140, 190], 0.18], sun: [0.7, 0.2], cloud: [50, 62, 92], haze: [28, 36, 60], rock: [40, 44, 56], rim: [90, 110, 150] },
};

/** paletteFor(hour, kind) → 'dawn' | 'day' | 'dusk' | 'night' for a time of day in hours (10.5 = 10:30) and what the sun does then ('lit' | 'shade' | 'night' | null); unknown → 'day'. */
export function paletteFor(hour, kind = null) {
  if (kind === 'night') return 'night'; // no sun at all: whatever the clock says
  if (!Number.isFinite(hour)) return 'day';
  if (hour >= 19 && (kind === 'lit' || kind === 'shade')) return 'dusk'; // a summer evening that is still lit
  if (hour < 6) return 'dawn';
  if (hour < 16) return 'day';
  if (hour < 19) return 'dusk';
  return 'night';
}

/** seedOf(id) → a stable integer for a record id, so the same card always gets the same picture. */
export function seedOf(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

/** loadDome(storage) → 'on' | 'off': the last choice of the sun-path switch on this device; anything else, or a blocked storage, is 'on'. */
export function loadDome(storage) {
  try {
    return storage.getItem(DOME_KEY) === 'off' ? 'off' : 'on';
  } catch {
    return 'on';
  }
}

/** saveDome(storage, v) → whether it was kept (only 'on' and 'off'; never throws). */
export function saveDome(storage, v) {
  if (v !== 'on' && v !== 'off') return false;
  try {
    storage.setItem(DOME_KEY, v);
    return true;
  } catch {
    return false;
  }
}

// ---- legibility: WCAG contrast of an ink on the worst pixel of a zone
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luma = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

/** zoneContrast(rgba, w, h, [x, y, zw, zh], [r, g, b]) → the lowest contrast ratio an ink has against any pixel of the zone (alpha ignored). */
export function zoneContrast(rgba, w, h, [x, y, zw, zh], ink) {
  const li = luma(...ink);
  let worst = Infinity;
  for (let j = Math.max(0, Math.floor(y)); j < Math.min(h, Math.ceil(y + zh)); j += 1) {
    for (let i = Math.max(0, Math.floor(x)); i < Math.min(w, Math.ceil(x + zw)); i += 1) {
      const o = (j * w + i) * 4;
      const lp = luma(rgba[o], rgba[o + 1], rgba[o + 2]);
      const c = (Math.max(li, lp) + 0.05) / (Math.min(li, lp) + 0.05);
      if (c < worst) worst = c;
    }
  }
  return worst === Infinity ? 21 : worst;
}

export const MAX_VEIL = 0.55;
const VEILS = Array.from({ length: 10 }, (_, i) => Math.round((0.1 + i * 0.05) * 100) / 100); // 0.10 … 0.55

/**
 * decideInk(measure) → { ink: 'cream' | 'dark', k, ok }: measure(ink, k) → [{ need, got }] for every zone. The lightest veil k that lets every zone reach
 * its need in cream ink; failing that, in dark ink; failing both, the ink whose worst shortfall is smaller, at the strongest veil (ok: false). Always ends.
 */
export function decideInk(measure) {
  const short = (rows) => Math.max(...rows.map((r) => r.need - r.got));
  const best = {};
  for (const ink of ['cream', 'dark']) {
    for (const k of VEILS) {
      const s = short(measure(ink, k));
      if (s <= 0) return { ink, k, ok: true };
      best[ink] = s;
    }
  }
  return { ink: best.cream <= best.dark ? 'cream' : 'dark', k: MAX_VEIL, ok: false };
}

// ---- the picture: value noise, a sky, a far ridge in haze, a rock face with strata and raking light
const rnd = (a, b, s) => {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(s, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const fade = (t) => t * t * (3 - 2 * t);
function noise(x, y, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = fade(x - x0), fy = fade(y - y0);
  const a = rnd(x0, y0, s), b = rnd(x0 + 1, y0, s), c = rnd(x0, y0 + 1, s), d = rnd(x0 + 1, y0 + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y, oct, s, base, persist = 0.5) {
  let sum = 0, amp = 1, tot = 0, f = base;
  for (let o = 0; o < oct; o += 1) {
    sum += amp * noise(x * f, y * f, s + o * 101);
    tot += amp;
    amp *= persist;
    f *= 2;
  }
  return sum / tot;
}
const mix = (a, b, t) => a + (b - a) * t;
const clip = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** scenePixels(name, seed, w, h) → Uint8ClampedArray RGBA of a w×h picture in the palette `name`; the same seed gives the same picture. */
export function scenePixels(name, seed, w, h) {
  const P = PALETTES[name] ?? PALETTES.day;
  const out = new Uint8ClampedArray(w * h * 4);
  const hpx = (h / w) * 1080; // coordinates in 1080-wide card pixels
  const ridge = new Float32Array(w), edge = new Float32Array(w);
  for (let i = 0; i < w; i += 1) {
    const u = i / w;
    ridge[i] = 0.34 + (noise(u * 14, 0.5, seed + 7) - 0.5) * 0.1 + (noise(u * 60, 0.5, seed + 8) - 0.5) * 0.018;
    edge[i] = 0.425 + u * 0.075 + (noise(u * 12, 0.5, seed + 9) - 0.5) * 0.07 + (noise(u * 70, 0.5, seed + 10) - 0.5) * 0.012;
  }
  const hgt = new Float32Array(w * h);
  const aux = new Float32Array(w * h * 3); // n, streak, cracks
  for (let j = 0; j < h; j += 1) {
    const v = j / h;
    for (let i = 0; i < w; i += 1) {
      const u = i / w;
      if (v < edge[i] - 0.02) continue;
      const n = fbm(u, v, 6, seed + 1, 2.5, 0.55);
      const warp = fbm(u, v, 3, seed + 2, 2) * 8.5;
      const ph = v * 1350 * 0.011 + warp;
      const st = Math.sin(ph) * 0.5 + 0.5;
      const k = j * w + i;
      hgt[k] = 0.62 * n + 0.38 * st;
      aux[k * 3] = n;
      aux[k * 3 + 1] = fbm(u * 0.8, v * 3, 4, seed + 3, 3);
      aux[k * 3 + 2] = clip(1 - Math.abs(Math.sin(ph)) * 22) * 0.3;
    }
  }
  const sc = 1080 / w;
  for (let j = 0; j < h; j += 1) {
    const v = j / h;
    for (let i = 0; i < w; i += 1) {
      const u = i / w;
      const s = clip(v / 0.5);
      const rgb = [0, 0, 0];
      const dx = (u - P.sun[0]) * 1080, dy = (v - P.sun[1]) * hpx, r = Math.hypot(dx, dy);
      const glow = Math.exp(-((r / (0.3 * 1080)) ** 2)) * P.glow[1] + Math.exp(-((r / (0.07 * 1080)) ** 2)) * P.glow[1] * 0.8;
      const cm = clip((fbm(u, v, 5, seed + 5, 2.2) - 0.52) * 3.2) * clip(1 - v / 0.5) * 0.55;
      for (let c = 0; c < 3; c += 1) {
        let sky = s < 0.55 ? mix(P.top[c], P.mid[c], s / 0.55) : mix(P.mid[c], P.low[c], (s - 0.55) / 0.45);
        sky += P.glow[0][c] * glow;
        sky = mix(sky, P.cloud[c], cm);
        if (v > ridge[i]) sky = mix(sky, P.haze[c] * (0.92 + 0.12 * clip((v - 0.34) / 0.12)), 0.92);
        rgb[c] = sky;
      }
      const m = clip(((v - edge[i]) * h) / 3);
      if (m > 0) {
        const k = j * w + i;
        const gx = ((hgt[k + (i < w - 1 ? 1 : 0)] - hgt[k - (i > 0 ? 1 : 0)]) / sc) * (i > 0 && i < w - 1 ? 0.5 : 1);
        const gy = ((hgt[k + (j < h - 1 ? w : 0)] - hgt[k - (j > 0 ? w : 0)]) / sc) * (j > 0 && j < h - 1 ? 0.5 : 1);
        const shade = 0.62 + clip((-gx * 0.75 - gy * 0.5) * 110, -0.42, 0.55);
        const lg = clip(1.22 - 0.62 * (0.55 * u + 0.45 * (v - edge[i])), 0.35, 1.3);
        const body = (0.52 + 0.9 * aux[k * 3]) * (0.86 + 0.28 * aux[k * 3 + 1]) * (1 - aux[k * 3 + 2]) * shade * lg;
        const rim = clip(1 - (v - edge[i]) / 0.1) * 0.3;
        for (let c = 0; c < 3; c += 1) rgb[c] = mix(rgb[c], mix(P.rock[c] * body, P.rim[c], rim), m);
      }
      const rr = Math.hypot((u - 0.5) * 2, (v - 0.5) * 2);
      const vig = 1 - 0.26 * clip(rr - 0.35, 0, 1.2) ** 1.6;
      const o = (j * w + i) * 4;
      out[o] = rgb[0] * vig;
      out[o + 1] = rgb[1] * vig;
      out[o + 2] = rgb[2] * vig;
      out[o + 3] = 255;
    }
  }
  return out;
}

export const SCENE_W = 270; // drawn this wide, then stretched: 1080 px of noise per card would be slow and no better to look at

/** drawScene(g, w, h, name, seed): paints the picture onto a canvas context, w×h pixels (the low-resolution pixels are stretched, smoothed). */
export function drawScene(g, w, h, name, seed) {
  const gw = SCENE_W, gh = Math.round((SCENE_W * h) / w);
  const small = document.createElement('canvas');
  small.width = gw;
  small.height = gh;
  small.getContext('2d').putImageData(new ImageData(scenePixels(name, seed, gw, gh), gw, gh), 0, 0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, w, h);
}
