// Liar's dice's 3D table (Menu, View: 3D): the same game and state as the flat table on the card games' shared tipped cloth
// (table3d.js). Each player stands round it as a plate (the lives left, the last bid, the dice at the lifting of the cups), and
// the bid as called lies in the middle as large as the room allows. Your dice, your bid and your buttons stay the page's own.
import { createCloth, createMotion, fill, slotOf } from "./table3d.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * One player's plate (pure): `cups` the lives left as markup, `bid` its last bid (markup: or `call`, the word it called with),
 * `dice` its dice as markup once the cups are lifted, `turn` it is to bid, `loser` it loses.
 */
export function plateOf({ name, seat, mine = false, turn = false, cups = "", bid = "", call = "", dice = "", thinking = false, loser = false, away = false }) {
  return {
    seat, name: mine ? "You" : name, meta: cups, tally: `${call ? `<b class="bo3-call">${esc(call)}</b>` : bid}${dice ? `<span class="bo3-dice">${dice}</span>` : ""}`,
    fan: 0, crown: false, mark: "", act: "", pass: false,
    state: [turn ? "on" : "", thinking ? "thinking" : "", loser ? "mate" : "", away ? "out" : ""].filter(Boolean).join(" "),
    label: `${mine ? "You" : name}${turn ? ", to bid" : ""}${loser ? ", loses" : ""}`,
  };
}

export function createBoast3d(host, { quiet = () => false } = {}) {
  let cloth = null, motion = null, seats = 0;
  const m = () => (motion ||= createMotion({ quiet }));

  /** `t`: { seats, me, plates: by seat, centre: markup, bid: a key that changes with each bid (the middle pops) }. */
  function draw(t) {
    if (!cloth || seats !== t.seats) { cloth = createCloth(host, { seats: t.seats }); seats = t.seats; cloth.centre.classList.add("bo3-centre"); cloth._bid = null; }
    t.plates.forEach((p, seat) => cloth.set(slotOf(seat, t.me, t.seats), p));
    const changed = fill(cloth.centre, t.centre);
    if (changed && cloth._bid !== null && t.bid !== cloth._bid) m().pop(cloth.centre.querySelector(".bo-bid-big"));
    cloth._bid = t.bid;
  }
  return {
    draw,
    pause: on => motion?.hold(on),
    dispose() { motion?.dispose(); motion = null; cloth = null; seats = 0; host.innerHTML = ""; },
  };
}
