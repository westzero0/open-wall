// src/poster-lockup.js — the 해벽 lockup (mark + wordmark, assets/haebyeok-lockup-dark.svg) drawn on a canvas in any ink, so a card can flip
// to dark type on a light ground. The path data is copied from the asset; test/poster-lockup.test.js fails when the asset changes.
export const LOCKUP = {
  w: 303,
  h: 140,
  paths: [
    "M125.5 36.7H169.5V49.4H125.5ZM147.7 52.5Q153.8 52.5 158.45 55.4Q163.1 58.3 165.8 63.449999999999996Q168.5 68.6 168.5 75.3Q168.5 82.0 165.8 87.15Q163.1 92.3 158.45 95.19999999999999Q153.8 98.1 147.7 98.1Q141.7 98.1 137.0 95.19999999999999Q132.3 92.3 129.60000000000002 87.15Q126.9 82.0 126.9 75.3Q126.9 68.6 129.60000000000002 63.449999999999996Q132.3 58.3 137.0 55.4Q141.7 52.5 147.7 52.5ZM147.7 65.8Q145.8 65.8 144.3 66.85Q142.8 67.9 141.95 70.0Q141.1 72.1 141.1 75.3Q141.1 78.5 141.95 80.65Q142.8 82.8 144.3 83.8Q145.8 84.8 147.7 84.8Q149.7 84.8 151.14999999999998 83.8Q152.6 82.8 153.45 80.65Q154.3 78.5 154.3 75.3Q154.3 72.1 153.45 70.0Q152.6 67.9 151.14999999999998 66.85Q149.7 65.8 147.7 65.8ZM191.5 23.599999999999994H206.8V117.4H191.5ZM182.3 61.0H196.5V73.9H182.3ZM172.0 25.099999999999994H187.0V113.8H172.0ZM139.8 26.0H155.7V44.8H139.8Z",
    "M260.2 36.7H282.4V49.4H260.2ZM260.2 56.099999999999994H282.9V68.8H260.2ZM218.1 29.099999999999994H234.1V40.89999999999999H247.8V29.099999999999994H263.6V76.1H218.1ZM234.1 53.199999999999996V63.4H247.8V53.199999999999996ZM229.1 83.4H293.8V117.5H277.6V96.1H229.1ZM277.6 23.69999999999999H293.8V79.7H277.6Z"
  ],
};

/**
 * drawLockup(g, x, y, height, ink, sun = '#f4b942') → the width drawn. Top-left at (x, y); the mark's sun disc is `sun`, everything else `ink`.
 * Strokes of the wordmark overlap, so they are filled nonzero (the SVG's own rule), never even-odd.
 */
export function drawLockup(g, x, y, height, ink, sun = '#f4b942') {
  const k = height / LOCKUP.h;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  g.save();
  g.translate(-25, -5);
  g.scale(0.625, 0.625);
  g.fillStyle = sun;
  g.beginPath();
  g.arc(120, 96, 80, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = ink;
  g.beginPath();
  g.moveTo(105, 8); g.lineTo(185, 8); g.lineTo(185, 232); g.lineTo(151, 232);
  g.closePath();
  g.fill();
  g.restore();
  g.fillStyle = ink;
  for (const d of LOCKUP.paths) g.fill(new Path2D(d));
  g.restore();
  return LOCKUP.w * k;
}
