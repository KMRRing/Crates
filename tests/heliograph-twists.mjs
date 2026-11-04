// Heliograph's twists (heliograph-engine.js): the splitter, the lamps (clear and coloured, together, in order), bolted and
// frail crystals, pinned mirrors and authored chandeliers. Each is a small table set by hand. Run: node tests/heliograph-twists.mjs
import { newGame, copy, trace, fire, canMove, moveMirror, takeMirror, addMirror, turnMirror, handLeft, lampsOf, litCount, hangFrom, pieces, CELLS, layerY } from "../heliograph-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const RT = Math.SQRT1_2;
const rules = x => ({ lv: 0, hang: {}, every: 99, shots: 6, goal: { kind: "lamps", mode: "all", pars: [3, 2] }, moves: 3, ...x });
const SLOPE = [RT, RT, 0];          // a mirror turning light falling straight down into light going level toward +x

// ---------- authored chandeliers ----------
{
  const h = hangFrom({ "0,0": "01b2", "1,0": "3l" });
  check(h.layers.length === 3 && h.depth.reduce((a, b) => a + b) === 4 && h.bolts.length === 1 && h.beacons.length === 1, "an authored chandelier: strings by place, a bolt and a lantern marked");
  const s = newGame(1, rules({ hang: { "0,0": "01b2f", "-1,0": "0" }, gems: [{ x: 3, y: 2, z: 0, c: 1 }] }));
  check(pieces(s).length === 4 && s.crystals.length === 1 && s.x.bolts.length === 1 && s.x.frail.length === 1 && s.mirrors.length === 0, "an authored level: its chandelier, its kept colour crystal, nothing else");
  const f = fire(s);
  check(f.state.crystals.length === 1 && f.state.crystals[0].x === 3 && f.state.shots === 1 && !f.cleared, "its colour crystal is not spent and a shot at an empty tube is only a shot");
  check(JSON.stringify(JSON.parse(JSON.stringify(s))) === JSON.stringify(s), "it survives being saved");
}

// ---------- pinned mirrors ----------
{
  const s = newGame(1, rules({ hand: 2, pins: [{ p: [-3, 9, 0], n: [0, 1, 0] }] }));
  const m = s.mirrors[0];
  check(m.pin && handLeft(s) === 2 && !canMove(s, m.id) && canMove(s), "a pinned mirror is not in hand, and cannot be moved");
  check(moveMirror(s, m.id, [0, 3, 0]) === s && takeMirror(s, m.id) === s, "nor moved nor taken back");
  check(turnMirror(s, m.id, [1, 1, 0]).mirrors[0].n[0] > 0, "but it turns");
  const t = addMirror(addMirror(s, [0, 3, 0]), [2, 3, 0]);
  check(handLeft(t) === 0 && addMirror(t, [-2, 3, 0]) === t, "the hand holds only what the level gives");
}

// ---------- the splitter, the lamps ----------
const split = { k: "split", p: [-3, 9, 0], n: [RT, RT, 0], r: 0.7 };
const two = (c = [-1, -1]) => rules({ port: [-3, 14, 0], fix: [split, { k: "lamp", p: [2, 9, 0], c: c[0] }, { k: "lamp", p: [-3, 4, 0], c: c[1] }], goal: { kind: "lamps", mode: "together", pars: [2, 1] } });
{
  const s = newGame(1, two());
  const t = trace(s);
  check(t.legs.length === 3 && t.lamps.length === 2 && t.lamps.every(l => l.ok) && t.ends.length === 2, "a splitter sends the light two ways: one beam on, one turned, each reaching a lamp");
  const parts = t.legs.map(l => l.t0);
  check(parts[0] === 0 && parts[1] > 0 && parts[2] > 0, "the branches know how far along their way they start");
  const f = fire(s);
  check(f.state.won && f.state.over && f.state.metAt === 1 && f.state.lit.length === 2, "two lamps in one shot meets a goal of lighting them together");
  const only = newGame(1, rules({ port: [-3, 14, 0], fix: [{ k: "lamp", p: [-3, 4, 0], c: -1 }, { k: "lamp", p: [2, 9, 0], c: -1 }, split], goal: { kind: "lamps", mode: "all", pars: [3, 2] } }));
  check(lampsOf(only).length === 2 && fire(only).state.won, "lamps are found by kind, not by their place in the fixtures");
}
{
  // a coloured lamp wants its colour: white light does not light it, light through a prism carrying it does
  const lamp = c => rules({ port: [-3, 14, 0], fix: [{ k: "lamp", p: [-3, 4, 0], c }], goal: { kind: "lamps", mode: "all", pars: [3, 2] } });
  check(!fire(newGame(1, lamp(1))).state.won && fire(newGame(1, lamp(-1))).state.won, "a lamp of a colour is not lit by white light; a clear one is");
  const via = rules({ port: [-3, 14, 0], fix: [{ k: "prism", p: [-3, 9, 0], cs: [1, 2] }, { k: "lamp", p: [-3, 4, 0], c: 2 }], goal: { kind: "lamps", mode: "all", pars: [3, 2] } });
  check(fire(newGame(1, via)).state.won, "light through a prism carrying its colour lights it");
}
{
  // in order: a lamp lit out of turn does nothing
  const x = rules({ port: [-3, 14, 0], fix: [split, { k: "lamp", p: [2, 9, 0], c: -1 }, { k: "lamp", p: [-3, 4, 0], c: -1 }], goal: { kind: "lamps", mode: "order", pars: [3, 2] } });
  // the light reaches lamp 0 (right) and lamp 1 (below) together: both light in the order the lamps are listed
  const a = fire(newGame(1, x)).state;
  check(litCount(a) === 2 && a.won, "a signal: lamps reached together in their order light together");
  const rev = rules({ ...x, fix: [split, { k: "lamp", p: [-3, 4, 0], c: -1 }, { k: "lamp", p: [2, 9, 0], c: -1 }] });
  const b = fire(newGame(1, rev)).state;
  check(litCount(b) >= 1 && !b.over || litCount(b) === 2, "and one out of turn is not lost");
}

// ---------- bolted and frail ----------
{
  const bare = bolt => rules({ hang: { "0,0": bolt ? "01b23" : "0123" }, goal: { kind: "clear", pars: [3, 2] } });
  const cut = s => { const t = copy(s); t.layers[0].c[CELLS.findIndex(c => !c.q && !c.r)] = -1; return fire(t); };
  check(cut(newGame(1, bare(false))).fallen.length === 3, "cut at the top, a whole string falls");
  const b = cut(newGame(1, bare(true)));
  check(b.fallen.length === 0 && pieces(b.state).length === 3 && b.state.x.bolts.length === 1, "a bolted crystal stays, and what hangs from it");
}
{
  // a frail crystal, reached by a level beam through a prism: cracked by the first shot, shattered by the second
  const x = rules({ hang: { "-2,0": "003f".replace("3f", "0f") }, port: [-4.2, 14, 0], pins: [{ p: [-4.2, layerY(2), 0], n: SLOPE }], fix: [{ k: "prism", p: [-3.2, layerY(2), 0], cs: [0, 1] }], goal: { kind: "clear", pars: [3, 2] } });
  const s = newGame(1, x), t = trace(s);
  check(t.cracked.length === 1 && t.shattered.length === 0 && t.stop.what === "crack", "a frail crystal: the first hit cracks it and ends the beam there");
  const one = fire(s);
  check(one.shattered.length === 0 && one.state.hurt.length === 1 && pieces(one.state).length === 3, "a cracked crystal stays, marked");
  const two = fire(one.state);
  check(two.shattered.length === 1 && two.state.hurt.length === 0 && pieces(two.state).length === 2, "the second hit shatters it");
}

console.log(bad ? `\n${bad} FAILED` : "\nall ok");
process.exit(bad ? 1 : 0);
