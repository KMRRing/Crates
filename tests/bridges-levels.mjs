// Bridges' levels and twists (bridges-levels.js, and the twists in bridges-engine.js): the ladder of puzzles in chapters, a
// reef that stops a link, a number that is only a bound, two realms each its own network; the solver checked against a plain
// search of every way to build bridges on small boards that have the twists; every level's puzzle (one answer by reasoning,
// its twist really in it, the answer's networks and bridges right); the stars; the miniature the menu draws; and that the
// plain puzzles Bridges made before the twists came are the puzzles their seeds name (today's, links).
import { createHash } from "node:crypto";
import { LEVELS as DIFFICULTIES, TWISTS, layoutOf, count, answerOf, gradeOf, solveAs, generate, randomBoard, rngOf, flagsOf, twistOn, breaks, puzzleOf } from "../bridges-engine.js";
import { CHAPTERS, LEVELS, COUNT, chapterOf, seedOf, levelPuzzle, kindOf, parOf, starsFor, PAR_PER_ISLAND } from "../bridges-levels.js";
import { miniature } from "../bridges-mini.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

/** Every way to build the bridges of a board with the twists, by a plain search that uses nothing of the solver's: the links are found here from the grid. */
function everyAnswer(size, grid, kinds, realms) {
  const isl = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] !== "." && grid[i] !== "#") isl.push({ i, r: Math.floor(i / size), c: i % size, n: +grid[i], kind: kinds[i] || "=", realm: realms[i] || "0" });
  const links = [];
  isl.forEach((a, x) => {
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      let r = a.r + dr, c = a.c + dc, cells = [];
      while (r < size && c < size && grid[r * size + c] === ".") { cells.push(r * size + c); r += dr; c += dc; }
      if (r >= size || c >= size || !cells.length) continue;
      const y = isl.findIndex(b => b.r === r && b.c === c);
      if (y >= 0 && isl[y].realm === a.realm) links.push({ a: x, b: y, cells });
    }
  });
  const out = [], cur = new Array(links.length).fill(0);
  const sum = x => links.reduce((t, l, k) => t + (l.a === x || l.b === x ? cur[k] : 0), 0);
  const ok = () => {
    const taken = new Set();
    for (let k = 0; k < links.length; k++) if (cur[k]) for (const c of links[k].cells) { if (taken.has(c)) return false; taken.add(c); }
    for (let x = 0; x < isl.length; x++) {
      const s = sum(x), a = isl[x];
      if (a.kind === "=" ? s !== a.n : a.kind === "+" ? s < a.n : s > a.n || s < 1) return false;     // "at most" is not none: the network needs a bridge on every island
    }
    for (const realm of ["0", "1"]) {
      const mine = isl.map((a, x) => (a.realm === realm ? x : -1)).filter(x => x >= 0);
      if (!mine.length) continue;
      const seen = new Set([mine[0]]), todo = [mine[0]];
      while (todo.length) { const x = todo.pop(); links.forEach((l, k) => { if (!cur[k]) return; const y = l.a === x ? l.b : l.b === x ? l.a : -1; if (y >= 0 && !seen.has(y)) { seen.add(y); todo.push(y); } }); }
      if (seen.size !== mine.length) return false;
    }
    return true;
  };
  (function go(k) {
    if (k === links.length) { if (ok()) out.push(cur.join("")); return; }
    for (let v = 0; v <= 2; v++) { cur[k] = v; go(k + 1); }
    cur[k] = 0;
  })(0);
  return { out, links };
}

// ---------- the twists, one at a time ----------
{
  const reef = layoutOf(5, "1.#.1" + "....." + "....." + "....." + ".....");
  const open = layoutOf(5, "1...1" + "....." + "....." + "....." + ".....");
  check(reef.links.length === 0 && open.links.length === 1 && open.isl.length === 2, "a reef in the water between two islands stops the link");
  const blocked = layoutOf(5, "1.2.1" + "....." + "....." + "....." + ".....", "", "0" + "." + "1" + "." + "0");
  check(blocked.links.length === 0 && blocked.realmSize[0] === 2 && blocked.realmSize[1] === 1, "an island of the other realm between two stops the link as any island does");
  const apart = layoutOf(5, "1...1" + "....." + "....." + "....." + "1...1", "", "0...1" + "....." + "....." + "....." + "0...1");
  check(apart.links.length === 2 && apart.links.every(l => apart.isl[l.a].realm === apart.isl[l.b].realm), "a link joins two islands of one realm only");
  const rng = layoutOf(5, "2.3.1" + "....." + "....." + "....." + ".....", "+.-.=", "");      // kinds and realms are written cell by cell, like the grid
  check(rng.isl[0].mn === 2 && rng.isl[0].mx === 8 && rng.isl[1].mn === 0 && rng.isl[1].mx === 3 && rng.isl[2].mn === 1 && rng.isl[2].mx === 1, "an island may be exact, at least or at most its number");
  // two islands, "at least 1" and "at most 3" side by side in a row: they can be joined by one bridge or two, so there are two answers
  check(count(layoutOf(5, "1.3.." + "....." + "....." + "....." + ".....", "+.-..", ""), 5) === 2, "a number that is only a bound allows every number within it (an answer for each)");
  check(count(layoutOf(5, "1.3.." + "....." + "....." + "....." + ".....", "", ""), 5) === 0 && count(layoutOf(5, "1.1.." + "....." + "....." + "....." + ".....", "", ""), 5) === 1, "…where an exact number allows only its own");
  // two realms side by side in the same columns: islands of the other colour face each other but are not linked, and each realm is joined on its own
  const two = layoutOf(5, "1.1.." + "....." + "1.1.." + "....." + ".....", "", "0.0.." + "....." + "1.1.." + "....." + ".....");
  check(two.links.length === 2 && two.realmSize[0] === 2 && two.realmSize[1] === 2 && count(two, 3) === 1, "islands of the two realms facing each other are not linked, and each realm is joined of itself");
  const mixed = layoutOf(5, "1.1.." + "....." + "1.1.." + "....." + ".....", "", "");
  check(mixed.links.length === 4 && count(mixed, 3) === 0, "…which one realm could not do (four links, and no bridge pattern makes every island a 1 and all one network)");
  // an island alone in its realm has no one to bridge to, so it can't have the bridge its network asks for
  check(count(layoutOf(5, "1.1.." + "....." + "....." + "....." + ".....", "", "0.1.."), 3) === 0, "an island alone in its realm has no answer");
}

// ---------- the solver, against every way ----------
{
  let cases = 0, withAnswers = 0, many = 0, wrong = [], linkDiffs = 0;
  const rng = rngOf(2718);
  for (let t = 0; t < 360; t++) {
    const size = 5 + (t % 3), flags = { reefs: t % 4 === 1 || t % 4 === 3, ranges: t % 4 === 2 || t % 4 === 3 || t % 7 === 0, realms: t % 5 === 1 || t % 5 === 4 };
    const board = randomBoard(size, rng, 5 + Math.floor(rng() * 5), rng() * 0.8, flags.realms);
    if (!board) continue;
    const chars = [...board.grid], kinds = Array.from(chars, c => (c === "." ? "." : "="));
    if (flags.reefs) for (let i = 0; i < chars.length; i++) if (chars[i] === "." && rng() < 0.12) chars[i] = "#";
    chars.forEach((c, i) => { if (c !== "." && c !== "#") {
      if (flags.ranges && rng() < 0.4) kinds[i] = rng() < 0.5 ? "+" : "-";
      if (t % 3 === 2 && rng() < 0.2) chars[i] = String(Math.max(1, Math.min(8, +c + (rng() < 0.5 ? 1 : -1))));      // a number off by one, usually leaving no answer
    } });
    const g = chars.join(""), k = kinds.join(""), lay = layoutOf(size, g, k, board.realms);
    if (lay.links.length > 12 || lay.isl.length < 3) continue;
    const { out, links } = everyAnswer(size, g, k, board.realms), got = count(lay, 100000);
    // the layout's links are the ones the plain search found, the same pairs
    const pairs = ls => ls.map(l => `${Math.min(l.a, l.b)}:${Math.max(l.a, l.b)}`).sort().join();
    if (pairs(links) !== pairs(lay.links)) linkDiffs++;
    cases++;
    if (out.length) withAnswers++;
    if (out.length > 1) many++;
    if (got !== out.length) wrong.push(`${size}:${g}:${k}:${board.realms} (${got} for ${out.length})`);
  }
  check(linkDiffs === 0, `the links of ${cases} boards with reefs, bounds and realms are the ones found from the grid`);
  check(!wrong.length && cases >= 150, `the solver counts exactly as many answers as a plain search, on ${cases} small boards with the twists (${withAnswers} with an answer, ${many} with several)${wrong.length ? `: ${wrong.slice(0, 3).join("; ")}` : ""}`);
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
  check(first("Harbour charts").twist === "none" && first("Reefs").twist === "reefs" && first("Ranges").twist === "ranges" && first("Two realms").twist === "realms", "each chapter's first level brings its twist");
  const chap = c => LEVELS.slice(CHAPTERS[c].from, CHAPTERS[c + 1]?.from ?? COUNT);
  check(chap(0).every(L => L.twist === "none") && chap(4).every(L => L.twist.includes("+")), "the first chapter is plain and the last puts twists together");
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
      const T = flagsOf(L.twist), lay = layoutOf(p.size, p.grid, p.kinds || "", p.realms || "");
      if (p.size !== L.size || p.sol.length !== lay.links.length) fail(i, seed, "wrong size or answer");
      if (count(lay, 2) !== 1) fail(i, seed, "not one answer");
      if (answerOf(p.size, p.grid, p.kinds || "", p.realms || "") !== p.sol) fail(i, seed, "another answer than its own");
      if (gradeOf(lay) !== ["easy", "medium", "hard"].indexOf(p.level)) fail(i, seed, "graded differently than it says");
      if (T.reefs !== p.grid.includes("#")) fail(i, seed, T.reefs ? "no reefs" : "reefs it shouldn't have");
      if (T.ranges !== /[+-]/.test(p.kinds || "")) fail(i, seed, T.ranges ? "no bounds" : "bounds it shouldn't have");
      if (T.realms !== (lay.realmSize[0] > 0 && lay.realmSize[1] > 0)) fail(i, seed, T.realms ? "one realm only" : "realms it shouldn't have");
      if (T.realms && (lay.realmSize[0] < 3 || lay.realmSize[1] < 3)) fail(i, seed, "a realm too small");
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
          if (cells.has(at)) fail(i, seed, "bridges cross"); cells.add(at);
          if (p.grid[at] === "#") fail(i, seed, "a bridge over a reef");
        }
      });
      const comps = new Set(), par = lay.isl.map((_, k) => k), find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
      lay.links.forEach((l, k) => { if (+p.sol[k]) par[find(l.a)] = find(l.b); });
      lay.isl.forEach((x, k) => comps.add(`${x.realm}:${find(k)}`));
      if (comps.size !== (T.realms ? 2 : 1)) fail(i, seed, "the islands of a realm are not one network");
      if (JSON.stringify(levelPuzzle(i, seed)) !== JSON.stringify(p)) fail(i, seed, "not the same twice");
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
  for (const i of [6, 12, 17, 24]) {
    const p = levelPuzzle(i, seedOf(i)), P = puzzleOf(p.size, p.grid, p.sol, p.kinds || "", p.realms || "");
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
  check(miniature(7, "none", 5) !== miniature(7, "none", 6), "another level, another chart");
}

console.log(bad ? `\n${bad} FAILED` : "\nbridges levels: the twists, the ladder, every level's puzzle, the stars, plain puzzles unchanged, the miniature");
process.exit(bad ? 1 : 0);
