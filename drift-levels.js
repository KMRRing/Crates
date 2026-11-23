// Drift's voyage: the campaign (campaign.js's pattern), its chapters each bringing one twist and its levels frozen in drift-book.js,
// each with its own deal written out and proved winnable by a player who reads the forecast (drift-plan.mjs makes them; Korbi, 23
// Nov 2026: "drift campaign fixed deals that are winnable"). A level is a quay (drift-shapes.js) and orders: crates of each good
// (salt, herring, furs, amber) to ship before the turns run out; its par is the turns the planner took. Open sail is the endless
// game on a quay dealt at random (quayFor).
import { rules } from "./drift-engine.js";
import { SHAPES } from "./drift-shapes.js";
import { BOOK } from "./drift-book.js";

// the plan Korbi reviewed on 23 Nov 2026 has eighteen chapters; these are its first twelve (tides, ships alongside, timber, mixed
// lots, sailing dates and the Hanse fleet are to come, in their places)
export const CHAPTERS = [
  { id: "trade", name: "Trade winds", rule: "Lay a crate, then the wind slides every crate its way. Three of a good in a line ship." },
  { id: "shift", name: "Shifting winds", rule: "The wind changes every turn: lay where the next wind brings a crate to its pair." },
  { id: "hold", name: "The warehouse", rule: "Put the crate to lay in the warehouse and take out the one kept there, once between two crates." },
  { id: "moor", name: "Bollards", rule: "A crate with an anchor is moored: it stays put and the others pile against it." },
  { id: "long", name: "Long cargo", rule: "Some goods ship only in lines of four or more; a line of three of them is lost." },
  { id: "squall", name: "Squalls", rule: "Stray crates land before the wind, drawn faint where they will fall." },
  { id: "airs", name: "Light airs", rule: "A breeze, the thin arrow, moves every crate one square, not all the way." },
  { id: "gust", name: "Crosswinds", rule: "Some turns a second wind follows the first, from another quarter." },
  { id: "wave", name: "Rogue waves", rule: "A wave shoves a row or a column one square, marked on the quay the turn it comes." },
  { id: "fog", name: "Fog", rule: "On a foggy turn the queue beyond it is hidden." },
  { id: "reef", name: "Reefs", rule: "A rock rises on an empty square and stays: slides stop at it and lines break at it." },
  { id: "seal", name: "Harbour master", rule: "A sealed crate ships every crate of its good on the quay." },
];
export const LEVELS = BOOK.map(L => ({ ...L, chapter: CHAPTERS.findIndex(c => c.id === L.ch) }));
/** The rules a level is played by: its quay, goods and orders, its turns and par, and its deal. */
export const levelRules = L => rules({ shape: L.shape, goods: L.goods, mix: L.mix, runs: L.runs || [], orders: L.orders, turns: L.turns, par: L.par, hold: !!L.hold, deal: L.deal });
// Open sail's quays and how often each is dealt: the classic hull is common.
export const QUAY_ODDS = { hull: 4, quay: 1, pier: 2, basin: 2, eight: 2, lagoon: 2 };
/** The quay a new endless game is dealt, from its seed (the player does not choose: Korbi, 4 November 2026). */
export function quayFor(seed) {
  const ids = Object.keys(QUAY_ODDS), tot = ids.reduce((a, id) => a + QUAY_ODDS[id], 0);
  let x = ((Math.imul((seed >>> 0) ^ 0x51ED270B, 0x9E3779B1) >>> 0) / 4294967296) * tot;
  for (const id of ids) if ((x -= QUAY_ODDS[id]) < 0) return id;
  return "hull";
}
/** The endless game on a given quay: the squalls speed up as it goes, and the other events come in late and light. */
export const openRules = shape => rules({
  shape: SHAPES[shape] ? shape : "quay", start: 8, moor: 6, seal: 12, squall: { pace: true },
  gust: { p: 0.1, from: 20 }, wave: { p: 0.08, from: 40 }, fog: { p: 0.06, from: 60 }, rock: { p: 0.03, from: 90, max: 4 },
});
