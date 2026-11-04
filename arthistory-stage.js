// The stage of the Art history course (course.js shows it above the words of each step): the step's pictures in a row, each with its
// credit line (maker, date, home) under it. A picture is fetched from Wikipedia as it's shown (pics.js); one that can't be had (offline,
// refused, no image) gives way to a quiet card with the work's name, and the step's words then name the work too (arthistory-lessons.js),
// so every exercise can be answered with no picture at all. In an exercise the credit is kept back until the answer is in, since it
// names the work and the date.
import { showPicture, OFFLINE_WIDTH } from "./pics.js";
import { WORK, creditOf } from "./arthistory-lessons.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** onResult(step, ok): called once for a step's first answer (a miss, or a right answer first time), for the review pile. */
export function artStage({ onResult = () => {} } = {}) {
  let box = null, api = null, cur = null, figs = [];
  function build(s) {
    cur = s;
    figs = [];
    const n = Math.max(1, s.pics.length);
    box.innerHTML = `<div class="ah-pics n${Math.min(n, 3)}">${s.pics.map((p, i) => `<figure class="ah-fig"><div class="ah-cell"><div class="ah-pic"></div><div class="ah-miss" hidden><b></b><span>Picture not available</span></div></div><figcaption></figcaption></figure>`).join("")}</div>`;
    if (!s.pics.length) box.innerHTML = `<div class="ah-pics n1"><div class="ah-none">Art history</div></div>`;
    s.pics.forEach((p, i) => {
      const w = WORK.get(p.id), fig = box.querySelectorAll(".ah-fig")[i], node = fig.querySelector(".ah-pic"), miss = fig.querySelector(".ah-miss");
      figs.push({ p, w, fig, miss });
      miss.querySelector("b").textContent = s.hide ? "" : w.name;
      showPicture(node, w.pic, { width: OFFLINE_WIDTH, alt: s.hide ? "" : w.name }).then(ok => {
        if (ok !== false || cur !== s) return;               // null: a later step took the node
        fig.classList.add("gone");
        miss.hidden = false;
        api.changed();                                       // the words name the work now
      });
    });
  }
  function captions(s, st) {
    figs.forEach(({ p, w, fig }) => {
      const done = st.done || s.kind === "text", cap = done ? creditOf(w) : p.before;
      fig.querySelector("figcaption").textContent = cap;
    });
  }
  return {
    mount(b, a) { box = b; api = a; box.classList.add("ah-stage"); },
    task: () => false,
    ready: () => true, label: () => "", submit: () => ({ ok: true }), hint() {},
    draw(s, st) {
      if (cur !== s || !box.firstChild) build(s);
      captions(s, st);
      // the review pile: a miss goes in; a right first answer moves the item up
      if (s.quiz && st.picked != null && !st.ah) {
        if (st.picked !== s.answer) { st.ah = "miss"; onResult(s, false); }
        else if (st.done) { st.ah = "hit"; onResult(s, true); }
      }
    },
  };
}
