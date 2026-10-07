export function isProfile(p) {
  if (!p || typeof p !== 'object') return false;
  const { step_deg: step, angles } = p;
  return (
    Number.isFinite(step) &&
    step > 0 &&
    360 % step === 0 &&
    Array.isArray(angles) &&
    angles.length === 360 / step &&
    angles.every((a) => Number.isFinite(a) && a >= 0 && a <= 90)
  );
}

export function cleanShadow(v) {
  if (!isProfile(v)) return null;
  const out = { step_deg: v.step_deg, angles: [...v.angles] };
  if (typeof v.computed_at === 'string') out.computed_at = v.computed_at;
  if (typeof v.source === 'string') out.source = v.source;
  if (v.params && typeof v.params === 'object' && !Array.isArray(v.params)) out.params = { ...v.params };
  return out;
}

// Linear interpolation between the two neighbouring azimuth samples (wraps at 360).
export function horizonAt({ step_deg: step, angles }, azimuth) {
  const n = angles.length;
  const pos = (((azimuth % 360) + 360) % 360) / step;
  const i = Math.floor(pos) % n;
  const f = pos - Math.floor(pos);
  return angles[i] * (1 - f) + angles[(i + 1) % n] * f;
}
