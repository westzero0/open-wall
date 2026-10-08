// src/invite-state.js — the invite sheet's picture flow as a pure state machine (no DOM).
// phase: 'edit' (a change is not saved yet) → 'making' (save pressed, the picture is being fixed) → 'done' (share and download on).
// key: what the picture shows for the values now (null: nothing to draw, or the moment is past). cache: key of the picture drawn ahead, if any.
// events: change {key} · save {key, past} · drawn {key} · failed {key} · open
// err: set when save is refused: 'past' | 'empty'.
export const initialInviteState = () => ({ phase: 'edit', key: null, cache: null, err: null });

export function nextInviteState(s, e) {
  switch (e.type) {
    case 'open': return { ...s, phase: 'edit', err: null }; // the cache stays: the same values need no new drawing
    case 'change':
      // while making, the newest values win: the picture is fixed again for them
      if (s.phase === 'making' && e.key) return { ...s, key: e.key, err: null, phase: s.cache === e.key ? 'done' : 'making' };
      return { ...s, phase: 'edit', key: e.key, err: null };
    case 'save':
      if (e.past) return { ...s, phase: 'edit', err: 'past' };
      if (!e.key) return { ...s, phase: 'edit', err: 'empty' };
      return { ...s, key: e.key, err: null, phase: s.cache === e.key ? 'done' : 'making' };
    case 'drawn': // an old result (another key than the one wanted now) is dropped, not cached
      if (e.key !== s.key) return s;
      return { ...s, cache: e.key, phase: s.phase === 'making' ? 'done' : s.phase };
    case 'failed':
      return s.phase === 'making' && e.key === s.key ? { ...s, phase: 'edit' } : s;
    default: return s;
  }
}
