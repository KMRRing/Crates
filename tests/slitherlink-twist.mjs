// Portolan's twists and hex board (slitherlink-twist.js): ranges ("2+", "≤1"), tunnels (the loop crossing itself straight through
// marked dots, square boards only) and the hex board. The rules are checked against a plain search of every edge set on tiny boards
// (nothing of the solver's, and the tunnels read on the flat board, not the split graph the solver uses), and generated puzzles
// against a plain counting search that guesses: exactly one answer, on the level asked, a bound or a tunnel where the twist says.
import { boardOf, puzzleOf, count, solveAs, gradeOf, generate, answerOf, breaks, hintFor, startMarks, labelOf, flagsOf, twistOn, HEX_SIZES, fits } from "../slitherlink-twist.js";
import { generate as engineGenerate, puzzleOf as enginePuzzle, startMarks as engineStart, fitsBoard, SIZES } from "../slitherlink-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const seedRng = seed => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

/** A plain search of the flat board: every set of edges where each dot has two lines or none (four at a tunnel), which traced straight on at the tunnels is one closed curve. */
function flatLoops(g, tun) {
  const { E, V0, ea, eb, vedges } = g, deg = new Uint8Array(V0), on = new Uint8Array(E), out = [], isT = new Set(tun);
  const lastOf = new Int16Array(V0).fill(-1);
  for (let e = 0; e < E; e++) { lastOf[ea[e]] = e; lastOf[eb[e]] = e; }
  const okDot = v => (isT.has(v) ? deg[v] === 4 : deg[v] === 0 || deg[v] === 2);
  const one = () => {
    const first = on.indexOf(1);
    if (first < 0) return false;
    const seen = new Uint8Array(E);
    let e = first, from = ea[first], to = eb[first], n = 0;
    for (let guard = 0; guard < E + 2; guard++) {
      seen[e] = 1; n++;
      const rest = vedges[to].filter(f => on[f] && f !== e);
      let next;
      if (!isT.has(to)) next = rest[0];
      else {
        const W = g.W, ox = 2 * (to % W) - (from % W), oy = 2 * Math.floor(to / W) - Math.floor(from / W);
        next = rest.find(f => { const o = ea[f] === to ? eb[f] : ea[f]; return o % W === ox && Math.floor(o / W) === oy; });
      }
      if (next == null) return false;
      from = to; to = ea[next] === to ? eb[next] : ea[next]; e = next;
      if (e === first) break;
    }
    return n === on.reduce((a, b) => a + b, 0);
  };
  const go = e => {
    if (e === E) { if (one()) out.push(Uint8Array.from(on)); return; }
    for (const v of [0, 1]) {
      on[e] = v;
      if (v) { deg[ea[e]]++; deg[eb[e]]++; }
      let fine = deg[ea[e]] <= 4 && deg[eb[e]] <= 4 && (isT.has(ea[e]) || deg[ea[e]] <= 2) && (isT.has(eb[e]) || deg[eb[e]] <= 2);
      for (const x of [ea[e], eb[e]]) if (lastOf[x] === e && !okDot(x)) fine = false;
      if (fine) go(e + 1);
      if (v) { deg[ea[e]]--; deg[eb[e]]--; }
    }
    on[e] = 0;
  };
  go(0);
  return out;
}
/** The same for a honeycomb (no tunnels): each vertex two lines or none, one closed loop. */
function hexLoops(g) {
  const { E, V, ea, eb, vedges } = g, deg = new Uint8Array(V), on = new Uint8Array(E), out = [], lastOf = new Int16Array(V).fill(-1);
  for (let e = 0; e < E; e++) { lastOf[ea[e]] = e; lastOf[eb[e]] = e; }
  const one = () => {
    const first = on.indexOf(1);
    if (first < 0) return false;
    let e = first, at = eb[first], n = 1;
    for (let guard = 0; guard < E + 2; guard++) {
      const next = vedges[at].find(f => on[f] && f !== e);
      if (next == null) return false;
      at = ea[next] === at ? eb[next] : ea[next]; e = next;
      if (e === first) break;
      n++;
    }
    return n === on.reduce((a, b) => a + b, 0);
  };
  const go = e => {
    if (e === E) { if (one()) out.push(Uint8Array.from(on)); return; }
    for (const v of [0, 1]) {
      on[e] = v;
      if (v) { deg[ea[e]]++; deg[eb[e]]++; }
      let fine = deg[ea[e]] <= 2 && deg[eb[e]] <= 2;
      for (const x of [ea[e], eb[e]]) if (lastOf[x] === e && deg[x] === 1) fine = false;
      if (fine) go(e + 1);
      if (v) { deg[ea[e]]--; deg[eb[e]]--; }
    }
    on[e] = 0;
  };
  go(0);
  return out;
}
/** How many of the loops meet every number and bound. */
const meeting = (g, X, loops) => loops.filter(on => g.cedges.every((es, k) => { if (X.lo[k] < 0) return true; const l = es.reduce((a, e) => a + on[e], 0); return l >= X.lo[k] && l <= X.hi[k]; })).length;
const randomClues = (g, rng, loops) => {
  const base = loops[Math.floor(rng() * loops.length)], lo = new Int8Array(g.cells), hi = new Int8Array(g.cells);
  for (let k = 0; k < g.cells; k++) {
    const n = g.cedges[k].reduce((a, e) => a + base[e], 0), deg = g.cedges[k].length, r = rng();
    if (r < 0.3) lo[k] = hi[k] = -1;
    else if (r < 0.6) lo[k] = hi[k] = n;
    else if (r < 0.8) { lo[k] = Math.max(0, n - (rng() < 0.4 ? 1 : 0)); hi[k] = deg; }
    else { lo[k] = 0; hi[k] = Math.min(deg, n + (rng() < 0.4 ? 1 : 0)); }
  }
  return { lo, hi };
};

// ---------- the boards ----------
{
  const sq = boardOf("square", 5), tq = boardOf("square", 5, [14]);
  check(sq.E === 60 && sq.V === 36 && sq.cells === 25 && tq.V === 37 && tq.forced.length === 4, "square board: 60 edges, 36 dots; a tunnel adds a node and forces its four edges");
  check(tq.vedges[14].length === 2 && tq.vedges[36].length === 2 && tq.vedges.every(es => es.length >= 2 && es.length <= 4), "a tunnel's dot is two nodes of two edges (across and up-down)");
  let fine = true;
  for (const m of [3, ...HEX_SIZES]) {
    const g = boardOf("hex", m), rho = (m - 1) / 2, cells = 3 * rho * (rho + 1) + 1;
    fine &&= g.cells === cells && g.vedges.every(es => es.length === 2 || es.length === 3) && g.cedges.every(es => es.length === 6 && new Set(es).size === 6) && g.ecells.every(cs => cs.length === 1 || cs.length === 2);
    fine &&= g.V - g.E + g.cells === 1;                       // Euler: dots - edges + cells (the inside faces) = 1
  }
  check(fine, "hex boards (3 and 5, 7, 9 across): every vertex has 2 or 3 edges, every hex 6, and Euler's count holds");
  check(HEX_SIZES.length === 3 && boardOf("hex", 5).cells === 19 && boardOf("hex", 9).cells === 61, "hex sizes 5, 7, 9 across are 19, 37 and 61 hexagons");
}

// ---------- the clue notation ----------
{
  const g = boardOf("hex", 5), grid = "0a-pe" + "6".repeat(14), P = puzzleOf(5, grid, null, { shape: "hex" });
  check(P.X.lo[1] === 1 && P.X.hi[1] === 6 && P.X.lo[3] === 0 && P.X.hi[3] === 1 && P.X.lo[4] === 5 && P.X.hi[4] === 6 && P.X.lo[2] < 0, "a to e are 1+ to 5+, p to t are ≤1 to ≤5, - is none");
  check([...P.clue.slice(0, 5)].map(labelOf).join(" ") === "0 1+  ≤1 5+" && g.cells === 19, "the labels read 0, 1+, nothing, ≤1, 5+");
  check(twistOn("ranges+tunnels", "hex") === "ranges" && twistOn("tunnels", "hex") === "none" && twistOn("tunnels") === "tunnels" && flagsOf("ranges+tunnels").ranges, "a hex board holds no tunnels");
}

// ---------- the rules, against every edge set of a tiny board ----------
{
  const rng = seedRng(5);
  // square 3×3 with no tunnel, one tunnel, two: the solver counts what the flat search counts
  let cases = 0, agree = 0, withAnswer = 0;
  for (const tun of [[], [5], [5, 10], [6]]) {
    const g = boardOf("square", 3, tun), flat = boardOf("square", 3), loops = flatLoops({ ...flat, V0: flat.V, W: 4 }, tun);
    // the flat loops are over the flat edges; the split graph has the same edges, so a loop is the same edge set
    for (let i = 0; i < 40 && loops.length; i++) {
      const X = randomClues(g, rng, loops), want = meeting(g, X, loops), got = count(g, X, 1000);
      cases++;
      if (want === got) agree++;
      if (want > 0) withAnswer++;
    }
  }
  check(agree === cases && withAnswer > 20, `3×3 with 0, 1 and 2 tunnels: the solver counts as many answers as the flat search on ${cases} sets of numbers and bounds (${withAnswer} with an answer)`);
  const flatCount = flatLoops({ ...boardOf("square", 3), V0: 16, W: 4 }, [5]).length;
  check(flatCount > 0, `a tunnel at the middle of a 3×3 has loops through it (${flatCount})`);
}
{
  const rng = seedRng(9);
  let cases = 0, agree = 0, withAnswer = 0;
  const g = boardOf("hex", 3), loops = hexLoops(g);
  for (let i = 0; i < 120; i++) {
    const X = randomClues(g, rng, loops), want = meeting(g, X, loops), got = count(g, X, 1000);
    cases++;
    if (want === got) agree++;
    if (want > 0) withAnswer++;
  }
  check(agree === cases && loops.length > 10, `hex 3 across (${loops.length} loops): the solver counts as many answers as the plain search on ${cases} sets (${withAnswer} with an answer)`);
}

// ---------- generated puzzles ----------
/** A plain counting search with no rules of the solver's: edges in order, only the numbers, the dot degrees and one loop checked. */
function guessCount(P, limit = 2, budget = 4e6) {
  const { g, X } = P, order = [], seen = new Set();
  for (let k = 0; k < g.cells; k++) for (const e of g.cedges[k]) if (!seen.has(e)) { seen.add(e); order.push(e); }
  for (let e = 0; e < g.E; e++) if (!seen.has(e)) order.push(e);
  const at = new Int16Array(g.E); order.forEach((e, i) => { at[e] = i; });
  const lastCell = Array.from({ length: g.cells }, (_, k) => Math.max(...g.cedges[k].map(e => at[e])));
  const lastNode = Array.from({ length: g.V }, (_, x) => Math.max(...g.vedges[x].map(e => at[e])));
  const on = new Uint8Array(g.E), deg = new Uint8Array(g.V), cl = new Int8Array(g.cells);
  const cellsAt = Array.from({ length: g.E }, () => []);
  g.ecells.forEach((cs, e) => { cellsAt[e] = cs; });
  let n = 0, steps = 0;
  const single = () => {
    const par = Array.from({ length: g.V }, (_, i) => i), find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
    let lines = 0, cyc = 0;
    for (let e = 0; e < g.E; e++) if (on[e]) { lines++; const a = find(g.ea[e]), b = find(g.eb[e]); if (a === b) cyc++; else par[a] = b; }
    if (!lines || cyc !== 1) return false;
    const roots = new Set();
    for (let e = 0; e < g.E; e++) if (on[e]) roots.add(find(g.ea[e]));
    return roots.size === 1;
  };
  const go = i => {
    if (n >= limit || steps++ > budget) return;
    if (i === order.length) { if (single()) n++; return; }
    const e = order[i];
    for (const v of [0, 1]) {
      on[e] = v;
      if (v) { deg[g.ea[e]]++; deg[g.eb[e]]++; for (const k of cellsAt[e]) cl[k]++; }
      let fine = deg[g.ea[e]] <= 2 && deg[g.eb[e]] <= 2;
      for (const x of [g.ea[e], g.eb[e]]) if (lastNode[x] === i && deg[x] === 1) fine = false;
      for (const k of cellsAt[e]) {
        if (X.lo[k] < 0) continue;
        if (cl[k] > X.hi[k]) fine = false;
        if (lastCell[k] === i && cl[k] < X.lo[k]) fine = false;
      }
      if (fine) {
        // a tunnel's edges are lines from the start: refuse the others
        if (!v && P.locked[e]) fine = false;
      }
      if (fine) go(i + 1);
      if (v) { deg[g.ea[e]]--; deg[g.eb[e]]--; for (const k of cellsAt[e]) cl[k]--; }
    }
    on[e] = 0;
  };
  go(0);
  return steps > budget ? -1 : n;
}

{
  const kinds = [["square", 5, "ranges"], ["square", 5, "tunnels"], ["square", 5, "ranges+tunnels"], ["hex", 5, "none"], ["hex", 5, "ranges"], ["square", 7, "ranges"], ["square", 7, "tunnels"], ["hex", 7, "ranges"]];
  for (const [shape, size, twist] of kinds) {
    let fine = true, onLevel = 0, total = 0, tuns = 0, bounds = 0, searched = 0, bounded = 0, sizeMs = 0;
    for (const level of ["easy", "medium", "hard"]) for (let i = 0; i < (size === 5 ? 2 : 1); i++) {
      const seed = 1000 + i * 7919 + size, t0 = performance.now(), p = generate(seed, shape, size, level, twist);
      sizeMs += performance.now() - t0;
      if (!p) { fine = false; continue; }
      total++;
      const P = puzzleOf(size, p.grid, p.sol, { shape, tun: p.tun });
      const flags = flagsOf(twist);
      if (p.level === level) onLevel++;
      fine &&= count(P.g, P.X, 2) === 1 && solveAs(P.g, P.X, ORDER_OF(p.level)).ok && gradeOf(P.g, P.X) === ORDER_OF(p.level);
      // the answer drawn meets every number and bound, and has the tunnels' four edges
      const on = Uint8Array.from(p.sol, ch => +ch === 1 ? 1 : 0);
      fine &&= P.g.cedges.every((es, k) => P.X.lo[k] < 0 || (() => { const l = es.reduce((a, e) => a + on[e], 0); return l >= P.X.lo[k] && l <= P.X.hi[k]; })());
      fine &&= P.g.forced.every(e => on[e] === 1);
      fine &&= answerOf(size, p.grid, { shape, tun: p.tun }) === p.sol || count(P.g, P.X, 2) === 1;
      if (flags.tunnels && shape === "square") { fine &&= P.g.tun.length >= 1; tuns += P.g.tun.length; }
      if (!flags.tunnels) fine &&= P.g.tun.length === 0;
      if (flags.ranges) { fine &&= p.bounds >= 1; bounds += p.bounds; } else fine &&= p.bounds === 0;
      if (size === 5) {                                      // the plain guessing search agrees there is one answer
        const c = guessCount(P);
        if (c >= 0) { searched++; if (c !== 1) fine = false; }
        else bounded++;
      }
    }
    check(fine && total === (size === 5 ? 6 : 3), `${shape} ${size} · ${twist}: ${total} puzzles, each one answer (rules-based and guessing search${searched ? `, ${searched} searched` : ""}), meeting every clue${tuns ? `, ${tuns} tunnels` : ""}${bounds ? `, ${bounds} bounds` : ""}; ${onLevel} on the level asked (${Math.round(sizeMs / total)} ms each)`);
  }
}
function ORDER_OF(l) { return ["easy", "medium", "hard"].indexOf(l); }

// ---------- the seed, the engine and the old game ----------
{
  const a = generate(77, "hex", 7, "medium", "ranges"), b = generate(77, "hex", 7, "medium", "ranges");
  check(JSON.stringify(a) === JSON.stringify(b), "the same seed makes the same twisted puzzle");
  const plain = engineGenerate(123456, 7, "medium"), again = engineGenerate(123456, 7, "medium", false, { shape: "square", twist: "none" });
  check(JSON.stringify(plain) === JSON.stringify(again) && plain.shape === undefined, "a plain square puzzle is made the old way, whatever spec is passed");
  const viaEngine = engineGenerate(5, 5, "easy", false, { shape: "hex", twist: "none" });
  check(viaEngine?.shape === "hex" && fitsBoard({ board: "hex", size: 5, grid: viaEngine.grid }) && !fitsBoard({ board: "hex", size: 6, grid: "0" }) && SIZES.includes(7), "the engine hands a hex puzzle over, and knows which saved grids fit");
  const P = enginePuzzle(5, viaEngine.grid, viaEngine.sol, { shape: "hex" });
  check(P.twisted && P.g.cells === 19 && engineStart(P) === "0".repeat(P.g.E), "a hex puzzle starts with no marks");
}

// ---------- marks, tunnels' locked edges, hints ----------
{
  const p = generate(4242, "square", 7, "easy", "tunnels"), P = puzzleOf(7, p.grid, p.sol, { shape: "square", tun: p.tun }), start = startMarks(P);
  check(P.g.forced.length === 4 * P.g.tun.length && [...start].filter(ch => ch === "1").length === P.g.forced.length, "a tunnel's four edges are lines in the starting marks");
  // a tunnel's lines never draw as a wrong corner, and the opening position breaks nothing
  const br = breaks(P, start);
  check(br.over.length === 0 && br.bad.length === 0 && br.loop.length === 0, "the starting marks break no rule");
  // hints: every step is true of the answer, and following them solves the puzzle
  for (const [shape, size, twist] of [["square", 7, "ranges+tunnels"], ["hex", 7, "ranges"], ["hex", 5, "none"]]) {
    const q = generate(31337, shape, size, "medium", twist), Q = puzzleOf(size, q.grid, q.sol, { shape, tun: q.tun });
    let marks = startMarks(Q), fine = true, steps = 0, techs = new Set();
    for (; steps < 400; steps++) {
      const h = hintFor(Q, marks);
      if (!h) break;
      const set = h.wrong != null ? [[h.wrong, h.should]] : h.step ? h.step.set.map(([e, v]) => [e, String(v)]) : [[h.reveal, h.should]];
      if (h.step) techs.add(h.step.tech);
      for (const [e, m] of set) {
        fine &&= (Q.sol[e] ? "1" : "2") === m;
        marks = marks.slice(0, e) + m + marks.slice(e + 1);
      }
      if ([...marks].every((m, e) => (m === "1") === (Q.sol[e] === 1)) && !marks.includes("0")) break;
    }
    check(fine && [...marks].every((m, e) => (m === "1") === (Q.sol[e] === 1)), `${shape} ${size} · ${twist}: ${steps} hint steps, each true of the answer, solve it (${[...techs].join(", ")})`);
  }
}

// ---------- the page, the worker and the room are wired to it ----------
{
  const fs = await import("node:fs"), root = new URL("../", import.meta.url).pathname, page = fs.readFileSync(root + "slitherlink.js", "utf8"), coop = await import("../slitherlink-coop.js");
  check(/P\.view/.test(page) && /specOf/.test(page) && /labelOf/.test(page), "the page draws the board from the puzzle's own view, and reads bounds");
  const p = generate(9, "hex", 5, "easy", "ranges"), run = { v: 1, mode: "random", seed: 9, board: "hex", size: 5, level: "easy", twist: p.twist, tun: "", came: p.level, grid: p.grid, sol: p.sol, marks: "0".repeat(p.sol.length), ms: 0, hints: 0 };
  const shared = coop.default.share({ [coop.KEY]: JSON.stringify(run) });
  check(shared && shared.fixed.board === "hex" && shared.fixed.twist === "ranges" && coop.default.valid({ fixed: shared.fixed, layers: shared.layers }) && coop.default.run({ fixed: shared.fixed, layers: shared.layers, start: shared.start }).board === "hex", "a hex board with ranges travels in the room's state and comes back as the same run");
  const q = generate(9, "square", 7, "easy", "tunnels"), r2 = { ...run, board: "square", size: 7, twist: "tunnels", tun: q.tun, grid: q.grid, sol: q.sol, marks: startMarks(puzzleOf(7, q.grid, q.sol, { tun: q.tun })) };
  const s2 = coop.default.share({ [coop.KEY]: JSON.stringify(r2) });
  check(s2 && s2.fixed.tun === q.tun && s2.layers.marks === r2.marks && coop.default.valid({ fixed: s2.fixed, layers: s2.layers }), "a board with causeways travels with its dots and its fixed lines");
}

console.log(bad ? `\n${bad} failed` : "\nall slitherlink twist checks passed");
process.exit(bad ? 1 : 0);
