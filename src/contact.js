// src/contact.js — 서비스 문의 (docs/system/permissions.md "서비스 문의"). No DOM: the form and the Worker share these rules.
// Unlike a board line, a 문의 may carry e-mail / phone (the sender chose to), so cleanLine's scrubbing is not used on body/reply; both stay plain text.
import { cleanBoardNick } from './board.js';

export const MAX_CONTACT_BODY = 500;
export const MAX_CONTACT_REPLY = 80;
export const MIN_CONTACT_BODY = 5;

const strip = (s) => s.normalize('NFC')
  .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
  .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
  .replace(/[<>]/g, ' ');

/** The 문의 text: line breaks kept (3+ in a row become 2), cut at 500 code points. Non-strings give ''. */
export const cleanContactBody = (v) => (typeof v !== 'string' ? '' : [...strip(v).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()].slice(0, MAX_CONTACT_BODY).join('').trim());
/** 연락 수단 (optional): one line, 80 code points. */
export const cleanContactReply = (v) => (typeof v !== 'string' ? '' : [...strip(v).replace(/\s+/g, ' ').trim()].slice(0, MAX_CONTACT_REPLY).join('').trim());

/** validateContact({ body, nick, reply }) → { ok, contact } cleaned, or { ok:false, error }. A too-long body is refused, not silently cut. */
export function validateContact(c) {
  const body = cleanContactBody(c?.body);
  if ([...body].length < MIN_CONTACT_BODY) return { ok: false, error: `문의 내용을 ${MIN_CONTACT_BODY}자 이상 적어 주세요` };
  const full = [...strip(String(c.body)).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()].length;
  if (full > MAX_CONTACT_BODY) return { ok: false, error: `내용은 ${MAX_CONTACT_BODY}자까지 적을 수 있어요` };
  return { ok: true, contact: { body, nick: cleanBoardNick(c?.nick), reply: cleanContactReply(c?.reply) } };
}
