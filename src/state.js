import { saveWalls } from './store.js';

export const state = { walls: [] };

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
  state.walls = next;
  try {
    saveWalls(storage, next);
  } catch {
    // quota exceeded etc.: keep working in memory
  }
  listeners.forEach((fn) => fn());
}
