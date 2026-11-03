// Tarot's stage for the course sheet (course.js): cards written as text in a lesson, drawn as the game draws them, a hand
// to pick from, and the judging of a pick by the rules themselves (so what a lesson asks is what the game would allow).
//
// Cards in a lesson: t1..t21 the trumps, ex the Excuse, and a suit card as its rank (1-10, J jack, C knight, Q queen,
// K king) then its suit (s h d c): "Kh", "10s", "t14 ex".
//
// A step's stage: rows [{ label, cards | backs }], table (the trick so far, in the order played: tableLabel), hand (to pick
// from: handLabel), goal and answer: "pick" (answer: the cards; many: true to pick several), "legal" (every card of the hand
// the rules allow on the table's trick), "barred" (every card of the hand the dog may not take).
import { fitCardStage } from "./course-cards.js";
import { tarotCard, backHtml } from "./tarot-faces.js";
import { EXCUSE, RANK_MARKS, suitCard, sortHand, legalCards, checkDiscard, cardName } from "./tarot-rules.js";

const SUIT_LETTERS = "shdc";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tokens = text => String(text || "").trim().split(/\s+/).filter(Boolean);

/** Cards written as text as ids. */
export function parseCards(text) {
  return tokens(text).map(tok => {
    if (tok === "ex") return EXCUSE;
    let m = /^t(\d{1,2})$/.exec(tok);
    if (m) { const n = Number(m[1]); if (n < 1 || n > 21) throw new Error(`no card "${tok}"`); return n - 1; }
    m = /^(10|[1-9JCQK])([shdc])$/.exec(tok);
    if (!m) throw new Error(`no card "${tok}"`);
    return suitCard(SUIT_LETTERS.indexOf(m[2]), RANK_MARKS.indexOf(m[1]));
  });
}
/** A card as a lesson writes it. */
export const tokenOf = c => (c === EXCUSE ? "ex" : c < 21 ? `t${c + 1}` : `${RANK_MARKS[(c - 22) % 14]}${SUIT_LETTERS[Math.floor((c - 22) / 14)]}`);
const same = (a, b) => a.length === b.length && [...a].sort((x, y) => x - y).every((c, i) => c === [...b].sort((x, y) => x - y)[i]);

/** What a "pick" step wants: the cards, or why a pick is not it. */
export function expected(step) {
  const hand = parseCards(step.hand), table = parseCards(step.table);
  switch (step.goal) {
    case "legal": return legalCards(hand, table.map((card, i) => ({ seat: i, card })));
    case "barred": return hand.filter(c => checkDiscard(hand, [c], 1) !== "");
    case "pick": return parseCards(step.answer);
    default: return null;
  }
}
export function judge(step, ids) {
  const want = expected(step);
  if (same(ids, want)) return { ok: true, msg: step.why || "Right." };
  const missing = want.filter(c => !ids.includes(c)), extra = ids.filter(c => !want.includes(c));
  if (step.goal === "pick") return { ok: false, why: step.wrong || "Not that card: look at what is left to come." };
  if (extra.length) return { ok: false, why: `${cardName(extra[0])} is not ${step.goal === "legal" ? "allowed here" : "one the dog refuses"}.` };
  return { ok: false, why: `${missing.length === 1 ? "One more card fits" : `${missing.length} more cards fit`}: look again.` };
}

export function tarotStage() {
  let box = null, api = null, step = null, st = null;
  const card = (c, cls = "") => tarotCard(c, { cls });
  const line = ids => `<span class="cd-line${ids.length > 7 ? " many" : ""}">${ids.map(c => card(c)).join("")}</span>`;
  const backs = n => `<span class="cd-line${n > 7 ? " many" : ""}" role="img" aria-label="${n} cards face down">${backHtml().repeat(n)}</span>`;
  const head = text => (text ? `<small>${esc(text)}</small>` : "");
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.addEventListener("click", e => {
        const c = e.target.closest(".lc-hand .cd[data-id]");
        if (!c || !step?.goal || st.done) return;
        const id = Number(c.dataset.id);
        st.sel ??= new Set();
        if (step.goal === "pick" && !step.many) st.sel = new Set(st.sel.has(id) ? [] : [id]);
        else if (st.sel.has(id)) st.sel.delete(id); else st.sel.add(id);
        api.changed();
      });
    },
    task: s => !!s.goal,
    ready: (s, t) => !!t.sel?.size,
    label: (s, t) => (s.goal === "pick" && !s.many ? "Play it" : `That is ${t.sel?.size || 0}`),
    submit: (s, t) => judge(s, [...t.sel]),
    hint(s, t) { t.sel = new Set(expected(s)); },
    draw(s, t) {
      step = s;
      st = t;
      const parts = (s.rows || []).map(r => `<div class="lc-row">${head(r.label)}${r.backs ? backs(r.backs) : line(parseCards(r.cards))}</div>`);
      const table = parseCards(s.table);
      if (table.length) parts.push(`<div class="lc-row lc-table">${head(s.tableLabel || "The trick so far")}${line(table)}</div>`);
      const hand = parseCards(s.hand);
      if (hand.length) {
        parts.push(`<div class="lc-row">${head(s.handLabel || "Your cards")}</div>`);
        const cls = `${s.goal ? "" : " still"}${t.done ? " done" : ""}`;
        parts.push(`<div class="cd-row lc-hand${cls}">${sortHand(hand).map(c => tarotCard(c, { cls: t.sel?.has(c) ? "sel" : "", data: { id: c } })).join("")}</div>`);
      }
      box.innerHTML = `<div class="lc">${parts.join("")}</div>`;
      fitCardStage(box, hand.length, parts.length > 2);
    },
  };
}
