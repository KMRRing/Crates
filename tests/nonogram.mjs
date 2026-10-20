// Nonogram (nonogram-engine.js, nonogram-pictures.js, nonogram-flags.js, nonogram-bot.js): the clues, the line solver
// against every arrangement, the simple rules never claiming more, the grading ladder, pictures that each make a
// puzzle with one answer reasoning reaches, the same on every device and every day's, the difficulty bands, the split
// (neither half of the clues finishes alone, both together do), the computer player, scoring, names, and a run saved
// and opened again.
import { execFileSync } from "node:child_process";
import { runsOf, cluesOf, linesOf, settle, overlap, pushes, grade, depthOf, countSolutions, propagate, unknownState, solved, fullMask, isKnown, colourOf,
  nextStep, knownFrom, emptyGrid, withCell, cellAt, CROSS, EMPTY, agrees, drawn, wrongCells, lineDone, scoreOf, creditFor, ownerOf,
  MISTAKE, HINT, WRONG_NAME, CREDIT, PROBES } from "../nonogram-engine.js";
import { PICTURES, SIZES, TOPICS, REGIONS, puzzleOf, makePuzzle, pictureOf, dealPicture, dailyPicture, namesOf, poolOf, gridFor, bandOf, rng, DAILY } from "../nonogram-pictures.js";
import { FLAGS, COLOURS, rasterFlag } from "../nonogram-flags.js";
import { PACES, createMind, botMove } from "../nonogram-bot.js";
import { check as typed } from "../typing.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const r = rng(20261020);

// ---------- the clues ----------
check(same(runsOf([0, 1, 1, 0, 1, 0, 0, 1, 1, 1]), [[2, 1], [1, 1], [3, 1]]) && same(runsOf([0, 0]), []), "a line's runs: their lengths in order, none for a blank line");
check(same(runsOf([1, 1, 2, 2, 0, 2]), [[2, 1], [2, 2], [1, 2]]), "in colour two colours touching are two runs, one colour after a gap two more");
{
  const L = linesOf(4, 3);
  check(L.length === 7 && same(L[0], [0, 1, 2, 3]) && same(L[3], [0, 4, 8]) && same(L[6], [3, 7, 11]), "lines are the rows, then the columns");
  check(same(cluesOf(3, 2, [1, 0, 1, 1, 1, 0]), [[[1, 1], [1, 1]], [[2, 1]], [[2, 1]], [[1, 1]], [[1, 1]]]), "a grid's clues, rows first");
}

// ---------- one line: the complete logic is exactly every arrangement; the simple rules never claim more ----------
{
  let wrong = 0, unsound = 0, weaker = 0, nulls = 0, missed = 0;
  for (let t = 0; t < 2500; t++) {
    const n = 1 + Math.floor(r() * 8), colours = 1 + Math.floor(r() * 3), full = fullMask(colours);
    const sol = Array.from({ length: n }, () => (r() < 0.45 ? 0 : 1 + Math.floor(r() * colours)));
    const runs = runsOf(sol);
    const a = Uint8Array.from(sol, c => { const x = r(); return x < 0.3 ? 1 << c : x < 0.5 ? (full & ~(1 << ((c + 1) % (colours + 1)))) | (1 << c) : full; });
    const possible = new Uint8Array(n);
    for (let code = 0; code < (colours + 1) ** n; code++) {
      let x = code; const line = [];
      for (let i = 0; i < n; i++) { line.push(x % (colours + 1)); x = Math.floor(x / (colours + 1)); }
      if (line.every((c, i) => (a[i] >> c) & 1) && same(runsOf(line), runs)) line.forEach((c, i) => { possible[i] |= 1 << c; });
    }
    const s = settle(a, runs), o = overlap(a, runs);
    if (!s || [...s].some((m, i) => m !== possible[i])) wrong++;
    if (!o || [...o].some((m, i) => (m & possible[i]) !== possible[i] || (m & ~a[i]))) unsound++;
    else if ([...o].some((m, i) => m !== possible[i])) weaker++;
    // the same line with a cell forced the wrong way, where that leaves no arrangement: both say so
    const i = Math.floor(r() * n), bad1 = Uint8Array.from(a);
    bad1[i] = full & ~possible[i];
    if (bad1[i]) { const none = !(settle(bad1, runs)); if (none) { nulls++; if (overlap(bad1, runs)) missed++; } }
  }
  check(!wrong, "the complete line logic leaves each cell exactly the colours some arrangement gives it (2,500 random lines, one to three colours, against every arrangement)");
  check(!unsound, `the simple rules never strike off a colour some arrangement needs (and are weaker on ${weaker} of the lines)`);
  check(nulls > 100 && !missed, "a line no arrangement fits is a contradiction to both rules");
  const p = pushes(Uint8Array.from([3, 3, 3, 3, 3]), [[3, 1]]);
  check(same(p, { left: [0], right: [2] }) && same([...overlap(Uint8Array.from([3, 3, 3, 3, 3]), [[3, 1]])], [3, 3, 2, 3, 3]), "a 3 in 5: pushed left it starts at 0, right at 2, and the middle cell is filled either way");
}

// ---------- the ladder: simple rules, the complete line logic, a contradiction ----------
{
  let n1 = 0, n2 = 0, n3 = 0, n4 = 0, wrongLevel = 0, uniqueOff = 0;
  for (let t = 0; t < 400; t++) {
    const w = 5 + Math.floor(r() * 4), h = 5 + Math.floor(r() * 4), fill = 0.35 + 0.3 * r();
    const cells = Array.from({ length: w * h }, () => (r() < fill ? 1 : 0));
    const p = { w, h, colours: 1, clues: cluesOf(w, h, cells) }, g = grade(p);
    const bySimple = solved(Object.assign(unknownState(p), {}).fill(fullMask(1)) && (() => { const st = unknownState(p); propagate(p, st, overlap); return st; })());
    const byLine = (() => { const st = unknownState(p); propagate(p, st, settle); return solved(st); })();
    const count = countSolutions(p).count;
    if (g.level === 1) n1++; else if (g.level === 2) n2++; else if (g.level === 3) n3++; else n4++;
    if ((g.level === 1) !== bySimple || (g.level <= 2) !== byLine || (g.level === 3 && !g.probes)) wrongLevel++;
    if (g.solved && count !== 1) uniqueOff++;
    if (g.solved && !same(Array.from(g.st, colourOf), cells)) uniqueOff++;
  }
  check(!wrongLevel, `the grade is the simplest rule that finishes: level 1 exactly when the simple rules do, 2 when only the complete logic does, 3 with contradictions (of 400 random grids: ${n1}, ${n2}, ${n3}, and ${n4} that need a guess)`);
  check(!uniqueOff && n1 && n2 && n3 && n4, "whatever reasoning finishes has found the one answer: a solved grade is the picture, and it is the only solution");
  const two = { w: 2, h: 2, colours: 1, clues: cluesOf(2, 2, [1, 0, 0, 1]) };
  check(countSolutions(two).count === 2 && grade(two).level === 4, "the two diagonals of a 2 × 2 can't be told apart: two answers, level 4, never dealt");
}

// ---------- the pictures ----------
{
  const topics = Object.keys(TOPICS);
  const count = t => PICTURES.filter(p => p.topic === t).length;
  check(count("countries") === 168 && count("flags") >= 190 && count("lakes") === 34, `the pictures: ${count("countries")} country outlines (Chart's), ${count("flags")} flags, ${count("lakes")} lakes`);
  check(PICTURES.every(p => p.about && p.name && p.regions.length && REGIONS.some(([id]) => p.regions.includes(id))), "every picture names its knowledge-base entity and a region");
  check(new Set(PICTURES.map(p => p.id)).size === PICTURES.length && PICTURES.every(p => pictureOf(p.id) === p), "every picture's id is its own");
  check(Object.keys(FLAGS).every(id => PICTURES.some(p => p.id === `f-${id}`)), "every flag drawn is a country the flags bank knows");
  const letters = new Set(Object.values(FLAGS).flatMap(f => rasterFlag(f, 15, 10).letters));
  check([...letters].every(c => c === "_" || COLOURS[c]), "every flag paints in the palette's colours");
  check(same(gridFor(1, "medium"), { w: 15, h: 15 }) && gridFor(1.5, "small").w > gridFor(1.5, "small").h && gridFor(0.17, "medium") === null, "the grid takes the picture's shape at about the size's cells; one too thin for it (Chile) has none");
}

// ---------- every picture makes a puzzle with one answer that reasoning reaches ----------
{
  const t0 = performance.now(), problems = [], made = {};
  const sample = PICTURES.flatMap((p, i) => Object.keys(SIZES).filter((s, k) => (i + k) % [1, 2, 4][k] === 0).map(s => [p, s]));
  for (const [p, size] of sample) {
    const z = puzzleOf(p.id, size);
    made[`${p.topic}:${size}`] = (made[`${p.topic}:${size}`] || 0) + (z ? 1 : 0);
    if (!z) continue;
    const q = { w: z.w, h: z.h, colours: z.colours, clues: z.clues };
    const n = countSolutions(q, { maxNodes: 50000 }), g = grade(q);
    if (n.count !== 1 || n.gaveUp || !g.solved || !same(Array.from(g.st, colourOf), z.answer) || !same(cluesOf(z.w, z.h, z.answer), z.clues)) problems.push(`${p.id}@${size}`);
    if (g.level !== z.level || z.band !== bandOf(z.level, z.depth) || (z.level === 3 && z.probes > PROBES)) problems.push(`${p.id}@${size} grade`);
    if (Math.min(z.w, z.h) < SIZES[size].short || Math.max(z.w, z.h) > SIZES[size].long) problems.push(`${p.id}@${size} size`);
  }
  check(!problems.length, `${sample.length} puzzles (every picture at Small, half at Medium, a quarter at Large) each have exactly one answer, the one drawn, reached by reasoning within ${PROBES} contradictions${problems.length ? `: not ${problems.slice(0, 6).join(", ")}` : ""} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  check(made["countries:small"] >= 160 && made["flags:small"] >= 185 && made["lakes:small"] >= 25, `nearly every picture makes a puzzle at Small (countries ${made["countries:small"]}, flags ${made["flags:small"]}, lakes ${made["lakes:small"]})`);
  const a = makePuzzle("c-italy", "medium"), b = makePuzzle("c-italy", "medium"), f1 = makePuzzle("f-south-africa", "large"), f2 = makePuzzle("f-south-africa", "large");
  check(same(a.answer, b.answer) && same(a.clues, b.clues) && same(f1.answer, f2.answer) && same(f1.palette, f2.palette), "a picture always makes the same puzzle at a size (made twice afresh)");
  check(f1.colours >= 4 && f1.palette.length === f1.colours + 1 && f1.palette.every(c => !c || /^#[0-9A-F]{6}$/i.test(c)), "a flag is a colour puzzle: its colours, and the blank's for the finished flag");
  const nepal = makePuzzle("f-nepal", "medium");
  check(nepal && nepal.palette[0] === null, "Nepal's pennants stand on no flag at all: its blank has no colour");
}

// ---------- difficulty ----------
{
  check(bandOf(1, 4) === "easy" && bandOf(1, 8) === "medium" && bandOf(2, 3) === "medium" && bandOf(1, 12) === "hard" && bandOf(3, 1) === "hard", "Easy is the simple rules in six rounds or fewer; Medium seven to ten, or the complete logic; Hard eleven or more, or a contradiction");
  const bands = { easy: 0, medium: 0, hard: 0 };
  for (const p of poolOf("countries", "world")) { const z = puzzleOf(p.id, "medium"); if (z) bands[z.band]++; }
  check(bands.easy >= 30 && bands.medium >= 60 && bands.hard >= 20, `every band has pictures enough at Medium (countries: ${bands.easy} easy, ${bands.medium} medium, ${bands.hard} hard)`);
  const flat = { w: 5, h: 5, colours: 1, clues: cluesOf(5, 5, Array(25).fill(1)) };
  check(depthOf(flat).depth === 1 && depthOf(flat).first === 1, "a full grid is shallow: the first round of reasoning settles it all");
  const hard = dealPicture({ topic: "countries", region: "europe", size: "large", band: "hard", rand: rng(3) }), z = puzzleOf(hard.id, "large");
  check(!hard.nearest && z.band === "hard", "a hard picture is dealt when one is asked for");
  const none = dealPicture({ topic: "lakes", region: "oceania", size: "small", band: "easy", rand: rng(4) });
  check(!none || none.nearest || puzzleOf(none.id, "small").band === "easy", "where a region has nothing of a band, the nearest is dealt and says so");
}

// ---------- dealing and the daily ----------
{
  const seen = poolOf("flags", "europe").slice(0, 20).map(p => p.id);
  const got = dealPicture({ topic: "flags", region: "europe", size: "small", seen, rand: rng(9) });
  check(got && !seen.includes(got.id) && pictureOf(got.id).regions.includes("europe"), "a picture not dealt lately comes first, from the region asked");
  const due = poolOf("countries", "asia").at(-1).id;
  check(dealPicture({ topic: "countries", region: "asia", size: "medium", prefer: [due], rand: rng(1) }).id === due, "learning mode's picks (due again, weak elsewhere) come before the rest");
  const days = [20261020, 20261021, 20261022, 20261101, 20270101];
  const here = days.map(d => { const id = dailyPicture(d), z = puzzleOf(id, DAILY.size); return `${id}:${z.answer.join("")}`; });
  check(here.every(x => x.startsWith("c-")) && new Set(here).size === days.length, "every day has its own picture, a country's outline");
  const there = execFileSync(process.execPath, ["--input-type=module", "-e", `import { dailyPicture, puzzleOf } from "./nonogram-pictures.js"; console.log(JSON.stringify(${JSON.stringify(days)}.map(d => { const id = dailyPicture(d); return id + ":" + puzzleOf(id, "medium").answer.join(""); })));`],
    { cwd: new URL("..", import.meta.url).pathname, encoding: "utf8" });
  check(same(JSON.parse(there), here), "a day's picture and puzzle come out the same on another device (made afresh in another process)");
  const monthOk = [...Array(31).keys()].every(k => { const id = dailyPicture(20261101 + (k < 30 ? k : 0)); const z = id && puzzleOf(id, "medium"); return z && z.band === "medium"; });
  check(monthOk, "every day of a month has a medium country to draw");
}

// ---------- the split: neither half of the clues finishes alone ----------
{
  check(ownerOf(0, 10, [3]) === 3 && ownerOf(12, 10, [3]) === 3, "alone at the table, every line is yours");
  check(ownerOf(4, 10, [1, 0]) === 0 && ownerOf(10, 10, [1, 0]) === 1, "two at the table: the rows to the first seat, the columns to the second");
  const three = [...Array(25).keys()].map(k => ownerOf(k, 12, [0, 2, 5]));
  check([0, 2, 5].every(s => three.slice(0, 12).includes(s) && three.slice(12).includes(s)), "three or more: every seat has rows and columns to read");
  let both = 0, alone = 0, tried = 0;
  for (const p of poolOf("countries", "world").filter((_, i) => i % 9 === 0)) {
    const z = puzzleOf(p.id, "medium");
    if (!z) continue;
    tried++;
    const rows = k => k < z.h, cols = k => k >= z.h;
    const st1 = unknownState(z); propagate(z, st1, settle, null, rows);
    const st2 = unknownState(z); propagate(z, st2, settle, null, cols);
    if (solved(st1) || solved(st2)) alone++;
    // two players taking turns, each reasoning along their own lines only, on one grid
    let grid = emptyGrid(z);
    const minds = [createMind(z, rows), createMind(z, cols)];
    for (let turn = 0, idle = 0; turn < 5000 && idle < 2; turn++) {
      const mv = botMove(minds[turn % 2], grid, PACES.hard, () => 0.5);
      if (!mv) { idle++; continue; }
      idle = 0;
      for (const [i, c] of mv.cells) grid = withCell(grid, i, c || CROSS);
    }
    if (drawn(grid, z.answer) === 1) both++;
  }
  check(tried >= 15 && !alone, `the rows' clues alone never finish a picture, nor the columns' (${tried} countries)`);
  check(both === tried, "two players each reasoning along their own half, on one grid, finish every one");
}

// ---------- the computer player ----------
{
  const z = puzzleOf("c-italy", "medium"), mind = createMind(z);
  let grid = emptyGrid(z), think = 0, moves = 0;
  for (let mv; (mv = botMove(mind, grid, PACES.medium, () => 0.5)); moves++) { think += mv.think + mv.each.reduce((a, b) => a + b, 0); for (const [i, c] of mv.cells) grid = withCell(grid, i, c || CROSS); }
  check(drawn(grid, z.answer) === 1 && !wrongCells(grid, z.answer).length, `the computer solves a picture on its own, never a cell wrong (Italy, ${moves} steps)`);
  check(think > 60000 && think < 15 * 60000, `paced like a person: about ${Math.round(think / 60000)} minutes for a medium Italy at Medium pace`);
  const fast = createMind(z), slow = createMind(z);
  const t = (m, pace) => { let g = emptyGrid(z), ms = 0; for (let mv; (mv = botMove(m, g, pace, () => 0.5));) { ms += mv.think + mv.each.reduce((a, b) => a + b, 0); for (const [i, c] of mv.cells) g = withCell(g, i, c || CROSS); } return ms; };
  check(t(fast, PACES.hard) < t(slow, PACES.easy) / 2, "Hard is more than twice as quick as Easy");
  const cols = createMind(z, k => k >= z.h);
  let g2 = emptyGrid(z);
  for (let mv; (mv = botMove(cols, g2, PACES.medium, () => 0.5));) for (const [i, c] of mv.cells) g2 = withCell(g2, i, c || CROSS);
  check(drawn(g2, z.answer) < 1 && !wrongCells(g2, z.answer).length, "as a partner with the columns only, it does what they allow and then waits on you");
}

// ---------- hints, checking, scoring ----------
{
  const z = puzzleOf("f-france", "small");
  let grid = emptyGrid(z);
  const step = nextStep(z, knownFrom(z, grid));
  check(step && step.rule === "simple" && step.cells.length > 0 && step.cells.every(([i, c]) => z.answer[i] === c), "a hint is the simplest step there is, and right");
  const blank = z.answer.findIndex(c => c === 0), filled = z.answer.findIndex(c => c > 0);
  grid = withCell(withCell(grid, blank, 1), filled, CROSS);
  check(same(wrongCells(grid, z.answer), [blank, filled].sort((a, b) => a - b)) && !isKnown(knownFrom(z, grid, z.answer)[blank]), "cells against the answer are found, and a hint never builds on them");
  let done = emptyGrid(z);
  z.answer.forEach((c, i) => { if (c) done = withCell(done, i, c); });
  check(agrees(z, done) && drawn(done, z.answer) === 1 && lineDone(z, done, 0), "a grid drawn as the picture agrees with every clue");
  check(cellAt(withCell(emptyGrid(z), 3, CROSS), 3) === CROSS && cellAt(withCell(emptyGrid(z), 3, 2), 3) === 2 && cellAt(emptyGrid(z), 3) === EMPTY, "a cell keeps what it's given: blank, crossed out, a colour");
  check(scoreOf({ ms: 125400, mistakes: 2, hints: 1 }) === 125 + 2 * MISTAKE + HINT, "the score: seconds, plus 20 a mistake and 30 a hint");
  check(scoreOf({ ms: 100000, name: { early: true, right: true, credit: 40 } }) === 60 && scoreOf({ ms: 100000, name: { early: true, right: false } }) === 100 + WRONG_NAME && scoreOf({ ms: 100000, name: { early: false, right: false } }) === 100,
    "named early and right takes its credit off; early and wrong adds 30 s; named at the end changes nothing");
  check(creditFor("medium", 0.5) === CREDIT.medium / 2 && creditFor("large", 1) === CREDIT.large && creditFor("small", 0) === 0, "the credit is the size's, times how much was still to draw");
}

// ---------- names ----------
{
  const name = (id, t) => typed(t, namesOf(pictureOf(id))).right;
  check(name("c-czech-republic", "Czechia") && name("c-uk", "UK") && name("f-ivory-coast", "Ivory Coast") && name("c-myanmar", "Burma"), "a place answers to what else it goes by (Czechia, the UK, Ivory Coast, Burma)");
  check(name("l-lake-geneva", "Léman") && name("l-lake-baikal", "baikal") && name("l-dead-sea", "dead sea"), "a lake answers without its Lake and its the, and Lake Geneva to Léman");
  check(name("f-chad", "Romania") && name("f-romania", "Chad") && !name("c-chad", "Romania"), "flags no one could tell apart answer to either name; their outlines don't");
  check(name("c-france", "frnace") && !name("c-france", "Germany"), "a slip of a letter is forgiven, another country isn't");
}

// ---------- a run saved and opened again ----------
{
  const z = puzzleOf("c-japan", "small");
  let grid = emptyGrid(z);
  for (let i = 0; i < z.answer.length; i += 3) if (z.answer[i]) grid = withCell(grid, i, z.answer[i]);
  const run = { v: 1, id: "c-japan", size: "small", mode: "random", play: "solo", grid, undo: [[[3, 0, 1]]], redo: [], ms: 41200, mistakes: 1, hints: 0, name: null, done: false, rules: { mistakes: "shown", nameIt: true, computer: "off", pace: "medium" }, rival: null };
  const back = JSON.parse(JSON.stringify(run)), again = makePuzzle(back.id, back.size);
  check(same(back, run) && drawn(back.grid, again.answer) === drawn(run.grid, z.answer) && same(again.clues, z.clues), "a run kept as JSON opens again as it was, its puzzle made from the picture's id and size");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("nonogram: clues, the line logic against every arrangement, the ladder, puzzles with one answer, the daily on every device, bands, the split, the computer, hints, scores, names, saving");
