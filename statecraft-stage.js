// The stage of the Statecraft course (course.js shows it above the words of each step). Maps, cards and "tap the place" are History of trade's
// (trade-stage.js, which it wraps); the interaction steps (tap-to-pair, ordering, sorting into bins, true or false, terms to open, a diagram
// to explore, a slider, a decision, a switch board, a diagram to build) are the lesson kit's (lesson-kit.js, docs/lesson-kit.md); this adds a
// quotation from a primary source. `onResult(step, ok)` is called once for a step's first answer, for the review pile (statecraft-pile.js).
import { tradeStage } from "./trade-stage.js";
import { createKit } from "./lesson-kit.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function statecraftStage({ onResult = () => {} } = {}) {
  const inner = tradeStage();
  const kit = createKit({ onResult });
  let box = null;

  function drawQuote(s) {
    box.innerHTML = `<div class="td-card sc-quote"><h4>${esc(s.card.head)}</h4><blockquote>${esc(s.card.quote)}</blockquote>${s.check ? '<span class="lk-check" title="Not yet verified">check</span>' : ""}</div>`;
  }

  // the review pile for the steps that are not the kit's: a miss goes in; a right first answer moves the item up
  function track(s, st) {
    if (st.sc) return;
    if (s.kind === "quiz") {
      if (st.picked == null) return;
      if (st.picked !== s.answer) { st.sc = "miss"; onResult(s, false); } else if (st.done) { st.sc = "hit"; onResult(s, true); }
    } else if (s.kind === "tap") {
      if (st.tries > 0) { st.sc = "miss"; onResult(s, false); } else if (st.done) { st.sc = "hit"; onResult(s, true); }
    }
  }

  return {
    mount(b, a) {
      box = b; box.classList.add("sc-stage");
      inner.mount(b, a);
      kit.mount(b, a);
    },
    task: s => kit.owns(s) || inner.task(s),
    submits: s => kit.owns(s) && kit.submits(s),
    ready: (s, st) => (kit.owns(s) ? kit.ready(s, st) : true),
    label: s => (kit.owns(s) ? kit.label(s) : "Check"),
    submit: (s, st) => (kit.owns(s) ? kit.submit(s, st) : { ok: false }),
    hint(s, st) {
      if (kit.owns(s)) kit.hint(s, st);
      else inner.hint(s, st);
    },
    draw(s, st) {
      if (kit.owns(s)) kit.draw(s, st);
      else if (s.card?.quote) drawQuote(s);
      else if (s.fig) box.innerHTML = kit.plain(s, st);
      else if (!s.card && !s.view) box.innerHTML = "";               // a question stands on its own
      else inner.draw(s, st);
      track(s, st);
    },
  };
}
