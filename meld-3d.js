// Gin rummy's 3D table (Menu, View: 3D): the same game and state as the flat table on the card games' shared tipped cloth
// (table3d.js). The other player stands across the cloth as a plate (a fan of backs, the cards it holds, the score); the stock
// and the pile lie in the middle, tapped as on the flat table; a card put on the pile is flown there from whoever threw it.
// At a hand's end the other's cards lie in the middle, melds set apart. Your cards and buttons stay the page's own.
import { createCloth, createMotion, rectOf, fill } from "./table3d.js";

/** The other player's plate (pure): `count` the cards it holds (none once shown), `score`, `turn`. */
export function plateOf({ name, seat, count = 0, score = 0, turn = false, over = false }) {
  return {
    seat, name, meta: `<i class="ml3-sc">${score}</i>`, tally: over ? "" : `<b class="tk-count">${count}</b>`, fan: over ? 0 : Math.min(count, 5),
    state: turn ? "on thinking" : "", label: `${name}, ${score} points${over ? "" : `, ${count} cards`}`,
  };
}
/** Your plate: only your name and score (your cards are the page's own, below). */
export const myPlate = ({ seat, score = 0, turn = false }) => ({ seat, name: "You", meta: `<i class="ml3-sc">${score}</i>`, tally: "", fan: 0, state: turn ? "on" : "", label: `You, ${score} points` });

export function createMeld3d(host, { quiet = () => false } = {}) {
  let cloth = null, motion = null, threw = -1, key = "";
  const m = () => (motion ||= createMotion({ quiet }));

  /** `t`: { me: your seat's colour, foe, centre: markup, key: the hand, thrown: the pile's size, mineThrown: you threw the last }. */
  function draw(t) {
    const first = !cloth;
    if (first) cloth = createCloth(host, { seats: 2 });
    cloth.set(0, t.me);
    cloth.set(1, t.foe);
    fill(cloth.centre, t.centre);
    if (!first && t.key === key && t.thrown > threw) {
      const to = rectOf(cloth.centre.querySelector(".ml-pile .cd")), from = rectOf(t.mineThrown ? document.getElementById("hand") : cloth.plates[1].querySelector(".tk-med"));
      if (to && from) m().fly({ face: cloth.centre.querySelector(".ml-pile .cd").outerHTML, from: { ...from, h: to.h }, to, up0: true, up1: true, ms: 340, land: cloth.centre.querySelector(".ml-pile .cd") });
    }
    key = t.key;
    threw = t.thrown;
  }
  return {
    draw,
    pause: on => motion?.hold(on),
    dispose() { motion?.dispose(); motion = null; cloth = null; threw = -1; key = ""; host.innerHTML = ""; },
  };
}
