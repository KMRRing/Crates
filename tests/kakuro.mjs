// Kakuro (kakuro-engine.js and its pieces): the rules as runs, the combinations, the exact solver, grids generated with
// exactly one solution for every rules, size and level, graded by how much a person has to work out, every step of
// the human-style solver sound and named, the computer player, grids and runs through JSON, the clues split for
// playing together (the parts make the whole, neither alone has one solution, and the relay finishes), the table
// through the database's round trip, and today's grid the same on every device.
import fs from "fs";
import { RULES, SIZES, LEVELS, DAILY, MOST, levelsOf, levelFor, levelOf, generate, encode, decode, validGrid, patternOf, fillOf, closesSwap, cluesOf,
  splitFor, viewOf, relay, alone, cluesSeen, doubt } from "../kakuro-engine.js";
import { shapeOf, patternOk, combosOf, combosLeft, total, bit, rng, mix } from "../kakuro-grid.js";
import { solver, fitRun } from "../kakuro-solve.js";
import { TECHNIQUES, BEYOND, stateOf, nextStep, apply, grade, say, runName } from "../kakuro-logic.js";
import { racePlan, placedBy, partnerMove, PACES, thinkMs } from "../kakuro-bot.js";
import { coopOf, placeCoop, hintCoop, coopValues, shareOf, orphanShares, placedBy as placedBySeat } from "../kakuro-room.js";
import { freshDuel, sayReady, runOf } from "../duel-core.js";
import { roundTrip } from "./rtdb.js";
import { today } from "../days.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const t0 = Date.now();
/** A grid from rows of text: "#" black, a digit a white cell's solution. */
const gridOf = rows => {
  const r = rows.length, c = rows[0].length, black = new Uint8Array(r * c), sol = new Uint8Array(r * c);
  rows.forEach((row, i) => [...row].forEach((ch, j) => { if (ch === "#") black[i * c + j] = 1; else sol[i * c + j] = Number(ch); }));
  return { shape: shapeOf(r, c, black), sol, black, rows: r, cols: c };
};

// ---------- the rules as runs ----------
{
  const g = gridOf(["####", "#12#", "#349", "##87"]);
  const runs = g.shape.runs.map(run => `${run.dir[0]}${run.head}:${[...run.cells].join(",")}`);
  check(runs.join(" ") === "d1:5,9 d2:6,10,14 a4:5,6 d7:11,15 a8:9,10,11 a13:14,15", `runs headed by their clue cells, across before down, in reading order (${runs.join(" ")})`);
  check([...g.shape.peers[10]].sort((a, b) => a - b).join() === "6,9,11,14" && g.shape.across[10] === 4 && g.shape.down[10] === 1, "a cell's peers are the rest of its two runs");
  check(cluesOf(g.shape, g.sol).join() === "4,14,3,16,16,15" && cluesOf(g.shape, g.sol, "product").join() === "3,64,2,63,108,56", "each run's clue: the sum of its digits (or their product)");
  check(patternOk(4, 4, g.black) && !patternOk(4, 4, Uint8Array.from([1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1])) && !patternOk(3, 3, Uint8Array.from([1, 1, 1, 1, 0, 1, 1, 0, 1])),
    "a pattern with a run of one, or a white cell in the clue frame's row, isn't a Kakuro's");
  const c = m => [...m].map(x => [...Array(10).keys()].filter(d => x & bit(d)).join("")).join(" ");
  check(c(combosOf("sum", 2, 3)) === "12" && c(combosOf("sum", 3, 23)) === "689" && c(combosOf("sum", 9, 45)) === "123456789" && combosOf("sum", 2, 10).length === 4 && combosOf("sum", 3, 15).length === 8,
    "sums: 3 in two is 1 2, 23 in three 6 8 9, 45 in nine every digit; 10 in two four ways, 15 in three eight");
  check(c(combosOf("product", 2, 24)).split(" ").sort().join(" ") === "38 46" && c(combosOf("product", 3, 6)) === "123" && combosOf("product", 2, 7).length === 1 && combosOf("product", 2, 11).length === 0,
    "products: 24 in two is 3 8 or 4 6, 6 in three only 1 2 3, a 7 shows itself, 11 can't be made");
  check(c(combosLeft("sum", 16, 1, bit(7))) === "9" && combosLeft("sum", 16, 1, bit(8)).length === 0 && c(combosLeft("product", 24, 1, bit(3))) === "8" && combosLeft("sum", 5, 0, bit(2) | bit(3)).length === 1
    && combosLeft("sum", null, 0, bit(2) | bit(3)).length === 1 && combosLeft("sum", null, 2, bit(1)).length === 28,
    "the ways a run can still be, less the digits in it (16 in two with a 7 needs a 9; with an 8, nothing can; a full run whose clue someone else holds is fine)");
  const f = fitRun(Uint16Array.of(bit(3) | bit(4), 0b1111111110), combosOf("sum", 2, 12));
  check(f.fits.length === 2 && f.allowed[1] === (bit(8) | bit(9)), "the ways that fit: 12 in two with a cell of 3 or 4 leaves the other 8 or 9");
  check(doubt("sum", 2, 3) === 0 && doubt("sum", 2, 10) === 2000 && doubt("sum", 3, 15) === 3000 && doubt("sum", 2, 7) === 1584, "doubt in thousandths of a bit, by integer arithmetic (log2 3 is 1.584)");
}

// ---------- the exact solver ----------
{
  const g = gridOf(["####", "#12#", "#349", "##87"]);
  const one = solver(g.shape, cluesOf(g.shape, g.sol)).solve();
  check(one.count === 1 && one.solution.join("") === g.sol.join(""), "a small grid: exactly one solution, found");
  // a rectangle of a b over b a in two across runs and the same two down runs can be swapped: two solutions
  const two = gridOf(["###", "#12", "#21"]);
  check(solver(two.shape, cluesOf(two.shape, two.sol)).solve().count === 2, "a swappable rectangle: counting stops at two");
  check(closesSwap(two.shape, Uint8Array.from([0, 0, 0, 0, 1, 2, 0, 2, 0]), 8, 1) && !closesSwap(two.shape, Uint8Array.from([0, 0, 0, 0, 1, 2, 0, 2, 0]), 8, 3), "the fill sees a swappable rectangle coming, and never closes one");
  check(solver(g.shape, [3, 14, 3, 16, 16, 15]).solve().count === 0, "clues that can't all be made: no solution");
  check(solver(g.shape, cluesOf(g.shape, g.sol).map(() => null)).solve().count === 2, "a grid without its clues has many solutions");
}

// ---------- generated grids: one solution, the level asked for, every step sound ----------
const made = [];
{
  const problems = [], mirror = (p, i) => (p.rows - Math.floor(i / p.cols)) * p.cols + (p.cols - (i % p.cols));
  const plan = [];
  for (const rules of Object.keys(RULES)) for (const size of [8, 10, 12]) for (const level of levelsOf(rules, size)) {
    if (size === 12 && level !== "medium" && level !== "expert") continue;      // the largest at two levels, to keep the run short
    plan.push({ rules, size, level });
  }
  for (const { rules, size, level } of plan) {
    const seed = 3000 + size + level.length, p = generate({ seed, rules, size, level }), cells = p.rows * p.cols, op = RULES[rules].op;
    made.push(p);
    const at = `${rules} ${size} ${level} ${seed}`;
    if (p.level !== level) problems.push(`${at}: came out ${p.level}`);
    const sol = solver(p.shape, p.clues, op).solve({ maxNodes: 400000 });
    if (sol.count !== 1) problems.push(`${at}: ${sol.count} solutions`);
    else if (sol.solution.join("") !== p.solution.join("")) problems.push(`${at}: not its solution`);
    if (!patternOk(p.rows, p.cols, p.black)) problems.push(`${at}: not a Kakuro's pattern`);
    for (let i = 0; i < cells; i++) if (p.black[i] !== p.black[mirror(p, i)] && Math.floor(i / p.cols) && i % p.cols) { problems.push(`${at}: not symmetric`); break; }
    for (const run of p.shape.runs) {
      if (new Set([...run.cells].map(c => p.solution[c])).size !== run.cells.length) problems.push(`${at}: a digit twice in a run`);
      if (run.cells.length < 2 || run.cells.length > (rules === "products" ? 4 : 7)) problems.push(`${at}: a run of ${run.cells.length}`);
    }
    if (op === "product" && p.clues.some(x => x > MOST)) problems.push(`${at}: a product too long to print`);
    if (levelOf(p.rank, p.work, p.shape.white.length) !== p.level) problems.push(`${at}: its level isn't what its grading says`);
    // every step of the human-style solver agrees with the solution, has words, and it finishes the grid
    const view = { shape: p.shape, clues: p.clues, op }, st = stateOf(view, new Uint8Array(cells));
    for (let step, k = 0; (step = nextStep(view, st)) && k < 3000; k++) {
      if (step.place && p.solution[step.place[0]] !== step.place[1]) problems.push(`${at}: ${step.tech} placed a wrong digit`);
      if (step.elim?.some(([c, m]) => m & bit(p.solution[c]))) problems.push(`${at}: ${step.tech} struck out the right digit`);
      if (!say(view, st, step)) problems.push(`${at}: ${step.tech} has no words`);
      apply(view, st, step);
    }
    if (!p.shape.white.every(c => st.val[c] === p.solution[c])) problems.push(`${at}: the solver didn't finish`);
  }
  check(!problems.length, `${plan.length} grids of every rules, size and level: one solution each, symmetric, at their level, every solver step sound and named${problems.length ? `: ${problems.slice(0, 6).join("; ")}` : ""}`);
  const again = generate({ seed: 3000 + 10 + 6, rules: "sums", size: 10, level: "medium" }), first = made.find(p => p.rules === "sums" && p.rows === 10 && p.level === "medium");
  check(JSON.stringify(encode(again)) === JSON.stringify(encode(first)), "the same seed makes the same grid");
  const uses = new Set(made.flatMap(p => Object.keys(p.uses)));
  check(["last", "single", "hidden", "fit"].every(t => uses.has(t)) && [...uses].some(t => TECHNIQUES[t].rank >= 3), `the grids between them need techniques of every rank (${[...uses].sort().join(", ")})`);
  const easy = made.filter(p => p.level === "easy"), expert = made.filter(p => p.level === "expert");
  check(easy.every(p => p.rank <= 2 && p.work / p.shape.white.length <= 0.08) && expert.every(p => p.rank === 4 || p.work / p.shape.white.length > 0.38),
    "an Easy grid needs the ways that fit once for every twelve cells at most; an Expert one a chain, or working out at nearly every other cell");
}

// ---------- chains: Expert grids that need one ----------
{
  const problems = [];
  let chains = 0;
  for (const seed of [6011, 6029]) {
    const p = generate({ seed, rules: "sums", size: 10, level: "expert" }), view = { shape: p.shape, clues: p.clues, op: p.op }, st = stateOf(view, new Uint8Array(p.rows * p.cols));
    for (let step, k = 0; (step = nextStep(view, st)) && k < 3000; k++) {
      if (step.tech === "chain") { chains++; if (!/^If this cell were \d/.test(say(view, st, step))) problems.push(`${seed}: a chain without its words`); }
      if (step.place && p.solution[step.place[0]] !== step.place[1]) problems.push(`${seed}: ${step.tech} placed a wrong digit`);
      if (step.elim?.some(([c, m]) => m & bit(p.solution[c]))) problems.push(`${seed}: ${step.tech} struck out the right digit`);
      apply(view, st, step);
    }
    if (!p.shape.white.every(c => st.val[c] === p.solution[c])) problems.push(`${seed}: the solver didn't finish`);
  }
  check(chains >= 3 && !problems.length, `two Expert grids that need chains (${chains} chains in all): every chain sound and named, the grids finished${problems.length ? `: ${problems.join("; ")}` : ""}`);
}

// ---------- grading, hints, and what the solver can't do ----------
{
  const g = gridOf(["####", "#12#", "#349", "##87"]), view = { shape: g.shape, clues: cluesOf(g.shape, g.sol), op: "sum" };
  const r = grade(view, new Uint8Array(16));
  check(r.solved && r.rank <= 2, `a small grid grades by its hardest step (rank ${r.rank}, ${r.steps.length} steps)`);
  const st = stateOf(view, new Uint8Array(16)), step = nextStep(view, st);
  check(step && /\d/.test(say(view, st, step)) && runName(view, 0) === "down 4 in two", `a hint is a named step: "${say(view, st, step)}"`);
  const blind = { ...view, clues: view.clues.map(() => null) };
  check(grade(blind, new Uint8Array(16)).rank === BEYOND, "a grid the techniques can't finish grades as beyond, and isn't dealt");
  check(levelOf(2, 3, 50) === "easy" && levelOf(2, 10, 50) === "medium" && levelOf(3, 10, 50) === "hard" && levelOf(4, 5, 50) === "expert" && levelOf(2, 25, 50) === "expert" && levelOf(BEYOND, 0, 50) === null,
    "levels by work a cell and the hardest technique");
}

// ---------- the computer ----------
{
  const p = made.find(x => x.rules === "sums" && x.rows === 10 && x.level === "medium"), view = { shape: p.shape, clues: p.clues, op: p.op };
  const plans = Object.keys(PACES).map(pace => racePlan(view, pace, rng(mix(p.seed, "race", pace))));
  check(plans.every(pl => pl.length === p.shape.white.length && pl.every(m => p.solution[m.cell] === m.digit) && pl.every((m, k) => !k || m.at >= pl[k - 1].at)),
    "a rival places every white cell, each right, in order of time");
  const ends = plans.map(pl => pl.at(-1).at);
  check(ends[0] > ends[1] && ends[1] > ends[2] && ends[1] > 3 * 60e3 && ends[1] < 25 * 60e3, `steady, keen and sharp take ${ends.map(ms => `${Math.round(ms / 60e3)} min`).join(", ")} over a 10×10 Medium`);
  check(placedBy(plans[1], 0) === 0 && placedBy(plans[1], ends[1]) === p.shape.white.length && racePlan(view, "keen", rng(mix(p.seed, "race", "keen"))).map(m => m.at).join() === plans[1].map(m => m.at).join(),
    "a race plan is the same every time for the grid (so a watching partner sees the same race)");
  check(thinkMs({ tech: "single", runs: [0] }, view, "keen", rng(1), 10) < thinkMs({ tech: "single", runs: [0] }, view, "keen", rng(1), 1) && thinkMs({ tech: "chain", length: 6, runs: [] }, view, "keen", rng(2)) > thinkMs({ tech: "last", runs: [0] }, view, "keen", rng(2)),
    "a crossing is quicker to spot with many on offer; a chain takes longer than a run's last cell");
  const split = splitFor(p, 2, p.seed), mine = viewOf(p, split, 1);
  const move = partnerMove(mine, new Uint8Array(p.rows * p.cols), "keen", rng(2), () => true);
  check(move && p.solution[move.cell] === move.digit && move.ms > 0, "a partner's next digit, from its own share of the clues, is right and takes time");
}

// ---------- grids and runs through JSON ----------
{
  const back = made.map(p => decode(JSON.parse(JSON.stringify(encode(p)))));
  check(back.every((q, k) => q.solution.join("") === made[k].solution.join("") && q.black.join("") === made[k].black.join("") && q.clues.join() === made[k].clues.join()),
    "every grid comes back from JSON as it was, its clues worked out again from it");
  check(made.every(p => validGrid(JSON.parse(JSON.stringify(encode(p))))), "every grid's text checks as whole");
  const e = encode(made[0]), white = e.p.indexOf("."), next = e.p.indexOf(".", white + 1);
  const twice = { ...e, s: e.s.slice(0, next) + e.s[white] + e.s.slice(next + 1) };
  check(!validGrid(twice) && !validGrid({ ...e, r: 7 }) && !validGrid(null) && !validGrid({ ...e, s: e.s.slice(1) }) && !validGrid({ ...e, p: e.p.replace(".", "#") }),
    "a grid's text that's been tampered with (a digit twice in a run, a size, a short string, a cell blacked out) is refused");
  check(JSON.stringify(roundTrip(JSON.parse(JSON.stringify(encode(made[0]))))) === JSON.stringify(encode(made[0])), "a grid's text goes through the database unchanged (a match carries it)");
}

// ---------- the clues split for playing together ----------
{
  const problems = [];
  const pairs = made.filter(p => p.rows <= 10 && p.level !== "expert").slice(0, 8);
  for (const p of pairs) {
    const split = splitFor(p, 2, p.seed), runs = p.shape.runs, at = `${p.rules} ${p.rows} ${p.level}`;
    if (split.length !== runs.length || !/^[01*]+$/.test(split)) { problems.push(`${at}: a split of ${split}`); continue; }
    // for two, across against down: each private clue of player 0 is an across one, of player 1 a down one
    if (runs.some((run, k) => split[k] !== "*" && split[k] !== (run.dir === "across" ? "0" : "1"))) problems.push(`${at}: not across against down`);
    // the parts make the whole: every clue is seen by someone
    if (!runs.every((_, k) => [0, 1].some(q => viewOf(p, split, q).clues[k] != null))) problems.push(`${at}: a clue nobody sees`);
    // each holds clues the other lacks, and neither alone has one solution
    if (![...split].some(ch => ch === "0") || ![...split].some(ch => ch === "1")) problems.push(`${at}: someone holds nothing of their own`);
    for (const q of [0, 1]) {
      const v = viewOf(p, split, q);
      if (solver(v.shape, v.clues, v.op).solve({ maxNodes: 400000 }).count < 2 || alone(p, split, q)) problems.push(`${at}: player ${q} could finish alone`);
    }
    const rel = relay(p, split, 2);
    if (!rel.done) problems.push(`${at}: the pair can't finish it between them`);
    else if (p.shape.white.some(c => rel.placed[c] !== p.solution[c])) problems.push(`${at}: the relay placed a wrong digit`);
    // from what each player sees, halfway through, every step the solver (a hint, the computer partner) takes is sound
    const half = Uint8Array.from(rel.placed, (d, i) => (i % 2 ? d : 0));
    for (const q of [0, 1]) {
      const v = viewOf(p, split, q), st = stateOf(v, half);
      for (let step, k = 0; (step = nextStep(v, st)) && k < 3000; k++) {
        if ((step.place && p.solution[step.place[0]] !== step.place[1]) || step.elim?.some(([c, m]) => m & bit(p.solution[c]))) { problems.push(`${at}: player ${q}'s ${step.tech} isn't sound`); break; }
        apply(v, st, step);
      }
    }
    if (splitFor(p, 2, p.seed) !== split) problems.push(`${at}: not the same split twice`);
  }
  check(!problems.length, `${pairs.length} pairs' splits: across against down, each player holding clues the other lacks, neither able to finish alone, the relay finishing, the same on every phone${problems.length ? `: ${problems.join("; ")}` : ""}`);
  const p = made.find(x => x.rules === "sums" && x.rows === 10 && x.level === "easy"), three = splitFor(p, 3, 7);
  check([0, 1, 2].every(q => three.includes(String(q))) && relay(p, three, 3).done && splitFor(p, 3, 7) === three && [0, 1, 2].every(q => !alone(p, three, q)),
    "a table of three: the clues dealt round it, three shares, the relay finishes, nobody can finish alone, the same split on every phone");
  check(cluesSeen(p, three, 0).filter(Boolean).length < p.clues.length && cluesSeen(p, three, 0, [1, 2]).every(Boolean) && cluesSeen(p, null, 0).every(Boolean),
    "what a player sees: their clues and the shared ones, and the others' too while those are lent");
}

// ---------- the table: a match through the database's round trip ----------
{
  const p = made.find(x => x.rules === "sums" && x.rows === 8 && x.level === "easy"), cells = p.rows * p.cols, white = [...p.shape.white];
  const seat = (name, slot) => ({ name, slot, pid: `p${slot}`, online: true });
  let g = roundTrip(freshDuel({ a: seat("Korbi", 0), b: seat("Sarah", 1) }, { match: { seed: p.seed, mode: "split", grid: encode(p) }, now: 1000 }));
  sayReady(g, 0, [0, 1], 2000); sayReady(g, 1, [0, 1], 2100);
  g = roundTrip(g);
  check(shareOf(g, 0).part === 0 && shareOf(g, 1).part === 1 && shareOf(g, 1).k === 2, "the two who start hold shares 0 (across) and 1 (down)");
  const black = [...p.black.keys()].find(i => p.black[i]);
  check(placeCoop(g, { n: 1, cell: white[0], digit: p.solution[white[0]], slot: 1, grid: p, now: 5000 }) && !placeCoop(g, { n: 2, cell: white[1], digit: 1, slot: 0, grid: p, now: 5000 })
    && !placeCoop(g, { n: 1, cell: black, digit: 1, slot: 0, grid: p, now: 5000 }), "a digit goes in for this match only, never in a black cell");
  g = roundTrip(g);
  const c = coopOf(g, cells);
  check(Number(c.v[white[0]]) === p.solution[white[0]] && c.by[white[0]] === "1" && placedBySeat(c)[1] === 1, "the shared grid keeps the digit and who placed it, through the database");
  hintCoop(g, 1, cells);
  for (const i of white.slice(1)) placeCoop(g, { n: 1, cell: i, digit: p.solution[i], slot: i % 2, grid: p, now: 9000 });
  g = roundTrip(g);
  const done = coopOf(g, cells);
  check(done.done === 9000 && done.hints === 1 && white.every(i => coopValues(done)[i] === p.solution[i]) && !placeCoop(g, { n: 1, cell: white[0], digit: 0, slot: 0, grid: p, now: 9500 }),
    "the last right digit solves it for the table (the time kept); the team's hint counted; a solved grid takes no more");
  check(orphanShares(g, [0]).join() === "1" && orphanShares(g, [0, 1]).length === 0, "a share nobody here holds is known (to be lent to the others)");
  const late = roundTrip(freshDuel({ a: seat("Korbi", 0), b: seat("Sarah", 1), c: seat("Mei", 2) }, { people: 3, match: { seed: 1, mode: "split", grid: encode(p) }, now: 1 }));
  sayReady(late, 0, [0, 1], 10); sayReady(late, 1, [0, 1], 11); sayReady(late, 2, [0, 1, 2], 5000);
  check(runOf(late, 2).begun > late.start && shareOf(late, 2).k === 2 && shareOf(late, 2).part === 0, "one who sits down late shares a share with someone who started");
}

// ---------- today's grid ----------
{
  const day = today(), a = encode(generate({ seed: day, ...DAILY })), b = encode(generate({ seed: day, ...DAILY }));
  check(JSON.stringify(a) === JSON.stringify(b) && a.rules === "sums" && a.r === 10 && a.level === "medium", "today's grid: Sums, 10×10, at Medium, the same each time it's made");
  check(encode(generate({ seed: today(new Date(Date.UTC(2026, 9, 21))), ...DAILY })).s !== encode(generate({ seed: today(new Date(Date.UTC(2026, 9, 22))), ...DAILY })).s, "a new day, a new grid");
  const engine = ["kakuro-grid.js", "kakuro-solve.js", "kakuro-logic.js", "kakuro-engine.js", "kakuro-bot.js", "kakuro-room.js"].map(f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
  check(engine.every(src => !/Math\.random|Date\.now|performance\.now/.test(src)), "the engine draws on nothing but its seed (no Math.random, no clock)");
  check(engine.every(src => !/Math\.(log|log2|log10|pow|exp|sqrt|sin|cos|atan|hypot|cbrt)\(|\*\*\s*[^\d(]/.test(src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ""))),
    "and on no arithmetic a browser may round its own way (logarithms, powers, roots), so every phone makes the same grids");
}

// ---------- levels and kinds ----------
check(levelsOf("sums", 10).length === 4 && levelsOf("sums", 8).length === 3 && levelsOf("products", 12).length === 3 && levelFor("products", 10, "expert") === "hard" && levelFor("sums", 12, "expert") === "expert",
  "Expert is offered on Sums of 10×10 and 12×12; an 8×8 and Products go to Hard");
check(Object.keys(SIZES).join() === "8,10,12" && Object.keys(RULES).join() === "sums,products" && Object.keys(LEVELS).length === 4, "two rules, three sizes, four levels");

console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("kakuro: the rules, the grids, the grading, the computer, the split and the table all hold");
