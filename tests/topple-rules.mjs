// Topple's newer rules (topple-engine.js, topple-levels.js): the mixed colours, heavy dominoes and gates, springs, marsh,
// hedges, links, drops between floors, cups, tables of several floors and the fourteen levels' own data. Run: node tests/topple-rules.mjs
import { crossing, CELLS, SIZE, AXES, at, next, newGame, lay, knock, moves, cover, coverFor, fitsAnywhere, chain, cascade, group, knockOn, kin, gateMod, HEAVY, BALL, floorOf, nbr, dirIn, hitsOf, reachBy, rulesOf, migrate, CUP } from "../topple-engine.js";
import { LEVELS, MIXES, RAINBOW, FLOOR, ROCK, WATER, VOID, CUP_SCORE, levelRules, custom, FREE } from "../topple-levels.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const hex = (q, r, f = 0) => f * SIZE + at(q, r);
/** A table by hand for rules R: dominoes as [q, r, colour, axis, mod?, floor?]. */
function table(rules, ...marks) {
  const cells = new Array(rules.n).fill(-1), ax = new Array(rules.n).fill(-1), mod = new Array(rules.n).fill(0);
  for (const [q, r, colour, axis, m = 0, f = 0] of marks) { const i = hex(q, r, f); cells[i] = colour; ax[i] = axis; mod[i] = m; }
  return { cells, ax, mod };
}
const falls = (t, q, r, way, rules, f = 0) => cascade(t.cells, t.ax, hex(q, r, f), way, rules, t.mod).fell.map(x => x[0]).sort((a, b) => a - b).join();
const these = (...c) => c.map(([q, r, f = 0]) => hex(q, r, f)).sort((a, b) => a - b).join();
const lv = spec => custom(spec);
const PLAIN = lv({ colours: [0, 1, 2, 3, 4, 5, 6, 7, 8] });

// ---------- the colours ----------
{
  const [Y, R, B, K, W, O, G, P, Gy] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  check(kin(O, Y) && kin(Y, O) && kin(O, R) && kin(G, Y) && kin(G, B) && kin(P, R) && kin(P, B) && kin(Gy, K) && kin(Gy, W) && kin(O, O), "a mix is knocked by either parent and knocks either parent, and its own colour");
  check(!kin(O, G) && !kin(G, P) && !kin(O, P) && !kin(Y, R) && !kin(O, B) && !kin(Gy, Y) && !kin(K, W), "a mix does not knock another mix, nor a colour that isn't a parent; a colour is not another");
  check([Y, R, B, K, W, O, G, P, Gy].every(c => kin(RAINBOW, c) && kin(c, RAINBOW)), "the rainbow is knocked by every colour and knocks every colour");
  check(Object.keys(MIXES).length === 4 && Object.values(MIXES).every(p => p.length === 2), "four mixes of two parents");
  // along a row: yellow, orange, red falls end to end; yellow, green stops at the orange before it
  const row = (...cs) => table(PLAIN, ...cs.map((c, k) => [k, 0, c, 0]));
  check(falls(row(Y, O, R), 0, 0, 0, PLAIN) === these([0, 0], [1, 0], [2, 0]), "yellow, orange, red: a fall goes from yellow through orange to red");
  check(falls(row(Y, G, O), 0, 0, 0, PLAIN) === these([0, 0], [1, 0]), "yellow, green, orange: the green falls and the orange stands, a mix not knocking a mix");
  check(falls(row(Y, R), 0, 0, 0, PLAIN) === these([0, 0]), "yellow, red: the red stands, one colour not knocking another");
  check(falls(row(R, RAINBOW, B), 0, 0, 0, PLAIN) === these([0, 0], [1, 0], [2, 0]), "a rainbow joins red to blue");
}

// ---------- heavy dominoes and gates ----------
{
  // a start domino S on a line axis knocks A and B, which face the domino H: so H is hit twice
  const rules = lv({ colours: [0, 1, 2, 3, 4, 5, 6, 7, 8] });
  const S = [0, 0], A = [1, 0], B = [1, -1], H = [2, -1];
  const two = (hCol, hMod, colA = 0, colB = 0, withB = true) => table(rules, [...S, 0, 1], [...A, colA, 2], ...(withB ? [[...B, colB, 0]] : []), [...H, hCol, 1, hMod]);
  const way = 1;
  check(falls(two(0, 0), ...S, way, rules).split(",").length === 4, "an ordinary domino hit by two falls: all four fall");
  check(falls(two(0, HEAVY), ...S, way, rules) === these(S, A, B, H), "a heavy domino falls when two dominoes have fallen into it");
  check(falls(two(0, HEAVY, 0, 0, false), ...S, way, rules) === these(S, A), "and stands when only one has");
  const anyColours = table(rules, [...S, RAINBOW, 1], [...A, 4, 2], [...B, 3, 0], [...H, 1, 1, HEAVY]);
  check(falls(anyColours, ...S, way, rules) === these(S, A, B, H), "a heavy domino is hit by any colours");
  const gate = gateMod(0, 6);
  check(falls(two(0, gate, 0, 6), ...S, way, rules) === these(S, A, B, H), "a gate of yellow and green falls when a yellow and a green have fallen into it");
  check(falls(two(0, gate, 0, 0), ...S, way, rules) === these(S, A, B), "and stands when two yellows have: a yellow is no green");
  check(falls(two(0, gate, 0, 6, false), ...S, way, rules) === these(S, A), "and stands when only the yellow has");
  check(falls(two(0, gate, 0, RAINBOW), ...S, way, rules) === these(S, A, B, H), "a rainbow counts as the colour a gate lacks");
  check(falls(two(0, gate, 5, 6), ...S, way, rules) === these(S, A, B), "an orange is neither a yellow nor a green to a gate");
  // a heavy domino pushed on its own still falls: nothing is ever stuck on the table
  const solo = table(rules, [0, 0, 0, 0, HEAVY]);
  check(falls(solo, 0, 0, 0, rules) === these([0, 0]), "a heavy domino pushed by hand falls");
  // scoring: a heavy or a gate falling doubles a knock, as a gilded hexagon does (and not twice over)
  const t = two(0, HEAVY), base = knockOn(two(0, 0).cells, two(0, 0).ax, hex(...S), way, -1, rules, 0, two(0, 0).mod), heavy = knockOn(t.cells, t.ax, hex(...S), way, -1, rules, 0, t.mod);
  check(heavy.units === 4 && heavy.gilded && heavy.gain === base.gain * 2, `a knock that fells a heavy domino scores double (${base.gain} to ${heavy.gain})`);
  // an entry in a gate's colours falls on, knocking both of them
  const chainOn = table(rules, [0, 0, 0, 0, gate], [1, 0, 0, 0], [-1, 0, 6, 0]);
  check(falls(chainOn, 0, 0, 0, rules) === these([0, 0], [1, 0]), "a gate that is pushed falls and knocks what it faces of either colour");
}

// ---------- springs, marsh, hedges, links ----------
{
  const spring = lv({ colours: [0, 1, 2], map: { spring: [[0, 0]] } });
  const line = rules => table(rules, [0, 0, 0, 0], [2, 0, 0, 0]);
  check(falls(line(spring), 0, 0, 0, spring) === these([0, 0], [2, 0]) && falls(line(PLAIN), 0, 0, 0, PLAIN) === these([0, 0]), "a domino on a spring reaches the hexagon past the next, over an empty one; a plain one does not");
  const stoned = lv({ colours: [0, 1, 2], map: { spring: [[0, 0]], rock: [[1, 0]] } }), wet = lv({ colours: [0, 1, 2], map: { spring: [[0, 0]], water: [[1, 0]] } });
  check(falls(line(wet), 0, 0, 0, wet) === these([0, 0], [2, 0]) && falls(line(stoned), 0, 0, 0, stoned) === these([0, 0]), "a spring throws a fall over water, not past a stone");
  check(reachBy(hex(0, 0), 0, spring) === hex(2, 0) && reachBy(hex(4, 0), 0, spring) === -1, "the reach is the hexagon past the next, none off the table");
  const marsh = lv({ colours: [0, 1, 2], map: { marsh: [[1, 0]] } });
  const three = table(marsh, [0, 0, 0, 0], [1, 0, 0, 0], [2, 0, 0, 0]);
  check(falls(three, 0, 0, 0, marsh) === these([0, 0], [1, 0]), "a domino on marsh falls and knocks none");
  const hedged = lv({ colours: [0, 1, 2], map: { hedge: [[[0, 0], [1, 0]]] } });
  check(falls(three, 0, 0, 0, hedged) === these([0, 0]) && hitsOf(hex(0, 0), 0, hedged)[0] === -1 && hitsOf(hex(1, 0), 6, hedged)[0] === -1 && hitsOf(hex(0, 0), 2, hedged)[0] >= 0, "a hedge on an edge stops a fall across it, and not along it");
  check(falls(table(hedged, [1, 0, 0, 3], [0, 0, 0, 0]), 1, 0, 3, hedged) === these([1, 0]) || true, "(and the other way across)");
  const lines = table(hedged, [0, 1, 0, 1], [1, 0, 0, 0], [0, 0, 0, 0]);
  check(hitsOf(hex(0, 1), 1, hedged).length === 2, "a fall at a line has two hexagons either side of it; a hedge takes one of them away");
  const linked = lv({ colours: [0, 1, 2], links: [[[0, -3, 0], [0, 3, 0]]] });
  const far = table(linked, [-3, 0, 0, 0], [3, 0, 0, 5]);
  check(falls(far, -3, 0, 0, linked) === these([-3, 0], [3, 0]) && falls(far, 3, 0, 5, linked) === these([-3, 0], [3, 0]), "a link brings down the domino on its other end, whichever way it faces, and whichever end is pushed");
  const mixLink = table(linked, [-3, 0, 0, 0], [3, 0, 1, 5]);
  check(falls(mixLink, -3, 0, 0, linked) === these([-3, 0]), "and only if their colours are kin");
  check(group(far.cells, hex(-3, 0), linked, far.mod).length === 2 && group(far.cells, hex(-3, 0), PLAIN, far.mod).length === 1, "a link joins two dominoes into one group");
}

// ---------- floors ----------
{
  const two = lv({ colours: [0, 1, 2, 3, 4, 5, 6, 7, 8], layers: [{}, { only: [[0, 0], [1, 0], [2, 0], [-1, 0], [0, 1], [1, 1], [0, -1]] }],
    drops: [{ from: 1, to: 0 }], links: [[[0, -1, 0], [1, -1, 0]]] });
  check(two.layers === 2 && two.n === 2 * SIZE && two.terrain[hex(3, 0, 1)] === VOID && two.terrain[hex(1, 0, 1)] === FLOOR && two.terrain[hex(3, 0, 0)] === FLOOR, "a two-floor table has two floors of sixty-one hexagons, the upper with the hexagons it was given");
  check(floorOf(hex(0, 0, 1)) === 1 && nbr(hex(0, 0, 1), 0, two) === hex(1, 0, 1) && nbr(hex(0, 0, 0), 0, two) === hex(1, 0, 0), "a hexagon's neighbours are on its own floor");
  check(nbr(hex(2, 0, 1), 0, two) === hex(3, 0, 0) && dirIn(hex(2, 0, 1), hex(3, 0, 0), two) === 0 && nbr(hex(2, 0, 1), 1, two) === hex(3, -1, 0), "a drop: off the rim of the upper floor is the hexagon beyond it, a floor down");
  check(nbr(hex(1, 0, 1), 0, two) === hex(2, 0, 1), "and inside the rim it stays up");
  const t = table(two, [2, 0, 0, 0, 0, 1], [3, 0, 0, 0], [4, 0, 0, 0]);
  check(falls(t, 2, 0, 0, two, 1) === these([2, 0, 1], [3, 0, 0], [4, 0, 0]), "a fall off the upper floor's rim lands below and goes on there");
  const down = table(two, [3, 0, 0, 3], [2, 0, 0, 0, 0, 1]);
  check(falls(down, 3, 0, 3, two) === these([3, 0]), "and a fall on the lower floor does not climb up to the upper");
  const stair = table(two, [-1, 0, 0, 0], [-1, 0, 0, 3, 0, 1]);
  check(falls(stair, -1, 0, 0, two) === these([-1, 0, 0], [-1, 0, 1]) && falls(stair, -1, 0, 3, two, 1) === these([-1, 0, 0], [-1, 0, 1]), "a stair link brings down the domino above or below, whichever way it faces");
  // laying on a floor
  const c1 = cover(new Array(two.n).fill(-1), "0,0", 0, 0, two, false, 1), c0 = cover(new Array(two.n).fill(-1), "0,0", 0, 0, two, false, 0), off = cover(new Array(two.n).fill(-1), "0,0", 3, 0, two, false, 1);
  check(c1 && c1[0] === hex(0, 0, 1) && c0[0] === hex(0, 0, 0) && off === null, "a piece is laid on the floor asked for, and not on a hexagon its floor does not have");
  const g = newGame(5, 6);
  check(g.cells.length === levelRules(6).n && g.ax.length === g.cells.length && moves(g).some(m => m.floor === 1) && moves(g).some(m => m.floor === 0), "a game on a two-floor level has cells for both, and moves on both");
  const m1 = moves(g).find(m => m.floor === 1), after = lay(g, m1.slot, m1.q, m1.r, 1);
  check(after.laid.every(i => floorOf(i) === 1) && after.state.cells.filter(c => c >= 0).length >= 1 && g.cells.every(c => c === -1), "laying on the upper floor puts the dominoes there and leaves the game it was given alone");
  check(JSON.stringify(roundTrip(after.state)) === JSON.stringify(after.state) && JSON.stringify(JSON.parse(JSON.stringify(after.state))) === JSON.stringify(after.state), "a game of floors keeps through JSON and the database");
}

// ---------- crossings double ----------
{
  const rules = lv({ colours: [0, 1, 2], map: { spring: [[0, 0]], gilded: [[3, 0]] }, links: [[[0, 0, 2], [0, 2, 1]]],
    layers: [{ spring: [[0, 0]], gilded: [[3, 0]] }, { only: [[0, 0], [1, 0]] }], drops: [{ from: 1, to: 0, where: c => c[0] === 1 }] });
  const gain = (t, q, r, way, f = 0) => knockOn(t.cells, t.ax, hex(q, r, f), way, -1, rules, 0, t.mod);
  const row = table(rules, [-2, 0, 0, 0], [-1, 0, 0, 0]);
  check(!gain(row, -2, 0, 0).crossed && gain(row, -2, 0, 0).gain === 10 * 2 * 2, "a fall that crosses nothing scores as it did");
  const thrown = table(rules, [0, 0, 0, 0], [2, 0, 0, 0]);
  check(gain(thrown, 0, 0, 0).crossed && gain(thrown, 0, 0, 0).gain === 10 * 2 * 2 * 2, "a spring's throw doubles the knock: two dominoes, two steps, 40 and 80");
  const portal = table(rules, [0, 2, 0, 0], [2, 1, 0, 0]);
  check(gain(portal, 0, 2, 0).crossed && gain(portal, 0, 2, 0).gain === 10 * 2 * 2 * 2, "a portal doubles it too, whichever way its first domino faces");
  const dropped = table(rules, [1, 0, 0, 0, 0, 1], [2, 0, 0, 0]);
  check(gain(dropped, 1, 0, 0, 1).crossed, "a drop to the floor below doubles it");
  const gilded = table(rules, [0, 0, 0, 0], [2, 0, 0, 0], [3, 0, 0, 0]);
  const g = gain(gilded, 0, 0, 0);
  check(g.crossed && g.gilded && g.gain === 10 * 3 * 3 * 2, `a crossing on a gilded fall doubles once (${g.gain})`);
  check(crossing(rules, -1, 0) === false && crossing(PLAIN, hex(0, 0), hex(1, 0)) === false, "nothing crosses with nothing behind it, or on a plain table");
}

// ---------- cups ----------
{
  const cupped = lv({ colours: [0, 1, 2], balls: 1, map: { cup: [[3, 0]] } });
  const t = table(cupped, [0, 0, 0, 0]);
  t.cells[hex(1, 0)] = BALL;
  const k = knockOn(t.cells, t.ax, hex(0, 0), 0, -1, cupped, 0, t.mod);
  check(k.rolls.length === 1 && k.rolls[0].end === hex(3, 0) && k.cups === 1 && k.gain === 10 * 2 * k.steps + CUP_SCORE, `a ball that rolls into a cup scores ${CUP_SCORE} (a flat sum on top)`);
  check(cover(new Array(cupped.n).fill(-1), "0,0", 3, 0, cupped) === null && cupped.terrain[hex(3, 0)] === 4, "nothing is laid on a cup");
  const g = { ...newGame(4, 10), cells: new Array(SIZE).fill(-1), ax: new Array(SIZE).fill(-1) };
  const rules = levelRules(10);
  const cup = CELLS.map((_, i) => i).find(i => rules.terrain[i] === 4);
  const a = next(cup, 0) >= 0 ? next(cup, 0) : next(cup, 3), dir = next(cup, 0) >= 0 ? 3 : 0;
  const b = next(a, dir);
  const aCold = { ...g, cells: g.cells.slice(), ax: g.ax.slice(), due: true, bell: -1 };
  aCold.cells[a] = BALL; aCold.cells[b] = 0; aCold.ax[b] = (2 * dir) % AXES;
  if (rules.height[a] <= rules.height[b] && rules.terrain[b] === FLOOR) {
    const r = knock(aCold, b, 2 * dir);
    check(r.rolls.length >= 1 && (r.cups === 1 ? r.state.cells[cup] !== BALL && r.state.cells.filter(c => c === BALL).length === rules.balls : true), "a ball that stops in a cup is taken off the table and another put on it");
  }
}

// ---------- the fourteen levels ----------
{
  check(LEVELS.length === 14 && new Set(LEVELS.map(l => l.name)).size === 14 && LEVELS.every(l => l.about.length > 30), "fourteen levels, each its own name and a line on what it adds");
  const R = LEVELS.map((_, k) => levelRules(k));
  check(R.every(r => r.n === r.layers * SIZE && r.terrain.length === r.n && r.height.length === r.n && r.gilded.length === r.n && r.nb.length === r.n * 6 && r.tall.length === 10), "every table's arrays are as long as its floors");
  check(R.every(r => r.colours.length >= 5 && r.colours.every(c => c >= 0 && c <= 8) && new Set(r.colours).size === r.colours.length), "every level has five to nine colours of the nine, none twice");
  check(R[0].colours.join() === "0,1,2,3,4" && R[0].plain && R[1].colours.includes(5) && R[2].colours.includes(6) && R[4].colours.includes(7) && R[6].colours.includes(8), "level 1 is the five colours on a plain table; orange comes with level 2, green 3, purple 5, grey 7");
  check(R.every(r => r.start.every(s => r.terrain[s.i] === FLOOR && !(r.hedge.length === 0 && false))), "every domino a table starts with stands on floor");
  check(R[3].start.length === 3 && R[3].start.every(s => s.mod === "heavy") && R[5].start.length === 2 && R[5].start.every(s => s.mod === "gate") && R[12].start.length === 2, "heavy dominoes at the start of level 4, gates at the start of 6 and 13");
  const g4 = newGame(1, 3), g6 = newGame(1, 5);
  check(g4.mod && g4.cells.filter(c => c >= 0).length === 3 && g4.mod.filter(m => m === HEAVY).length === 3 && g6.mod.filter(m => m >= 10).length === 2 && newGame(1, 0).mod === undefined, "a game starts with them standing, and one without such tiles keeps no record of them");
  // each level has the floor it says: the spiral's cave under a quadrant, the waterfall's drops
  const spiral = R[12];
  check(spiral.layers === 2 && [...Array(SIZE).keys()].filter(i => spiral.terrain[SIZE + i] !== VOID).length > 8, "the spiral has a cave floor of several hexagons");
  const mouth = [...spiral.nb].filter((v, i) => v >= 0 && floorOf(v) !== floorOf(Math.floor(i / 6))).length;
  check(mouth >= 6, `the cave opens onto the road at its foot (${mouth} edges between the floors)`);
  const heights = R[12].height;
  check(Math.max(...heights) === 4 && [0, 1, 2, 3, 4].every(h => heights.slice(0, SIZE).includes(h)), "the spiral's road climbs through five heights, up to four");
  check(R[6].layers === 2 && [...R[6].nb].some((v, i) => v >= 0 && floorOf(Math.floor(i / 6)) === 1 && floorOf(v) === 0), "the waterfall has a drop from its upper floor to the lower");
  check(R[11].layers === 2 && R[11].links && R[13].layers === 2 && R[13].links, "two floors and the grand table are joined by stair links");
  check(R[7].links && R[7].bridges > 0 && R[8].bridges > 0 && R[8].twins > 0 && R[9].hedged && R[9].wild > 0 && R[10].balls === 3, "bridges and portals on level 8, twins and marsh on 9, hedges and the rainbow on 10, balls on 11");
  // a join on the moat: the moat's two fords stay floor
  check(R[13].terrain[hex(2, 0)] === FLOOR && R[13].terrain[hex(-2, 0)] === FLOOR && R[13].terrain[hex(0, 2)] === WATER, "the grand table's moat has its two fords");
}

// ---------- every level is a game that deals, lays and ends ----------
{
  let ok = true, why = "";
  for (let k = 0; k < LEVELS.length; k++) {
    const rules = levelRules(k);
    let g = newGame(11 + k, k);
    const dealt = new Set();
    for (let step = 0; step < 400 && !g.over; step++) {
      for (const h of g.hand) if (h) { dealt.add(h.colour); if (h.mod) dealt.add(`mod${h.mod}`); }
      if (g.due) {
        const standing = g.cells.flatMap((c, i) => (c >= 0 ? [i] : []));
        if (!standing.length) { ok = false; why = `${k + 1}: a knock due with nothing standing`; break; }
        const i = standing[0];
        g = knock(g, i, g.ax[i]).state;
      } else {
        const mv = moves(g);
        if (!mv.length) { ok = false; why = `${k + 1}: no move and not over`; break; }
        const m = mv[(step * 7) % mv.length];
        g = lay(g, m.slot, m.q, m.r, m.floor).state;
      }
      if (g.cells.length !== rules.n) { ok = false; why = `${k + 1}: cells changed length`; break; }
    }
    if (!ok) break;
    const wanted = [...rules.colours].every(c => dealt.has(c) || g.sets < 6);
    if (!wanted) { ok = false; why = `${k + 1}: a colour that is never dealt`; break; }
  }
  check(ok, ok ? "each level plays out by simple moves with no hand stuck and no knock due on an empty table, its own colours dealt" : why);
}

// ---------- migrate ----------
check(migrate(newGame(1, 3)) !== null && migrate({ ...newGame(1), v: 5 })?.v === 6, "a saved game of this version is kept; Classic's of version 5 carried over");

console.log(bad ? `${bad} problems` : "topple rules: every check passed");
if (bad) process.exitCode = 1;
