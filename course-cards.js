// The card games' stage for a course (course.js): examples with their names, the play on the table to beat, and a hand
// to pick from, drawn as the games draw their cards (cards.js). The game says what its cards look like (face, label)
// and judges a pick (judge(step, ids) → { ok, msg } or { ok: false, why }). In a lesson, cards are written as text:
// ranks 3–9, T, J, Q, K, A, 2, each with a suit or none (d c h s: ♦ ♣ ♥ ♠), and SJ, BJ for the jokers.
//
// A step's stage: rows: [{ label, zh, cards | backs (how many cards face down) | text (a word, as a pass) }] (examples),
// table (the play to beat; tableLabel), hand (the cards to pick from; handLabel), goal (an exercise: the game's judge
// reads it), answer (the cards Hint picks: they must be in the hand). Each row is its own pack (examples may repeat a
// card), the table and the hand one between them; oneDeck: true deals the rows from that pack too (a hand taken apart,
// the cards played so far), so no card shows twice.
import { cardHtml, backHtml, fitRow } from "./cards.js";

const RANKS = ["3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A", "2"];
const SUIT = { d: 0, c: 1, h: 2, s: 3 }, FILL = [3, 2, 1, 0];      // a card written without a suit: ♠ first, then ♥ ♣ ♦
const CARD = /^(10|[2-9TJQKA])([dchs])?$/;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tokens = text => String(text || "").trim().split(/\s+/).filter(Boolean);
const rankIn = tok => RANKS.indexOf(tok === "10" ? "T" : tok);

/**
 * Cards written as text ("3 3 7s Th Qd 2 SJ BJ") as ids: rank × 4 + suit (♦ ♣ ♥ ♠), the small joker 52, the big 53. A card
 * written without a suit takes the first of ♠ ♥ ♣ ♦ that isn't taken (taken: the cards already written, shared across the
 * texts of one pack so no card is written twice).
 */
export function parseCards(text, taken = new Set()) {
  const out = [];
  for (const tok of tokens(text)) {
    let id;
    if (tok === "SJ" || tok === "BJ") id = tok === "SJ" ? 52 : 53;
    else {
      const m = CARD.exec(tok);
      if (!m) throw new Error(`no card "${tok}"`);
      const r = rankIn(m[1]);
      const s = (m[2] ? [SUIT[m[2]]] : FILL).find(x => !taken.has(r * 4 + x));
      if (s == null) throw new Error(`"${tok}" written more times than there are cards`);
      id = r * 4 + s;
    }
    if (taken.has(id)) throw new Error(`"${tok}" written twice`);
    taken.add(id);
    out.push(id);
  }
  return out;
}
const rankOf = id => (id >= 52 ? id - 39 : id >> 2);
/** A card as a lesson writes it, with its suit ("Th", "SJ"). */
export const tokenOf = id => (id === 52 ? "SJ" : id === 53 ? "BJ" : `${RANKS[id >> 2]}${"dchs"[id & 3]}`);
/** Cards as text, lowest first ("5s 5h 5c 8s"): one pick, one text, for a test to tell picks apart. */
export const keyOf = ids => [...ids].sort((a, b) => rankOf(a) - rankOf(b) || a - b).map(tokenOf).join(" ");
/**
 * Whether a pick is the cards a text names: as many, each card written with a suit that card, each written without
 * one any card of its rank ("5 5 5 8" is any three fives and an eight; "Ad" only the ace of diamonds).
 */
export function sameCards(ids, text) {
  const want = tokens(text), left = [...ids];
  if (want.length !== left.length) return false;
  // the suited first, so an unsuited token never takes the card a suited one needs
  for (const tok of [...want].sort((a, b) => /[dchs]$/.test(b) - /[dchs]$/.test(a))) {
    const i = pickFrom(left, tok)?.[0];
    if (i == null) return false;
    left.splice(left.indexOf(i), 1);
  }
  return true;
}

/** A step's cards: { rows: [[ids] | null], table, hand }; a row of backs or a word has none. */
export function cardsOf(step) {
  const taken = new Set(), own = () => (step.oneDeck ? taken : new Set());
  const rows = (step.rows || []).map(r => (r.cards != null ? parseCards(r.cards, own()) : null));
  const table = parseCards(step.table, taken), hand = parseCards(step.hand, taken);
  return { rows, table, hand };
}
/** The cards of a hand a text names (the answer Hint picks): each by its rank, and its suit when written; null if any is missing. */
export function pickFrom(hand, text) {
  const left = [...hand], out = [];
  for (const tok of tokens(text)) {
    const m = CARD.exec(tok), joker = tok === "SJ" ? 52 : tok === "BJ" ? 53 : null;
    const i = left.findIndex(id => (joker != null ? id === joker : m && rankOf(id) === rankIn(m[1]) && (!m[2] || (id & 3) === SUIT[m[2]])));
    if (i < 0) return null;
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

/** The stage. face(id): a card's face for cards.js; label(id): its name; judge(step, ids): a pick judged. */
export function cardStage({ face, label, judge }) {
  let box = null, api = null, step = null, st = null;
  const card = (id, cls = "") => cardHtml(face(id), { cls, label: label(id) });
  const line = ids => `<span class="cd-line${ids.length > 7 ? " many" : ""}">${ids.map(id => card(id)).join("")}</span>`;
  const backs = n => `<span class="cd-line${n > 7 ? " many" : ""}" role="img" aria-label="${n} card${n === 1 ? "" : "s"} face down">${backHtml().repeat(n)}</span>`;
  const head = (text, zh) => (text || zh ? `<small>${esc(text || "")}${zh ? ` <i>${esc(zh)}</i>` : ""}</small>` : "");
  // a hand held biggest first, as the games hold it
  const held = ids => [...ids].sort((a, b) => rankOf(b) - rankOf(a) || b - a);
  return {
    mount(b, a) {
      box = b;
      api = a;
      box.addEventListener("click", e => {
        const c = e.target.closest(".lc-hand .cd[data-id]");
        if (!c || !step?.goal || st.done) return;
        const id = Number(c.dataset.id);
        st.sel ??= new Set();
        if (st.sel.has(id)) st.sel.delete(id); else st.sel.add(id);
        api.changed();
      });
    },
    task: s => !!s.goal,
    ready: (s, t) => !!t.sel?.size,
    label: (s, t) => (!t.sel?.size ? "Play" : t.sel.size === 1 ? "Play it" : `Play these ${t.sel.size}`),
    submit: (s, t) => judge(s, [...t.sel]),
    hint(s, t) { t.sel = new Set(pickFrom(cardsOf(s).hand, s.answer) || []); },
    draw(s, t) {
      step = s;
      st = t;
      const { rows, table, hand } = cardsOf(s);
      const parts = (s.rows || []).map((r, i) => `<div class="lc-row">${head(r.label, r.zh)}${rows[i] ? line(rows[i]) : r.backs ? backs(r.backs) : `<b class="lc-word">${esc(r.text || "")}</b>`}</div>`);
      if (table.length) parts.push(`<div class="lc-row lc-table">${head(s.tableLabel || "To beat")}${line(table)}</div>`);
      if (hand.length) {
        parts.push(`<div class="lc-row">${head(s.handLabel || "Your cards")}</div>`);
        const cls = `${s.goal ? "" : " still"}${t.done ? " done" : ""}`;
        parts.push(`<div class="cd-row lc-hand${cls}">${held(hand).map(id => cardHtml(face(id), { cls: t.sel?.has(id) ? "sel" : "", data: { id }, label: label(id) })).join("")}</div>`);
      }
      box.innerHTML = `<div class="lc">${parts.join("")}</div>`;
      fit(box, hand.length, parts.length > 2);
    },
  };
}

/**
 * The stage's cards as large as it allows: the hand from the stage's height (so the cards never set their own size);
 * the other lines all at one size, the largest at which the longest fits the width (as large as the hand at most);
 * then the whole no taller than the stage, the lines shrinking first and then the hand (a tablet draws them all
 * larger). The height is measured from the first row's top to the last's foot: the content is centred, so what
 * overflows at the top isn't in a scroll height.
 */
function fit(box, n, more) {
  const lc = box.firstElementChild, row = box.querySelector(".lc-hand");
  // no larger than a ninth of the stage's height: a phone's cards as the game's, a tablet's larger
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, MAX = Math.max(1.45, Math.min(2.6, box.clientHeight / 9 / rem));
  // the hand: no taller than its share of the stage, nor so large that its cards (each showing at least 0.28 of
  // itself, as fitRow lays them) run wider than the stage
  const handMax = Math.min(MAX, lc.clientWidth / (2.5 * (1 + 0.28 * (n - 1))) / rem);
  if (row) {
    row.style.height = `${Math.min(box.clientHeight * (more ? 0.4 : 0.6), rem * (handMax * 3.5 + 0.6))}px`;
    fitRow(row, n, { max: handMax });
  }
  const lines = [...lc.querySelectorAll(".lc-row > .cd-line")];
  if (lines.length) {
    // a line's width in ems (its cards and their overlaps are in ems), less the room the table's frame takes
    const avail = lc.clientWidth - rem * 1.6;
    let size = rem * MAX;
    for (const l of lines) size = Math.min(size, avail / (l.scrollWidth / parseFloat(getComputedStyle(l).fontSize)));
    const set = px => { for (const l of lines) l.style.fontSize = `${px}px`; };
    set(size);
    const kids = lc.children, over = () => kids[kids.length - 1].getBoundingClientRect().bottom - kids[0].getBoundingClientRect().top + rem * 0.6 - box.clientHeight;
    for (let k = 0; k < 4 && over() > 0; k++) {
      const tall = lines.reduce((t, l) => t + l.offsetHeight, 0);
      size *= Math.max(0.5, (tall - over() - 1) / tall);
      set(size);
    }
    if (row && over() > 0) {
      row.style.height = `${Math.max(rem * 3, row.offsetHeight - over() - 1)}px`;
      fitRow(row, n, { max: handMax });
    }
  }
}
