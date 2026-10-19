// Heliograph's rules (heliograph-engine.js): the deal from a seed, the light (down from the port, off mirrors by the law
// of reflection, coloured by each colour crystal it passes, through the cluster's crystals of its colours, stopped by
// another, white light doing nothing), what a shot shatters and what falls from the strings, the points, the colour
// crystals spent and replaced, where a mirror may stand, the cluster coming down (a new layer, mirrors under it back in
// hand, the end), a game saved and opened again, and whole games by simple players.
import { R, H, PR, MR, PORT, LY, LOSE_Y, CELLS, CRYSTALS, START_LAYERS, CLEAR_BONUS, MOVES, SHAPES, canMove, dropEvery, newGame, copy, trace, fire, pieces, lowest, layerY,
  addMirror, moveMirror, turnMirror, takeMirror, pointMirror, cantPlace, clampInside, reflect, anglesOf, fromAngles, crystalsAt, plan } from "../heliograph-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-6) => a.every((v, k) => Math.abs(v - b[k]) < e);
/** A game set by hand: every crystal of the cluster colour `fill`, `paint` (k, i) → a colour to change some; the colour
 *  crystals where given, nothing coming down for a while. */
function setUp({ fill = 3, paint = () => null, crystals = [[0, 3, 3.4, 1], [-3, 2, -1, 2]], layers = START_LAYERS } = {}) {
  const s = newGame(1);
  s.layers = Array.from({ length: layers }, (_, k) => ({ s: 100 + k, c: CELLS.map((_, i) => paint(k, i) ?? fill) }));
  s.crystals = crystals.map(([x, y, z, c]) => ({ x, y, z, c }));
  s.depth = CELLS.map(() => layers);
  s.mirrors = [];
  s.untilDrop = 99;
  s.moves = 99;                       // set by hand: as many moves as a test needs
  return s;
}
const row = CELLS.map((c, i) => [c, i]).filter(([c]) => c.r === 0).sort(([a], [b]) => a.q - b.q).map(([, i]) => i);   // the places along x, z = 0

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.layers) !== JSON.stringify(c.layers), "the same seed deals the same game, another seed another");
  const strings = CELLS.map((_, i) => a.layers.filter(l => l.c[i] >= 0).length);
  check(SHAPES[a.shape] && strings.join() === a.depth.join() && a.layers.every(l => l.c.length === 19 && l.c.every(x => x >= -1 && x < 4)) && Math.max(...a.depth) <= 9,
    `a chandelier in a shape (${a.shape}): under each place of the crown a string as deep as the shape has it`);
  const shapes = new Set(Array.from({ length: 40 }, (_, k) => newGame(k).shape));
  check(shapes.size >= 5 && [...shapes].every(n => CELLS.some(c => SHAPES[n](c) !== SHAPES[n](CELLS[0])) || n === "column"), `games hang chandeliers of different shapes (${[...shapes].join(", ")})`);
  check(a.moves === MOVES && MOVES === 2, "two moves a shot");
  const cols = new Set(pieces(a).map(p => p.c));
  check(a.crystals.length === CRYSTALS && a.crystals.every(x => cols.has(x.c)) && a.crystals[0].c !== a.crystals[1].c, "two colour crystals, of two colours the cluster has");
  check(crystalsAt(a).every(p => Math.hypot(p[0], p[2]) < R - 0.8 && p[1] >= 0.9 && p[1] < lowest(a) - 1) && a.untilDrop === dropEvery(0) && cols.has(a.next), "low in the tube, clear of the wall and the cluster; the next colour one the cluster has");
}

// ---------- the light ----------
{
  const s = setUp(), t = trace(s);
  check(t.legs.length === 1 && near(t.legs[0].a, PORT) && t.stop.what === "floor" && near(t.legs[0].b, [PORT[0], 0, PORT[2]], 1e-9) || t.legs.length === 2,
    "with no mirror the light falls from the port to the floor (through a crystal under it, if one is)");
  check(near(reflect([0, -1, 0], [0, 1, 0]), [0, 1, 0]) && near(reflect([0, -1, 0], [Math.SQRT1_2, Math.SQRT1_2, 0]), [1, 0, 0], 1e-9), "reflection: straight back off a level mirror, level off one at 45°");
  const [y, p] = anglesOf([0, 1, 0]);
  check(Math.abs(p - Math.PI / 2) < 1e-9 && near(fromAngles(...anglesOf([0.6, 0.8, 0])), [0.6, 0.8, 0], 1e-9) && near(fromAngles(0, 0), [0, 0, 1]) && Number.isFinite(y), "a facing to two angles and back");
  // a mirror under the port, at 45°, sends the light level across the tube to the wall
  const flat = addMirror(setUp({ crystals: [[0, 9, -3, 1], [3, 9, 0, 2]] }), [PORT[0], 1.5, PORT[2]], [0, Math.SQRT1_2, -Math.SQRT1_2]), f = trace(flat);
  check(f.legs.length === 2 && f.lit.join() === "0" && f.stop.what === "wall" && Math.abs(f.legs[1].b[1] - 1.5) < 1e-9 && Math.abs(Math.hypot(f.legs[1].b[0], f.legs[1].b[2]) - R) < 1e-9,
    "off a mirror at 45° under the port, level across the tube to the glass");
  const off = turnMirror(flat, 0, [0, 1, 0.2]);
  check(trace(off).legs.length === 2 && trace(off).legs[1].b[1] > 1.5, "turned, the mirror sends it another way");
  const moved = moveMirror(flat, 0, [0, 1.5, 1]);
  check(trace(moved).lit.length === 0 && trace(moved).stop.what === "floor", "moved out of the light, the mirror is passed by");
}

// a mirror under the port pointed at another level with the second layer, which sends the light across it along z = 0
const LAYER = 2, Y = layerY(LAYER);
function across(s, colourCrystal = [0, 3, 3.4, 1], second = [-3, 2, -1, 2], to = [4.2, Y, 0]) {
  let t = setUp(s);
  t.crystals = [colourCrystal, second].map(([x, y, z, c]) => ({ x, y, z, c }));
  t = addMirror(addMirror(t, [0, 1.2, 3.4]), [-4.2, Y, 0]);
  t = pointMirror(t, 0, [-4.2, Y, 0]);
  return pointMirror(t, 1, to);
}
{
  const red = (k, i) => (k === LAYER && row.includes(i) ? 1 : null);
  const s = across({ paint: red }), t = trace(s);
  check(t.lit.join() === "0,1" && t.crossed.join() === "0" && t.legs[0].cs.length === 0 && t.legs.at(-1).cs.join() === "1",
    "the light passes the colour crystal under the port, takes its colour, and two mirrors carry it");
  check(t.shattered.length === 5 && t.shattered.every(id => row.includes(id % 19)) && t.stop.what === "wall", "across the layer through all five crystals of its colour in a line, out to the glass");
  const f = fire(s);
  check(f.fallen.length === 5 * (START_LAYERS - LAYER - 1) && f.gain === 10 * (5 + f.fallen.length) ** 2, `everything below them on their strings falls (${f.fallen.length}); the shot is ten times the square of all it brought down (+${f.gain})`);
  check(pieces(f.state).length === 19 * START_LAYERS - 5 - f.fallen.length && f.state.shots === 1 && f.state.score === f.gain, "they're gone from the cluster; a shot counted, the points added");
  check(!near(crystalsAt(f.state)[0], [0, 3, 3.4]) && near(crystalsAt(f.state)[1], [-3, 2, -1]), "the colour crystal passed is spent and another stands somewhere; the other stays");

  const stopped = across({ paint: (k, i) => (k === LAYER && row.includes(i) ? (i === row[2] ? 0 : 1) : null) }), u = trace(stopped);
  check(u.shattered.length === 2 && u.stop.what === "piece" && u.stop.id % 19 === row[2], "a crystal of another colour stops it");
  const white = across({ paint: red }, [3, 3, -2, 1]);
  check(trace(white).shattered.length === 0 && trace(white).crossed.length === 0 && trace(white).stop.what === "piece", "light that missed the colour crystals is white: the first crystal it meets stops it, nothing shatters");
  // both colour crystals in its way: it carries both colours and shatters either
  const two = across({ paint: (k, i) => (k === LAYER && row.includes(i) ? (i === row[2] ? 2 : 1) : null) }, [0, 3, 3.4, 1], [0, 6, 3.4, 2]), w = trace(two);
  check(w.crossed.join() === "1,0" && w.legs[1].cs.join() === "2" && w.legs.at(-1).cs.join() === "2,1" && w.shattered.length === 5, "through both colour crystals the light carries both colours and shatters crystals of either");
  check(fire(two).state.crystals.every((c, k) => !near([c.x, c.y, c.z], [[0, 3, 3.4], [0, 6, 3.4]][k])), "both crystals passed are spent");
}

// ---------- where a mirror may stand ----------
{
  const s = setUp();
  check(cantPlace(s, [0, 2, 0]) === null && /tube/.test(cantPlace(s, [R, 2, 0])) && /tube/.test(cantPlace(s, [0, 0.2, 0])) && /tube/.test(cantPlace(s, [4, H - 0.5, 0])),
    "a mirror stands inside the tube, off the floor and under the frame");
  check(/cluster/.test(cantPlace(s, [0, layerY(3), 0])) && /colour/.test(cantPlace(s, [0, 3.3, 3.4])) && /other mirrors/.test(cantPlace(addMirror(s, [1, 2, 0]), [1.5, 2, 0])),
    "clear of the cluster, the colour crystals and the other mirrors");
  check(cantPlace(addMirror(s, [1, 2, 0]), [1.5, 2, 0], 0) === null, "a mirror being moved isn't in its own way");
  const c = clampInside([9, -3, 0]);
  check(Math.abs(Math.hypot(c[0], c[2]) - (R - MR - 0.12)) < 1e-9 && c[1] > MR && cantPlace(s, c) === null, "a point outside the tube is brought in to where a mirror may stand");
  const t = takeMirror(addMirror(addMirror(s, [1, 2, 0]), [-1, 2, 0]), 0);
  check(t.mirrors.length === 1 && t.mirrors[0].id === 1, "a mirror taken back");
}

// ---------- the cluster coming down ----------
{
  const s = setUp();
  s.untilDrop = 1;
  const low = lowest(s), f = fire(s);
  check(f.dropped && f.state.layers.length === START_LAYERS + 1 && Math.abs(lowest(f.state) - (low - LY)) < 1e-9 && f.state.untilDrop === dropEvery(1), "every few shots a new layer under the crown, and the cluster a layer lower");
  const under = addMirror(setUp(), [0, lowest(s) - LY - 0.3, 0]);
  under.untilDrop = 1;
  const g = fire(under);
  check(g.crushed.join() === "0" && g.state.mirrors.length === 0, "a mirror the cluster comes down on goes back to hand");
  const deep = setUp({ layers: 1 + Math.floor((layerY(0) - LOSE_Y - PR) / LY) });
  deep.untilDrop = 1;
  check(!deep.over && fire(deep).state.over && fire(fire(deep).state).state.shots === fire(deep).state.shots, "a crystal reaching the line ends the game, and nothing more is fired");
  check([0, 29, 30, 70, 120, 180, 400].map(dropEvery).join() === "6,6,5,4,3,2,2", "the cluster comes down every six shots at first, then five, four, three and two");
  const one = setUp({ layers: 1, paint: (k, i) => (row.includes(i) ? 1 : 2) });
  one.layers[0].c = one.layers[0].c.map((c, i) => (row.includes(i) ? 1 : -1));
  one.crystals = [{ x: 0, y: 3, z: 3.4, c: 1 }, { x: -3, y: 2, z: -1, c: 2 }];
  let t = addMirror(addMirror(one, [0, 1.2, 3.4]), [-4.2, layerY(0), 0]);
  t = pointMirror(pointMirror(t, 0, [-4.2, layerY(0), 0]), 1, [4.2, layerY(0), 0]);
  const cl = fire(t);
  check(cl.cleared && cl.gain === 10 * 25 + CLEAR_BONUS && cl.state.layers.length === Math.max(...cl.state.depth) && pieces(cl.state).length === cl.state.depth.reduce((x, y) => x + y, 0),
    `a cluster cleared is 1,000 more, and a new one hangs from the crown (a ${cl.state.shape})`);
  const drop = setUp({ layers: 3 });
  drop.depth = CELLS.map((_, i) => (i % 2 ? 3 : 0));
  drop.untilDrop = 1;
  check(fire(drop).state.layers[0].c.every((c, i) => (i % 2 ? c >= 0 : c < 0)), "coming down, a crystal more at the top of every string of the shape, none where it has none");
}

// ---------- two moves a shot ----------
{
  let s = newGame(5);
  s = addMirror(s, [1, 2, 0]);
  s = addMirror(s, [-1, 2, 0]);
  check(s.moves === 0 && !canMove(s) && addMirror(s, [0, 4, 0]) === s, "two mirrors set: no moves left, and a third can't be set");
  const a = moveMirror(s, 0, [1, 3, 0]);
  check(a.mirrors[0].p[1] === 3 && a.moves === 0, "a mirror set this shot moves again free");
  const turned = turnMirror(s, 1, [1, 1, 0]);
  check(Math.abs(turned.mirrors[1].n[0] - Math.SQRT1_2) < 1e-9, "turning a mirror is always free");
  const back = takeMirror(s, 1);
  check(back.moves === 1 && back.mirrors.length === 1, "taking back a mirror set this shot gives its move back");
  let n = fire(s).state;
  check(n.moves === MOVES && n.touched.length === 0 && n.mirrors.length === 2, "after a shot two moves again; the mirrors stay where they are");
  n = moveMirror(n, 0, [1, 4, 0]);
  n = takeMirror(n, 1);
  check(n.moves === 0 && moveMirror(n, 0, [1, 5, 0]).mirrors[0].p[1] === 5 && n.mirrors.length === 1, "moving one and taking another back spends both; the one moved still moves");
  n = fire(addMirror(n, [2, 2, 2])).state;
  check(n.mirrors.length === 1, "and no mirror can be set until the next shot");
}

// ---------- kept and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 9; k++) s = fire(plan(s, "glance", () => 0.3)).state;
  const again = JSON.parse(JSON.stringify(s));
  const a = fire(plan(s, "best")), b = fire(plan(again, "best"));
  check(JSON.stringify(a.state) === JSON.stringify(b.state), "a game saved and opened again goes on as it would have (the colour crystals, the new layers)");
  const before = copy(s);
  fire(s);
  check(JSON.stringify(s) === JSON.stringify(before), "firing leaves the game passed in as it was");
}

// ---------- whole games ----------
{
  const rnd = (() => { let a = 99; return () => { a = (a * 1103515245 + 12345) >>> 0; return a / 4294967296; }; })();
  const play = (how, seed) => { let s = newGame(seed), n = 0; while (!s.over && n < 800) { s = fire(plan(s, how, rnd)).state; n++; } return s; };
  const none = [1, 2, 3].map(k => play("none", k)), glance = [1, 2, 3, 4, 5, 6].map(k => play("glance", k)), best = [1, 2, 3].map(k => play("best", k));
  const avg = (g, f) => g.reduce((a, s) => a + f(s), 0) / g.length;
  check(none.every(s => s.over && s.shots < 50 && s.score === 0), `doing nothing, the cluster reaches the line in ${none[0].shots} shots`);
  check(avg(glance, s => s.shots) > 1.3 * none[0].shots && glance.every(s => s.over), `someone glancing over a few crystals lasts longer (${avg(glance, s => s.shots).toFixed(0)} shots) and every game ends`);
  check(avg(best, s => s.shots) > avg(glance, s => s.shots) && avg(best, s => s.score) > avg(glance, s => s.score) && best.every(s => s.over),
    `the best shot each turn lasts longer still (${avg(best, s => s.shots).toFixed(0)} shots, ${avg(best, s => s.score).toFixed(0)} points), and ends`);
}

console.log(bad ? `\n${bad} failed` : "\nheliograph: the deal, the light and its colours, a shot and its falls, mirrors, the cluster coming down, saving, whole games");
process.exit(bad ? 1 : 0);
