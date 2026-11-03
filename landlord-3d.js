// Dou Dizhu's 3D table (Menu, View: 3D): the same game and state as the flat table on the card games' shared tipped cloth
// (table3d.js). The three seats stand round it as plates (a crown on the landlord, a fan of backs and the count of cards left,
// the latest bid or pass said beside it), the kitty and what the trick is lie in the middle, and each seat's play lies on the
// cloth in front of it, its cards flown there from its plate. Your cards, the counter and the buttons stay the page's own.
import { createCloth, createMotion, rectOf, fill, slotOf } from "./table3d.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * One seat's plate (pure): `role` landlord or peasant (`roleWord` in the table talk), `count` the cards it still holds, `word`
 * what it last said (a bid, a pass), `lead` that it holds the trick, `pay` the points won or lost once the deal is paid.
 */
export function plateOf({ name, seat, mine = false, turn = false, count = 0, role = "", roleWord = "", score = 0, word = "", think = "", lead = false, pay = 0, out = false, over = false }) {
  const sc = `<i class="ll3-sc">${score > 0 ? "+" : ""}${score}</i>`;
  const meta = `${roleWord ? `<i class="ll3-role ${role}">${esc(roleWord)}</i>` : ""}${sc}${pay ? `<i class="ll3-pay ${pay > 0 ? "up" : "down"}">${pay > 0 ? "+" : "−"}${Math.abs(pay)}</i>` : ""}`;
  return {
    seat, name, meta, tally: mine ? "" : `<b class="tk-count${count <= 2 && !over ? " low" : ""}" title="Cards left">${count}</b>`,
    fan: mine || over ? 0 : Math.min(count, 5), crown: role === "landlord", act: out ? "Out" : word,
    pass: false, state: [turn ? "on" : "", think ? "thinking" : "", lead ? "tobeat" : ""].filter(Boolean).join(" "),
    label: `${name}${role ? `, ${role}` : ""}${mine ? "" : `, ${count} cards left`}${word ? `, ${word}` : ""}`,
  };
}

export function createLandlord3d(host, { quiet = () => false } = {}) {
  let cloth = null, motion = null, lanes = null, top = null;
  const m = () => (motion ||= createMotion({ quiet }));
  const build = () => {
    cloth = createCloth(host, { seats: 3, clockwise: false });
    cloth.centre.innerHTML = `<div class="ll3-top"></div><div class="ll3-lanes"><div class="ll3-lane" data-slot="2"></div><div class="ll3-lane" data-slot="1"></div></div><div class="ll3-lane me" data-slot="0"></div>`;
    lanes = [...cloth.centre.querySelectorAll(".ll3-lane")];
    top = cloth.centre.firstElementChild;
  };

  /** `t`: { me, plates: by seat, lanes: markup by seat, top: markup (the kitty, the trick) }. */
  function draw(t) {
    const first = !cloth;
    if (first) build();
    t.plates.forEach((p, seat) => cloth.set(slotOf(seat, t.me, 3), p));
    fill(top, t.top);
    t.plates.forEach((_, seat) => {
      const slot = slotOf(seat, t.me, 3), lane = lanes.find(l => Number(l.dataset.slot) === slot);
      if (!fill(lane, t.lanes[seat] || "") || first) return;
      const from = rectOf(cloth.plates[slot].querySelector(".tk-med"));
      [...lane.querySelectorAll(".cd")].slice(0, 12).forEach((cd, i) => {
        const to = rectOf(cd);
        if (from && to) m().fly({ face: cd.outerHTML, from: { ...from, h: to.h }, to, up0: true, up1: true, delay: i * 30, ms: 340, land: cd });
      });
    });
  }
  return {
    draw,
    pause: on => motion?.hold(on),
    dispose() { motion?.dispose(); motion = null; cloth = null; lanes = null; top = null; host.innerHTML = ""; },
  };
}
