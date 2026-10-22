// src/dialog-back.js — 뒤로가기 closes the sheet that is open instead of leaving the page. Every dialog opened with showModal() gets one history
// entry (same address) while it is open: 뒤로 / swipe-back pops that entry and closes the top dialog; closing it any other way pops the entry itself.
// The wall sheet (class wall-sheet) keeps its own entry, which carries the ?wall= address; this module skips it. Import once, before the sheets are made.
const stack = []; // open dialogs holding an entry, the newest last
let selfBack = false; // our own history.back() is in flight: its popstate is not a user's 뒤로

if (typeof HTMLDialogElement !== 'undefined') {
  const open = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function showModal(...args) {
    const was = this.open;
    open.apply(this, args);
    if (was || this.classList.contains('wall-sheet') || stack.includes(this)) return;
    stack.push(this);
    history.pushState({ dialogBack: true }, '');
    this.addEventListener('close', () => {
      const i = stack.indexOf(this);
      if (i < 0) return; // closed by 뒤로: the entry is already gone
      stack.splice(i, 1);
      selfBack = true;
      history.back();
    }, { once: true });
  };
  // registered before the wall sheet's own popstate listener, so a 뒤로 that closed a dialog on top of it does not close it too
  window.addEventListener('popstate', (e) => {
    if (selfBack) { selfBack = false; e.stopImmediatePropagation(); return; }
    const top = stack.pop();
    if (!top) return;
    e.stopImmediatePropagation();
    top.close();
  });
}
