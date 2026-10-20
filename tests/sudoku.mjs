// Sudoku (sudoku-engine.js and its pieces): the rules as units, the exact solver, grids generated with exactly one
// solution for every kind and level, graded by the hardest technique a person needs, every step of the human-style
// solver sound, hints that name a step, the computer player, grids and runs through JSON, the givens split for playing
// together (the parts make the whole, neither alone does, and the relay finishes), the table through the database's
// round trip, and today's grid the same on every device.
import fs from "fs";
import { RULES, SIZES, LEVELS, DAILY, levelsOf, levelFor, generate, encode, decode, validGrid, shapeFor, jigsawOf, killerCut, splitFor, viewOf, relay } from "../sudoku-engine.js";
import { shapeOf, boxRegions, rng, bit, POP } from "../sudoku-grid.js";
import { solver, combosOf } from "../sudoku-solve.js";
import { TECHNIQUES, stateOf, nextStep, apply, grade, say, BEYOND } from "../sudoku-logic.js";
import { racePlan, placedBy, partnerMove, PACES, thinkMs } from "../sudoku-bot.js";
import { coopOf, placeCoop, hintCoop, coopValues, shareOf, orphanShares, placedBy as placedBySeat } from "../sudoku-room.js";
import { freshDuel, sayReady, startAll, runOf } from "../duel-core.js";
import { roundTrip } from "./rtdb.js";
import { today } from "../days.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const grid = s => Uint8Array.from([...s].map(c => (c === "." ? 0 : Number(c))));
const t0 = Date.now();

// ---------- the rules as units ----------
{
  const s9 = shapeOf(9), s6 = shapeOf(6), sx = shapeOf(9, boxRegions(9), { diagonals: true });
  check(s9.units.length === 27 && s9.units.every(u => u.length === 9) && s9.peers.every(p => p.length === 20), "a 9×9: 27 units of nine, each cell with 20 peers (its row, column and box)");
  check(s6.units.length === 18 && s6.peers.every(p => p.length === 12) && boxRegions(6).slice(0, 12).join("") === "000111000111", "a 6×6: boxes two rows tall and three wide, 12 peers a cell");
  check(sx.units.length === 29 && sx.peers[0].length === 26 && sx.peers[40].length === 32 && sx.peers[1].length === 20, "Diagonals: the two long diagonals are units too (the centre sees 32 cells)");
  const cages = [{ cells: [0, 1, 10], sum: 12 }];
  const sk = shapeOf(9, boxRegions(9), { cages });
  check(sk.sees[10 * 81 + 0] === 1 && sk.cageOf[10] === 0 && sk.cageOf[2] === -1, "Killer: a cage's cells are peers (no digit twice in a cage)");
  const c9 = combosOf(9);
  check(c9[2][3].length === 1 && c9[2][3][0] === (bit(1) | bit(2)) && c9[3][24].length === 1 && c9[9][45].length === 1 && c9[2][10].length === 4, "cage sums: 3 in two is only 1+2, 24 in three only 7+8+9, 10 in two four ways");
}

// ---------- the exact solver ----------
{
  const S = solver(shapeOf(9));
  const hard = grid("4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......");
  const r = S.solve(hard);
  check(r.count === 1 && r.solution.join("").startsWith("417369825"), "a hard 17-clue grid: exactly one solution, found");
  check(S.solve(new Uint8Array(81)).count === 2, "an empty grid: counting stops at two");
  const clash = grid("11" + ".".repeat(79));
  check(S.solve(clash).count === 0, "two 1s in a row: no solution");
  const a = S.solve(new Uint8Array(81), { limit: 1, rng: rng(5) }).solution, b = S.solve(new Uint8Array(81), { limit: 1, rng: rng(5) }).solution;
  check(a.join("") === b.join("") && shapeOf(9).units.every(u => new Set([...u].map(c => a[c])).size === 9), "a random fill: a valid grid, the same from the same seed");
}

// ---------- generated grids: one solution, the level asked for, every step sound ----------
const COUNTS = { classic: { 9: 4, 6: 2 }, x: { 9: 1, 6: 2 }, jigsaw: { 9: 1, 6: 2 }, killer: { 9: 1, 6: 2 } };
const made = [];
{
  const problems = [];
  let total = 0;
  for (const rules of Object.keys(RULES)) for (const n of [9, 6]) for (const level of Object.keys(levelsOf(rules, n))) {
    const count = level === "expert" || (rules !== "classic" && level === "hard" && n === 9) ? 1 : COUNTS[rules][n];
    for (let s = 1; s <= count; s++) {
      const seed = 1000 * s + n, p = generate({ seed, rules, size: n, level }), spec = levelsOf(rules, n)[p.level], cells = n * n;
      total++;
      made.push(p);
      if (p.level !== level) problems.push(`${rules} ${n} ${level} ${seed}: came out ${p.level}`);
      const sh = shapeFor(p), S = solver(sh), sol = S.solve(p.givens);
      if (sol.count !== 1) problems.push(`${rules} ${n} ${level} ${seed}: ${sol.count} solutions`);
      if (sol.solution && sol.solution.join("") !== p.solution.join("")) problems.push(`${rules} ${n} ${level} ${seed}: not its solution`);
      if (p.rank < spec.lo || p.rank > spec.hi) problems.push(`${rules} ${n} ${level} ${seed}: rank ${p.rank}`);
      if (spec.floor && p.givens.filter(Boolean).length < spec.floor) problems.push(`${rules} ${n} easy ${seed}: too few digits`);
      if (p.givens.some((d, i) => d && d !== p.solution[i])) problems.push(`${rules} ${n} ${level} ${seed}: a given against the solution`);
      if (!p.cages && p.rules !== "jigsaw") {
        const mirrored = [...p.givens.keys()].every(i => !!p.givens[i] === !!p.givens[cells - 1 - i]);
        if (!mirrored) problems.push(`${rules} ${n} ${level} ${seed}: givens not in mirrored pairs`);
      }
      if (p.cages) {
        const seen = new Set(), near = (a, b) => Math.abs(a - b) === n || (Math.abs(a - b) === 1 && Math.floor(a / n) === Math.floor(b / n));
        for (const c of p.cages) {
          for (const i of c.cells) { if (seen.has(i)) problems.push(`${seed}: a cell in two cages`); seen.add(i); }
          if (new Set(c.cells.map(i => p.solution[i])).size !== c.cells.length) problems.push(`${seed}: a digit twice in a cage`);
          if (c.cells.reduce((t, i) => t + p.solution[i], 0) !== c.sum) problems.push(`${seed}: a sum that doesn't add up`);
          const joined = new Set([c.cells[0]]);
          for (let grow = true; grow;) { grow = false; for (const i of c.cells) if (!joined.has(i) && [...joined].some(j => near(i, j))) { joined.add(i); grow = true; } }
          if (joined.size !== c.cells.length) problems.push(`${seed}: a cage in two pieces`);
        }
        if (seen.size !== cells) problems.push(`${seed}: cells in no cage`);
      }
      // every step of the human-style solver agrees with the solution, and it finishes the grid
      const st = stateOf(sh, p.givens);
      let steps = 0;
      for (let step; (step = nextStep(sh, st)); steps++) {
        if (step.place && p.solution[step.place[0]] !== step.place[1]) problems.push(`${rules} ${seed}: ${step.tech} placed a wrong digit`);
        if (step.elim?.some(([c, m]) => m & bit(p.solution[c]))) problems.push(`${rules} ${seed}: ${step.tech} struck out the right digit`);
        if (!say(sh, step)) problems.push(`${rules} ${seed}: ${step.tech} has no words`);
        apply(sh, st, step);
      }
      if (!st.val.every((v, i) => v === p.solution[i])) problems.push(`${rules} ${n} ${level} ${seed}: the solver didn't finish`);
    }
  }
  check(!problems.length, `${total} grids of every rules, size and level: one solution each, at their level, every solver step sound${problems.length ? `: ${problems.slice(0, 6).join("; ")}` : ""}`);
  const again = generate({ seed: 1009, rules: "jigsaw", size: 9, level: "easy" });
  check(encode(again).g === encode(made.find(p => p.seed === 1009 && p.rules === "jigsaw" && p.level === "easy")).g && encode(again).r === encode(made.find(p => p.seed === 1009 && p.rules === "jigsaw" && p.level === "easy")).r,
    "the same seed makes the same grid (a jigsaw's regions too)");
  const uses = new Set(made.flatMap(p => Object.keys(p.uses)));
  check(["full", "hidden", "naked", "locked", "cage", "rule45"].every(t => uses.has(t)) && [...uses].some(t => TECHNIQUES[t].rank === 3) && [...uses].some(t => TECHNIQUES[t].rank === 4),
    `the grids between them need techniques of every rank (${[...uses].sort().join(", ")})`);
  const easy = made.filter(p => p.level === "easy" && p.n === 9 && !p.cages), expert = made.filter(p => p.level === "expert");
  check(easy.every(p => Object.keys(p.uses).every(t => TECHNIQUES[t].rank === 1)) && expert.every(p => Object.keys(p.uses).some(t => TECHNIQUES[t].rank === 4)),
    "an Easy grid needs singles only; an Expert one a chain");
}

// ---------- jigsaw and killer pieces ----------
{
  const j = jigsawOf(9, rng(3)) || jigsawOf(9, rng(4));
  const sizes = Array.from({ length: 9 }, (_, g) => [...j.regions].filter(x => x === g).length);
  check(sizes.every(x => x === 9) && j.moved >= 27 && shapeOf(9, j.regions).units.every(u => new Set([...u].map(c => j.solution[c])).size === 9),
    "a jigsaw: nine regions of nine, a third of the cells out of their boxes, its solution fitting them");
  const cut = killerCut(9, [0, 0, 4, 4, 2], rng(8));
  const cs = cut.cages();
  check(solver(shapeOf(9, boxRegions(9), { cages: cs })).solve(new Uint8Array(81)).count === 1 && cs.every(c => c.cells.length <= 5), "a killer cut: cages of up to five, one solution");
}

// ---------- grading and hints on known grids ----------
{
  const sh = shapeOf(9);
  const easy = grid("53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79");
  const g = grade(sh, easy);
  check(g.solved && g.rank === 1, "a classic singles grid grades Easy");
  const st = stateOf(sh, easy), step = nextStep(sh, st);
  check(step && step.place && /[1-9]/.test(say(sh, step)) && step.rank === 1, `a hint is a named step: "${say(sh, step)}"`);
  // the solver gets stuck, it doesn't guess: a grid with too little to go on
  const thin = grid("1........" + ".".repeat(72));
  check(grade(sh, thin).rank === BEYOND, "a grid beyond every technique grades as beyond, and isn't dealt");
}

// ---------- the computer ----------
{
  const p = made.find(x => x.rules === "classic" && x.n === 9 && x.level === "medium"), sh = shapeFor(p), empty = p.givens.filter(d => !d).length;
  const plans = Object.keys(PACES).map(pace => racePlan(sh, p.givens, pace, p.seed));
  check(plans.every(pl => pl.length === empty && pl.every(m => p.solution[m.cell] === m.digit) && pl.every((m, k) => !k || m.at >= pl[k - 1].at)),
    "a rival places every empty cell, each right, in order of time");
  const ends = plans.map(pl => pl.at(-1).at);
  check(ends[0] > ends[1] && ends[1] > ends[2] && ends[1] > 3 * 60e3 && ends[1] < 20 * 60e3, `steady, keen and sharp take ${ends.map(ms => `${Math.round(ms / 60e3)} min`).join(", ")} on a Medium`);
  check(placedBy(plans[1], 0) === 0 && placedBy(plans[1], ends[1]) === empty && racePlan(sh, p.givens, "keen", p.seed).map(m => m.at).join() === plans[1].map(m => m.at).join(),
    "a race plan is the same every time for the grid (so a watching partner sees the same race)");
  const r = rng(1);
  check(thinkMs({ tech: "hidden" }, "keen", rng(1), 10) < thinkMs({ tech: "hidden" }, "keen", rng(1), 1) && thinkMs({ tech: "xychain" }, "keen", r) > thinkMs({ tech: "full" }, "keen", r),
    "a single is quicker to find with many on offer; a chain takes longer than a last cell");
  const split = splitFor(p, 2, p.seed), view = viewOf(p, split, 1);
  const move = partnerMove(view.shape, view.givens, "keen", rng(2), i => !p.givens[i]);
  check(move && p.solution[move.cell] === move.digit && !p.givens[move.cell] && move.ms > 0, "a partner's next digit, from its own share of the givens, is right and takes time");
}

// ---------- grids and runs through JSON ----------
{
  const back = made.map(p => decode(JSON.parse(JSON.stringify(encode(p)))));
  check(back.every((q, k) => q.givens.join("") === made[k].givens.join("") && q.solution.join("") === made[k].solution.join("") && (q.regions?.join("") ?? "") === (made[k].regions?.join("") ?? "")
    && JSON.stringify(q.cages) === JSON.stringify(made[k].cages)), "every grid comes back from JSON as it was, cages and regions included");
  check(made.every(p => validGrid(JSON.parse(JSON.stringify(encode(p))))), "every grid's text checks as whole");
  const e = encode(made[0]);
  check(!validGrid({ ...e, s: e.s.replace(/^./, c => (c === "1" ? "2" : "1")) }) && !validGrid({ ...e, n: 7 }) && !validGrid(null) && !validGrid({ ...e, g: e.g.slice(1) }),
    "a grid's text that's been tampered with (a solution digit, a size, a short string) is refused");
  check(JSON.stringify(roundTrip(JSON.parse(JSON.stringify(encode(made[0]))))) === JSON.stringify(encode(made[0])), "a grid's text goes through the database unchanged (a match carries it)");
}

// ---------- the givens split for playing together ----------
{
  const problems = [];
  const pairs = made.filter(p => p.n === 9 && ["easy", "medium", "hard"].includes(p.level) && ["classic", "killer", "x"].includes(p.rules)).slice(0, 7);
  for (const p of pairs) {
    const split = splitFor(p, 2, p.seed), units = p.cages ? p.cages.length : p.n * p.n;
    if (split.length !== units) { problems.push(`${p.rules} split of ${split.length}`); continue; }
    const views = [0, 1].map(q => viewOf(p, split, q));
    // the parts make the whole: every given (or sum) is seen by someone, and both together see everything
    if (p.cages) { if (!p.cages.every((c, i) => views.some(v => v.cages[i].sum === c.sum))) problems.push(`${p.seed}: a sum nobody sees`); }
    else if (![...p.givens.keys()].every(i => !p.givens[i] || views.some(v => v.givens[i] === p.givens[i]))) problems.push(`${p.seed}: a given nobody sees`);
    // neither alone does: each part on its own has more than one solution
    for (const v of views) if (solver(v.shape).solve(v.givens).count < 2) problems.push(`${p.rules} ${p.level} ${p.seed}: a player could finish alone`);
    if (!relay(p, split, 2).done) problems.push(`${p.rules} ${p.level} ${p.seed}: the pair can't finish it between them`);
    if (!/^[.*01]+$/.test(split) || ![...split].some(c => c === "0") || ![...split].some(c => c === "1")) problems.push(`${p.seed}: a split without a private share each`);
  }
  check(!problems.length, `${pairs.length} pairs' splits: each player holds givens the other lacks, neither can finish alone, the relay finishes${problems.length ? `: ${problems.join("; ")}` : ""}`);
  const p = made.find(x => x.rules === "classic" && x.n === 9 && x.level === "easy"), three = splitFor(p, 3, 7);
  check([0, 1, 2].every(q => three.includes(String(q))) && relay(p, three, 3).done && splitFor(p, 3, 7) === three, "a table of three: three shares, the relay finishes, the same split on every phone");
}

// ---------- the table: a match through the database's round trip ----------
{
  const p = made.find(x => x.rules === "classic" && x.n === 9 && x.level === "easy"), cells = 81;
  const seat = (name, slot) => ({ name, slot, pid: `p${slot}`, online: true });
  let g = roundTrip(freshDuel({ a: seat("Korbi", 0), b: seat("Sarah", 1) }, { match: { seed: p.seed, mode: "split", grid: encode(p) }, now: 1000 }));
  sayReady(g, 0, [0, 1], 2000); sayReady(g, 1, [0, 1], 2100);
  g = roundTrip(g);
  check(shareOf(g, 0).part === 0 && shareOf(g, 1).part === 1 && shareOf(g, 1).k === 2, "the two who start hold shares 0 and 1");
  const empty = [...Array(cells).keys()].filter(i => !p.givens[i]);
  check(placeCoop(g, { n: 1, cell: empty[0], digit: p.solution[empty[0]], slot: 1, grid: p, now: 5000 }) && !placeCoop(g, { n: 2, cell: empty[1], digit: 1, slot: 0, grid: p, now: 5000 })
    && !placeCoop(g, { n: 1, cell: [...p.givens.keys()].find(i => p.givens[i]), digit: 1, slot: 0, grid: p, now: 5000 }), "a digit goes in for this match only, never on a given");
  g = roundTrip(g);
  const c = coopOf(g, cells);
  check(Number(c.v[empty[0]]) === p.solution[empty[0]] && c.by[empty[0]] === "1" && placedBySeat(c)[1] === 1, "the shared grid keeps the digit and who placed it, through the database");
  hintCoop(g, 1, cells);
  for (const i of empty.slice(1)) placeCoop(g, { n: 1, cell: i, digit: p.solution[i], slot: i % 2, grid: p, now: 9000 });
  g = roundTrip(g);
  const done = coopOf(g, cells);
  check(done.done === 9000 && done.hints === 1 && coopValues(done, p).join("") === p.solution.join("") && !placeCoop(g, { n: 1, cell: empty[0], digit: 0, slot: 0, grid: p, now: 9500 }),
    "the last right digit solves it for the table (the time kept); the team's hint counted; a solved grid takes no more");
  check(orphanShares(g, [0]).join() === "1" && orphanShares(g, [0, 1]).length === 0, "a share nobody here holds is known (to be lent to the others)");
  const late = roundTrip(freshDuel({ a: seat("Korbi", 0), b: seat("Sarah", 1), c: seat("Mei", 2) }, { people: 3, match: { seed: 1, mode: "split", grid: encode(p) }, now: 1 }));
  sayReady(late, 0, [0, 1], 10); sayReady(late, 1, [0, 1], 11); sayReady(late, 2, [0, 1, 2], 5000);
  check(runOf(late, 2).begun > late.start && shareOf(late, 2).k === 2 && shareOf(late, 2).part === 0, "one who sits down late shares a share with someone who started");
}

// ---------- today's grid ----------
{
  const day = today(), a = encode(generate({ seed: day, ...DAILY })), b = encode(generate({ seed: day, ...DAILY }));
  check(a.g === b.g && a.s === b.s && a.rules === "classic" && a.n === 9 && a.level === "medium", "today's grid: a classic 9×9 at Medium, the same each time it's made");
  check(encode(generate({ seed: today(new Date(Date.UTC(2026, 9, 21))), ...DAILY })).g !== encode(generate({ seed: today(new Date(Date.UTC(2026, 9, 22))), ...DAILY })).g, "a new day, a new grid");
  const engine = ["sudoku-grid.js", "sudoku-solve.js", "sudoku-logic.js", "sudoku-engine.js", "sudoku-bot.js", "sudoku-room.js"].map(f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
  check(engine.every(src => !/Math\.random|Date\.now|performance\.now/.test(src)), "the engine draws on nothing but its seed (no Math.random, no clock), so every phone makes the same grids");
}

// ---------- levels and kinds ----------
check(Object.keys(levelsOf("classic", 9)).length === 4 && !levelsOf("killer", 9).expert && !levelsOf("classic", 6).expert && levelFor("jigsaw", 6, "expert") === "hard" && levelFor("x", 9, "expert") === "expert",
  "Expert is offered on a 9×9 without cages; a 6×6 and Killer go to Hard");
check(Object.keys(SIZES).join() === "6,9" && Object.keys(RULES).length === 4 && Object.keys(LEVELS).length === 4, "four rules, two sizes, four levels");

console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("sudoku: the rules, the grids, the grading, the computer, the split and the table all hold");
