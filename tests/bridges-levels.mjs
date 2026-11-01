// Bridges' levels (bridges-levels.js, with the twists made by bridges-engine.js): the puzzles with viaducts and fairways
// made, the ladder of puzzles in chapters, every level's puzzle (one answer by reasoning, its twist really in it, the
// answer's networks and bridges right); the stars; the miniature the menu draws; and that the plain puzzles Bridges made
// before the twists came are the puzzles their seeds name (today's, links). The rules of the twists, and the solver against a
// plain search of every way to build bridges, are in tests/bridges-search.mjs.
import { createHash } from "node:crypto";
import { LEVELS as DIFFICULTIES, TWISTS, layoutOf, count, answerOf, gradeOf, solveAs, generate, flagsOf, twistOn, breaks, puzzleOf } from "../bridges-engine.js";
import { CHAPTERS, LEVELS, COUNT, chapterOf, seedOf, levelPuzzle, kindOf, parOf, starsFor, PAR_PER_ISLAND } from "../bridges-levels.js";
import { miniature } from "../bridges-mini.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- viaducts and fairways, made ----------
{
  // the generator: a viaduct really goes over a low bridge of the answer, and a lane really lies under a viaduct of it
  let ok = true, why = "";
  const fail = (m) => { if (ok) why = m; ok = false; };
  for (const twist of ["hills", "lanes", "reefs+hills", "ranges+lanes", "realms+hills"]) for (const size of [7, 9]) for (let i = 0; i < 2; i++) {
    const seed = 600 + i * 17 + size, p = generate(seed, size, ["easy", "medium", "hard"][i % 3], twist), tag = `${twist} ${size} #${seed}`;
    if (!p || !p.hills || p.twist !== twistOn(twist) || (flagsOf(twist).lanes !== !!p.lanes)) { fail(`${tag}: twist strings missing`); continue; }
    const lay = layoutOf(size, p.grid, p.kinds || "", p.realms || "", p.hills, p.lanes || "");
    if (count(lay, 2) !== 1 || answerOf(size, p.grid, p.kinds || "", p.realms || "", p.hills, p.lanes || "") !== p.sol) fail(`${tag}: not one answer, or another answer`);
    const cells = l => { const a = lay.isl[lay.links[l].a], b = lay.isl[lay.links[l].b], out = []; for (let r = a.r, c = a.c; r !== b.r || c !== b.c; r += Math.sign(b.r - a.r), c += Math.sign(b.c - a.c)) if (r !== a.r || c !== a.c) out.push(r * size + c); return out; };
    const built = [...p.sol].map((m, l) => (m === "0" ? null : { l, high: lay.links[l].high, cells: cells(l) })).filter(Boolean);
    const over = built.some(x => x.high && built.some(y => !y.high && y.cells.some(k => x.cells.includes(k))));
    if (!over) fail(`${tag}: no viaduct over a low bridge`);
    if (p.lanes && !built.some(x => x.high && x.cells.some(k => p.lanes[k] === "~"))) fail(`${tag}: no viaduct over a lane`);
    if (p.lanes && built.some(x => !x.high && x.cells.some(k => p.lanes[k] === "~"))) fail(`${tag}: a low bridge over a lane`);
    if ([...p.hills].some((h, k) => h === "1" && /[.#]/.test(p.grid[k]))) fail(`${tag}: a hill that isn't an island`);
    if (JSON.stringify(generate(seed, size, ["easy", "medium", "hard"][i % 3], twist)) !== JSON.stringify(p)) fail(`${tag}: not the same twice`);
  }
  check(ok, `puzzles with viaducts and fairways have one answer, a viaduct over a low bridge, a lane under a viaduct, hills only on islands, and are the same twice${why ? ` (${why})` : ""}`);
}

// ---------- the ladder ----------
{
  check(COUNT === LEVELS.length && COUNT >= 20, `${COUNT} levels`);
  check(new Set(LEVELS.map(L => L.name)).size === COUNT && LEVELS.every(L => L.name && [7, 9, 11].includes(L.size) && DIFFICULTIES[L.level]), "each level has a name of its own, a size and a difficulty");
  check(LEVELS.every(L => twistOn(L.twist) === L.twist), "each level's twist is written the way the engine writes it");
  check(CHAPTERS[0].from === 0 && CHAPTERS.every((c, k) => c.name && c.about && (k === 0 || c.from > CHAPTERS[k - 1].from) && c.from < COUNT), "chapters begin at the first level and follow in order");
  check(LEVELS.every((_, i) => chapterOf(i) === CHAPTERS.map((c, k) => (i >= c.from ? k : -1)).filter(k => k >= 0).pop()), "a level's chapter is the last one begun by then");
  check(new Set(LEVELS.map((_, i) => seedOf(i))).size === COUNT, "each level has a seed of its own");
  const first = name => LEVELS[CHAPTERS.find(c => c.name === name).from];
  check(first("Harbour charts").twist === "none" && first("Reefs").twist === "reefs" && first("Ranges").twist === "ranges" && first("Two realms").twist === "realms" && first("Viaducts").twist === "hills" && first("Fairways").twist === "lanes", "each chapter's first level brings its twist");
  const chap = c => LEVELS.slice(CHAPTERS[c].from, CHAPTERS[c + 1]?.from ?? COUNT);
  check(chap(0).every(L => L.twist === "none") && chap(4).every(L => L.twist.includes("+")), "the first chapter is plain and the admiralty puts twists together");
  const last = chap(CHAPTERS.length - 1);
  check(last.every(L => L.twist.includes("+") && /hills|lanes/.test(L.twist)) && chap(5).every(L => L.twist === "hills") && chap(6).every(L => L.twist === "lanes"), "the viaduct and fairway chapters keep to their twist, and the grand charts put them with the others");
  check(CHAPTERS.slice(0, 5).map(c => c.from).join() === "0,6,11,16,21" && LEVELS[24].name === "Admiralty chart" && LEVELS[6].name === "Shallows", "the levels there were before keep their numbers (the stars, the runs and the seeds are kept by number)");
  check(Object.keys(TWISTS).every(t => t === "none" || LEVELS.some(L => flagsOf(L.twist)[t])), "every twist is on some level");
}

// ---------- a puzzle of every level, for several seeds ----------
{
  let ok = true, why = "", total = 0, hit = 0, worst = 0;
  const fail = (i, seed, what) => { if (ok) why = `level ${i + 1}, seed ${seed}: ${what}`; ok = false; };
  const t0 = performance.now();
  LEVELS.forEach((L, i) => {
    for (const seed of [seedOf(i), 4001 + i, 77001 + 31 * i]) {
      const t = performance.now(), p = levelPuzzle(i, seed), took = performance.now() - t;
      worst = Math.max(worst, took); total++;
      if (!p) { fail(i, seed, "no puzzle"); continue; }
      if (p.level === L.level) hit++;
      const T = flagsOf(L.twist), lay = layoutOf(p.size, p.grid, p.kinds || "", p.realms || "", p.hills || "", p.lanes || "");
      if (p.size !== L.size || p.sol.length !== lay.links.length) fail(i, seed, "wrong size or answer");
      if (count(lay, 2) !== 1) fail(i, seed, "not one answer");
      if (answerOf(p.size, p.grid, p.kinds || "", p.realms || "", p.hills || "", p.lanes || "") !== p.sol) fail(i, seed, "another answer than its own");
      if (gradeOf(lay) !== ["easy", "medium", "hard"].indexOf(p.level)) fail(i, seed, "graded differently than it says");
      if (T.reefs !== p.grid.includes("#")) fail(i, seed, T.reefs ? "no reefs" : "reefs it shouldn't have");
      if (T.ranges !== /[+-]/.test(p.kinds || "")) fail(i, seed, T.ranges ? "no bounds" : "bounds it shouldn't have");
      if (T.realms !== (lay.realmSize[0] > 0 && lay.realmSize[1] > 0)) fail(i, seed, T.realms ? "one realm only" : "realms it shouldn't have");
      if (T.realms && (lay.realmSize[0] < 3 || lay.realmSize[1] < 3)) fail(i, seed, "a realm too small");
      if (T.hills !== !!p.hills || T.lanes !== !!p.lanes) fail(i, seed, "hills or lanes missing, or there when they shouldn't be");
      // the answer is a valid building: bridges within an island's bound, none across another, each realm joined (the solver's complete() already says so; this walks it)
      const sums = lay.isl.map(() => 0);
      lay.links.forEach((l, k) => { sums[l.a] += +p.sol[k]; sums[l.b] += +p.sol[k]; });
      lay.isl.forEach((x, k) => { if (sums[k] < Math.max(x.mn, 1) || sums[k] > x.mx) fail(i, seed, "an island with a number the bridges don't make"); });
      const cells = new Set();
      lay.links.forEach((l, k) => {
        if (!+p.sol[k]) return;
        const a = lay.isl[l.a], b = lay.isl[l.b];
        for (let r = a.r, c = a.c; r !== b.r || c !== b.c; r += Math.sign(b.r - a.r), c += Math.sign(b.c - a.c)) {
          const at = r * p.size + c;
          if (at === a.r * p.size + a.c) continue;
          const key = `${at}${l.high ? "h" : "l"}`;                  // a viaduct and a low bridge may share a cell, nothing else
          if (cells.has(key)) fail(i, seed, "bridges cross"); cells.add(key);
          if (p.lanes?.[at] === "~" && !l.high) fail(i, seed, "a low bridge over a lane");
          if (p.grid[at] === "#") fail(i, seed, "a bridge over a reef");
        }
      });
      const comps = new Set(), par = lay.isl.map((_, k) => k), find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
      lay.links.forEach((l, k) => { if (+p.sol[k]) par[find(l.a)] = find(l.b); });
      lay.isl.forEach((x, k) => comps.add(`${x.realm}:${find(k)}`));
      if (comps.size !== (T.realms ? 2 : 1)) fail(i, seed, "the islands of a realm are not one network");
      if (seed === seedOf(i) && JSON.stringify(levelPuzzle(i, seed)) !== JSON.stringify(p)) fail(i, seed, "not the same twice");
    }
  });
  check(ok, `every level makes a puzzle with one answer, its twist in it, the answer a true building, the same twice${why ? ` (${why})` : ""}`);
  check(hit >= total * 0.9, `nearly every puzzle comes out at the difficulty its level asks (${hit} of ${total})`);
  console.log(`     ${total} puzzles in ${Math.round(performance.now() - t0)} ms, the slowest ${Math.round(worst)} ms`);
  check(worst < 1500, "no puzzle takes long to make");
}

// ---------- the hint and the rules the marks break, with the twists ----------
{
  let ok = true;
  for (const i of [6, 12, 17, 24, 27, 33, 38]) {
    const p = levelPuzzle(i, seedOf(i)), P = puzzleOf(p.size, p.grid, p.sol, p.kinds || "", p.realms || "", p.hills || "", p.lanes || "");
    const none = "0".repeat(p.sol.length), all = breaks(P, p.sol);
    if (breaks(P, none).over.length || all.over.length || all.cut.length) ok = false;          // the answer breaks no rule
    const r = solveAs(P.lay, 2);
    if (!r.ok) ok = false;
  }
  check(ok, "the answer breaks no rule the page shows, and the solver's finish is the answer");
}

// ---------- the stars ----------
{
  const p = levelPuzzle(2, seedOf(2)), par = parOf(p);
  check(Number.isInteger(par) && par > 0, "the par is a whole number of seconds");
  check(starsFor(p, par) === 3 && starsFor(p, par + 1) === 2 && starsFor(p, 2 * par) === 2 && starsFor(p, 2 * par + 1) === 1 && starsFor(p, 0) === 3 && starsFor(p, 100000) === 1, "three stars within the par, two within twice it, one for solving it");
  const pars = LEVELS.map((_, i) => parOf(levelPuzzle(i, seedOf(i))));
  check(pars.every(x => x >= 15 && x <= 1200), `every par is between fifteen seconds and twenty minutes (${Math.min(...pars)} to ${Math.max(...pars)} s)`);
  check(parOf({ ...p, level: "hard" }) > parOf({ ...p, level: "easy" }) && parOf({ ...p, grid: p.grid.replace(/\./, "3") }) > par && PAR_PER_ISLAND > 0, "a harder puzzle, or one with more islands, has a longer par");
}

// ---------- puzzles from before the twists ----------
{
  const GOLD = {
    "1/7/easy": "251561cf97",
    "20261101/7/easy": "41a7b1dc4f",
    "1/7/medium": "7a010260a5",
    "20261101/7/medium": "02604d4d90",
    "1/7/hard": "fc6b19f861",
    "20261101/7/hard": "98457f836a",
    "1/9/easy": "dc7a078a56",
    "20261101/9/easy": "0ed7308072",
    "1/9/medium": "f70fe08579",
    "20261101/9/medium": "f05e8717d7",
    "1/9/hard": "76859f760c",
    "20261101/9/hard": "0caf085b85",
    "1/11/easy": "e21cf600ab",
    "20261101/11/easy": "a57d95b92e",
    "1/11/medium": "65e541cefa",
    "20261101/11/medium": "81525bf70e",
    "1/11/hard": "42b0061589",
    "20261101/11/hard": "dcb398ea47"
  };
  const h = p => createHash("sha1").update(p.grid + "|" + p.sol + "|" + p.level).digest("hex").slice(0, 10);
  const wrong = Object.entries(GOLD).filter(([k, v]) => { const [seed, size, level] = k.split("/"); return h(generate(+seed, +size, level)) !== v; }).map(([k]) => k);
  check(!wrong.length, `puzzles made before the twists came are the same puzzles (${Object.keys(GOLD).length} seeds, sizes and levels)${wrong.length ? `: ${wrong.join(", ")}` : ""}`);
  const plain = generate(99, 9, "medium");
  check(!("twist" in plain) && !("kinds" in plain) && !("realms" in plain), "a plain puzzle carries nothing of the twists");
  check(JSON.stringify(generate(5, 9, "easy", "reefs+ranges")) === JSON.stringify(generate(5, 9, "easy", "ranges+reefs")), "twists named in either order are the same puzzle");
}

// ---------- the miniature ----------
{
  const plain = miniature(7, "none", 5), all = miniature(11, "reefs+ranges+realms", 5);
  check(plain === miniature(7, "none", 5) && plain.startsWith("<svg") && plain.includes("<circle") && plain.includes("<line"), "a chart in miniature is the same for the same level, with islands and bridges");
  check(!plain.includes('class="reef"') && !plain.includes("r1") && all.includes('class="reef"') && all.includes("r1") && all.includes("range"), "a chart shows its twists: reefs, a second colour, rings for bounds");
  const hilly = miniature(9, "hills", 5), lane = miniature(9, "lanes", 5), grand = miniature(11, "reefs+ranges+realms+lanes", 5);
  check(hilly.includes('class="hill"') && !plain.includes('class="hill"') && lane.includes('class="lane"') && grand.includes('class="lane"') && !plain.includes('class="lane"') && hilly === miniature(9, "hills", 5), "a chart shows hills as contour rings and a fairway as a run of tinted water");
  check(miniature(7, "none", 5) !== miniature(7, "none", 6), "another level, another chart");
}

console.log(bad ? `\n${bad} FAILED` : "\nbridges levels: viaduct and fairway puzzles, the ladder, every level's puzzle, the stars, plain puzzles unchanged, the miniature");
process.exit(bad ? 1 : 0);
