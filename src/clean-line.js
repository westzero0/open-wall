// src/clean-line.js — one line of stranger-typed text, made safe. No DOM, no imports: shared by the browser and the Worker.
/**
 * cleanLine(v, max) → a short plain line. Links, markup, e-mails and phone-like numbers are removed, control and
 * direction-changing characters are dropped, spaces collapse, and it is cut at max code points. Non-strings give ''.
 */
export function cleanLine(v, max) {
  if (typeof v !== 'string') return '';
  const s = v.normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/<[^>]*>/g, ' ') // markup: the tag goes, its text stays
    .replace(/[<>]/g, ' ')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, ' ')
    .replace(/\S+@\S+\.\S+/g, ' ')
    .replace(/\+?(?:\d[\s().-]*){7,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...s].slice(0, max).join('').trim();
}
