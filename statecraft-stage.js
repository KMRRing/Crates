// The stage of the Statecraft course (course.js shows it above the words of each step). Maps, cards and "tap the place" are History of trade's
// (trade-stage.js, which it wraps); this adds what that course has no use for: a quotation from a primary source, a row of cards to put in
// order (the arrows move one up or down; Check judges it), and pairs to match (a choice beside each, Check judges them). course.js has no
// ordering step, so the stage judges these through its button (`submit`), as a stage may. `onResult(step, ok)` is called once for a step's
// first answer, for the review pile (statecraft-pile.js).
import { tradeStage } from "./trade-stage.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
const DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const own = s => s.kind === "order" || s.kind === "match";

export function statecraftStage({ onResult = () => {} } = {}) {
  const inner = tradeStage();
  let box = null, api = null, curSt = null, cur = null;

  function drawOrder(s, st) {
    st.ord ||= [...s.items];
    const right = st.done ? s.order : st.ord, n = right.length;
    box.innerHTML = `<div class="sc-task"><ol class="sc-ord">${right.map((t, i) => `<li class="sc-row${st.done ? " ok" : ""}"><span class="sc-pos">${i + 1}</span><span class="sc-txt">${esc(t)}</span>`
      + `<span class="sc-mv"><button type="button" data-mv="${i}" data-by="-1" aria-label="Move up" ${st.done || i === 0 ? "disabled" : ""}>${UP}</button>`
      + `<button type="button" data-mv="${i}" data-by="1" aria-label="Move down" ${st.done || i === n - 1 ? "disabled" : ""}>${DOWN}</button></span></li>`).join("")}</ol>`
      + `<p class="sc-help">${st.done ? "In order." : "Move the cards with the arrows, then check."}</p></div>`;
  }
  function drawMatch(s, st) {
    st.pick ||= s.lefts.map(() => -1);
    const sel = st.done ? s.key : st.pick;
    box.innerHTML = `<div class="sc-task"><div class="sc-match">${s.lefts.map((l, i) => `<div class="sc-mrow${st.done ? " ok" : ""}"><span class="sc-l">${esc(l)}</span>`
      + `<select data-m="${i}" aria-label="${esc(l)}" ${st.done ? "disabled" : ""}><option value="-1">Choose…</option>${s.rights.map((r, j) => `<option value="${j}" ${sel[i] === j ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></div>`).join("")}</div>`
      + `<p class="sc-help">${st.done ? "Matched." : "Choose one for each, then check."}</p></div>`;
  }
  function drawQuote(s) {
    box.innerHTML = `<div class="td-card sc-quote"><h4>${esc(s.card.head)}</h4><blockquote>${esc(s.card.quote)}</blockquote></div>`;
  }

  // the review pile: a miss goes in; a right first answer moves the item up
  function track(s, st) {
    if (st.sc) return;
    if (s.kind === "quiz") {
      if (st.picked == null) return;
      if (st.picked !== s.answer) { st.sc = "miss"; onResult(s, false); } else if (st.done) { st.sc = "hit"; onResult(s, true); }
    } else if (s.kind === "tap" || own(s)) {
      if (st.tries > 0) { st.sc = "miss"; onResult(s, false); } else if (st.done) { st.sc = "hit"; onResult(s, true); }
    }
  }

  return {
    mount(b, a) {
      box = b; api = a; box.classList.add("sc-stage");
      inner.mount(b, a);
      box.addEventListener("click", e => {
        const mv = e.target.closest("[data-mv]");
        if (!mv || !cur || cur.kind !== "order" || curSt.done) return;
        const i = Number(mv.dataset.mv), j = i + Number(mv.dataset.by), o = curSt.ord;
        if (j < 0 || j >= o.length) return;
        [o[i], o[j]] = [o[j], o[i]];
        api.changed();
      });
      box.addEventListener("change", e => {
        const sel = e.target.closest("[data-m]");
        if (!sel || !cur || cur.kind !== "match" || curSt.done) return;
        curSt.pick[Number(sel.dataset.m)] = Number(sel.value);
        api.changed();
      });
    },
    task: s => own(s) || inner.task(s),
    submits: s => own(s),
    ready: (s, st) => (s.kind === "match" ? !!st.pick && st.pick.every(v => v >= 0) : true),
    label: s => (s.kind === "match" ? "Check" : "Check order"),
    submit(s, st) {
      if (s.kind === "order") {
        const right = st.ord.filter((t, i) => t === s.order[i]).length;
        return right === s.order.length ? { ok: true, msg: s.why } : { ok: false, why: `Not that order: ${right} of ${s.order.length} are in the right place.` };
      }
      const right = st.pick.filter((v, i) => v === s.key[i]).length;
      return right === s.key.length ? { ok: true, msg: s.why } : { ok: false, why: `Not quite: ${right} of ${s.key.length} are matched right.` };
    },
    hint(s, st) {
      if (s.kind === "order") st.ord = [...s.order];
      else if (s.kind === "match") st.pick = [...s.key];
      else inner.hint(s, st);
    },
    draw(s, st) {
      cur = s; curSt = st;
      if (s.kind === "order") drawOrder(s, st);
      else if (s.kind === "match") drawMatch(s, st);
      else if (s.card?.quote) drawQuote(s);
      else inner.draw(s, st);
      track(s, st);
    },
  };
}
