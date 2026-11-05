// Drift's voyage: sixteen levels in eight sections, each section bringing one event (drift-engine.js says what each
// does), each level a quay (drift-shapes.js) and a set of orders: crates of each good (salt, herring, furs, amber) to
// ship before the turns run out. Open sail is the endless game on a quay dealt at random (quayFor).
import { rules } from "./drift-engine.js";
import { SHAPES } from "./drift-shapes.js";

export const SECTIONS = [
  { id: 1, name: "Fair winds", event: null, blurb: "Trade winds hold their heading. Three alike in a line ship.", levels: [
    { id: "1-1", name: "First cargo", note: "The wind keeps its heading for several turns. Pile crates against the quay edge it blows to.", shape: "pier", goods: 2, windMode: "trade", orders: [6, 9, 0, 0], turns: 18 },
    { id: "1-2", name: "Down the slip", note: "A hull is a quay with a pointed bow: a slide stops where the water begins.", shape: "hull", goods: 3, windMode: "trade", orders: [6, 6, 3, 0], turns: 22 },
  ] },
  { id: 2, name: "Moorings", event: "moor", blurb: "The wind veers every turn. Every sixth crate comes moored: it stays put and the others pile against it.", levels: [
    { id: "2-1", name: "Bollards", note: "A moored crate is a wall you place. Build a line against it, or keep a pair apart from the crate that would spoil it.", shape: "basin", goods: 3, moor: 6, orders: [6, 6, 3, 0], turns: 22 },
    { id: "2-2", name: "The long cargo", note: "Furs ship only in lines of four or more: a line of three is spent and counts for nothing.", shape: "eight", goods: 3, moor: 6, orders: [6, 3, 4, 0], runs: [0, 0, 4, 0], mix: [2, 2, 2, 1], turns: 32 },
  ] },
  { id: 3, name: "Squalls", event: "squall", blurb: "Stray crates blow onto the quay before the wind, drawn faint where they will land.", levels: [
    { id: "3-1", name: "Storm season", note: "A squall lays a stray crate every fourth turn, none making a line where it lands. No crate can be laid on a faint one.", shape: "lagoon", goods: 3, moor: 6, squall: { every: 4, count: 1 }, orders: [9, 9, 3, 0], turns: 30 },
    { id: "3-2", name: "Heavy weather", note: "Squalls come every third turn, two crates at a time. Furs and amber need lines of four.", shape: "hull", goods: 4, moor: 6, squall: { every: 3, count: 2 }, mix: [2, 2, 2, 2], orders: [3, 6, 4, 4], runs: [0, 0, 4, 4], turns: 38 },
  ] },
  { id: 4, name: "Crosswinds", event: "gust", blurb: "Some turns a second gust follows the wind at once, from another quarter.", levels: [
    { id: "4-1", name: "Two winds", note: "A double arrow in the queue is a turn with two winds. The crates settle after the first, then the second blows.", shape: "pier", goods: 3, moor: 6, gust: { p: 0.3 }, orders: [6, 6, 6, 0], turns: 24 },
    { id: "4-2", name: "Backed and veered", note: "Gusts and squalls together: read the queue before you lay.", shape: "basin", goods: 3, moor: 6, gust: { p: 0.25 }, squall: { every: 5, count: 1 }, orders: [9, 9, 9, 0], turns: 30 },
  ] },
  { id: 5, name: "Rogue waves", event: "wave", blurb: "A wave shoves a whole row or column one square, drawn as a band on the quay a turn ahead.", levels: [
    { id: "5-1", name: "The swell", note: "A band with an arrow marks the row or column the wave will push, before the wind. A crate with water behind it does not move.", shape: "eight", goods: 3, moor: 6, wave: { p: 0.3 }, orders: [6, 6, 3, 0], turns: 26 },
    { id: "5-2", name: "Breakers", note: "Waves and gusts both: the queue shows each turn's weather.", shape: "hull", goods: 3, moor: 6, wave: { p: 0.25 }, gust: { p: 0.15 }, orders: [9, 9, 6, 0], turns: 32 },
  ] },
  { id: 6, name: "Fog", event: "fog", blurb: "In fog the queue beyond the turn is hidden. Fog is itself forecast, so it can be planned for.", levels: [
    { id: "6-1", name: "Murk", note: "On a foggy turn you see the wind and the crate to lay, and nothing after them. Do not leave a line that needs the next wind.", shape: "lagoon", goods: 3, moor: 6, fog: { p: 0.3 }, orders: [6, 6, 6, 0], turns: 26 },
    { id: "6-2", name: "Thick weather", note: "Fog between squalls and waves.", shape: "basin", goods: 4, moor: 6, fog: { p: 0.2 }, wave: { p: 0.15 }, squall: { every: 5, count: 1 }, orders: [6, 9, 9, 3], turns: 38 },
  ] },
  { id: 7, name: "Reefs", event: "rock", blurb: "A rock rises from the water on an empty square, forecast a turn ahead, and stays: slides stop at it and lines are broken by it.", levels: [
    { id: "7-1", name: "Shoals", note: "A faint rock on the quay is where one will stand next turn. No crate can be laid there; keep your lines clear of it.", shape: "quay", goods: 3, moor: 6, rock: { p: 0.15, max: 3 }, orders: [6, 6, 6, 0], turns: 26 },
    { id: "7-2", name: "Rocks and rollers", note: "Rocks, waves and gusts on a narrow hull.", shape: "hull", goods: 3, moor: 6, rock: { p: 0.1, max: 3 }, wave: { p: 0.15 }, gust: { p: 0.15 }, orders: [9, 9, 9, 0], turns: 36 },
  ] },
  { id: 8, name: "Harbour master", event: "seal", blurb: "Now and then a crate comes sealed: laid, it ships every crate of its good on the quay.", levels: [
    { id: "8-1", name: "The seal", note: "A sealed crate is a good you choose to ship in full. Lay it when the quay holds the most of its good, and fill an order outright.", shape: "pier", goods: 4, moor: 6, seal: 8, mix: [2, 2, 2, 2], orders: [6, 6, 6, 6], turns: 36 },
    { id: "8-2", name: "Open season", note: "Everything at once: waves, gusts, squalls, fog, reefs and the harbour master's seal.", shape: "eight", goods: 4, moor: 6, seal: 9, squall: { every: 6, count: 1 }, gust: { p: 0.1 }, wave: { p: 0.1 }, fog: { p: 0.08 }, rock: { p: 0.06, max: 2 }, mix: [2, 2, 2, 2], orders: [9, 6, 9, 6], turns: 44 },
  ] },
];
export const LEVELS = SECTIONS.flatMap(s => s.levels.map(l => ({ ...l, section: s.id })));
/** The rules a level is played by. */
export const levelRules = l => rules(l);
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
