// Hearts' 3D table (Menu, View: 3D): the same game and state as the flat table, on the card games' shared tipped cloth
// (table3d.js). The four seats stand round it as plates with a fan of backs, their score and the points taken this hand;
// each seat's card in the trick lies on the cloth in a lane in front of it, flown there from its plate, and the trick
// is swept to the plate of whoever takes it. Your cards and the buttons stay the page's own.
import { createCloth, createMotion, rectOf, fill, slotOf, snap } from "./table3d.js";
import { slide, mayMove } from "./cardslide.js";

/**
 * One seat's plate (pure): `count` the cards it holds, `score` its game score (said, not shown), `taken` the points it has taken this hand,
 * `word` what it says (Passed, or the points a trick brought), `win` the seat that took the last trick or the hand.
 */
export function plateOf({ name, seat, mine = false, turn = false, count = 0, score = 0, taken = 0, word = "", think = false, win = false, over = false }) {
  const meta = taken ? `<i class="hr3-taken">♥ ${taken}</i>` : "";      // this hand's points; the match's score is the plate's (Korbi, 10 Nov 2026: the score stood twice, at the seat and on the brass plate; the plate keeps it)
  return {
    seat, name, meta, tally: mine ? "" : `<b class="tk-count${count === 1 && !over ? " low" : ""}" title="Cards left">${count}</b>`,
    fan: mine || over ? 0 : Math.min(count, 5), crown: win, act: word, pass: false,
    state: [turn ? "on" : "", think ? "thinking" : "", win ? "tobeat" : ""].filter(Boolean).join(" "),
    label: `${name}${mine ? "" : `, ${count} cards left`}, ${score} points${taken ? `, ${taken} taken this hand` : ""}${word ? `, ${word}` : ""}`,
  };
}

export function createHearts3d(host, { quiet = () => false } = {}) {
  let cloth = null, motion = null, lanes = null, top = null;
  const m = () => (motion ||= createMotion({ quiet }));
  const build = () => {
    cloth = createCloth(host, { seats: 4 });
    cloth.centre.dataset.n = 4;
    cloth.centre.innerHTML = [0, 1, 2, 3].map(i => `<div class="hr3-lane s${i}" data-slot="${i}"></div>`).join("") + `<div class="hr3-top"></div>`;
    lanes = [...cloth.centre.querySelectorAll(".hr3-lane")];
    top = cloth.centre.querySelector(".hr3-top");
  };

  /** `t`: { me, plates: by seat, lanes: markup by seat, top: markup, winner: the seat a cleared trick goes to (or null) }. */
  function draw(t) {
    const first = !cloth;
    if (first) build();
    t.plates.forEach((p, seat) => cloth.set(slotOf(seat, t.me, 4), p));
    fill(top, t.top);
    const swept = [];
    t.plates.forEach((_, seat) => {
      const slot = slotOf(seat, t.me, 4), lane = lanes[slot], html = t.lanes[seat] || "";
      if (!html && lane._h && t.winner != null) [...lane.querySelectorAll(".cd")].forEach(cd => swept.push(snap(cd)));
      if (!fill(lane, html) || first || !html) return;
      const from = rectOf(cloth.plates[slot].querySelector(".tk-med"));
      if (from && mayMove(quiet)) slide(lane.querySelector(".cd"), from, 0);          // the card that lies there is the one that moves
    });
    if (swept.length && t.winner != null) m().sweep(swept, rectOf(cloth.plates[slotOf(t.winner, t.me, 4)].querySelector(".tk-med")), { plane: cloth.centre });
  }
  return {
    draw,
    pause: on => motion?.hold(on),
    dispose() { motion?.dispose(); motion = null; cloth = null; lanes = null; top = null; host.innerHTML = ""; },
  };
}
