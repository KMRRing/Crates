// The stage of the Firmament course (course.js shows it above the words of each step): the step's figure, drawn in the app (firmament-figs.js),
// and under it the date line of the lesson. Nothing is fetched, so every step works offline.
import { draw } from "./firmament-figs.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function firmamentStage() {
  let box = null, cur = null;
  const build = s => {
    cur = s;
    box.innerHTML = `<figure class="fm-fig"><svg viewBox="0 0 320 190" class="fm" role="img" aria-label="${esc(s.alt || s.when || "A diagram")}">${draw(s.fig)}</svg>${s.when ? `<figcaption>${esc(s.when)}</figcaption>` : ""}</figure>`;
  };
  return {
    mount(b) { box = b; box.classList.add("fm-stage"); },
    task: () => false,
    ready: () => true, label: () => "", submit: () => ({ ok: true }), hint() {},
    draw(s) { if (cur !== s || !box.firstChild) build(s); },
  };
}
