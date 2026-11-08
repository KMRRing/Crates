// Trumps' 3D table (Menu, View: 3D): Jass, Belote, Coinche and Schafkopf on the card games' shared tipped cloth (table3d.js),
// as Guandan, Hearts and Big Two have it. The four seats stand round it as plates with a fan of backs and the cards left, what
// they last said at the seat; each seat's card in the trick lies on the cloth in a lane in front of it, flown there from its
// plate, and the trick is swept to the plate of whoever takes it. Your cards and the buttons stay the page's own.
import { createCloth, createMotion, rectOf, fill, slotOf } from "./table3d.js";
import { slide, mayMove } from "./cardslide.js";

/**
 * One seat's plate (pure): `count` the cards it holds (`showCount` false: not said, where every seat holds the same), `word` what it last said (a bid, a Weis), `role` the part it plays
 * this hand ("trump", "plays", "took"), `dealer`, `mate` your partner in a game with sides.
 */
export function plateOf({ name, seat, mine = false, turn = false, count = 0, word = "", role = "", dealer = false, mate = false, think = false, showCount = true }) {
  const meta = `${role ? `<i class="tr3-role">${role}</i>` : ""}${dealer ? `<i class="tr3-deal" title="Dealer">dealer</i>` : ""}`;
  return {
    seat, name, meta, tally: mine || !showCount ? "" : `<b class="tk-count" title="Cards left">${count}</b>`,
    fan: mine ? 0 : Math.min(count, 5), crown: false, act: word, pass: false,
    state: [turn ? "on" : "", think ? "thinking" : "", mate ? "mate" : ""].filter(Boolean).join(" "),
    label: `${name}${mine || !showCount ? "" : `, ${count} cards left`}${role ? `, ${role}` : ""}${word ? `, ${word}` : ""}`,
  };
}

export function createTrumps3d(host, { quiet = () => false } = {}) {
  let cloth = null, motion = null, lanes = null, top = null, result = null;
  const m = () => (motion ||= createMotion({ quiet }));
  const build = () => {
    cloth = createCloth(host, { seats: 4 });
    cloth.centre.dataset.n = 4;
    cloth.centre.innerHTML = [0, 1, 2, 3].map(i => `<div class="tr3-lane s${i}"></div>`).join("") + `<div class="tr3-top"></div><div class="tr3-res"></div>`;
    lanes = [...cloth.centre.querySelectorAll(".tr3-lane")];
    top = cloth.centre.querySelector(".tr3-top");
    result = cloth.centre.querySelector(".tr3-res");
  };

  /** `t`: { me, plates: by seat, lanes: markup by seat, top: markup, result: markup (a hand's score) or "", winner: the seat a cleared trick goes to (or null) }. */
  function draw(t) {
    const first = !cloth;
    if (first) build();
    t.plates.forEach((p, seat) => cloth.set(slotOf(seat, t.me, 4), p));
    fill(top, t.top);
    fill(result, t.result);
    cloth.centre.classList.toggle("res", !!t.result);
    const swept = [];
    t.plates.forEach((_, seat) => {
      const slot = slotOf(seat, t.me, 4), lane = lanes[slot], html = t.lanes[seat] || "";
      if (!html && lane._h && t.winner != null) [...lane.querySelectorAll(".cd")].forEach(cd => swept.push({ at: rectOf(cd), html: cd.outerHTML }));
      if (!fill(lane, html) || first || !html) return;
      const from = rectOf(cloth.plates[slot].querySelector(".tk-med"));
      if (from && mayMove(quiet)) slide(lane.querySelector(".cd"), from, 0);          // the card that lies there is the one that moves
    });
    if (swept.length && t.winner != null) m().sweep(swept, rectOf(cloth.plates[slotOf(t.winner, t.me, 4)].querySelector(".tk-med")));
  }
  return {
    draw,
    pause: on => motion?.hold(on),
    dispose() { motion?.dispose(); motion = null; cloth = null; lanes = null; top = null; result = null; host.innerHTML = ""; },
  };
}
