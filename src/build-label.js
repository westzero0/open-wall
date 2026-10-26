// src/build-label.js — the version a visitor can read out loud: "10/27-3" (the deploy's 날짜-순번), else the build's commit hash.
// Both are stamped into index.html by the deploy (tools/stamp-build.mjs); a dev copy has neither, so this returns ''.
export function buildLabel(doc = document) {
  const meta = (name) => doc.querySelector(`meta[name="${name}"]`)?.content ?? '';
  return meta('build-label') || meta('build');
}
