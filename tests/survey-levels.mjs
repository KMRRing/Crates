// Survey's levels (survey-levels.js): the ladder of recipes, the shapes of rock, a block made from a level and a seed, the
// stars, and the miniature the menu draws. The rules themselves are tests/survey.mjs's; this checks what the levels ask of them:
// every level makes a block with one answer, got by reasoning along the rows, that can be chipped clear, for any seed;
// and that the blocks Survey made before levels came are still the blocks their seeds name (today's, and links).
import { createHash } from "node:crypto";
import { READINGS, makePuzzle, newRun, exposed, chip, wasteLeft, score, reasonIn, frameOf, reachable, readingsOf, linesOf } from "../survey-engine.js";
import { SHAPES, shapeOf, CHAPTERS, LEVELS, COUNT, chapterOf, seedOf, levelPuzzle, PAR_PER_CUBE, parOf, starsFor } from "../survey-levels.js";
import { miniature } from "../survey-mini.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const SEEDS = [0, 1, 2, 3].map(k => (k ? 7919 * k + 31 : null));    // the level's own seed first, then three others

// ---------- the shapes ----------
{
  const connected = (present, n) => {
    const there = []; present.forEach((v, i) => { if (v) there.push(i); });
    const seen = new Set([there[0]]), stack = [there[0]];
    while (stack.length) {
      const i = stack.pop(), x = i % n, y = Math.floor(i / n) % n, z = Math.floor(i / (n * n));
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const a = x + dx, b = y + dy, c = z + dz;
        if (a < 0 || b < 0 || c < 0 || a >= n || b >= n || c >= n) continue;
        const j = a + n * (b + n * c);
        if (present[j] && !seen.has(j)) { seen.add(j); stack.push(j); }
      }
    }
    return seen.size === there.length;
  };
  const spans = (present, n, box) => [0, 1, 2].every(a => {
    const at = [];
    present.forEach((v, i) => { if (v) at.push([i % n, Math.floor(i / n) % n, Math.floor(i / (n * n))][a]); });
    return Math.min(...at) === 0 && Math.max(...at) === box[a] - 1;
  });
  const used = [...new Set(LEVELS.map(L => `${L.shape}/${L.n}/${(L.box ?? "").toString()}`))];
  let ok = true, why = "";
  for (const key of used) {
    const [shape, n, boxText] = key.split("/"), box = boxText ? boxText.split(",").map(Number) : [+n, +n, +n], present = shapeOf(shape, +n, boxText ? box : null);
    if (!spans(present, +n, box)) { ok = false; why = `${key} doesn't span its block`; }
    if (!connected(present, +n)) { ok = false; why = `${key} is in pieces`; }
  }
  check(ok, `every shape a level uses spans its block along each axis and is one piece${why ? ` (${why})` : ""}`);
  check(Object.keys(SHAPES).every(s => LEVELS.some(L => L.shape === s)), "every shape is used by some level");
  check([...shapeOf("cube", 4)].every(v => v === 1) && shapeOf("cube", 4).length === 64, "a cube fills its block");
  const box = shapeOf("cube", 5, [4, 4, 5]);
  check(box.reduce((t, v) => t + v, 0) === 80, "a box is the corner of its block, as big as it says");
}

// ---------- the ladder ----------
{
  check(COUNT === LEVELS.length && COUNT >= 20, `${COUNT} levels`);
  check(new Set(LEVELS.map(L => L.name)).size === COUNT && LEVELS.every(L => L.name && L.n >= 3 && L.n <= 7), "each level has a name of its own and a block of three to seven cubes");
  check(LEVELS.every(L => READINGS[L.kind] && L.fog >= 0 && L.fog < 0.5 && L.depth >= 2), "each level reads its rows one of the ways, with a fog under half and a depth to ask for");
  check(CHAPTERS[0].from === 0 && CHAPTERS.every((c, k) => c.name && c.about && (k === 0 || c.from > CHAPTERS[k - 1].from) && c.from < COUNT), "chapters begin at the first level and follow in order");
  check(LEVELS.every((_, i) => chapterOf(i) === CHAPTERS.map((c, k) => (i >= c.from ? k : -1)).filter(k => k >= 0).pop()), "a level's chapter is the last one begun by then");
  check(new Set(LEVELS.map((_, i) => seedOf(i))).size === COUNT, "each level has a seed of its own");
  // a chapter's first level brings what the chapter is about: runs in Runs, fog in Fog, a shape in Cuttings
  const first = c => LEVELS[CHAPTERS.find(x => x.name === c).from];
  check(first("Blind counts").kind === "counts" && first("Runs").kind === "runs" && first("Cuttings").shape !== "cube" && first("Fog").fog > 0, "each chapter's first level brings its idea");
  const sizes = LEVELS.map(L => L.n);
  check(Math.max(...sizes) === 7 && sizes.slice(0, 4).every(n => n <= 5), "the first chapter is small blocks, and the ladder reaches seven cubes");
}

// ---------- a block of every level, for several seeds ----------
let worst = 0, shortOfDepth = 0, total = 0;
{
  let ok = true, why = "";
  const fail = (i, seed, what) => { if (ok) why = `level ${i + 1}, seed ${seed}: ${what}`; ok = false; };
  const t0 = performance.now();
  LEVELS.forEach((L, i) => {
    for (const s of SEEDS) {
      const seed = s ?? seedOf(i), t = performance.now(), p = levelPuzzle(i, seed), took = performance.now() - t;
      worst = Math.max(worst, took); total++;
      const n = L.n, cells = n ** 3, present = p.present, got = reasonIn(frameOf(p), p.clues);
      if (p.level !== i || p.n !== n || p.kind !== L.kind || p.readings !== L.kind || p.seed !== seed) fail(i, seed, "wrong header");
      if (!got?.solved) fail(i, seed, "not solved by reasoning");
      else for (let c = 0; c < cells; c++) if (present[c] && got.st[c] !== p.ore[c]) { fail(i, seed, "reasoning reached another answer"); break; }
      for (let c = 0; c < cells; c++) if (p.ore[c] && !present[c]) { fail(i, seed, "ore outside the rock"); break; }
      if (!reachable(n, p.ore, present)) fail(i, seed, "a waste cube sealed in");
      const there = [...present].reduce((t2, v) => t2 + v, 0), ore = [...p.ore].reduce((t2, v) => t2 + v, 0);
      if (p.waste !== there - ore || p.waste < 1 || wasteLeft(p, newRun()) !== p.waste) fail(i, seed, "waste miscounted");
      if (ore < there * 0.28 || ore > there * 0.6) fail(i, seed, `ore is ${Math.round((100 * ore) / there)}% of the rock`);
      // the readings are the ore's, row by row, except where fog has taken them off
      const truth = readingsOf(n, p.ore, present), rows = linesOf(n).length;
      if (p.clues.length !== rows) fail(i, seed, "a reading short");
      let off = 0, hasRock = 0;
      p.clues.forEach((c, k) => {
        if (truth[k] == null) { if (c != null) fail(i, seed, "a plate on a row with no rock"); return; }
        hasRock++;
        if (c == null) off++; else if (JSON.stringify(c) !== JSON.stringify(truth[k])) fail(i, seed, "a wrong reading");
      });
      if (L.fog === 0 && off) fail(i, seed, "fog where there is none");
      if (L.fog > 0 && (off === 0 || off > Math.round(hasRock * L.fog))) fail(i, seed, `${off} of ${hasRock} rows in fog, for ${L.fog}`);
      if (got.depth < L.depth) shortOfDepth++;
      const again = levelPuzzle(i, seed);
      if (JSON.stringify([...again.ore, ...again.clues.map(c => JSON.stringify(c))]) !== JSON.stringify([...p.ore, ...p.clues.map(c => JSON.stringify(c))])) fail(i, seed, "not the same twice");
    }
  });
  check(ok, `every level makes a block with one answer by reasoning, ore in the rock, none sealed in, readings true, fog as asked, the same twice${why ? ` (${why})` : ""}`);
  check(shortOfDepth <= total * 0.1, `at least the asked reasoning in nearly every block (${total - shortOfDepth} of ${total})`);
  console.log(`     ${total} blocks in ${Math.round(performance.now() - t0)} ms, the slowest ${Math.round(worst)} ms`);
  check(worst < 1500, "no block takes long to make (page start-up)");
}

// ---------- blocks differ by seed; the level's own seed is the same for all ----------
{
  const i = 5, a = levelPuzzle(i, seedOf(i)), b = levelPuzzle(i, seedOf(i) + 1), c = levelPuzzle(i, seedOf(i));
  check(a.ore.join("") !== b.ore.join("") && a.ore.join("") === c.ore.join(""), "another seed is another block of the level; the level's own is always the same one");
}

// ---------- chipping a level clear: every waste cube can be reached, ore stays, the end is settled ----------
{
  let ok = true, why = "";
  LEVELS.forEach((L, i) => {
    const p = levelPuzzle(i, seedOf(i)), run = newRun();
    let guard = 0, stuck = false;
    while (!run.done && guard++ < 2000) {
      let hit = -1;
      for (let c = 0; c < L.n ** 3; c++) if (p.present[c] && !p.ore[c] && !run.gone.includes(c) && exposed(p, run, c)) { hit = c; break; }
      if (hit < 0) { stuck = true; break; }
      if (chip(p, run, hit) !== "chipped") { stuck = true; break; }
    }
    if (stuck || !run.done || run.gone.length !== p.waste || run.strikes) { ok = false; why = `level ${i + 1}`; }
  });
  check(ok, `every level can be chipped clear from the outside in, without a strike${why ? ` (${why})` : ""}`);
}

// ---------- the stars ----------
{
  const p = levelPuzzle(8, seedOf(8)), par = parOf(p);
  check(Number.isInteger(par) && par > 0, "the par is a whole number of seconds");
  check(starsFor(p, par) === 3 && starsFor(p, par + 1) === 2 && starsFor(p, 2 * par) === 2 && starsFor(p, 2 * par + 1) === 1 && starsFor(p, 0) === 3 && starsFor(p, 100000) === 1, "three stars within the par, two within twice it, one for clearing it");
  const pars = LEVELS.map((_, i) => parOf(levelPuzzle(i, seedOf(i))));
  check(pars.every(x => x >= 10 && x <= 900), `every par is between ten seconds and a quarter of an hour (${Math.min(...pars)} to ${Math.max(...pars)} s)`);
  const more = { ...p, waste: p.waste + 10 }, deeper = { ...p, depth: p.depth + 2 };
  check(parOf(more) > par && parOf(deeper) > par && PAR_PER_CUBE > 0, "a block with more waste, or one that asks more thought, has a longer par");
  // a strike (20 s) or a hint (30 s) is in the score, so it is in the stars
  const run = { ...newRun(), ms: (par - 10) * 1000, strikes: 1 };
  check(score(run) === par + 10 && starsFor(p, score(run)) === 2, "a strike's seconds count against the stars");
}

// ---------- blocks from before levels ----------
{
  const GOLD = {
  "1/small/seams": "f3b615f3ef",
  "1/small/counts": "103e1861f7",
  "1/medium/seams": "d891be127a",
  "1/medium/counts": "3c90050feb",
  "1/large/seams": "71d9175870",
  "1/large/counts": "0de85acf60",
  "1/vast/seams": "15b23c3c7d",
  "1/vast/counts": "48b02c9e76",
  "42/small/seams": "2cef191075",
  "42/small/counts": "a363fe5d68",
  "42/medium/seams": "cc80deb11f",
  "42/medium/counts": "c97e189a2d",
  "42/large/seams": "b09b1cb062",
  "42/large/counts": "de938c3baf",
  "42/vast/seams": "fccfd6771a",
  "42/vast/counts": "f16cf20ada",
  "20261101/small/seams": "81525ddb27",
  "20261101/small/counts": "bc42ab1224",
  "20261101/medium/seams": "3f88e18ba1",
  "20261101/medium/counts": "9888bbf422",
  "20261101/large/seams": "e105ad23b5",
  "20261101/large/counts": "33554af88f",
  "20261101/vast/seams": "593820b9a5",
  "20261101/vast/counts": "a009e8e221",
  "987654321/small/seams": "1c4000d759",
  "987654321/small/counts": "cd643f6d69",
  "987654321/medium/seams": "45dfbdb8e9",
  "987654321/medium/counts": "acfcd5d63d",
  "987654321/large/seams": "102051da2e",
  "987654321/large/counts": "bca7dd616d",
  "987654321/vast/seams": "c09a77829d",
  "987654321/vast/counts": "6085197750"
  };
  const h = p => createHash("sha1").update(JSON.stringify([...p.ore]) + JSON.stringify(p.clues.map(c => [c.c, c.g]))).digest("hex").slice(0, 10);
  const wrong = Object.entries(GOLD).filter(([k, v]) => { const [seed, size, rd] = k.split("/"); return h(makePuzzle(+seed, size, rd)) !== v; }).map(([k]) => k);
  check(!wrong.length, `blocks made before levels came are the same blocks (${Object.keys(GOLD).length} seeds, sizes and readings)${wrong.length ? `: ${wrong.join(", ")}` : ""}`);
  let runsOk = true;
  for (const size of ["small", "medium", "large", "vast"]) {
    const p = makePuzzle(20261101, size, "runs"), got = reasonIn(frameOf(p), p.clues);
    if (!got?.solved || p.readings !== "runs" || p.kind !== "runs") runsOk = false;
  }
  check(runsOk, "free play can read its rows as runs, at every size");
}

// ---------- the miniature ----------
{
  const n = 3, cube = shapeOf("cube", n), svg = miniature(cube, n), faces = (svg.match(/<polygon/g) || []).length;
  check(faces === 3 * n * n && /viewBox="[-\d. ]+"/.test(svg) && svg.startsWith("<svg") && svg.includes('class="t"') && svg.includes('class="l"') && svg.includes('class="r"'), "a cube in miniature shows its three faces, a cube to a square on each");
  const arch = miniature(shapeOf("arch", 5), 5), full = miniature(shapeOf("cube", 5), 5);
  check((arch.match(/<polygon/g) || []).length > 0 && arch !== full, "a shaped rock draws as itself");
  const [x, y, w, h2] = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(full).slice(1).map(Number);
  check(w > 0 && h2 > 0 && Number.isFinite(x + y), "its drawing has a size");
}

console.log(bad ? `\n${bad} FAILED` : "\nsurvey levels: every level's block, the shapes, fog and runs, the stars, old blocks unchanged, the miniature");
process.exit(bad ? 1 : 0);
