// src/planner-ui.js — the one place that touches the vendored Preact/htm. Relative imports only (CSP: script-src 'self', no import maps).
import { h, render } from '../vendor/preact/preact.mjs';
import { useState, useEffect, useRef } from '../vendor/preact/hooks.mjs';
import htm from '../vendor/htm/htm.mjs';

export const html = htm.bind(h);
export { h, render, useState, useEffect, useRef };

/** Subscribe a component to a createPlannerState() store; returns the current state and re-renders on every change. */
export function usePlannerState(store) {
  const [s, setS] = useState(store.get());
  useEffect(() => {
    setS(store.get()); // a change between first render and subscribe
    return store.subscribe(setS);
  }, [store]);
  return s;
}
