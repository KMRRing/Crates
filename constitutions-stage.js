// The stage of the Constitutions course (course.js shows it above the words of each step): a source to read, a card of terms (the reading list, or the terms that stay in view
// under a question), a figure, or one of the lesson kit's exercises (lesson-kit.js: match, order, sort, true or false, slider, diagram...). The kit judges those; a choice is judged
// by the sheet; the stage only reports first answers to the review pile (onResult(step, ok)).
import { createKit } from "./lesson-kit.js";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function constStage({ onResult = () => {} } = {}) {
  const kit = createKit({ onResult });
  let box = null;

  function html(s, st) {
    if (s.fig) return kit.plain(s, st);
    if (s.src) return `<figure class="cn-src"><figcaption>${esc(s.src.head)}</figcaption><blockquote>${esc(s.src.text)}</blockquote>${s.src.by ? `<small>${esc(s.src.by)}</small>` : ""}</figure>`;
    if (s.card) return `<div class="cn-card"><h4>${esc(s.card.head || "")}</h4><dl>${s.card.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></div>`;
    return `<div class="cn-none">Constitutions</div>`;
  }

  return {
    mount(b, a) { box = b; box.classList.add("cn-stage"); kit.mount(b, a); },
    task: s => kit.owns(s),
    submits: s => kit.owns(s) && kit.submits(s),
    ready: (s, st) => kit.ready(s, st),
    label: s => kit.label(s),
    submit: (s, st) => kit.submit(s, st),
    hint: (s, st) => kit.hint(s, st),
    draw(s, st) {
      if (kit.owns(s)) { kit.draw(s, st); return; }
      box.innerHTML = html(s, st);
      // the review pile: a wrong choice goes in once; a right first answer moves the item up
      if (s.quiz && st.picked != null && !st.cn) {
        if (st.picked !== s.answer) { st.cn = "miss"; onResult(s, false); }
        else if (st.done) { st.cn = "hit"; onResult(s, true); }
      }
    },
  };
}
