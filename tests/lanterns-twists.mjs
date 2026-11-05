// Lanterns' twists (5 November 2026): the hex board, mirrors, short beams and bounds, as pure code. The rules are checked
// against an independent walker written here from the geometry (axial coordinates, vectors, a mirror as a reflection across its
// axis), by trying every set of lanterns on small boards; then generated puzzles of every twist and board are checked to have
// one answer, to be solved by reasoning at their level, and to show the twist; and old seeds still make the same puzzles.
import crypto from "node:crypto";
import { boardOf, puzzleOf, count, solveAs, gradeOf, generate, twistOf, twistKey, ORDER, HEX_SIZES, breaks, hintFor, withMark, solvedBy, NONE, trace, numberText } from "../lanterns-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const seedRng = seed => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

// ---------- an independent world: cells with positions, a way to step, a mirror as a reflection ----------
function worldOf(shape, N) {
  if (shape === "square") {
    const at = (r, c) => (r >= 0 && c >= 0 && r < N && c < N ? r * N + c : -1);
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    return {
      cells: N * N, dirs: dirs.length, mirrors: ["/", "\\"],
      step: (x, d) => at(Math.floor(x / N) + dirs[d][0], (x % N) + dirs[d][1]),
      reflect: (m, d) => { const [dr, dc] = dirs[d], [er, ec] = m === "/" ? [-dc, -dr] : [dc, dr]; return dirs.findIndex(([a, b]) => a === er && b === ec); },
      touching: x => dirs.map((_, d) => at(Math.floor(x / N) + dirs[d][0], (x % N) + dirs[d][1])).filter(y => y >= 0),
    };
  }
  const R = (N - 1) / 2, qr = [], idx = new Map();
  for (let r = -R; r <= R; r++) for (let q = Math.max(-R, -r - R); q <= Math.min(R, -r + R); q++) { idx.set(`${q},${r}`, qr.length); qr.push([q, r]); }
  const vec = [[1, 0], [-1, 0], [1, -1], [-1, 1], [0, -1], [0, 1]];
  const px = ([q, r]) => [q + r / 2, (Math.sqrt(3) / 2) * r];                    // where an axial vector points on the page (y down)
  const axis = { "-": 0, "/": 60, "\\": 120 };
  return {
    cells: qr.length, dirs: 6, mirrors: ["-", "/", "\\"],
    step: (x, d) => idx.get(`${qr[x][0] + vec[d][0]},${qr[x][1] + vec[d][1]}`) ?? -1,
    reflect: (m, d) => {
      const [vx, vy] = px(vec[d]), t = (axis[m] * Math.PI) / 180, ux = Math.cos(t), uy = -Math.sin(t), dot = vx * ux + vy * uy;
      const rx = 2 * dot * ux - vx, ry = 2 * dot * uy - vy;
      return vec.findIndex(v => { const [a, b] = px(v); return Math.abs(a - rx) < 1e-9 && Math.abs(b - ry) < 1e-9; });
    },
    touching: x => vec.map((_, d) => idx.get(`${qr[x][0] + vec[d][0]},${qr[x][1] + vec[d][1]}`) ?? -1).filter(y => y >= 0),
  };
}
const worlds = {};
const W = (shape, N) => (worlds[`${shape}${N}`] ??= worldOf(shape, N));

/** The cells a lantern lights, by walking the beams one cell at a time (k: reach, 0 for none); `self` if one comes back to its lantern. */
function lightsOf(w, grid, x, k) {
  const lit = new Set([x]);
  let self = false;
  for (let d0 = 0; d0 < w.dirs; d0++) {
    let at = x, d = d0;
    for (let steps = 0; steps < w.cells * w.dirs * 2 && (!k || steps < k); steps++) {
      const y = w.step(at, d);
      if (y < 0) break;
      const ch = grid[y];
      if (w.mirrors.includes(ch)) { d = w.reflect(ch, d); at = y; continue; }
      if (ch !== ".") break;
      if (y === x) self = true; else lit.add(y);
      at = y;
    }
  }
  return { lit, self };
}
/** Whether a set of lanterns answers a puzzle, by the rules as the page's Rules say them. */
function meets(w, grid, k, set) {
  const lamps = [];
  for (let x = 0; x < w.cells; x++) if (set[x]) { if (grid[x] !== ".") return false; lamps.push(x); }
  const cover = new Array(w.cells).fill(0);
  for (const a of lamps) {
    const { lit, self } = lightsOf(w, grid, a, k);
    if (self) return false;
    for (const y of lit) { cover[y]++; if (y !== a && set[y]) return false; }
  }
  for (let x = 0; x < w.cells; x++) {
    const ch = grid[x];
    if (ch === ".") { if (!cover[x]) return false; continue; }
    let n, lo, hi;
    if (ch >= "0" && ch <= "6") lo = hi = +ch;
    else if (ch >= "a" && ch <= "f") { lo = ch.charCodeAt(0) - 96; hi = 99; }
    else if (ch >= "A" && ch <= "E") { lo = 0; hi = ch.charCodeAt(0) - 64; }
    else continue;
    n = w.touching(x).filter(y => set[y]).length;
    if (n < lo || n > hi) return false;
  }
  return true;
}

// ---------- the boards ----------
{
  let fine = true;
  for (const [shape, N, cells] of [["hex", 3, 7], ["hex", 5, 19], ["hex", 7, 37], ["hex", 9, 61], ["hex", 11, 91], ["square", 7, 49]]) {
    const B = boardOf(shape, N), w = W(shape, N);
    fine &&= B.cells === cells && B.nb.length === cells;
    for (let x = 0; x < cells; x++) for (let d = 0; d < B.D; d++) {
      const y = B.nb[x][d];
      fine &&= y === w.step(x, d);
      if (y >= 0) fine &&= B.nb[y][d ^ 1] === x;              // the way back is the opposite way, d ^ 1
    }
    for (let t = 0; t < B.mirrors.length; t++) for (let d = 0; d < B.D; d++) {
      fine &&= B.turn[t][d] === w.reflect(B.mirrors[t], d);
      fine &&= B.turn[t][B.turn[t][d]] === d && B.turn[t][d ^ 1] === (B.turn[t][d] ^ 1);       // a mirror is its own undoing, and turns opposite beams opposite ways
    }
  }
  check(fine, "boards: hex and square cells, neighbours, the way back, and every mirror's turns agree with the geometry");
  check(HEX_SIZES.every(s => s % 2 === 1) && boardOf("hex", 7).cells === 37 && boardOf("hex", 11).cells === 91, "a hex board is a hexagon of hexes, an odd number across");
}

// ---------- the rules, against every set of lanterns on small boards ----------
function randomGrid(rng, w, opts) {
  const g = [];
  for (let x = 0; x < w.cells; x++) {
    const r = rng();
    if (opts.mirrors && r < 0.14) g.push(w.mirrors[Math.floor(rng() * w.mirrors.length)]);
    else if (r < 0.14 + opts.rock) {
      const t = rng();
      g.push(t < 0.4 ? "#" : opts.ranges && t < 0.75 ? (rng() < 0.5 ? String.fromCharCode(97 + Math.floor(rng() * 3)) : String.fromCharCode(65 + Math.floor(rng() * 3))) : String(Math.floor(rng() * 4)));
    } else g.push(".");
  }
  return g.join("");
}
for (const [name, shape, sizes, opts] of [
  ["mirrors on the square board", "square", [4, 5], { mirrors: true, rock: 0.2 }],
  ["mirrors on the hex board", "hex", [3, 5], { mirrors: true, rock: 0.14 }],
  ["short beams and bounds on the square board", "square", [4, 5], { ranges: true, rock: 0.2, k: [1, 2, 3] }],
  ["short beams, bounds and mirrors on the hex board", "hex", [3, 5], { ranges: true, mirrors: true, rock: 0.14, k: [1, 2, 3] }],
]) {
  const rng = seedRng(shape.length * 7 + (opts.k ? 5 : 1)), t0 = performance.now();
  let fine = 0, cases = 0, withAnswers = 0, several = 0, selfCells = 0;
  for (let t = 0; t < 160; t++) {
    const N = sizes[t % sizes.length], w = W(shape, N), grid = randomGrid(rng, w, opts), k = opts.k ? opts.k[t % opts.k.length] : 0;
    const P = puzzleOf(N, grid, null, { board: shape, k }), whites = Array.from(P.whites);
    if (whites.length > 14 || whites.length < 4) continue;
    let want = 0;
    for (let m = 0; m < 1 << whites.length; m++) {
      const set = new Int8Array(w.cells);
      for (let i = 0; i < whites.length; i++) if ((m >> i) & 1) set[whites[i]] = 1;
      if (meets(w, grid, k, set)) want++;
    }
    const got = count(P, 100000);
    cases++;
    if (want > 0) withAnswers++;
    if (want > 1) several++;
    selfCells += P.self.reduce((a, b) => a + b, 0);
    if (got === want) fine++; else console.log("  differs:", shape, N, k, grid, "plain", want, "solver", got);
    // a beam lights a cell exactly when that cell's beam lights it back (the reasoning relies on it), and the walker agrees with the engine's rays
    for (const x of whites) {
      const a = lightsOf(w, grid, x, k);
      if (!same([...a.lit].sort((p, q) => p - q), Array.from(P.see[x]).sort((p, q) => p - q)) || !!P.self[x] !== a.self) { fine--; console.log("  rays differ", shape, grid, x); break; }
      for (const y of P.see[x]) if (!P.see[y].includes(x)) { fine--; console.log("  not both ways", shape, grid, x, y); break; }
    }
  }
  check(fine === cases && withAnswers > cases * 0.3 && several > 4, `${name}: the solver counts exactly the answers a plain search finds, and rays agree both ways (${cases} boards, ${withAnswers} with answers, ${several} with several, ${selfCells} cells that would shine on themselves) in ${Math.round(performance.now() - t0)} ms`);
}

// ---------- a few boards by hand ----------
{
  // square: a lantern at (0,2) shines down to a "/" at (2,2), which sends it to the right
  const P = puzzleOf(5, ".....".repeat(2) + "../.." + ".....".repeat(2));
  check(same(Array.from(P.see[2]).sort((a, b) => a - b), [0, 1, 2, 3, 4, 7, 10, 11]), "a square mirror turns the beam: a lantern above a slash shines down it and then to the left");
  const Q = puzzleOf(5, "....." + "./.\\." + "....." + ".\\./." + ".....");
  check(Q.self[7] === 1 && !Q.self[0], "a beam that comes back to its own lantern is recorded: that cell can't hold one");
  const H = puzzleOf(7, ".".repeat(37), null, { board: "hex" });
  check(H.see[18].length === 1 + 6 * 3, "on a hex board a lantern in the middle of a 7-wide hexagon lights the six rays, three cells each");
  const S = puzzleOf(7, ".".repeat(49), null, { k: 2 });
  check(S.see[24].length === 1 + 4 * 2 && S.see[0].length === 1 + 2 + 2, "a short beam lights k cells each way, and fewer where the board ends");
  const B2 = puzzleOf(5, "..A.." + "..2.." + "..b.." + ".....".repeat(2));
  check(numberText(B2, 2) === "≤1" && numberText(B2, 7) === "2" && numberText(B2, 12) === "2+" && B2.lo[2] === 0 && B2.hi[2] === 1 && B2.lo[12] === 2 && B2.hi[12] >= 4, "a bound reads as 2+ or ≤1 and as the least and most lanterns beside it");
}

// ---------- generated puzzles: one answer, graded, showing their twist ----------
const TWIST_SETS = [
  ["none", [[7, "easy"], [7, "medium"], [10, "hard"]]],
  ["ranges", [[7, "easy"], [7, "medium"], [10, "easy"]]],
  ["short", [[7, "easy"], [7, "medium"], [10, "medium"]]],
  ["mirrors", [[7, "easy"], [7, "medium"], [10, "hard"]]],
  ["hex", [[7, "easy"], [7, "medium"], [9, "hard"]]],
  ["hex+ranges", [[7, "medium"], [9, "easy"]]],
  ["hex+short", [[7, "medium"], [9, "easy"]]],
  ["hex+mirrors", [[7, "medium"], [9, "easy"]]],
  ["ranges+short+mirrors", [[7, "medium"], [10, "easy"]]],
  ["hex+ranges+short+mirrors", [[9, "medium"]]],
];
const made = [];
{
  const t0 = performance.now();
  let total = 0, unique = 0, meetsAll = 0, graded = 0, shows = 0, onLevel = 0;
  for (const [twist, jobs] of TWIST_SETS) {
    const tw = twistOf(twist);
    for (const [size, level] of jobs) for (let s = 0; s < 2; s++) {
      const seed = 7700 + size * 31 + s * 7 + twist.length, p = generate(seed, size, level, twist);
      total++;
      if (!p) continue;
      const o = { board: p.board, k: p.k }, P = puzzleOf(size, p.grid, p.sol, o), w = W(tw.hex ? "hex" : "square", size);
      made.push({ twist, seed, size, level, p, P });
      if (count(P, 2) === 1) unique++;
      if (meets(w, p.grid, p.k || 0, Int8Array.from(p.sol, Number))) meetsAll++;
      const lv = ORDER.indexOf(p.level);
      if (solveAs(P, lv).ok && (lv === 0 || !solveAs(P, lv - 1).ok)) graded++;
      if (p.level === level) onLevel++;
      const bounds = [...p.grid].filter(c => /[a-fA-E]/.test(c)).length, mirrors = [...p.grid].filter(c => "/\\-".includes(c)).length;
      const ok = ((!tw.ranges || bounds >= 2) && (!tw.mirrors || mirrors >= 1) && (!tw.short || (p.k >= 2 && p.k <= 5)) && (!!tw.hex === (p.board === "hex")) && (tw.plain ? p.k == null && p.board == null : true));
      if (ok) shows++; else console.log('  no twist shown:', twist, size, level, p.k, p.board, p.grid);
    }
  }
  check(unique === total, `${total} puzzles over every twist and board: each has exactly one answer, counted by a search that guesses`);
  check(meetsAll === total, "…each answer meets every rule as an independent walker reads them");
  check(graded === total && onLevel >= total - 6, `…each is solved by reasoning at its level and not a level below (${onLevel} of ${total} came out at the level asked for)`);
  check(shows === total, "…and each shows its twist: bounds, mirrors, a reach, or the hex board");
  console.log(`  (${Math.round(performance.now() - t0)} ms)`);
}
{
  // hints take only true steps, and reach a mirrors+hex puzzle's end alone
  const picks = made.filter(m => m.twist.includes("mirrors") || m.twist.includes("ranges"));
  let steps = 0, true_ = 0, solved = 0;
  const techs = new Set();
  for (const { P, p } of picks) {
    let marks = NONE.repeat(P.cells), n = 0;
    while (!solvedBy(P, marks) && n++ < P.cells + 5) {
      const h = hintFor(P, marks);
      if (!h) break;
      if (h.wrong != null) marks = withMark(marks, h.wrong, h.should);
      else if (h.reveal != null) marks = withMark(marks, h.reveal, h.should);
      else {
        steps++; techs.add(h.step.tech);
        let all = true;
        for (const [x, v] of h.step.set) { all &&= (v === 1) === (p.sol[x] === "1") && marks[x] === NONE; marks = withMark(marks, x, v === 1 ? "1" : "2"); }
        if (all) true_++;
      }
    }
    if (solvedBy(P, marks)) solved++;
    const b = breaks(P, p.sol);
    if (b.clash.length || b.over.length || b.short.length || b.dark.length) { solved = -1e9; console.log("  the answer breaks a rule", p.grid); }
  }
  check(steps > 0 && true_ === steps && solved === picks.length, `hints on mirror and bound puzzles take only true steps and solve them alone (${steps} steps: ${[...techs].sort().join(", ")})`);
}
{
  // a bound puzzle is solved with its bounds: the same grid with each bound made exact is a different puzzle that the answer also meets
  const withBounds = made.filter(m => /[a-fA-E]/.test(m.p.grid));
  check(withBounds.length >= 4 && withBounds.every(m => count(m.P, 2) === 1), `puzzles with bounds in them have one answer each (${withBounds.length})`);
  const hexes = made.filter(m => m.p.board === "hex");
  check(hexes.length >= 8 && hexes.every(m => m.p.grid.length === boardOf("hex", m.size).cells), `hex puzzles carry a grid a cell of the hexagon (${hexes.length})`);
}

// ---------- old seeds make the same puzzles ----------
{
  const gold = {"1:7:easy":"3e1375434e","2:7:medium":"7484ba208d","3:7:hard":"f703dbb929","4:7:expert":"26f5771c90","5:10:easy":"88685f55f9","6:10:medium":"efa4e7c04d","7:10:hard":"6bd5fd7d37","20261104:10:medium":"0e8c75b866","8:14:easy":"a56afc904d","9:14:medium":"4938371e0f","424242:7:medium":"ec817181bc","11:10:expert":"c18682f1c6"};
  let fine = 0;
  for (const [key, hash] of Object.entries(gold)) {
    const [seed, size, level] = key.split(":");
    const p = generate(+seed, +size, level), h = crypto.createHash("sha1").update(JSON.stringify(p)).digest("hex").slice(0, 10);
    if (h === hash) fine++; else console.log("  changed:", key);
  }
  check(fine === Object.keys(gold).length, `plain puzzles of old seeds are exactly what they were (${fine} golden hashes, today's puzzle among them)`);
  check(twistKey("hex+mirrors") === "mirrors+hex" && twistKey("none") === "none" && twistKey("nonsense") === "none" && twistOf("ranges").plain === false && twistOf(null).plain, "twists are named in a fixed order, and anything else is none");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("lanterns twists: the hex board, mirrors, short beams and bounds hold");
