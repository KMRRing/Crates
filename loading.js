// Loading, in the instruments' style. A page or a long task (dealing a board, fetching a run, updating) shows the
// rete, large in the middle of the screen; a short wait inside a line or a box (a lookup, a reconnect, a partner
// on their way) shows the sextant, small, before its words. Both are animated SVG files (rete.svg, sextant.svg);
// the overlay is drawn by style.css (html.busy body::after), so it needs nothing in any page's markup.

let held = 0;
/**
 * Shows the rete over the page, with `label` under it, until the returned function is called; `delay` (ms) keeps a
 * task that finishes quickly from flashing it. Calls nest: the rete goes when the last one is done.
 */
export function busy(label = "", { delay = 120 } = {}) {
  held++;
  let shown = false, done = false;
  const timer = setTimeout(() => {
    if (done) return;
    shown = true;
    document.body.dataset.busy = label;
    document.documentElement.classList.add("busy");
  }, delay);
  return () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (--held > 0 || !shown) return;
    document.documentElement.classList.remove("busy");
    delete document.body.dataset.busy;
  };
}
/** Runs `task` (a promise or a function returning one) with the rete showing; resolves with its result. */
export async function whileBusy(label, task) {
  const done = busy(label);
  try { return await (typeof task === "function" ? task() : task); } finally { done(); }
}
/** The small sextant, to put before a line's words while it waits. */
export function sextant() {
  const i = document.createElement("i");
  i.className = "ld";
  i.setAttribute("aria-hidden", "true");
  return i;
}
