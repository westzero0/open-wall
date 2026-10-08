// 이벤트 랭킹: shown in the 내 정보 sheet while data/contributors.json says the event runs (parseContributors); hidden on any failure.
import { parseContributors } from './contrib.js';
import { ymd } from './time.js';
import { el } from './dom.js';

const box = document.getElementById('pfRank');
if (box) {
  try {
    const r = await fetch('data/contributors.json');
    const c = r.ok ? parseContributors(await r.json(), ymd(new Date())) : null;
    if (c && c.rows.length) {
      const [, m, d] = c.until.split('-').map(Number);
      box.querySelector('.pf-rank-title').textContent = `이벤트 랭킹 · ${m}/${d}까지`;
      box.querySelector('.pf-rank-list').replaceChildren(...c.rows.map((x) => el('li', {}, el('b', {}, `${x.rank}위`), ` ${x.nick} · ${x.count}건`)));
      const [, um, ud] = c.updated.split('-').map(Number);
      box.querySelector('.pf-rank-note').textContent = `승인된 제보 기준이에요. 하루 한 번 갱신돼요 (${um}/${ud} 기준).`;
      box.hidden = false;
    }
  } catch { /* offline or no file: no ranking */ }
}
