// Hold'em's 3D table (Menu, View: 3D): the same game and the same state as the flat table, drawn on the card games' shared
// tipped cloth (table3d.js). The seats stand round it as plates (a medallion, the stack, the bet, a fan of two backs or, at a
// showdown, the two cards), the pot, the board and the narrator's words lie in the middle, and the board's cards are flown in
// as the flop, the turn and the river come. Your own cards, the coach, the size and the buttons stay the page's own below.
import { createCloth, createMotion, rowFit, rectOf, fill, slotOf } from "./table3d.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = n => Number(n).toLocaleString("en-GB");

/**
 * What one seat's plate shows (pure; the page gives it facts, and markup only for cards): `tags` the small blind, big blind and
 * rebuy marks, `bet` the chips put in this round, `held` the two cards as markup where they are face up, `hidden` that it
 * holds two face down, `act` its latest word (at a showdown the hand it made), `delta` the chips won or lost once paid.
 */
export function plateOf({ name, seat, mine = false, out = false, turn = false, win = false, button = false, tags = [], stack = 0, bet = 0, held = "", hidden = false, act = "", thinking = false, delta = 0 }) {
  const meta = tags.map(t => `<i class="hd3-tag">${esc(t)}</i>`).join("")
    + (bet > 0 && !delta ? `<i class="hd3-bet" title="Bet this round">${fmt(bet)}</i>` : "")
    + (delta ? `<i class="hd3-delta ${delta > 0 ? "up" : "down"}">${delta > 0 ? "+" : "−"}${fmt(Math.abs(delta))}</i>` : "");
  const chips = `<b class="tk-n hd3-stack">${fmt(stack)}</b>`;
  return {
    seat, name, meta, tally: (held ? `<span class="hd3-held">${held}</span>` : "") + chips, fan: hidden && !out && !mine && !held ? 2 : 0,
    crown: win, mark: button ? "D" : "", act, pass: act === "Fold",
    state: [turn && !out ? "on" : "", out ? "out" : "", thinking ? "thinking" : "", win ? "tobeat" : ""].filter(Boolean).join(" "),
    label: `${name}${button ? ", the button" : ""}, ${fmt(stack)} chips${bet > 0 ? `, bet ${fmt(bet)}` : ""}${act ? `, ${act}` : ""}`,
  };
}

/** The five places of the board as markup: a card where one is turned up (`face(id)` draws it), an empty outline where not. */
export function boardRow(board, seen, face) {
  return Array.from({ length: 5 }, (_, i) => (i < seen ? `<span class="hd3-slot" data-i="${i}">${face(board[i])}</span>` : `<span class="hd3-slot empty" data-i="${i}"></span>`)).join("");
}

/** The width of a board card: five in a row in the middle, as wide as the room allows and no wider than 3.4rem. */
export const boardWidth = (room, rem = 16) => rowFit(room, 5, { gap: 0.14, max: 3.4 * rem });

export function createHoldem3d(host, { quiet = () => false } = {}) {
  let cloth = null, motion = null, seats = 0, hand = -1, seen = 0, cw = 0;
  const m = () => (motion ||= createMotion({ quiet }));

  /** Draws the table. `t`: { seats, me, hand, seen, plates: [plateOf…] by seat, board: markup, pot, said, next }. */
  function draw(t) {
    if (!cloth || seats !== t.seats) { cloth = createCloth(host, { seats: t.seats }); seats = t.seats; hand = -1; seen = 0; cw = 0; }
    t.plates.forEach((p, seat) => cloth.set(slotOf(seat, t.me, t.seats), p));
    const c = cloth.centre;
    const w = boardWidth({ w: c.clientWidth, h: c.clientHeight * 0.5 });
    if (w > 0 && Math.abs(w - cw) > 0.5) { cw = w; c.style.setProperty("--cw", `${w.toFixed(1)}px`); }
    const grew = fill(c, `<p class="hd-pot">${t.pot}</p><div class="hd3-board" aria-label="The board">${t.board}</div><p class="hd-said">${esc(t.said)}</p>${t.next}`);
    // flights, after the first draw of a hand: its cards dealt to the fans, then each card of the board from the pile
    if (hand === -1) { hand = t.hand; seen = t.seen; return; }
    if (t.hand !== hand) {
      hand = t.hand; seen = t.seen;
      const fans = t.plates.map((_, seat) => (seat === t.me ? null : cloth.plates[slotOf(seat, t.me, t.seats)].querySelector(".tk-fan")));
      m().deal({ from: rectOf(c.querySelector(".hd-pot")), to: fans.map(rectOf), per: 2 });
    } else if (t.seen > seen && grew) {
      const from = rectOf(c.querySelector(".hd-pot"));
      for (let i = seen; i < t.seen; i++) {
        const land = c.querySelector(`.hd3-slot[data-i="${i}"]`), to = rectOf(land);
        if (to && from) m().fly({ face: land.innerHTML, from: { ...from, h: to.h }, to, up0: false, up1: true, delay: (i - seen) * 140, land });
      }
      seen = t.seen;
    } else seen = t.seen;
  }
  return {
    draw,
    pause: on => motion?.hold(on),
    /** Back to the flat table: the cloth goes and the cards in the air with it. */
    dispose() { motion?.dispose(); motion = null; cloth = null; host.innerHTML = ""; },
  };
}
