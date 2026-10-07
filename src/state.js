import { saveWalls } from './store.js';

export const state = { walls: [] };

// editing (and so every write to the saved list) is only on at ?edit; visitors always read the shipped list
export const canEdit = new URLSearchParams(globalThis.location?.search).has('edit');

// localStorage can throw (private mode, blocked site data); fall back to a no-op store.
export const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
})();

const listeners = [];
export const onChange = (fn) => listeners.push(fn);

export function setWalls(next) {
  if (!canEdit) return; // hard stop: visitors never write the saved list
  state.walls = next;
  try {
    saveWalls(storage, next);
  } catch {
    // quota exceeded etc.: keep working in memory
  }
  listeners.forEach((fn) => fn());
}
