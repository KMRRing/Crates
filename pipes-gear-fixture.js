// Gears: hand-built frames for the views to draw from (4 November 2026; docs/pipes-contract.md). Each is { name, note, plan, frame, L, laid }
// with the engine's mesh already computed, so a view can be built and looked at before the page exists. The sink goals are read off the
// drawn trains, so every solved fixture is solved by the engine's own check (tests/pipes-gear.mjs). Changes to the contract go through the
// rules agent, with a line here.
//   2026-11-04  first version: idle, train, ratio, pitches, riser, bridge, jam, clash, hands, date, moon.
import { parseLevel, emptyLaid, planOf, frameOf, check, F, SLOTS } from "./pipes-gear-engine.js";
import { parseKind } from "./pipes-gear-shapes.js";

/** Level data from a drawn plate; the hand is what is laid, and every sink and goal pin gets the speed and turn the drawing gives it. */
function build(spec, laidMap) {
  const hand = {};
  for (const p of Object.values(laidMap)) { const k = p.slice(0, p.lastIndexOf("@")); hand[k] = (hand[k] || 0) + 1; }
  const full = { rotate: true, ...spec, sols: [laidMap], hand: Object.entries(hand).map(([k, n]) => `${k}:${n}`).join(" ") };
  const L0 = parseLevel(full), laid0 = emptyLaid(L0);
  for (const [c, p] of Object.entries(laidMap)) laid0[c] = p;
  const M = check(L0, laid0).M;
  const goal = (c, g) => {
    const w = M.omega[c * SLOTS + (g.w ?? (g.ring ? 1 : 0))];
    return w ? { ...g, speed: F.fmt(F.abs(w)), dir: w[0] > 0 ? "cw" : "ccw" } : g;
  };
  full.trains = full.trains.map(t => ({ ...t, sink: { ...t.sink, goal: goal(t.sink.c, t.sink.goal || { type: "wheel" }) } }));
  full.pins = (full.pins || []).map(p => (p.goal ? { ...p, goal: goal(p.c, p.goal) } : p));
  const L = parseLevel(full), laid = emptyLaid(L);
  for (const [c, p] of Object.entries(laidMap)) laid[c] = p;
  return { L, laid };
}
/** A row of squares: the barrel (east) at 0, `pieces` after it, the sink (west) at the end. */
function row(id, pieces, o = {}) {
  const n = pieces.length + 2, laid = {}, pins = [];
  pieces.forEach((p, i) => {
    if (!p) return;
    if (typeof p === "string") laid[i + 1] = p;
    else pins.push({ c: i + 1, kind: p.pin.slice(0, p.pin.lastIndexOf("@")), rot: Number(p.pin.slice(p.pin.lastIndexOf("@") + 1)), train: 0, goal: p.goal });
  });
  return build({
    id, name: id, cols: n, rows: 1, map: [o.map || ".".repeat(n)], pins,
    trains: [{ id: "A", barrel: { c: 0, side: "E", m: o.m ?? 5, l: o.l ?? 1 }, sink: { c: n - 1, side: "W", m: o.sinkM ?? o.m ?? 5, l: o.sinkL ?? o.l ?? 1, n: o.n ?? 9, ring: !!o.ring, pinion: o.pinion, goal: o.goal || { type: "wheel" } } }],
  }, laid);
}
const make = (name, note, b, extra = {}) => ({ name, note, plan: planOf(b.L), frame: frameOf(b.L, b.laid, extra), L: b.L, laid: b.laid });

const S51 = "S5.1@0", D66 = "D5.1:6+6@0";
export const FIXTURES = {};
const add = (key, name, note, b, extra) => { FIXTURES[key] = make(name, note, b, extra); };

{
  const b = row("fx-idle", [S51, D66, S51]);
  b.laid.fill(null);
  add("idle", "Idle", "An empty plate: a barrel, a sink with its goal; a single is held and a ghost shows it over square 1.", b, { held: { kind: "S5.1", rot: 0 }, ghost: { c: 1, kind: "S5.1", rot: 0, ok: true } });
}
add("train", "Train", "One train of standard (m5) pieces on layer 1, solved: wheels alternate, the duo flips.", row("fx-train", [S51, D66, S51]));
add("ratio", "Ratio", "A stack K[5.1>5.2]:8/4>6: the 8-tooth wheel (layer 1) is rigid with a 4-tooth pinion (layer 2); the sink runs at a fraction of the barrel.",
  row("fx-ratio", [S51, "K[5.1>5.2]:8/4>6@0", "S5.2@0"], { sinkL: 2 }));
{
  const b = build({
    id: "fx-pitches", name: "Pitches", cols: 5, rows: 3, map: [".....", ".....", "....."],
    trains: [
      { id: "A", barrel: { c: 0, side: "E", m: 5, l: 1 }, sink: { c: 4, side: "W", m: 5, l: 1, n: 9, goal: { type: "wheel" } } },
      { id: "B", barrel: { c: 10, side: "E", m: 4, l: 1 }, sink: { c: 14, side: "W", m: 4, l: 1, n: 11, goal: { type: "wheel" } } },
    ],
  }, { 1: S51, 2: D66, 3: S51, 11: "S4.1@0", 12: "T4.1:5-7-5@0", 13: "S4.1@0" });
  add("pitches", "Pitches", "Two trains of two modules in rows 0 and 2 (rose fine m4, gilt standard m5); row 1 is the gap that keeps them from touching.", b);
}
add("riser", "Riser", "A riser R[5.1,5.2]: the train comes in on layer 1 and leaves on layer 2 through one shaft.", row("fx-riser", [S51, "R[5.1,5.2]@0", "S5.2@0"], { sinkL: 2 }));
add("bridge", "Bridge", "Squares 1 and 2 lie under bridges (cap 1 and 2): only low pieces fit there. A train on layer 1 runs under both.", row("fx-bridge", [S51, D66, S51], { map: ".12.." }));
{
  const b = build({
    id: "fx-jam", name: "Jam", cols: 3, rows: 3, map: ["...", "...", "..."],
    trains: [{ id: "A", barrel: { c: 0, side: "E", m: 5, l: 1 }, sink: { c: 8, side: "N", m: 5, l: 1, n: 9, goal: { type: "wheel" } } }],
  }, { 1: S51, 2: S51, 4: S51, 5: "D5.1:5>5e@3" });
  add("jam", "Jam", "A ring of four squares round a corner, one a duo: five wheels in a ring, an odd loop. It is locked (M.jam, M.loops).", b);
}
{
  const b = build({
    id: "fx-clash", name: "Clash", cols: 4, rows: 1, map: ["...."],
    trains: [{ id: "A", barrel: { c: 0, side: "E", m: 5, l: 1 }, sink: { c: 3, side: "W", m: 4, l: 1, n: 11, goal: { type: "wheel" } } }],
  }, { 1: S51, 2: "S4.1@0" });
  add("clash", "Clash", "A standard (m5) single beside a fine (m4) single on one layer: the teeth cannot mesh (M.clash).", b);
}
add("hands", "Hands", "A station then a sink, both with hands: the engine's speeds are the dial's (the exact 12:1 is a level's business).",
  row("fx-hands", [S51, "K[5.1>5.2]:8/4>6@0", { pin: "S5.2@0", goal: { type: "hands" } }, "K[5.2>5.1]:8/4>6@0", S51], { goal: { type: "hands", hour: true } }));
add("date", "Date", "A sink with a ring: a 4-tooth pinion inside a ring wheel on the layer above; the ring turns the same way as the pinion.",
  row("fx-date", [S51, D66], { ring: true, pinion: 5, goal: { type: "date", ring: true } }));
add("moon", "Moon", "A fine (m4) sink on layer 2 reached through an adapter stack K[5.1>4.2]:8/6>7.",
  row("fx-moon", [S51, "K[5.1>4.2]:8/6>7@0", "S4.2@0"], { sinkM: 4, sinkL: 2, n: 11, goal: { type: "moon" } }));
export const NAMES = Object.keys(FIXTURES);
void parseKind;
