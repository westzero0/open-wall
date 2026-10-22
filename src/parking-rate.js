// src/parking-rate.js — parking fee from a rule (parking.rate), no DOM. A rule is typed in when the data is entered
// (from the wall's own wording); the app never reads a sentence. Anything the rule cannot answer is null, never a guess.
//   rate: { free_min, first: {min, won}, step: {min, won}, tiers: [{upto, won}], day_flat, day_max, conditions: [text] }
//   cost: { h3, h5, h8, day } — hand-typed amounts for a wall no rule fits; a rate wins over it.

export const STAY_HOURS = [3, 5, 8];
export const DEFAULT_STAY_H = 3; // the stay a card is priced for while no minimum-stay filter is on (an assumption, one place to change)

/** → won | null: the fee for staying `minutes`. Free time first, then first block, steps (a started step counts whole), tiers, the day cap. */
export function calcFee(rate, minutes) {
  if (!rate || !(minutes > 0)) return null;
  const { free_min = 0, first, step, tiers, day_flat, day_max } = rate;
  const cap = (won) => (day_max != null ? Math.min(won, day_max) : won);
  if (day_flat != null) return day_flat;
  const t = minutes - free_min;
  if (t <= 0) return 0;
  if (tiers?.length) {
    const tier = [...tiers].sort((a, b) => a.upto - b.upto).find((x) => minutes <= x.upto);
    return tier ? cap(tier.won) : day_max ?? null;
  }
  if (first) {
    if (t <= first.min) return cap(first.won);
    return step ? cap(first.won + Math.ceil((t - first.min) / step.min) * step.won) : null;
  }
  return step ? cap(Math.ceil(t / step.min) * step.won) : null;
}

/** → won | null for 3/5/8 hours (or any hours with a rate): the rate if there is one, else the hand-typed cost. */
export function feeAfter(parking, hours) {
  if (parking?.rate) return calcFee(parking.rate, hours * 60);
  const v = parking?.cost?.[`h${hours}`];
  return Number.isFinite(v) ? v : null;
}

const won = (n) => `${n.toLocaleString('en-US')}원`;

const span = (min) => (min % 60 === 0 ? `${min / 60}시간` : `${min}분`);

/** → the card's cost words for a stay of `hours`: "4시간 무료" (the free span, not the stay) | "5시간 기준 2,000원" | "2시간 무료 · 이후 확인 필요" | "요금 확인 필요". */
export function feeBrief(parking, hours = DEFAULT_STAY_H) {
  const n = feeAfter(parking, hours);
  const free = parking?.rate?.free_min;
  if (n == null) return free ? `${span(free)} 무료 · 이후 확인 필요` : '요금 확인 필요';
  if (n === 0) return free ? `${span(free)} 무료` : '무료';
  return `${hours}시간 기준 ${won(n)}`;
}

export const TABLE_HOURS = [1, 3, 5, 8]; // the hours priced for the sheet (the table shows only the first; a single lot is told as a sentence of them all), then 하루

/** → the lots that have a price: the wall's own (parking.rate / cost, named after its own lot) first, then parking.lots with a rate. [{ name, walk_min?, rate?, cost? }] */
export function pricedLots(parking) {
  const own = parking?.rate || parking?.cost ? [{ name: parking.onsite?.[0] ?? '외벽 앞', rate: parking.rate, cost: parking.cost, own: true }] : [];
  return [...own, ...(parking?.lots ?? []).filter((l) => l.rate)];
}

export const NOTE_MAX = 14; // a 비고 longer than this (characters) is told on a line of its own under the lot's row, not squeezed into the cell

/** → [{ name, walk_min, cells: [text × TABLE_HOURS, 하루], note, free, first, step }] one row per priced lot for the sheet's table (TABLE_HOURS columns, then 하루) (a missing amount is '–'). */
export function lotFeeTable(parking) {
  const text = (n) => (n == null ? '–' : n === 0 ? '무료' : `${n.toLocaleString('en-US')}원`); // the same 3,000원 as the entry-fee table
  return pricedLots(parking).map((l) => ({
    name: l.name,
    walk_min: l.walk_min ?? null,
    own: Boolean(l.own),
    free: l.rate?.free_min ? `${span(l.rate.free_min)} 무료` : '',
    // the rule's own words, so the table says how the amounts come about: head ("최초 30분", "10분당") and amount ("1,000원") apart; null when the rule has no such part
    first: l.rate?.first ? { head: `최초 ${span(l.rate.first.min)}`, cell: won(l.rate.first.won) } : null,
    step: l.rate?.step ? { head: `${span(l.rate.step.min)}당`, cell: won(l.rate.step.won) } : null,
    cells: [...TABLE_HOURS.map((h) => text(feeAfter(l, h))), text(l.rate ? calcFee(l.rate, 24 * 60) : Number.isFinite(l.cost?.day) ? l.cost.day : null)],
    note: (l.rate?.conditions ?? []).join(' · '),
    flat: Number.isFinite(l.rate?.day_flat), // one price for any stay: the table merges its stay and 하루 cells
  }));
}
