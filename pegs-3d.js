// Cribbage's 3D table (Menu, View: 3D): the two seats on the card games' shared tipped cloth (table3d.js), as Guandan has it, you at
// the foot and the other at the far side as plates, and in the middle the pegboard's two lanes, the starter, the count, the crib and
// this round's cards (or a count of the show). Your cards and the buttons stay the page's own.
import { createCloth, fill } from "./table3d.js";

/** One seat's plate (pure): its score, the crib's mark when it is the dealer's, the cards it holds (not yours: they are the page's). */
export function plateOf({ name, seat, mine = false, turn = false, count = 0, score = 0, dealer = false }) {
  return {
    seat, name, meta: dealer ? `<i class="pg3-crib">crib</i>` : "",      // the pegboard keeps the score (Korbi, 10 Nov 2026: the score stood twice, at the seat and on the brass plate; the plate keeps it)
    tally: mine ? "" : `<b class="tk-count" title="Cards left">${count}</b>`, fan: mine ? 0 : Math.min(count, 5), crown: false, act: "", pass: false,
    state: turn ? "on" : "", label: `${name}, ${score} points${dealer ? ", the crib's" : ""}${mine ? "" : `, ${count} cards`}`,
  };
}

export function createPegs3d(host) {
  let cloth = null;
  return {
    /** `t`: { plates: [yours, the other's], centre: markup }. */
    draw(t) {
      if (!cloth) { cloth = createCloth(host, { seats: 2 }); cloth.centre.dataset.n = 2; }
      t.plates.forEach((p, slot) => cloth.set(slot, p));
      fill(cloth.centre, t.centre);
    },
    dispose() { cloth = null; host.innerHTML = ""; },
  };
}
