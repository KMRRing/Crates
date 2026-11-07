// The card room: what Guandan (tribute.js) looks and works like, shared by every card game so they are one brand (Korbi, 7 Nov 2026:
// "this is EXACTLY what every other game should look like that is card based: the same cards, hand, fan, coach, board, enemies, top bar").
//   plateHtml    the brass plate across the top: the game's own facts (a level, a deal, the scores)
//   bubble       the coach's word as a dismissable, partly see-through speech bubble over the screen (it takes no room)
//   drawHandBox  your cards: a column to a rank, or a fan along the table's edge when held sideways on a phone; the hand
//                always takes the room of its deepest stack, so the table never changes size as the cards are rearranged
//   wireDrag     tap a card to pick it, or drag across cards to pick (or put back) each one passed
import { cardHtml } from "./cards.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- the plate ----------
/**
 * @param lead   markup at the left (a card, a number), or ""
 * @param items  [{ k: small label, v: big value (markup), on: this one counts now }], at the right
 * @param tail   a small word after them
 */
export function plateHtml({ lead = "", title = "", items = [], tail = "" } = {}) {
  const part = i => `<span class="cr-side${i.on ? " on" : ""}"><small>${esc(i.k)}</small><b>${i.v}</b></span>`;
  return `<span class="cr-plate">${lead ? `<span class="cr-lead">${lead}</span>` : ""}${title ? `<span class="cr-title"><small>${title}</small></span>` : ""}`
    + `<span class="cr-sides">${items.map(part).join("")}</span>${tail ? `<span class="cr-tail">${tail}</span>` : ""}</span>`;
}

// ---------- the coach's bubble ----------
/** `el`: a hidden-able element inside a `.cr-bar` (position: relative) over your buttons. show(html, sig): `sig` names what it says,
 *  so a word dismissed stays dismissed until it is a different word; ask() brings it back (a Hint asked for again). */
export function bubble(el) {
  el.classList.add("cr-bubble");
  let off = "";
  el.addEventListener("click", e => { if (e.target.closest(".cr-bubble-x")) { off = el.dataset.sig || ""; el.hidden = true; } });
  return {
    show(html, sig = html) {
      el.dataset.sig = sig;
      if (!html || sig === off) { el.hidden = true; return false; }
      el.innerHTML = `${html}<button type="button" class="cr-bubble-x" aria-label="Dismiss">×</button>`;
      el.hidden = false;
      return true;
    },
    ask() { off = ""; },
  };
}

// ---------- your cards ----------
/** A column to a rank, its cards each showing at least their corner; always the room of the deepest stack (7.2rem below the card). */
export function stackedLayout(cols, rem, room, { big = false, reachRem = 7.2 } = {}) {
  const W = (big ? 3.2 : 2.6) * rem, H = (big ? 4.4 : 3.6) * rem;
  const pitch = cols.length > 1 ? Math.min(W + 0.2 * rem, (room - W) / (cols.length - 1)) : W;
  const deepest = Math.max(1, ...cols.map(c => c.length));
  const index = 2.1 * rem, reach = reachRem * rem;
  const drop = deepest > 1 ? Math.min(index, Math.max(0.9 * rem, reach / (deepest - 1))) : 0, tight = deepest > 1 && drop < index;
  const x0 = Math.max(0, (room - (cols.length ? (cols.length - 1) * pitch + W : 0)) / 2);
  const at = [];
  cols.forEach((col, c) => col.forEach((id, i) => at.push({ id, x: x0 + c * pitch, y: i * drop, z: i + 1 })));
  return { W, H, at, tight, height: H + reach + 0.3 * rem };
}
/** Held sideways, in a row: each card showing its corner, a little more room between ranks than within one. */
export function fannedLayout(cols, rem, room, { big = 1 } = {}) {
  const W = 2.25 * big * rem, H = 3.2 * big * rem;
  const n = cols.reduce((s, c) => s + c.length, 0), breaks = Math.max(0, cols.length - 1), least = 1.05 * rem;
  let gap = 0.22 * rem, pitch = n > 1 ? (room - W - breaks * gap) / (n - 1) : 0;
  if (pitch < least && n > 1) { gap = breaks ? Math.max(0, (room - W - (n - 1) * least) / breaks) : 0; pitch = Math.max((room - W - breaks * gap) / (n - 1), 0.6 * rem); }
  pitch = Math.min(pitch, W * 0.66);
  const x0 = Math.max(0, (room - W - (n - 1) * pitch - breaks * gap) / 2), at = [];
  let k = 0;
  cols.forEach((col, c) => col.forEach(id => { at.push({ id, x: x0 + k * pitch + c * gap, y: 0, z: k + 1 }); k++; }));
  return { W, H, at, height: H };
}
const sideways = () => matchMedia("(orientation: landscape) and (min-width: 700px)").matches;
const low = () => matchMedia("(max-height: 520px)").matches;

/**
 * Draws a hand into `box` (class cr-hand).
 * @param cols     the cards as columns (arrays of ids), the strongest on the left; a hint's plan is its own columns
 * @param face     id -> { rank, suit } | { joker }   (cards.js)
 * @param label    id -> the card's name
 * @param classes  id -> extra classes (sel, advised, dim, shade…)

 * @param big      the fan's card size, in steps of Guandan's (default 1.1); a hand of few cards takes more
 * @param html     id, { cls, data } -> a card's markup, for a game with a pack of its own (instead of face and label)
 * @param reachRem how far below a card the deepest stack may reach; a game whose stacks are shallow (four suits) takes less
 * @returns the layout, with `.fan`
 */
export function drawHandBox(box, { cols, face, label = () => "", classes = () => "", fan = null, reachRem = 7.2, html = null, big = null }) {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, room = box.parentElement?.clientWidth || box.clientWidth || 360;
  const row = fan ?? (sideways() && low());
  const lay = row ? fannedLayout(cols, rem, room, { big: low() ? 1 : big ?? 1.1 }) : stackedLayout(cols, rem, room, { big: sideways() && !low(), reachRem });
  const rows = Math.max(...cols.map(c => c.length), 1);
  const t = (x) => (x + lay.W / 2 - room / 2) / (room / 2), drop = (row ? 0.9 : 0.55) * rem, tilt = row ? 6 : 4;
  box.classList.add("cr-hand");
  box.classList.toggle("fan", row);
  box.classList.toggle("tight", !!lay.tight);
  box.style.setProperty("--cd-size", `${(lay.W / 2.5).toFixed(2)}px`);
  box.innerHTML = lay.at.map(({ id, x, y, z }, i) => {
    const arc = `;--rot:${(t(x) * tilt).toFixed(2)}deg;--ly:${(t(x) * t(x) * drop).toFixed(1)}px`;
    const o = { cls: `cr-card ${classes(id)}`.trim(), data: { id, x: x.toFixed(1), y: y.toFixed(1), z, arc } };
    return html ? html(id, o) : cardHtml(face(id), { ...o, label: label(id) });
  }).join("");
  // the positions are set as styles on the cards (cardHtml carries data only)
  for (const el of box.children) {
    const d = el.dataset;
    el.style.cssText = `left:${d.x}px;top:${d.y}px;z-index:${d.z}${d.arc}`;
    delete d.x; delete d.y; delete d.z; delete d.arc;
  }
  box.style.height = `${lay.height.toFixed(0)}px`;
  void rows;
  return { ...lay, fan: row };
}

/** Tap picks a card; drag across cards, along the row or down a column, picks (or puts back, as the first one went) each one passed. */
export function wireDrag(box, { has, toggle }) {
  let drag = null;
  const touch = el => {
    const id = Number(el.dataset.id);
    if (drag.done.has(id)) return;
    drag.done.add(id);
    toggle(id, drag.pick);
  };
  box.addEventListener("pointerdown", e => {
    const el = e.target.closest(".cd[data-id]");
    if (!el || e.button > 0) return;
    box.setPointerCapture(e.pointerId);
    drag = { pick: !has(Number(el.dataset.id)), done: new Set() };
    touch(el);
  });
  box.addEventListener("pointermove", e => {
    const el = drag && document.elementFromPoint(e.clientX, e.clientY)?.closest(".cr-hand .cd[data-id]");
    if (el) touch(el);
  });
  for (const end of ["pointerup", "pointercancel"]) box.addEventListener(end, () => { drag = null; });
}
