// Calcudoku (calcudoku-engine.js and its pieces): the rules as units (a cage's ways, repeats where cells share no
// line, − and ÷ on two cells, a hidden operation's ways), the exact solver, grids generated with exactly one solution
// for every rules, size and level, graded by the hardest technique a person needs, every step of the human-style solver
// sound, hints that name a step, the computer player, grids and runs through JSON and the database, the clues split
// for playing together (the parts make the whole, neither alone does, the relay finishes), the table through the
// database's round trip, and today's grid the same on every device.
import fs from "fs";
import { RULES, SIZES, LEVELS, DAILY, levelsOf, levelFor, generate, encode, decode, validGrid, splitFor, viewOf, relay } from "../calcudoku-engine.js";
import { shapeOf, rng, bit, nearOf, connected } from "../calcudoku-grid.js";
import { waysOf, holds, targetOf, labelOf, opsFor, cagesFor, readCage } from "../calcudoku-cage.js";
import { solver, latinSquare } from "../calcudoku-solve.js";
import { TECHNIQUES, viewFor, stateOf, nextStep, apply, grade, say, BEYOND } from "../calcudoku-logic.js";
import { racePlan, placedBy, partnerMove, PACES, thinkMs } from "../calcudoku-bot.js";
import { coopOf, placeCoop, hintCoop, coopValues, shareOf, orphanShares, placedBy as placedBySeat } from "../calcudoku-room.js";
import { freshDuel, sayReady, runOf } from "../duel-core.js";
import { roundTrip } from "./rtdb.js";
import { today } from "../days.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const t0 = Date.now();
const count = (shape, cages, values = new Uint8Array(shape.cells)) => solver(shape, cages).solve(values, { limit: 2, maxNodes: 50000 });
const tuples = (shape, cells, op, target) => { const w = waysOf(shape, cells, op, target), out = []; for (let i = 0; i < w.length; i += cells.length) out.push([...w.subarray(i, i + cells.length)].join("")); return out; };

// ---------- the rules as units ----------
{
  const s6 = shapeOf(6), s9 = shapeOf(9);
  check(s6.units.length === 12 && s6.peers.every(p => p.length === 10) && s9.units.length === 18 && s9.peers.every(p => p.length === 16),
    "a Latin square's lines: rows and columns only, each cell seeing its row and column (10 peers on a 6×6, 16 on a 9×9)");
  check(tuples(s6, [0, 1], "-", 3).sort().join() === "14,25,36,41,52,63", "3− in two cells side by side: 1 and 4, 2 and 5, 3 and 6, either way round");
  check(tuples(s6, [0, 1, 6], "+", 4).join() === "211" && tuples(s6, [0, 1, 2], "+", 4).length === 0 && tuples(s6, [0, 1, 2], "+", 6).length === 6,
    "a digit repeats in a cage only where its cells share no line: an L of three adding up to 4 is 2, 1, 1; a straight three can't, and 6+ is 1, 2, 3 six ways");
  check(targetOf("/", [2, 6]) === 3 && targetOf("/", [2, 3]) === null && targetOf("-", [2, 6]) === 4 && targetOf("x", [3, 4, 5]) === 60 && opsFor(3).join() === "+,x" && opsFor(2).length === 4 && opsFor(1).join() === "=",
    "÷ only where one divides the other, − and ÷ only on two cells, a cage of one is its digit");
  const union = new Set(["+", "-", "x", "/"].flatMap(op => tuples(s6, [0, 1], op, 2)));
  check(tuples(s6, [0, 1], "?", 2).length === union.size && union.size === 12 && holds("?", 2, [1, 3]) && holds("?", 2, [4, 2]) && !holds("?", 2, [3, 4]),
    "a hidden operation is every way any operation makes the target, each once (a 2 on two cells: 12 ways, by −, × or ÷)");
  check(labelOf({ op: "x", target: 12 }) === "12×" && labelOf({ op: "-", target: 3 }) === "3−" && labelOf({ op: "/", target: 2 }) === "2÷" && labelOf({ op: "x", target: 12 }, true) === "12" && labelOf({ op: "=", target: 4 }) === "4",
    "labels as printed: 12×, 3−, 2÷; a hidden operation shows the target alone; a cage of one its digit");
}

// ---------- the exact solver ----------
{
  const s6 = shapeOf(6), a = latinSquare(s6, rng(5)), b = latinSquare(s6, rng(5)), c = latinSquare(s6, rng(6));
  check(a.join("") === b.join("") && a.join("") !== c.join("") && s6.units.every(u => new Set([...u].map(x => a[x])).size === 6), "a random Latin square: valid, the same from the same seed, another from another");
  check(count(s6, []).count === 2, "an empty grid: counting stops at two");
  const impossible = cagesFor(s6, [{ cells: [0, 1], op: "+", target: 20 }]);
  check(count(s6, impossible).count === 0, "a cage no digits can make: no solution");
  const p = generate({ seed: 11, rules: "classic", size: 4, level: "easy" }), r = count(shapeOf(4), viewOf(p, null, null).view.cages);
  check(r.count === 1 && r.solution.join("") === p.solution.join(""), "a generated 4×4: exactly one solution, its own");
}

// ---------- generated grids: one solution, the level asked for, every step sound ----------
const made = [];
{
  const problems = [];
  let total = 0;
  for (const rules of Object.keys(RULES)) for (const n of Object.keys(SIZES).map(Number)) for (const level of Object.keys(levelsOf(rules, n))) {
    const seed = 1000 + n, p = generate({ seed, rules, size: n, level }), spec = levelsOf(rules, n)[level], shape = shapeOf(n), cells = n * n, tag = `${rules} ${n} ${level}`;
    total++;
    made.push(p);
    if (p.level !== level) problems.push(`${tag}: came out ${p.level}`);
    if (p.rank < spec.lo || p.rank > spec.hi) problems.push(`${tag}: rank ${p.rank}`);
    const view = viewOf(p, null, null).view, res = count(shape, view.cages);
    if (res.count !== 1 || res.solution?.join("") !== p.solution.join("")) problems.push(`${tag}: ${res.count} solutions`);
    if (!shape.units.every(u => new Set([...u].map(x => p.solution[x])).size === n)) problems.push(`${tag}: not a Latin square`);
    const seen = new Set();
    for (const c of p.cages) {
      for (const i of c.cells) { if (seen.has(i)) problems.push(`${tag}: a cell in two cages`); seen.add(i); }
      if (!connected(n, c.cells)) problems.push(`${tag}: a cage in two pieces`);
      if (!opsFor(c.cells.length).includes(c.op)) problems.push(`${tag}: ${c.op} on ${c.cells.length} cells`);
      if (targetOf(c.op, c.cells.map(i => p.solution[i])) !== c.target) problems.push(`${tag}: a target its digits don't make`);
      if (rules === "products" && c.cells.length > 1 && c.op !== "x") problems.push(`${tag}: a ${c.op} in Products`);
      if (rules === "classic" && c.op === "x" && c.cells.length > 2 && c.target > 999) problems.push(`${tag}: a product too long for its corner`);
      if (c.cells.length > 2 && readCage(view.cages[p.cages.indexOf(c)], new Uint16Array(cells).fill(shape.all)).alive > 800) problems.push(`${tag}: a cage too long to weigh`);
    }
    if (seen.size !== cells) problems.push(`${tag}: cells in no cage`);
    if (p.cages.filter(c => c.cells.length === 1).length > Math.ceil(n / 2)) problems.push(`${tag}: too many cages of one cell`);
    // every step of the human-style solver agrees with the solution, has words, and it finishes the grid
    const st = stateOf(view, new Uint8Array(cells));
    for (let step; (step = nextStep(view, st));) {
      if (step.place && p.solution[step.place[0]] !== step.place[1]) problems.push(`${tag}: ${step.tech} placed a wrong digit`);
      if (step.elim?.some(([c, m]) => m & bit(p.solution[c]))) problems.push(`${tag}: ${step.tech} struck out the right digit`);
      if (!say(view, step, st)) problems.push(`${tag}: ${step.tech} has no words`);
      apply(view, st, step);
    }
    if (!st.val.every((d, i) => d === p.solution[i])) problems.push(`${tag}: the solver didn't finish`);
  }
  check(!problems.length, `${total} grids of every rules, size and level: one solution each (counted), at their level, cages whole and right, every solver step sound${problems.length ? `: ${problems.slice(0, 6).join("; ")}` : ""}`);
  const again = generate({ seed: 1006, rules: "hidden", size: 6, level: "hard" });
  check(JSON.stringify(encode(again)) === JSON.stringify(encode(made.find(p => p.rules === "hidden" && p.n === 6 && p.level === "hard"))), "the same seed makes the same grid");
  const uses = new Set(made.flatMap(p => Object.keys(p.uses)));
  check([1, 2, 3, 4].every(k => [...uses].some(t => TECHNIQUES[t].rank === k)) && ["single", "cage", "cageline", "linecage", "forcing"].every(t => uses.has(t)),
    `the grids between them need techniques of every rank (${[...uses].sort().join(", ")})`);
  check(made.filter(p => p.level === "easy").every(p => Object.keys(p.uses).every(t => TECHNIQUES[t].rank === 1)) && made.filter(p => p.level === "expert").every(p => p.uses.forcing),
    "an Easy grid needs the plainest steps only; an Expert one a contradiction");
  const ops = new Set(made.filter(p => p.rules === "classic").flatMap(p => p.cages.map(c => c.op)));
  check(["+", "-", "x", "/", "="].every(o => ops.has(o)), "classic grids use all four operations, and cages of one cell");
}

// ---------- grading and hints ----------
{
  const p = made.find(x => x.rules === "classic" && x.n === 6 && x.level === "medium"), view = viewOf(p, null, null).view, st = stateOf(view, new Uint8Array(36));
  const first = nextStep(view, st);
  check(first && first.rank === 1 && /\d/.test(say(view, first, st)), `a hint is a named step: "${say(view, first, st)}"`);
  const g = grade(view, new Uint8Array(36));
  const cageStep = g.steps.find(s => s.tech === "cage");
  check(g.solved && g.rank === 2 && !!cageStep, "a Medium grid grades Medium, by way of a cage's arithmetic");
  const blank = viewFor(shapeOf(6), []);
  check(grade(blank, new Uint8Array(36)).rank === BEYOND, "a grid with nothing to go on grades as beyond, and isn't dealt");
  const h = made.find(x => x.rules === "hidden" && x.n === 6 && x.level === "medium"), hv = viewOf(h, null, null).view, hs = stateOf(hv, new Uint8Array(36));
  let words = "";
  for (let step; !words && (step = nextStep(hv, hs));) { if (step.tech === "cage" && hv.cages[step.cage].cells.length > 1) words = say(hv, step, hs); apply(hv, hs, step); }
  check(/^(The|Of the ways to make the) cage of \d+/.test(words) && hv.cages.every(c => c.cells.length === 1 || c.op === "?"), `with the operations hidden, the solver doesn't know them either: "${words}"`);
}

// ---------- the computer ----------
{
  const p = made.find(x => x.rules === "classic" && x.n === 6 && x.level === "medium"), view = viewOf(p, null, null).view;
  const plans = Object.keys(PACES).map(pace => racePlan(view, pace, p.seed));
  check(plans.every(pl => pl.length === 36 && pl.every(m => p.solution[m.cell] === m.digit) && pl.every((m, k) => !k || m.at >= pl[k - 1].at)),
    "a rival places every cell, each right, in order of time");
  const ends = plans.map(pl => pl.at(-1).at);
  check(ends[0] > ends[1] && ends[1] > ends[2] && ends[1] > 2 * 60e3 && ends[1] < 12 * 60e3, `steady, keen and sharp take ${ends.map(ms => `${(ms / 60e3).toFixed(1)} min`).join(", ")} on a 6×6 Medium`);
  check(placedBy(plans[1], 0) === 0 && placedBy(plans[1], ends[1]) === 36 && racePlan(view, "keen", p.seed).map(m => m.at).join() === plans[1].map(m => m.at).join(),
    "a race plan is the same every time for the grid (so a watching partner sees the same race)");
  check(thinkMs({ tech: "hidden" }, "keen", rng(1), 10) < thinkMs({ tech: "hidden" }, "keen", rng(1), 1) && thinkMs({ tech: "cage", alive: 60 }, "keen", rng(1)) > thinkMs({ tech: "cage", alive: 1 }, "keen", rng(1))
    && thinkMs({ tech: "forcing", cells: [1, 2, 3] }, "keen", rng(1)) > thinkMs({ tech: "naked" }, "keen", rng(1)),
    "a single is quicker with many on offer, a cage slower the more ways it has, a contradiction slowest");
  const split = splitFor(p, 2, p.seed), mine = viewOf(p, split, 1).view;
  const move = partnerMove(mine, new Uint8Array(36), "keen", rng(2), () => true);
  check(move && p.solution[move.cell] === move.digit && move.ms > 0, "a partner's next digit, from its own share of the clues, is right and takes time");
}

// ---------- grids and runs through JSON ----------
{
  const back = made.map(p => decode(JSON.parse(JSON.stringify(encode(p)))));
  check(back.every((q, k) => q.solution.join("") === made[k].solution.join("") && JSON.stringify(q.cages) === JSON.stringify(made[k].cages.map(c => ({ cells: c.cells, op: c.op, target: c.target })))),
    "every grid comes back from JSON as it was, its cages and clues included");
  check(made.every(p => validGrid(JSON.parse(JSON.stringify(encode(p))))), "every grid's text checks as whole");
  const e = encode(made.find(p => p.n === 9 && p.rules === "classic"));
  const sol = latinSquare(shapeOf(9), rng(3)), lone = { rules: "classic", n: 9, level: "easy", rank: 1, seed: 3, solution: sol, cages: [...sol.keys()].map(i => ({ cells: [i], op: "=", target: sol[i] })) };
  const el = encode(lone), dl = decode(el);
  check(el.k.length === 162 && validGrid(el) && dl.cages.length === 81 && dl.cages.every((c, i) => c.cells.join() === String(i) && c.target === sol[i]),
    "a grid of more than 36 cages keeps two characters a cell for its cages, and comes back whole");
  const e6 = encode(made.find(p => p.n === 6)), twist = s => s.replace(/^./, c => (c === "1" ? "2" : "1"));
  check(!validGrid({ ...e6, s: twist(e6.s) }) && !validGrid({ ...e6, n: 10 }) && !validGrid(null) && !validGrid({ ...e6, t: e6.t.replace(/^\d+/, x => String(Number(x) + 1)) }) && !validGrid({ ...e6, o: "-".repeat(e6.o.length) }),
    "a grid's text that's been tampered with (a solution digit, a size, a target, the operations) is refused");
  check(JSON.stringify(roundTrip(JSON.parse(JSON.stringify(e)))) === JSON.stringify(e), "a grid's text goes through the database unchanged (a match carries it)");
}

// ---------- the clues split for playing together ----------
{
  const problems = [];
  const pick = made.filter(p => (p.n === 6 && p.rules !== "products") || (p.n === 9 && p.rules === "classic" && p.level !== "easy") || (p.n === 7 && p.rules === "products" && p.level === "hard"));
  for (const p of pick) {
    const split = splitFor(p, 2, p.seed), tag = `${p.rules} ${p.n} ${p.level}`, zeros = new Uint8Array(p.n * p.n);
    if (split.length !== p.cages.length || !/^[*01]+$/.test(split)) { problems.push(`${tag}: a split of ${split}`); continue; }
    const views = [0, 1].map(q => viewOf(p, split, q));
    // the parts make the whole: every clue is seen by someone
    if (!p.cages.every((_, i) => views.some(v => v.seen[i]))) problems.push(`${tag}: a clue nobody sees`);
    // neither alone does: each part on its own has more than one solution
    for (const v of views) if (count(shapeOf(p.n), v.view.cages, zeros).count < 2) problems.push(`${tag}: a player could finish alone`);
    if (![...split].includes("0") || ![...split].includes("1")) problems.push(`${tag}: a split without a private share each`);
    if (!relay(p, split, 2).done) problems.push(`${tag}: the pair can't finish it between them`);
    if (splitFor(p, 2, p.seed) !== split) problems.push(`${tag}: a different split on another phone`);
  }
  check(!problems.length, `${pick.length} pairs' splits: each player holds clues the other lacks, neither can finish alone, the relay finishes, the same on every phone${problems.length ? `: ${problems.join("; ")}` : ""}`);
  const p = made.find(x => x.rules === "classic" && x.n === 6 && x.level === "easy"), three = splitFor(p, 3, 7);
  check([0, 1, 2].every(q => three.includes(String(q))) && relay(p, three, 3).done, "a table of three: three shares, the relay finishes");
}

// ---------- the table: a match through the database's round trip ----------
{
  const p = made.find(x => x.rules === "classic" && x.n === 6 && x.level === "easy"), cells = 36;
  const seat = (name, slot) => ({ name, slot, pid: `p${slot}`, online: true });
  let g = roundTrip(freshDuel({ a: seat("Korbi", 0), b: seat("Sarah", 1) }, { match: { seed: p.seed, mode: "split", grid: encode(p) }, now: 1000 }));
  sayReady(g, 0, [0, 1], 2000); sayReady(g, 1, [0, 1], 2100);
  g = roundTrip(g);
  check(shareOf(g, 0).part === 0 && shareOf(g, 1).part === 1 && shareOf(g, 1).k === 2, "the two who start hold shares 0 and 1");
  check(placeCoop(g, { n: 1, cell: 0, digit: p.solution[0], slot: 1, grid: p, now: 5000 }) && !placeCoop(g, { n: 2, cell: 1, digit: 1, slot: 0, grid: p, now: 5000 })
    && !placeCoop(g, { n: 1, cell: cells, digit: 1, slot: 0, grid: p, now: 5000 }) && !placeCoop(g, { n: 1, cell: 1, digit: 7, slot: 0, grid: p, now: 5000 }),
    "a digit goes in for this match only, on the grid, from 1 to n");
  g = roundTrip(g);
  const c = coopOf(g, cells);
  check(Number(c.v[0]) === p.solution[0] && c.by[0] === "1" && placedBySeat(c)[1] === 1, "the shared grid keeps the digit and who placed it, through the database");
  hintCoop(g, 1, cells);
  for (let i = 1; i < cells; i++) placeCoop(g, { n: 1, cell: i, digit: p.solution[i], slot: i % 2, grid: p, now: 9000 });
  g = roundTrip(g);
  const done = coopOf(g, cells);
  check(done.done === 9000 && done.hints === 1 && coopValues(done).join("") === p.solution.join("") && !placeCoop(g, { n: 1, cell: 0, digit: 0, slot: 0, grid: p, now: 9500 }),
    "the last right digit solves it for the table (the time kept); the team's hint counted; a solved grid takes no more");
  check(orphanShares(g, [0]).join() === "1" && orphanShares(g, [0, 1]).length === 0, "a share nobody here holds is known (to be lent to the others)");
  const late = roundTrip(freshDuel({ a: seat("Korbi", 0), b: seat("Sarah", 1), c: seat("Mei", 2) }, { people: 3, match: { seed: 1, mode: "split", grid: encode(p) }, now: 1 }));
  sayReady(late, 0, [0, 1], 10); sayReady(late, 1, [0, 1], 11); sayReady(late, 2, [0, 1, 2], 5000);
  check(runOf(late, 2).begun > late.start && shareOf(late, 2).k === 2 && shareOf(late, 2).part === 0, "one who sits down late shares a share with someone who started");
}

// ---------- today's grid ----------
{
  const day = today(), a = encode(generate({ seed: day, ...DAILY })), b = encode(generate({ seed: day, ...DAILY }));
  check(JSON.stringify(a) === JSON.stringify(b) && a.rules === "classic" && a.n === 6 && a.level === "medium", "today's grid: a classic 6×6 at Medium, the same each time it's made");
  check(encode(generate({ seed: today(new Date(Date.UTC(2026, 9, 21))), ...DAILY })).s !== encode(generate({ seed: today(new Date(Date.UTC(2026, 9, 22))), ...DAILY })).s, "a new day, a new grid");
  const engine = ["calcudoku-grid.js", "calcudoku-cage.js", "calcudoku-solve.js", "calcudoku-logic.js", "calcudoku-engine.js", "calcudoku-bot.js", "calcudoku-room.js"].map(f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
  check(engine.every(src => !/Math\.random|Date\.now|performance\.now/.test(src)), "the engine draws on nothing but its seed (no Math.random, no clock), so every phone makes the same grids");
}

// ---------- levels and kinds ----------
check(Object.keys(levelsOf("classic", 4)).join() === "easy,medium" && Object.keys(levelsOf("classic", 5)).join() === "easy,medium,hard" && Object.keys(levelsOf("products", 5)).join() === "easy,medium"
  && [6, 7, 8, 9].every(n => Object.keys(levelsOf("hidden", n)).length === 4) && levelFor("classic", 4, "expert") === "medium" && levelFor("classic", 5, "expert") === "hard",
  "a 4×4 has Easy and Medium, a 5×5 Hard too (not in Products), 6×6 up all four; a level a size lacks goes to its hardest");
check(Object.keys(SIZES).join() === "4,5,6,7,8,9" && Object.keys(RULES).join() === "classic,hidden,products" && Object.keys(LEVELS).length === 4, "three rules, six sizes, four levels");
check(nearOf(6, 0).sort().join() === "1,6" && nearOf(6, 35).sort().join() === "29,34", "a cage grows edge to edge, never off the grid");

console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("calcudoku: the rules, the grids, the grading, the computer, the split and the table all hold");
