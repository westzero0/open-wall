// Weather risk of one plan: level + a phrase that is never empty. DOM-free.
import { pickHour, hardWeather, rainOf, skyKind, windy } from './weather.js';
import { cragRow } from './crag-model.js';

const FAR_TEXT = '예보가 아직 바뀔 수 있어요'; // the crag card's FAR_NOTE reads '예보는 바뀔 수 있어요'; the spec wording is kept here
const LEVEL = { good: 'ok', drying: 'caution', wet: 'caution', recent: 'caution', rain: 'hard', frozen: 'hard' };
const p2 = (n) => String(n).padStart(2, '0');
const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const levelOfCond = (c) => LEVEL[c?.state] ?? 'none';

// N days since the last rain when the condition knows it (recent: daysSince; wetness model: ago hours); null otherwise.
const rainAgo = (c) => {
  const n = Number.isFinite(c.daysSince) ? c.daysSince : Number.isFinite(c.ago) ? Math.floor(c.ago / 24) : 0;
  return n > 0 ? `${n}일 전 비` : null;
};

/** the phrase for a crag condition that is not ok/none; '' for the others. Hard states say the forecast, no judgment word. */
export function condPhrase(c) {
  switch (c?.state) {
    case 'drying': case 'wet': case 'recent': return `주의 · ${rainAgo(c) ?? '최근 비가 있었어요'}`;
    case 'rain': return '비 예보';
    case 'frozen': return '영하 예보';
    default: return '';
  }
}

const out = (level, phrase, far = false, reason = null) => ({ level, phrase, reason, far, note: far ? FAR_TEXT : null });

function noForecast(at, now, span) {
  const from = new Date(at.getFullYear(), at.getMonth(), at.getDate() - span);
  if (from <= day0(now)) return '예보를 불러오지 못했어요';
  return `예보는 ${p2(from.getMonth() + 1)}/${p2(from.getDate())}부터 확인돼요`;
}

const okPhrase = (h) => (h && Number.isFinite(h.t) ? `${Number.isFinite(h.c) ? skyKind(h.c).text : '예보'} ${Math.round(h.t) || 0}°` : '예보상 비 없음');

function wallReason(h, wall) {
  const dry = wall?.venue === 'both' || !!wall?.tags?.includes('지붕');
  if (dry) return wall?.venue !== 'both' && windy(h) ? '강풍' : null; // a roof keeps rain off, not wind
  const { why } = hardWeather(h);
  const r = rainOf(h);
  return why === '비' && r?.p != null ? `비 ${Math.round(r.p)}%` : why;
}

export function riskOf(resolved, plan, wx, now = Date.now()) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(plan?.date ?? '');
  const nowD = new Date(now);
  if (!date) return out('none', '날짜를 확인해 주세요');
  const at = new Date(+date[1], +date[2] - 1, +date[3], Number.isFinite(plan.min) ? Math.floor(plan.min / 60) : 12, Number.isFinite(plan.min) ? plan.min % 60 : 0);
  const diff = Math.round((day0(at) - day0(nowD)) / 864e5);
  if (diff < 0) return out('past', '지난 일정');
  if (resolved?.venue === 'indoor') return out('ok', '실내');
  if (!resolved?.located) return out('none', resolved?.reported ? '운영자가 확인 중이에요' : '아직 앱에 없는 암장이라 날씨는 볼 수 없어요');
  const far = diff >= 3;

  if (resolved.kind === 'crag') {
    const { cond, wx: hr } = cragRow(resolved.crag, at, { now: nowD, ...(wx?.crag ?? {}) });
    const level = levelOfCond(cond);
    if (level === 'none') return out('none', noForecast(at, nowD, 6), far);
    return out(level, level === 'ok' ? okPhrase(hr) : condPhrase(cond), far, cond.state);
  }

  const h = wx?.hourly?.get?.(resolved.name) ? pickHour(wx.hourly.get(resolved.name), at) : null;
  if (!h) return out('none', noForecast(at, nowD, 3), far);
  const reason = wallReason(h, resolved.wall);
  return reason ? out('hard', `${reason} 예보`, far, reason) : out('ok', okPhrase(h), far);
}
