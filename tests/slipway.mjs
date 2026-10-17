// Slipway's rules (slipway-engine.js): the deal from a seed (only the kinds of part the ship is built of, now and then a
// second-stage part or a blueprint), merges (three or more alike joined along their sides, on the square laid, not
// across a corner, not across kinds or stages, four at once, a merge setting off the next), components fitted to the
// ship or waiting for one that needs them, launches and the ships in order, the hold, blueprints, the points, the game
// laid from left as it was, the end with the yard full, a game saved and opened again, and whole games.
import { W, H, GROUP, STAGES, KINDS, BLUEPRINT, EMPTY, DEAL, SHIPS, code, kindOf, stageOf, shipAt, powered, partName, points, needs, newGame, group, blueprintAt, place, swap, moves, taken } from "../slipway-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
// a yard drawn by hand, a row of six a line from the slipway forward: "." empty, else a kind's letter and a stage,
// H hull, M masts (funnels), S sails (engines), G guns (deckhouses), P screws
const LETTERS = "HMSGP";
const part = t => code(LETTERS.indexOf(t[0]), Number(t[1]));
const yard = rows => rows.flatMap(r => r.trim().split(/\s+/).map(t => (t === "." ? EMPTY : part(t))));
const show = cells => Array.from({ length: H }, (_, y) => cells.slice(y * W, y * W + W).map(c => (c === EMPTY ? "." : LETTERS[kindOf(c)] + stageOf(c))).join(" "));
const at = (x, y) => y * W + x;
const game = (rows, hand, extra = {}) => Object.assign(newGame(1), { cells: yard(rows), hand }, extra);
const EMPTY_ROW = ". . . . . .";

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  const parts = g => { const out = []; for (let k = 0; k < 12; k++) { g = swap({ ...g, hold: null }); out.push(g.next); } return out.join(); };
  check(JSON.stringify(a) === JSON.stringify(b) && parts(a) === parts(b) && parts(a) !== parts(c), "the same seed deals the same parts, another seed others");
  check(a.cells.length === W * H && a.cells.every(x => x === EMPTY) && a.ship === 0 && a.hold === null && shipAt(0).id === "cog", "an empty yard, a cog laid down, nothing in the hold");
  let s = newGame(3), seen = { stage2: 0, blueprint: 0, kinds: new Set(), n: 0 };
  for (let k = 0; k < 4000; k++) {
    const t = swap({ ...s, hold: null });            // each swap into an empty hold deals a new part
    const p = t.next;
    seen.n++;
    if (p === BLUEPRINT) seen.blueprint++;
    else { seen.kinds.add(kindOf(p)); if (stageOf(p) === 2) seen.stage2++; if (stageOf(p) > 2) seen.stage2 = -1e9; }
    s = t;
  }
  const near = (x, p) => Math.abs(x / seen.n - p) < .02;
  check(near(seen.blueprint, DEAL.blueprint) && near(seen.stage2, DEAL.stage2 * (1 - DEAL.blueprint)), `a blueprint about one part in ${Math.round(1 / DEAL.blueprint)}, a second-stage part about one in ${Math.round(1 / DEAL.stage2)}, never a component`);
  check([...seen.kinds].sort().join() === "0,1,2", "for a cog only hull, mast and sail parts: she has no guns");
  const galleon = Object.assign(newGame(5), { ship: SHIPS.findIndex(x => x.id === "galleon") }), kinds = new Set();
  let g = galleon;
  for (let k = 0; k < 600; k++) { g = swap({ ...g, hold: null }); if (g.next !== BLUEPRINT) kinds.add(kindOf(g.next)); }
  check(kinds.has(3) && !kinds.has(4), "for a galleon guns too, and no part she isn't built of");
}

// ---------- merges ----------
{
  let r = place(game(["H1 H1 . . . .", EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW], part("H1")), at(2, 0));
  check(show(r.state.cells)[0] === ". . H2 . . ." && r.steps.map(x => x.type).join() === "place,merge", "three planks in a row make a strake, on the square the last was laid");
  r = place(game(["H1 . . . . .", "H1 . . . . .", EMPTY_ROW, EMPTY_ROW, EMPTY_ROW], part("H1")), at(1, 1));
  check(show(r.state.cells).slice(0, 2).join("|") === ". . . . . .|. H2 . . . .", "round a corner too: joined along their sides");
  r = place(game(["H1 . . . . .", ". . . . . .", "H1 . . . . .", EMPTY_ROW, EMPTY_ROW], part("H1")), at(1, 1));
  check(r.state.cells.filter(c => c === part("H1")).length === 3 && r.steps.length === 1, "touching only at corners they don't join");
  r = place(game(["H1 H1 . . . .", EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW], part("M1")), at(2, 0));
  const r2 = place(game(["H2 H2 . . . .", EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW], part("H1")), at(2, 0));
  check(r.steps.length === 1 && r2.steps.length === 1, "a spar doesn't join planks, nor a plank strakes");
  r = place(game(["H1 H1 . H1 . .", EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW], part("H1")), at(2, 0));
  check(show(r.state.cells)[0] === ". . H2 . . ." && r.steps[1].from.length === 4 && r.steps[1].gain === points.merge(4, 2, 1), "four joined go at once, and count four");
  // a plank making three planks makes a strake, which makes three strakes and a hull section, fitted to the cog
  r = place(game(["H1 H1 . H2 H2 .", EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW], part("H1")), at(2, 0));
  check(r.steps.map(x => x.type).join() === "place,merge,merge,fit" && r.state.cells.every(c => c === EMPTY) && r.state.fitted[0] === 1, "a merge sets off the next: planks to a strake, strakes to a hull section, and the cog takes it");
  check(r.gain === points.merge(3, 2, 1) + points.merge(3, 3, 2) + points.fit && r.state.score === r.gain, "the points: each merge by its parts, its stage and its place in the chain, and the fitting");
  const before = game(["H1 H1 . . . .", EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW], part("H1")), copy = JSON.stringify(before);
  place(before, at(2, 0));
  check(JSON.stringify(before) === copy && r.state.turns === 1, "the game laid from is left as it was; a turn counted");
  let threw = 0;
  try { place(game(["H1 . . . . .", EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW], part("H1")), at(0, 0)); } catch { threw++; }
  try { place(Object.assign(newGame(1), { over: true }), 0); } catch { threw++; }
  try { place(newGame(1), W * H); } catch { threw++; }
  check(threw === 3, "a part goes only on an empty square of the yard, and not once the game is over");
  check(group(yard(["H1 H1 .  . . .", ". H1 . . . .", EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]), at(0, 0)).length === 3 && GROUP === 3 && STAGES === 3, "a group: everything alike joined to a square");
}

// ---------- components, the ship, launches ----------
{
  // the cog has her hull and mast; a suit of sails finishes her
  const s = game(["S2 S2 . . . .", EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW], part("S2"), { fitted: [1, 1, 0, 0, 0] });
  const r = place(s, at(2, 0));
  check(r.steps.map(x => x.type).join() === "place,merge,fit,launch,lay" && r.state.launched === 1 && r.state.ship === 1 && shipAt(1).id === "hulk" && r.state.fitted.every(n => n === 0), "her last component fitted, the cog is launched and a hulk laid down");
  check(r.gain === points.merge(3, 3, 1) + points.fit + points.launch(0) && points.launch(0) === 250 * 3, "a launch scores by the components she took");
  // a gun waits in the yard: the hulk has none; the galleon takes it as she's laid down
  const g = game(["G2 G2 . . . .", EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW], part("G2"), { ship: 1 });
  const wait = place(g, at(2, 0));
  check(wait.state.cells[at(2, 0)] === part("G3") && !wait.steps.some(x => x.type === "fit"), "a component the ship doesn't need waits in the yard");
  const gi = SHIPS.findIndex(x => x.id === "galleon"), last = Object.assign(structuredClone(wait.state), { ship: gi - 1, fitted: [...shipAt(gi - 1).needs] });
  last.fitted[0]--;                                             // the fluyt wants one more hull section
  last.cells[at(0, 2)] = part("H2"); last.cells[at(1, 2)] = part("H2"); last.hand = part("H2");
  const on = place(last, at(2, 2));
  check(on.state.ship === gi && on.state.fitted[3] === 1 && on.state.cells[at(2, 0)] === EMPTY && on.steps.at(-1).type === "fit", "laid down, a ship takes what's waiting for her");
  check(SHIPS.map(x => x.id).join() === "cog,hulk,caravel,carrack,galleon,fluyt,indiaman,clipper,steamer,liner,vlcc" && shipAt(40).id === "vlcc", "the ships in history's order, a VLCC for ever after");
  check(SHIPS.every(x => x.needs.length === KINDS && x.needs.some(n => n)) && SHIPS.every((x, i) => powered(i) === (i >= 8)) && SHIPS.slice(0, 8).every(x => !x.needs[4]), "under sail four kinds of part at most, under power five");
  check(partName(part("H1"), 0) === "plank" && partName(part("H3"), 9) === "hull block" && partName(part("S3"), 0) === "suit of sails" && partName(part("S3"), 9) === "engine" && partName(BLUEPRINT, 0) === "blueprint", "the parts named for the era: timber and canvas, then steel and steam");
  check(needs(Object.assign(newGame(1), { fitted: [1, 0, 0, 0, 0] })).join() === "0,1,1,0,0", "what she still needs");
}

// ---------- the hold, blueprints ----------
{
  const s = newGame(11), a = swap(s);
  check(a.hold === s.hand && a.hand === s.next && a.turns === 0, "an empty hold takes the part in hand, and the next comes to hand");
  const b = swap(a);
  check(b.hold === a.hand && b.hand === a.hold && b.next === a.next, "a full one swaps with it");
  // beside two strakes and two planks a blueprint is a strake, and makes a hull section
  const bp = game([". H2 . . . .", "H1 . H2 . . .", ". H1 . . . .", EMPTY_ROW, EMPTY_ROW], BLUEPRINT, { ship: 1 });
  check(blueprintAt(bp, at(1, 1)) === part("H2"), "a blueprint becomes the part that merges, the higher stage first");
  const r = place(bp, at(1, 1));
  check(r.steps[0].blueprint && r.steps[1].part === part("H3"), "and merges as that part would");
  const lone = game([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW], BLUEPRINT, { fitted: [1, 0, 1, 0, 0] });
  check(blueprintAt(lone, 0) === part("M1"), "with nothing to merge, a first part of the kind the ship needs most");
}

// ---------- the end ----------
{
  const rows = ["H1 M1 S1 H1 M1 S1", "M1 S1 H1 M1 S1 H1", "S1 H1 M1 S1 H1 M1", "H1 M1 S1 H1 M1 H1", "M1 S1 H1 M1 H1 ."];
  const r = place(game(rows, part("G1")), at(5, 4));
  check(r.over && r.state.over && moves(r.state).length === 0 && taken(r.state) === W * H, "the yard full: the game is over");
  const saved = place(game(rows, part("H1")), at(5, 4));
  check(!saved.over && saved.state.cells[at(5, 4)] === part("H2"), "unless the last square makes a merge");
}

// ---------- saved and opened again ----------
{
  let s = newGame(21);
  for (let k = 0; k < 20; k++) s = place(s, moves(s)[k % moves(s).length]).state;
  const again = JSON.parse(JSON.stringify(s)), m = moves(s)[0];
  check(JSON.stringify(place(s, m)) === JSON.stringify(place(again, m)) && JSON.stringify(swap(s)) === JSON.stringify(swap(again)), "a game saved and opened again goes on as it would have");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  let z = 3;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const random = [], greedy = [], ships = [];
  for (let g = 0; g < 12; g++) {
    let s = newGame(100 + g);
    while (!s.over) { const all = moves(s); s = place(s, all[Math.floor(rnd() * all.length)]).state; }
    random.push(s.turns);
    let t = newGame(100 + g);
    while (!t.over && t.turns < 3000) {
      let best = null, bv = -Infinity;
      for (const i of moves(t)) {
        const o = place(t, i);
        let same = 0;
        for (const n of [i - W, i + W, i % W ? i - 1 : -1, (i + 1) % W ? i + 1 : -1]) if (n >= 0 && n < W * H && t.cells[n] === t.hand) same++;
        const v = o.gain * 10 + same + rnd() * .1;
        if (v > bv) { bv = v; best = o; }
      }
      t = best.state;
    }
    greedy.push(t.turns);
    ships.push(t.launched);
  }
  check(median(random) < 80, `laying anywhere: the yard full in about ${median(random)} turns`);
  check(median(greedy) > 2 * median(random) && Math.max(...greedy) < 3000 && median(ships) >= 2, `laying beside its own kind: about ${median(greedy)} turns and ${median(ships)} ships, and the ships still end it`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("slipway: the deal, merges, components and launches, the hold, blueprints, the end, saving, whole games");
