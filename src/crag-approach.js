// 어프로치 모델(순수). 주차 → 분기 1..n → 암장 도착.
const flat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const isMin = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

const CHIP = { free: '노지 · 무료', roadside: '갓길 · 주정차 주의' };
// the wall's parking tones (card-model PARKING_TEXT → .pk-word): 무료·유료 = good (both 가능), 주차 불가 = warn, 모름 = muted; 갓길 is 주의, so warn
const TONE = { free: 'good', paid: 'good', roadside: 'warn' };

function parkOf(p) {
  const kind = ['paid', 'free', 'roadside'].includes(p?.kind) ? p.kind : null;
  const paid = kind === 'paid' || (!kind && p?.fee);
  const chip = CHIP[kind] ?? (paid ? '유료 · 요금' : p?.status === 'none' ? '주차 불가' : '주차 확인 필요'); // kind wins; the old status word stays when there is no kind
  const tone = TONE[kind] ?? (paid ? 'good' : p?.status === 'none' ? 'warn' : 'muted');
  return { kind, chip, tone, line: [p?.fee, p?.note].map(flat).filter(Boolean).join(' · ') };
}

export function approachModel(crag) {
  const steps = Array.isArray(crag?.approach_steps) ? crag.approach_steps : [];
  const parking = crag?.parking;
  const hasPark = parking && (parking.kind || parking.fee || parking.note || parking.status || parking.photo);
  if (!steps.length && !isMin(crag?.approach_min) && !hasPark) return null;

  const last = steps[steps.length - 1]?.min;
  const totalMin = isMin(crag?.approach_min) ? crag.approach_min : isMin(last) ? last : null;
  const timed = totalMin > 0 && steps.every((s, i) => isMin(s.min) && (!i || s.min > steps[i - 1].min))
    && (!steps.length || last < totalMin);
  const len = steps.length + 2;
  const posAt = (i, min) => (timed ? min / totalMin : i / (len - 1));

  const stops = [
    { type: 'park', n: null, label: '주차', min: 0, pos: 0, photo: parking?.photo ?? null, text: '', turn: null, wrong: null },
    ...steps.map((s, i) => ({
      type: 'fork', n: i + 1, label: `분기 ${i + 1}`, min: isMin(s.min) ? s.min : null,
      pos: posAt(i + 1, s.min), photo: s.photo || null, text: flat(s.text),
      turn: s.turn || null, wrong: s.wrong ? flat(s.wrong) : null,
    })),
    { type: 'end', n: null, label: '암장 도착', min: totalMin, pos: 1, photo: null, text: '', turn: null, wrong: null },
  ];
  return {
    stops, totalMin, forks: steps.length,
    photos: [...new Set(stops.map((s) => s.photo).filter(Boolean))],
    // has: the crag has parking data of its own (the card's 주차 row shows only then; the chip alone, the long line is the sheet's first stop)
    park: { ...parkOf(parking), has: Boolean(hasPark) },
  };
}

export const stepTo = (i, delta, len) => Math.max(0, Math.min(len - 1, i + delta));
export const photoUrl = (path) => 'data/' + path;
