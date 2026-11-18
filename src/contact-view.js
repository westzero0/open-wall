// src/contact-view.js — 서비스 문의 sheet (#contact), opened from the 앱 정보 sheet's 문의 줄. DOM only; the rules are in contact.js, the request in contact-api.js.
import { config, contactOn } from './config.js';
import { createContactApi } from './contact-api.js';
import { MAX_CONTACT_BODY, MAX_CONTACT_REPLY, validateContact } from './contact.js';
import { getStr, setStr } from './storage.js';

const SAY = {
  ok: '문의를 보냈어요. 답이 필요하면 남겨 주신 연락 수단으로 연락드려요.',
  okNoReply: '문의를 보냈어요. 연락 수단을 남기지 않으셔서 답은 드리지 못해요.',
  rate_limited: '잠시 뒤에 다시 보내 주세요. (1분에 1건, 하루 5건까지 받아요)',
  fail: '보내지 못했어요. 연결을 확인하고 다시 눌러 주세요.',
};
const KEY = 'open-wall:contact-ts';
const COOLDOWN_MS = 60_000;

export function createContactView({ api = createContactApi({ url: config.boardUrl }) } = {}) {
  const dlg = document.getElementById('contact');
  if (!dlg) return { open() {} };
  const f = dlg.querySelector('form');
  const status = dlg.querySelector('.rp-status');
  // a result line the sheet has scrolled past (large text) is no result at all: bring it into view by hand (no scrollIntoView, it also moves the page behind)
  const say = (m) => {
    status.textContent = m;
    if (!m) return;
    const over = status.getBoundingClientRect().bottom - dlg.getBoundingClientRect().bottom + 16;
    if (over > 0) dlg.scrollTop += over;
  };
  f.elements.body.maxLength = MAX_CONTACT_BODY;
  f.elements.reply.maxLength = MAX_CONTACT_REPLY;
  let busy = false;
  const refresh = () => { f.elements.send.disabled = busy || !f.elements.body.value.trim(); };
  f.addEventListener('input', refresh);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (f.elements.send.disabled) return;
    const v = validateContact({ body: f.elements.body.value, nick: f.elements.nick.value, reply: f.elements.reply.value });
    if (!v.ok) return say(v.error);
    const wait = COOLDOWN_MS - (Date.now() - Number(getStr(KEY)));
    if (wait > 0) return say(`${Math.ceil(wait / 1000)}초 뒤에 다시 보낼 수 있어요.`);
    busy = true; refresh(); say('보내는 중…');
    try {
      await api.submit({ ...v.contact, hp: f.elements.website.value });
      setStr(KEY, String(Date.now())); // private mode: no cooldown
      const hadReply = !!v.contact.reply;
      f.reset(); // a draft is cleared only once it is sent; closing the sheet keeps it
      say(hadReply ? SAY.ok : SAY.okNoReply);
      dlg.querySelector('[data-close]').focus(); // the send button just went dark; keep the keyboard on the sheet
    } catch (err) {
      say(SAY[err.code] ?? SAY.fail);
    }
    busy = false; refresh();
  });

  return {
    open() {
      if (!contactOn()) return;
      say(''); refresh(); // the draft stays as it was left (this page's memory only; a reload clears it)
      dlg.showModal();
    },
  };
}
