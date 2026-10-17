// Rosette's rules (rosette-engine.js): the deal from a seed, the shapes, a cut's repeats (a lobe apart round the dial,
// past twelve o'clock, skipped over metal already cut, the first having to fit), where a cut fits, the bands finished
// (rings and spokes, in one pattern or not, crossing), a cut made (repeats engraved, bands faced off, the points, the
// hand, the game cut from left as it was), the cuts growing as the game goes on, the worn cutter's nicks, the end with
// nowhere to go, a game saved and opened again, and whole games played out to their end.
import { RINGS, SECTORS, HAND, PATTERNS, PATTERN_NAMES, SHAPES, LOBES, PACE, NICKS, maxCells, nicksFor, lobesFor, newGame, cellAt, echo, places, fitsAnywhere, bands, counted, worth, cut, moves, engraved } from "../rosette-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
/** A dial drawn by hand: a row of twelve characters a ring, from the centre out, "." bare, "0"–"3" a pattern. */
const dial = rows => { const c = new Array(RINGS * SECTORS).fill(-1); rows.forEach((r, ring) => [...r].forEach((ch, k) => { if (ch !== ".") c[cellAt(ring, k)] = Number(ch); })); return c; };
const ring = (c, r) => [...Array(SECTORS).keys()].map(k => (c[cellAt(r, k)] < 0 ? "." : c[cellAt(r, k)])).join("");
const game = (rows, hand, extra = {}) => Object.assign(newGame(1), { cells: dial(rows), hand }, extra);
const shapeOf = rows => Object.keys(SHAPES).find(k => { const want = JSON.stringify(rows.flatMap((r, i) => [...r].flatMap((ch, j) => (ch === "#" ? [[i, j]] : [])))); return JSON.stringify(SHAPES[k].cells) === want; });
const DOT = shapeOf(["#"]), ARC2 = shapeOf(["##"]), ARC3 = shapeOf(["###"]), RAY2 = shapeOf(["#", "#"]), BLOCK = shapeOf(["##", "##"]);

// ---------- the deal, the shapes ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.hand) !== JSON.stringify(c.hand), "the same seed deals the same cuts, another seed others");
  check(a.hand.length === HAND && a.cells.every(x => x < 0) && a.sets === 1 && PATTERN_NAMES.length === PATTERNS, "a bare dial and three cuts");
  let ok = true;
  for (let seed = 0; seed < 200; seed++) for (const h of newGame(seed).hand) {
    const s = SHAPES[h.shape];
    if (!lobesFor(h.shape, 0).some(([k]) => k === h.lobes) || s.cells.length * h.lobes > maxCells(0) || !(h.pattern >= 0 && h.pattern < PATTERNS)) ok = false;
  }
  check(ok, `every cut dealt comes with a rosette its shape allows, ${maxCells(0)} cells at most in the first hands, in one of ${PATTERNS} patterns`);
  const joined = Object.values(SHAPES).every(({ cells }) => {
    const seen = new Set([0]), q = [0];
    while (q.length) { const [r, k] = cells[q.pop()]; cells.forEach(([r2, k2], j) => { if (!seen.has(j) && Math.abs(r - r2) + Math.abs(k - k2) === 1) { seen.add(j); q.push(j); } }); }
    return seen.size === cells.length;
  });
  check(joined && new Set(Object.values(SHAPES).map(s => JSON.stringify(s.cells))).size === Object.keys(SHAPES).length && DOT && ARC2 && ARC3 && RAY2 && BLOCK, "every shape is joined along its sides, and none comes twice");
  check(Object.keys(SHAPES).every(k => lobesFor(k, Infinity).every(([l]) => SHAPES[k].sectors <= SECTORS / l && SHAPES[k].cells.length * l <= SECTORS)) && lobesFor(DOT, Infinity).length === LOBES.length && !lobesFor(BLOCK, Infinity).some(([l]) => l > 3),
    "a rosette never makes a cut's repeats overlap, nor engrave more than a ring's worth (a dot takes any, a 2×2 three lobes at most)");
}

// ---------- a cut's repeats ----------
{
  const four = { shape: DOT, pattern: 1, lobes: 4 }, bare = dial([]);
  const e = echo(bare, four, 2, 1);
  check(e.length === 4 && e.every(c => c.cut) && e.map(c => c.cells[0]).join() === [1, 4, 7, 10].map(k => cellAt(2, k)).join(), "four lobes: four copies a quarter turn apart, round from the first");
  const wrap = echo(bare, { shape: ARC2, pattern: 0, lobes: 2 }, 0, 11);
  check(wrap[0].cells.join() === [cellAt(0, 11), cellAt(0, 0)].join() && wrap[1].cells.join() === [cellAt(0, 5), cellAt(0, 6)].join(), "a cut runs on past twelve o'clock, and its repeat with it");
  const crossed = echo(dial(["....0......."]), four, 0, 1);
  check(crossed[0].cut && !crossed[1].cut && crossed[2].cut && crossed[3].cut, "a repeat that would cross metal already cut is skipped, the others cut");
  const part = echo(dial(["....0......."]), { shape: ARC2, pattern: 2, lobes: 3 }, 0, 0);
  check(part && part[1].cells.includes(cellAt(0, 4)) && !part[1].cut, "a repeat is skipped whole when any of its cells is cut already");
  check(echo(dial([".0.........."]), four, 0, 1) === null && echo(bare, { shape: RAY2, pattern: 0, lobes: 1 }, RINGS - 1, 0) === null, "the first copy has to fit, on bare metal and on the dial");
  check(places(bare, four).length === RINGS * SECTORS && places(bare, { shape: RAY2, pattern: 0, lobes: 2 }).length === (RINGS - 1) * SECTORS && fitsAnywhere(bare, four), "on a bare dial a cut fits everywhere its shape does");
  const full = dial(Array(RINGS).fill("0".repeat(SECTORS)).map((r, i) => (i === 3 ? "0000.0000000" : r)));
  check(places(full, four).join() === "3,4" && !fitsAnywhere(full, { shape: ARC2, pattern: 0, lobes: 1 }), "and only where its first copy finds bare metal");
}

// ---------- bands ----------
{
  const r = bands(dial(["", "012301230123"]));
  check(r.length === 1 && r[0].ring === 1 && !r[0].true && r[0].cells.length === SECTORS, "a ring cut all round is finished");
  const sp = bands(dial(["2", "2", "2", "2", "2"]));
  check(sp.length === 1 && sp[0].spoke === 0 && sp[0].true && sp[0].cells.length === RINGS, "a spoke cut from the centre to the rim too, and all in one pattern it's a true band");
  const both = bands(dial(["3", "333333333333", "3", "3", "1"]));
  check(both.length === 2 && counted(both) === SECTORS + RINGS - 1 + SECTORS, "a ring and a spoke crossing: their cells counted once, the true ring's twice, the spoke in two patterns not");
  check(bands(dial(["00000000000."])).length === 0 && worth(12) === 1440 && worth(24) === 5760, "eleven of twelve is nothing; ten times the square of what a cut finishes");
}

// ---------- a cut ----------
{
  const s = game(["0.00.00.00.0"], [{ shape: DOT, pattern: 0, lobes: 4 }, { shape: ARC2, pattern: 2, lobes: 1 }, { shape: DOT, pattern: 3, lobes: 1 }]);
  const r = cut(s, 0, 0, 1);
  check(r.copies.length === 4 && r.copies.every(c => c.cut) && r.bands.length === 1 && r.bands[0].true && r.gain === worth(24), "four dots finish a ring all in one pattern: a true band, its twelve cells counted twice, 5,760");
  check(ring(r.state.cells, 0) === "............" && r.state.score === 5760 && r.state.finished === 12 && r.state.bands === 1 && r.state.cuts === 1, "the ring is faced off, bare again, and the game counts it");
  check(r.state.hand[0] === null && !r.dealt && s.hand[0] && ring(s.cells, 0) === "0.00.00.00.0", "the cut leaves the hand; the game cut from is left as it was");
  const mixed = cut(game(["1.00.00.00.0"], s.hand), 0, 0, 1);
  check(mixed.gain === worth(12) && !mixed.bands[0].true, "in two patterns the ring scores 1,440");
  const skip = cut(game(["0....0......"], s.hand), 0, 2, 2);
  check(skip.copies.every(c => c.cut) && engraved(skip.state) === 6, "repeats engrave where they land");
  let t = game([], [{ shape: DOT, pattern: 0, lobes: 1 }, { shape: DOT, pattern: 0, lobes: 1 }, { shape: DOT, pattern: 0, lobes: 1 }]);
  t = cut(t, 0, 0, 0).state;
  t = cut(t, 2, 0, 1).state;
  const last = cut(t, 1, 0, 2);
  check(last.dealt && last.state.hand.every(h => h) && last.state.sets === 2, "once all three are in, three more come");
  let threw = 0;
  try { cut(t, 0, 0, 3); } catch { threw++; }
  try { cut(game(["0"], s.hand), 1, 0, 0); } catch { threw++; }
  try { cut(Object.assign(structuredClone(s), { over: true }), 0, 0, 1); } catch { threw++; }
  check(threw === 3, "a cut has to be in hand, fit, and the game not be over");
  check(moves(s).every(m => echo(s.cells, s.hand[m.slot], m.ring, m.sector)) && moves(s).length === s.hand.reduce((a, h) => a + places(s.cells, h).length, 0), "every cut there is, listed");
}

// ---------- the cuts grow ----------
{
  check(PACE.every(([, c], k) => !k || c >= PACE[k - 1][1]) && maxCells(0) < maxCells(1000) && maxCells(1000) === SECTORS, "the cuts grow as the hands go by, to a ring's worth");
  let late = 0;
  const dots = () => Array.from({ length: HAND }, () => ({ shape: DOT, pattern: 0, lobes: 1 }));
  for (let seed = 0; seed < 100; seed++) {
    let g = Object.assign(newGame(seed), { sets: 1000, hand: dots() });
    for (let k = 0; k < HAND; k++) g = cut(g, k, 0, k).state;
    late = Math.max(late, ...g.hand.map(h => SHAPES[h.shape].cells.length * h.lobes));
  }
  check(late > maxCells(0), `late in a game a cut engraves up to ${late} cells`);
}

// ---------- the worn cutter ----------
{
  check(nicksFor(29) === 0 && nicksFor(30) === 1 && nicksFor(59) === 1 && nicksFor(60) === 2 && nicksFor(99) === 2 && nicksFor(100) === 3 && nicksFor(1e4) === 3 && NICKS.length === 3, "the cutter is worn from the 30th hand: a nick a hand, two from the 60th, three from the 100th");
  // two rings a cell short of finished (ring 0 at eleven o'clock, ring 1 at five), the rest bare; three dots in hand
  const rows = ["00000000000.", "00000.000000"], short = [cellAt(0, 11), cellAt(1, 5)];
  const dots = () => Array.from({ length: HAND }, () => ({ shape: DOT, pattern: 1, lobes: 1 }));
  /** The hand's last dot cut, at ring 4, with `sets` hands dealt before the next. */
  const last = (sets, seed = 1) => {
    let g = game(rows, dots(), { seed, sets });
    g = cut(g, 0, 4, 0).state;
    g = cut(g, 1, 4, 4).state;
    return { g, r: cut(g, 2, 4, 8) };
  };
  const mid = cut(game(rows, dots(), { sets: 99 }), 0, 4, 0);
  check(!mid.dealt && mid.nicked.length === 0 && last(28).r.nicked.length === 0, "no nick while a hand is still in play, nor before the 30th hand");
  check(last(29).r.nicked.length === 1 && last(59).r.nicked.length === 2 && last(99).r.nicked.length === 3, "the 30th hand comes with a nick, the 60th with two, the 100th with three");
  let fair = true, finished = false;
  const where = new Set(), patterns = new Set();
  for (let seed = 0; seed < 200; seed++) {
    const { g, r } = last(99, seed), was = g.cells.slice();
    was[cellAt(4, 8)] = 1;
    finished ||= r.nicked.some(i => short.includes(i)) || bands(r.state.cells).length > 0;
    fair &&= r.nicked.length === 3 && new Set(r.nicked).size === 3 && r.state.cells.every((p, i) => (r.nicked.includes(i) ? was[i] < 0 && p >= 0 && p < PATTERNS : p === was[i]));
    for (const i of r.nicked) { where.add(i); patterns.add(r.state.cells[i]); }
  }
  check(fair, "a nick lands on bare metal, in a pattern, and touches nothing else");
  check(!finished, "and never where it would finish a band");
  check(where.size > 30 && patterns.size === PATTERNS, `nicks fall all over the dial (${where.size} of the 33 cells that finish nothing), in every pattern`);
  // every bare cell the last of its spoke: a nick anywhere would finish one, so there's none
  const spoky = Array.from({ length: RINGS }, (_, r) => [...Array(SECTORS).keys()].map(k => (k % RINGS === r || (r === 0 && k === 1) ? "." : "0")).join(""));
  const none = cut(game(spoky, [null, null, { shape: DOT, pattern: 2, lobes: 1 }], { sets: 99 }), 2, 0, 1);
  check(none.dealt && none.bands.length === 0 && none.nicked.length === 0 && bands(none.state.cells).length === 0, "with every bare cell finishing a band, the cutter nicks nothing");
  const { g } = last(99, 5), again = JSON.parse(JSON.stringify(g));
  check(JSON.stringify(cut(g, 2, 4, 8)) === JSON.stringify(cut(again, 2, 4, 8)), "the nicks come from the game's seed: a game opened again is nicked as it would have been");
}

// ---------- the end ----------
{
  // bare like a chessboard's dark squares: no two bare cells together round a ring or along a spoke, no band finished
  const rows = Array.from({ length: RINGS }, (_, r) => [...Array(SECTORS).keys()].map(k => ((r + k) % 2 ? "0" : ".")).join(""));
  const s = game(rows, [{ shape: DOT, pattern: 1, lobes: 1 }, { shape: ARC2, pattern: 1, lobes: 1 }, { shape: RAY2, pattern: 1, lobes: 2 }]);
  check(!s.over && bands(s.cells).length === 0 && fitsAnywhere(s.cells, s.hand[0]) && !fitsAnywhere(s.cells, s.hand[1]) && !fitsAnywhere(s.cells, s.hand[2]), "(a dial with only single cells bare)");
  const r = cut(s, 0, 2, 0);
  check(r.over && r.state.over && r.gain === 0, "the dot cut, nothing in hand fits: the game is over");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 9 && !s.over; k++) { const m = moves(s)[(k * 7) % moves(s).length]; s = cut(s, m.slot, m.ring, m.sector).state; }
  const again = JSON.parse(JSON.stringify(s)), m = moves(s)[3];
  check(JSON.stringify(cut(s, m.slot, m.ring, m.sector)) === JSON.stringify(cut(again, m.slot, m.ring, m.sector)), "a game saved and opened again goes on as it would have");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  let z = 3;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const random = [], greedy = [];
  for (let g = 0; g < 12; g++) {
    let s = newGame(100 + g);
    while (!s.over && s.cuts < 3000) { const all = moves(s), m = all[Math.floor(rnd() * all.length)]; s = cut(s, m.slot, m.ring, m.sector).state; }
    random.push(s.cuts);
    let t = newGame(100 + g);
    while (!t.over && t.cuts < 3000) {
      let best = null, bv = -Infinity;
      for (const m of moves(t)) { const o = cut(t, m.slot, m.ring, m.sector), v = o.gain - 10 * engraved(o.state) - (o.over ? 1e6 : 0) + rnd(); if (v > bv) { bv = v; best = o; } }
      t = best.state;
    }
    greedy.push(t.cuts);
  }
  check(median(random) < 60, `cutting anywhere: nowhere to go in about ${median(random)} cuts`);
  check(median(greedy) > 1.5 * median(random) && Math.max(...greedy) < 3000, `cutting to finish bands: about ${median(greedy)} cuts, and the growing cuts still end it`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("rosette: the deal, the shapes, repeats, bands, a cut, the growing cuts, the worn cutter, the end, saving, whole games");
