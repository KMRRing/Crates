// Tarot's 3D table (Menu, View: 3D): three to five seats on the card games' shared tipped cloth (table3d.js), as Guandan has it. The
// seats stand round it as plates (cards left, score, the part played, what was bid), each seat's card in the trick lies on the cloth
// in front of its plate, flown there from it, and what the table says (the dog, the call, a hand's score) sits in the middle.
import { createCloth, rectOf, fill, slotOf } from "./table3d.js";
import { slide, mayMove } from "./cardslide.js";

/** One seat's plate (pure). `role` the chip (Taker, Partner), `word` what it bid, `think` that it is deciding. */
export function plateOf({ name, seat, mine = false, turn = false, count = 0, role = "", word = "", think = false }) {
  return {
    seat, name, meta: role ? `<i class="tr3-role">${role}</i>` : "",    // its part this deal; the score is the plate's (Korbi, 10 Nov 2026: the score stood twice, at the seat and on the brass plate; the plate keeps it)
    tally: mine ? "" : `<b class="tk-count" title="Cards left">${count}</b>`, fan: mine ? 0 : Math.min(count, 5), crown: false, act: word, pass: word === "Pass",
    state: [turn ? "on" : "", think ? "thinking" : ""].filter(Boolean).join(" "),
    label: `${name}${mine ? "" : `, ${count} cards left`}${role ? `, ${role}` : ""}${word ? `, ${word}` : ""}`,
  };
}

export function createTarot3d(host, { quiet = () => false } = {}) {
  let cloth = null, seats = 0, lanes = [], mid = null;
  const build = n => {
    cloth = createCloth(host, { seats: n, clockwise: false });
    seats = n;
    cloth.centre.dataset.n = n;
    cloth.centre.innerHTML = `<div class="tr3-mid"></div>`;
    mid = cloth.centre.firstElementChild;
    // each seat's card lies between its plate and the middle of the cloth
    lanes = cloth.spots.map(sp => {
      const el = document.createElement("div");
      el.className = "tr3-lane";
      el.style.cssText = `left:${(50 + (sp.x - 50) * 0.55).toFixed(1)}%;top:${(46 + (sp.y - 46) * 0.4).toFixed(1)}%`;
      cloth.mat.append(el);
      return el;
    });
  };

  /** `t`: { me, n, plates: by seat, lanes: markup by seat, mid: markup }. */
  function draw(t) {
    const first = !cloth || seats !== t.n;
    if (first) build(t.n);
    t.plates.forEach((p, seat) => cloth.set(slotOf(seat, t.me, t.n), p));
    fill(mid, t.mid);
    t.plates.forEach((_, seat) => {
      const slot = slotOf(seat, t.me, t.n), lane = lanes[slot], html = t.lanes[seat] || "";
      if (!fill(lane, html) || first || !html || /\bold\b/.test(html)) return;
      const from = rectOf(cloth.plates[slot].querySelector(".tk-med"));
      if (from && mayMove(quiet)) slide(lane.querySelector(".cd"), from, 0);          // the card that lies there is the one that moves
    });
  }
  return { draw, pause() {}, dispose() { cloth = null; lanes = []; mid = null; seats = 0; host.innerHTML = ""; } };
}
