// Big Two's 3D table (Menu, View: 3D): the same game and state as the flat table on the card games' shared tipped cloth
// (table3d.js). The seats (three or four) stand round it as plates with a fan of backs and the count left; the latest play
// lies on the cloth in the middle, its cards flown there from its seat's plate; what the trick is says in the middle.
// Your cards and the buttons stay the page's own.
import { createCloth, createMotion, rectOf, fill, slotOf } from "./table3d.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * One seat's plate (pure): `count` the cards it holds, `word` what it last said (a pass), `lead` that it holds the trick,
 * `pay` the points it lost once the deal is paid and `won` the points the winner took, `last` one card left.
 */
export function plateOf({ name, seat, mine = false, turn = false, count = 0, score = 0, word = "", think = false, lead = false, pay = 0, won = 0, over = false }) {
  const meta = `<i class="b23-sc">${score > 0 ? "+" : ""}${score}</i>${pay ? `<i class="b23-pay down">−${pay}</i>` : ""}${won ? `<i class="b23-pay up">+${won}</i>` : ""}`;
  return {
    seat, name, meta, tally: mine ? "" : `<b class="tk-count${count === 1 && !over ? " low" : ""}" title="Cards left">${count}</b>`,
    fan: mine || over ? 0 : Math.min(count, 5), crown: won > 0, act: won > 0 ? "Out" : word, pass: !!word && !won,
    state: [turn ? "on" : "", think ? "thinking" : "", lead ? "tobeat" : ""].filter(Boolean).join(" "),
    label: `${name}${mine ? "" : `, ${count} cards left`}${word ? `, ${word}` : ""}`,
  };
}

export function createBigTwo3d(host, { quiet = () => false } = {}) {
  let cloth = null, motion = null, pile = null, top = null, seats = 0;
  const m = () => (motion ||= createMotion({ quiet }));
  const build = n => {
    cloth = createCloth(host, { seats: n, clockwise: false });
    seats = n;
    cloth.centre.dataset.n = n;
    cloth.centre.innerHTML = `<div class="b23-pile"></div><div class="b23-top"></div>`;
    pile = cloth.centre.querySelector(".b23-pile");
    top = cloth.centre.querySelector(".b23-top");
  };

  /** `t`: { seats, me, plates: by seat, pile: { seat, html } | null, top: markup (what the trick is) }. */
  function draw(t) {
    const first = !cloth || seats !== t.seats;
    if (first) build(t.seats);
    t.plates.forEach((p, seat) => cloth.set(slotOf(seat, t.me, t.seats), p));
    fill(top, t.top);
    // the play lies in the middle, its cards flown there from the plate of the seat that made it
    if (!fill(pile, t.pile?.html || "") || first || !t.pile) return;
    const from = rectOf(cloth.plates[slotOf(t.pile.seat, t.me, t.seats)].querySelector(".tk-med"));
    [...pile.querySelectorAll(".cd")].slice(0, 5).forEach((cd, i) => {
      const to = rectOf(cd);
      if (from && to) m().fly({ face: cd.outerHTML, from: { ...from, h: to.h }, to, up0: true, up1: true, delay: i * 30, ms: 340, land: cd });
    });
  }
  return {
    draw,
    pause: on => motion?.hold(on),
    dispose() { motion?.dispose(); motion = null; cloth = null; pile = null; top = null; seats = 0; host.innerHTML = ""; },
  };
}
