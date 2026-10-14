// French-suited playing cards for the card games on seats.js (Big Two, Landlord): a card drawn in HTML as Tribute's
// are, ivory with its rank and suit in the corner and the suit large at its foot, red for hearts and diamonds; a joker
// lettered down its corner, where a rank is, so it reads in a fanned hand. Sizes are in em, so a hand, a play on the
// table and a card in a line of words are the same card at different sizes (cards.css). A game says what each of its
// cards is: { rank: "10", suit: 0–3 (♦ ♣ ♥ ♠) } or { joker: "big" | "small" }.
export const SUIT_MARKS = ["♦", "♣", "♥", "♠"];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** A card as markup: face is { rank, suit } or { joker }; cls adds classes (sel, dim, lit…); data its data-* fields. */
export function cardHtml(face, { cls = "", data = {}, label = "" } = {}) {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
  if (face.joker) {
    const big = face.joker === "big";
    return `<span class="cd joker ${big ? "big" : "small"}${cls ? ` ${cls}` : ""}"${attrs} role="img" aria-label="${esc(label || (big ? "big joker" : "small joker"))}"><span class="cd-j">JOKER</span><span class="cd-pip" aria-hidden="true">★</span></span>`;
  }
  const red = face.suit === 0 || face.suit === 2, s = SUIT_MARKS[face.suit];
  return `<span class="cd${red ? " red" : ""}${cls ? ` ${cls}` : ""}"${attrs} role="img" aria-label="${esc(label || `${face.rank} of ${["diamonds", "clubs", "hearts", "spades"][face.suit]}`)}"><span class="cd-r">${esc(face.rank)}</span><span class="cd-s">${s}</span><span class="cd-pip" aria-hidden="true">${s}</span></span>`;
}
/** A card's back: the others' hands. */
export const backHtml = (cls = "") => `<span class="cd back${cls ? ` ${cls}` : ""}" aria-hidden="true"></span>`;

/**
 * Lays a row of cards out in its box: as large as `max` (in rem) allows, overlapping as much as the width needs, the
 * last card whole. Sets --cd-size (the cards' font size) and --cd-step (how far each card is from the last) on the box.
 */
export function fitRow(box, n, { max = 1.05, min = .7, aspect = 2.5 } = {}) {
  const w = box.clientWidth, h = box.clientHeight, rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  if (!w || !n) return;
  let size = max * rem;
  if (h) size = Math.min(size, (h - 0.6 * rem) / 3.5);                          // a card is 3.5em high (plus the lift when picked)
  size = Math.max(min * rem, size);
  const cw = size * aspect;
  const step = n > 1 ? Math.min(cw * 1.04, (w - cw) / (n - 1)) : 0;
  box.style.setProperty("--cd-size", `${size}px`);
  box.style.setProperty("--cd-step", `${Math.max(step, cw * 0.28)}px`);
}
