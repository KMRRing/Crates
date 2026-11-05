// Dujiang's twists (nurikabe-engine.js): numbers that are only a bound ("5+", "≤4"), islands with no number ("?") and arch
// bridges. The solver is checked against a plain search of every filling of 4×4 boards, as the plain game's is; the
// generator makes one answer for each twist and board (found by a search that guesses); and the plain game's puzzles are the
// ones they always were, seed for seed (old seeds, daily links and saves depend on it).
import crypto from "node:crypto";
import { generate, puzzleOf, count, answerOf, hintFor, breaks, solvedBy, withMark, NONE, labelOf, twistOn, twistsOf, bridgeArms, solveAs } from "../nurikabe-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const seedRng = seed => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
const rows = (s, w) => s.replace(new RegExp(`(.{${w}})`, "g"), "$1 ").trim();

// ---------- the plain game is untouched ----------
{
  const GOLD = { "1,6,easy": "4294a4a8c0", "2,6,medium": "d1c3283cff", "3,6,hard": "14c9e9a393", "424242,8,medium": "53a7cac3e5", "20261031,8,medium": "f02e4846fb" };
  let same = 0;
  for (const [k, hash] of Object.entries(GOLD)) {
    const [seed, size, level] = k.split(",");
    if (crypto.createHash("md5").update(JSON.stringify(generate(+seed, +size, level))).digest("hex").slice(0, 10) === hash) same++;
  }
  check(same === Object.keys(GOLD).length, `the plain game makes the puzzles it always made, seed for seed (${same} of ${Object.keys(GOLD).length})`);
  check(twistOn("bridges+ranges") === "ranges+bridges" && twistOn("nonsense") === "none" && twistsOf("none") === null, "twist names are made canonical, an unknown one is the plain game");
}

// ---------- the rules, from the page's words alone (a filling is an answer or not) ----------
/** Whether a filling (1 sea, 2 island) is an answer to a puzzle of numbers, bounds and bridges, by the Rules sheet and nothing of the solver's. */
function meets(N, spec, fill) {
  const { clue, bound, bridge, total } = spec, at = (r, c) => r * N + c;
  const around = x => { const r = Math.floor(x / N), c = x % N, out = []; if (r) out.push(x - N); if (r < N - 1) out.push(x + N); if (c) out.push(x - 1); if (c < N - 1) out.push(x + 1); return out; };
  const stone = x => clue[x] > 0 || bound[x] === "?";
  let land = 0;
  for (let x = 0; x < N * N; x++) {
    if (fill[x] === 2) land++;
    if ((stone(x) || bridge[x] !== "-") && fill[x] !== 2) return false;
    if (bridge[x] !== "-") {                                  // ends island, the water's two sides sea
      const r = Math.floor(x / N), c = x % N, h = bridge[x] === "h";
      const ends = h ? [at(r, c - 1), at(r, c + 1)] : [at(r - 1, c), at(r + 1, c)], sides = h ? [at(r - 1, c), at(r + 1, c)] : [at(r, c - 1), at(r, c + 1)];
      if (r < 1 || c < 1 || r > N - 2 || c > N - 2) return false;
      if (ends.some(e => fill[e] !== 2) || sides.some(e => fill[e] !== 1)) return false;
    }
  }
  if (total != null && land !== total) return false;
  const wet = x => fill[x] === 1 || bridge[x] !== "-";
  for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) if ([at(r, c), at(r, c + 1), at(r + 1, c), at(r + 1, c + 1)].every(wet)) return false;
  const seen = new Uint8Array(N * N);
  let waters = 0;
  for (let x = 0; x < N * N; x++) {                           // islands: pieces of island cells
    if (seen[x] || fill[x] !== 2) continue;
    const piece = [x], todo = [x];
    seen[x] = 1;
    while (todo.length) for (const y of around(todo.pop())) if (!seen[y] && fill[y] === 2) { seen[y] = 1; todo.push(y); piece.push(y); }
    const stones = piece.filter(stone);
    if (stones.length !== 1) return false;
    const s = stones[0], n = clue[s], b = bound[s];
    if (b === "-" && piece.length !== n) return false;
    if (b === "+" && piece.length < n) return false;
    if (b === "<" && piece.length > n) return false;
  }
  const seen2 = new Uint8Array(N * N);
  for (let x = 0; x < N * N; x++) {                           // the water, bridges included, is one piece
    if (seen2[x] || !wet(x)) continue;
    waters++;
    const todo = [x];
    seen2[x] = 1;
    while (todo.length) for (const y of around(todo.pop())) if (!seen2[y] && wet(y)) { seen2[y] = 1; todo.push(y); }
  }
  return waters <= 1;
}
const specOf = (P, gridStr, bd, br, land) => ({ clue: Array.from(gridStr, ch => (ch === "-" ? 0 : parseInt(ch, 36))), bound: [...bd], bridge: [...br], total: land });

// ---------- the solver against every filling of 4×4 boards ----------
{
  const N = 4, rng = seedRng(97);
  let cases = 0, fine = 0, answered = 0, several = 0, withBridge = 0;
  const nbrs = x => { const r = Math.floor(x / N), c = x % N, out = []; if (r) out.push(x - N); if (r < N - 1) out.push(x + N); if (c) out.push(x - 1); if (c < N - 1) out.push(x + 1); return out; };
  for (let t = 0; t < 4000 && cases < 140; t++) {
    // a filling with a bridge (or not) whose islands and water meet the rules, then stones and bounds that are true of it
    const fill = Array.from({ length: 16 }, () => (rng() < 0.4 ? 2 : 1));
    const br = Array(16).fill("-");
    if (rng() < 0.6) {
      const b = [5, 6, 9, 10][Math.floor(rng() * 4)], h = rng() < 0.5;
      fill[b] = 2; br[b] = h ? "h" : "v";
      for (const e of h ? [b - 1, b + 1] : [b - N, b + N]) fill[e] = 2;
      for (const e of h ? [b - N, b + N] : [b - 1, b + 1]) fill[e] = 1;
    }
    const grid = Array(16).fill("-"), bd = Array(16).fill("-"), seen = new Set();
    for (let x = 0; x < 16; x++) {
      if (fill[x] !== 2 || seen.has(x)) continue;
      const piece = [x], todo = [x];
      seen.add(x);
      while (todo.length) for (const y of nbrs(todo.pop())) if (fill[y] === 2 && !seen.has(y)) { seen.add(y); todo.push(y); piece.push(y); }
      const s = piece.filter(y => br[y] === "-")[Math.floor(rng() * piece.filter(y => br[y] === "-").length)];
      if (s === undefined) continue;
      const k = Math.floor(rng() * 5), n = piece.length;
      if (k === 0 || n === 1) grid[s] = n.toString(36);
      else if (k === 1) { grid[s] = Math.max(2, n - Math.floor(rng() * 2)).toString(36); bd[s] = "+"; }
      else if (k === 2) { grid[s] = (n + Math.floor(rng() * 2)).toString(36); bd[s] = "<"; }
      else if (k === 3) bd[s] = "?";
      else grid[s] = n.toString(36);
    }
    const land = fill.filter(v => v === 2).length, givenLand = bd.includes("?") || rng() < 0.6 ? land : null;
    if (givenLand == null && bd.every(v => v === "-") && br.every(v => v === "-")) continue;
    const spec = specOf(null, grid.join(""), bd, br, givenLand);
    if (!meets(N, spec, fill)) continue;                       // (a stone-less island, or water in pieces: not a case)
    const P = puzzleOf(N, grid.join(""), null, { bd: bd.join(""), br: br.join(""), land: givenLand ?? undefined });
    let want = 0;
    const stoneMask = (() => { let m = 0; for (let x = 0; x < 16; x++) if (grid[x] !== "-" || bd[x] === "?" || br[x] !== "-") m |= 1 << x; return m; })();
    const f = new Array(16);
    for (let m = 0; m < 1 << 16; m++) {
      if ((m & stoneMask) !== stoneMask) continue;
      for (let i = 0; i < 16; i++) f[i] = (m >> i) & 1 ? 2 : 1;
      if (meets(N, spec, f)) want++;
    }
    const got = count(P, 100000);
    cases++;
    if (want) answered++;
    if (want > 1) several++;
    if (br.some(v => v !== "-")) withBridge++;
    if (got === want) fine++; else console.log("  differs:", rows(grid.join(""), N), rows(bd.join(""), N), rows(br.join(""), N), givenLand, "plain", want, "solver", got);
  }
  check(fine === cases && cases >= 120 && answered === cases && several > 6 && withBridge > 30, `the solver counts exactly the answers a plain search finds: ${cases} 4×4 boards with bounds, unknown islands and bridges (${several} with several answers, ${withBridge} with a bridge)`);
}

// ---------- the generator: one answer for each twist ----------
const made = [];
{
  const t0 = performance.now();
  let unique = 0, total = 0, shapes = 0, twisted = 0, sols = 0;
  const jobs = [["ranges", 6, "easy"], ["unknown", 6, "easy"], ["bridges", 6, "easy"], ["ranges+unknown+bridges", 6, "medium"], ["ranges+bridges", 6, "hard"]];
  for (const [tw, size, level] of jobs) for (let i = 0; i < 2; i++) {
    const seed = 3300 + i * 101 + size, p = generate(seed, size, level, tw);
    if (!p) continue;
    const P = puzzleOf(size, p.grid, p.sol, p), spec = specOf(P, p.grid, p.bd || "-".repeat(size * size), p.br || "-".repeat(size * size), p.land ?? null);
    total++;
    made.push({ tw, size, level, p, P, seed });
    if (count(P, 2) === 1) unique++;
    if (meets(size, spec, Int8Array.from(p.sol, Number))) shapes++;
    if (answerOf(size, p.grid) === null || P.fancy) sols++;
    const t = twistsOf(tw);
    if ((!t.ranges || /[+<]/.test(p.bd)) && (!t.unknown || /\?/.test(p.bd)) && (!t.bridges || /[hv]/.test(p.br))) twisted++;
  }
  check(total === 10 && unique === total, `${total} puzzles over the twists, sizes and levels: each has exactly one answer, counted by a search that guesses`);
  check(shapes === total && twisted === total, "…its answer meets the rules as the Rules sheet says them, and it shows the twists it was asked for (a bound, a ?, a bridge)");
  const mixed = made.find(m => m.tw === "ranges+unknown+bridges");
  check(!!mixed && /\?/.test(mixed.p.bd) && /[hv]/.test(mixed.p.br) && Number.isInteger(mixed.p.land), "all three together in one puzzle, the land count given");
  const a = generate(777, 6, "easy", "bridges"), b = generate(777, 6, "easy", "bridges");
  check(JSON.stringify(a) === JSON.stringify(b), "a seed makes the same twisted puzzle every time");
  console.log(`  (${Math.round(performance.now() - t0)} ms)`);
}

// ---------- bridges, bounds and hints on the board ----------
{
  const m = made.find(x => x.tw === "bridges");
  const { P, p } = m, x = [...P.bridge].findIndex(v => v > 0), arms = bridgeArms(P.N, x, P.bridge[x]);
  const none = NONE.repeat(P.cells);
  check(P.sol[x] === 2 && arms.ends.every(e => P.sol[e] === 2) && arms.sides.every(e => P.sol[e] === 1), "a bridge is an island cell with island at its two ends and the water's two sides sea");
  const h = hintFor(P, none);
  check(h.step?.tech === "bridge" && h.step.set.length === 4, "the first hint on a bridge board is the bridge: ends island, sides sea");
  // the bridge counts as sea for the water: sea on both sides of it, joined, is not cut by it
  const bs = breaks(P, p.sol);
  check(!bs.pool.length && !bs.island.length && !bs.cut.length && solvedBy(P, p.sol), "the answer breaks nothing, a bridge keeping the sea in one piece");
  // hints take the board to the answer, every step true
  let fine = 0, steps = 0, all = 0;
  for (const q of made) {
    let marks = NONE.repeat(q.P.cells), n = 0, good = true;
    while (!solvedBy(q.P, marks) && n++ < q.P.cells + 5) {
      const hh = hintFor(q.P, marks);
      if (!hh) break;
      if (hh.wrong != null) marks = withMark(marks, hh.wrong, hh.should);
      else if (hh.reveal != null) { good = false; marks = withMark(marks, hh.reveal, hh.should); }
      else { steps++; for (const [c, v] of hh.step.set) { if (String(v) !== q.p.sol[c] || marks[c] !== NONE) good = false; marks = withMark(marks, c, String(v)); } }
    }
    all++;
    if (good && solvedBy(q.P, marks)) fine++;
  }
  check(fine === all, `hints alone solve every twisted puzzle, each step true of the answer, without a reveal (${all} puzzles, ${steps} steps)`);
  const r = made.find(q => q.tw === "ranges");
  const cell = [...r.P.bound].findIndex(v => v === 1 || v === 2);
  check(/^(\d+\+|≤\d+)$/.test(labelOf(r.P, cell)) && labelOf(r.P, [...r.P.bound].findIndex(v => v === 0 && false) + 0 || cell).length > 1, "a bound reads \"5+\" or \"≤4\", as in Bridges");
  const u = made.find(q => q.tw === "unknown"), uc = [...u.P.bound].findIndex(v => v === 3);
  check(labelOf(u.P, uc) === "?" && u.P.stone[uc] === 1 && u.P.clue[uc] === 0, "an unknown island is a stone that reads \"?\"");
  check(!solveAs(u.P, 0).broken && u.p.land === [...u.p.sol].filter(c => c === "2").length, "the land count given is the answer's");
}

// ---------- the 3D scene reads the same rules ----------
{
  const { plotsOf, works } = await import("../nurikabe-works.js");
  const r = made.find(q => q.tw === "ranges"), b = made.find(q => q.tw === "bridges"), u = made.find(q => q.tw === "unknown");
  const whole = q => plotsOf(q.P.N, q.P.clue, q.p.sol.replace(/2/g, "0"), q.P).filter(v => v >= 0).length;
  check([r, b, u].every(q => whole(q) === [...q.p.sol].filter(c => c === "2").length), "a solved board's islands are all whole plots in 3D, bounds and unknown islands included");
  const x = [...b.P.bridge].findIndex(v => v > 0), marks = b.p.sol.replace(/2/g, "0"), wet = [...marks].map((m, i) => (b.P.bridge[i] ? "1" : m)).join("");
  const plan = works(b.P.N, b.P.stone, wet, b.P.bridge);
  const cells = [plan.source, plan.outlet, ...plan.sluices.map(s => s.cell), ...plan.norias.map(n => n.cell), ...plan.locks.flatMap(l => l.gates)];
  check(plan.sea[x] === 1 && !cells.includes(x), "the water runs under a rule's bridge (its cell is sea to the works) and no decoration stands on it");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("nurikabe twists: the rules, the generator and the hints hold");
