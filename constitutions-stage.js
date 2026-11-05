// The stage of the Constitutions course (course.js shows it above the words of each step): the lesson's card of terms, or a source to read, or, in an ordering step, the cards
// to put in order. Ordering is this stage's own exercise (tap the cards in the order you think; tap a placed one to take it back; Check judges it), so the shared course sheet is
// untouched. A choice is judged by the sheet; the stage only reports first answers to the review pile (onResult(step, ok)).
import { createKit } from "./lesson-kit.js";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function constStage({ onResult = () => {} } = {}) {
  const kit = createKit({ onResult });
  let box = null, api = null, curSt = null, cur = null;

  function html(s, st) {
    if (s.order) {
      const seq = st.seq || [], right = s.order;
      const cards = s.shown.map(i => {
        const at = seq.indexOf(i), placed = at >= 0, ok = st.done && placed;
        return `<button type="button" class="cn-item${placed ? " on" : ""}${ok ? " ok" : ""}" data-i="${i}" ${st.done ? "disabled" : ""}><span class="cn-n" aria-hidden="true">${placed ? at + 1 : ""}</span><span class="cn-t">${esc(right[i])}</span></button>`;
      }).join("");
      return `<div class="cn-order" role="group" aria-label="Put in order">${cards}</div>`;
    }
    if (s.src) return `<figure class="cn-src"><figcaption>${esc(s.src.head)}</figcaption><blockquote>${esc(s.src.text)}</blockquote>${s.src.by ? `<small>${esc(s.src.by)}</small>` : ""}</figure>`;
    if (s.fig) return kit.plain(s, st);
    if (s.card) return `<div class="cn-card"><h4>${esc(s.card.head || "")}</h4><dl>${s.card.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></div>`;
    return `<div class="cn-none">Constitutions</div>`;
  }

  return {
    mount(b, a) {
      box = b; api = a; box.classList.add("cn-stage");
      kit.mount(b, a);
      box.addEventListener("click", e => {
        const b2 = e.target.closest(".cn-item");
        if (!b2 || !cur || !curSt || curSt.done || !cur.order) return;
        const i = Number(b2.dataset.i), seq = (curSt.seq ||= []), at = seq.indexOf(i);
        if (at >= 0) seq.splice(at, 1); else seq.push(i);
        api.changed();
      });
    },
    task: s => kit.owns(s) || !!s.order,
    submits: s => (kit.owns(s) ? kit.submits(s) : true),
    ready: (s, st) => (kit.owns(s) ? kit.ready(s, st) : (st.seq || []).length === s.order.length),
    label: () => "Check",
    /** Judges the order: right ends the step; wrong says how many cards sit in the right place, and the first miss goes to the review pile. */
    submit(s, st) {
      if (kit.owns(s)) return kit.submit(s, st);
      const seq = st.seq || [], hits = seq.filter((v, k) => v === k).length;
      if (hits === s.order.length) {
        if (!st.miss) onResult(s, true);
        return { ok: true, msg: `${s.why}`, done: true };
      }
      if (!st.miss) { st.miss = true; onResult(s, false); }
      return { ok: false, why: `Not yet: ${hits} of ${s.order.length} are in the right place. Tap a card to take it back.` };
    },
    hint(s, st) {
      if (kit.owns(s)) { kit.hint(s, st); return; }
      if (!st.miss) { st.miss = true; onResult(s, false); }            // shown the answer: it comes back in the review
      st.seq = s.order.map((_, i) => i);
    },
    draw(s, st) {
      cur = s; curSt = st;
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
