// src/dom.js — the one way views build DOM: elements, attributes via setAttribute, children as nodes or text (never HTML).
export const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v);
  e.append(...kids.filter((k) => k !== null && k !== undefined && k !== false));
  return e;
};

// Data text with a parenthetical ("(유효 1년, 평일·주말 사용)", "(…, 이용료 별도)"): keep its first two and last two words together so a line never
// breaks right after "(" or leaves a lone "별도)" at the start of a line. Spaces become no-break spaces; the words and the text stay the same.
export const tightParens = (text) => typeof text === 'string'
  ? text.replace(/\(([^()]{3,60})\)/g, (_, inner) => `(${inner.replace(/^(\S+) /, '$1\u00a0').replace(/ (\S+)$/, '\u00a0$1')})`)
  : text;

