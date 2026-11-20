// src/axis-gap.js — how far either side of the hours axis' time tag (14:00) the axis labels give way. No DOM.
// The axis runs 06:00-24:00 (1080 min) across the strip, so a fixed number of minutes is a different number of pixels on every
// screen: the gap is worked out in pixels (half the tag + half the label + a little air) and turned into minutes for the strip's width.
export const AXIS_SPAN_MIN = 1080;
const TAG_HALF_PX = 26; // "14:00" in the tag, with its padding, at the base text size
const AIR_PX = 4;

/** tagGapMin(plotPx, scale, labelHalfPx) → minutes: a label closer than this to the tag is not drawn. scale = rem / 16 (the text size). */
export function tagGapMin(plotPx, scale = 1, labelHalfPx = 8) {
  const px = (TAG_HALF_PX + labelHalfPx + AIR_PX) * scale;
  return Math.ceil((px * AXIS_SPAN_MIN) / Math.max(plotPx, 1));
}

/** the strip's width before it is on screen: the sheet's width less its side padding and the label column (3.6rem). */
export function estimatePlotPx(sheetPx, scale = 1) {
  return Math.max(120, sheetPx - (2 * 16 + 3.6 * 16) * scale);
}
