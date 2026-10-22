// Pipes: the board (pipes-engine.js, Pipe Dream's rules) and the descent in 3D (pipes-deep.js). The boards are
// repeatable and fair (the wellhead's outlet clear, the terminal's inlet open, pumps and tanks passable, no corner
// walled off), the queue comes in bags, the oil runs as the rules say (quota, spills, crossings both ways, pumps,
// tanks, the terminal, blasts, Hurry, the countdown cut short, unused pieces), the route ahead is where the oil goes,
// and a bot playing at a person's pace finds the early levels easy and the later ones hard. The shaft is repeatable,
// always has a way down, keeps rock off the surface and gaps in its slabs; the pieces lay as they're turned, the boons
// do what they say, the oil speeds up with depth and catches a pipe left short; a descent saved and restored plays on
// the same; and a bot at a person's pace gets a fair way down before it's caught.
const B = await import("../pipes-engine.js");
const G = await import("../pipes-deep.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const at = (x, y) => y * B.COLS + x;

// ---------- the board: the deal ----------
{
  let problems = 0, built = 0;
  const fail = (...why) => { problems++; if (problems < 6) console.log("   ", ...why); };
  for (let seed = 1; seed <= 40; seed++) for (let n = 1; n <= 15; n++) {
    const L = B.deal(seed * 7919, n), again = B.deal(seed * 7919, n), lv = B.levelOf(n);
    built++;
    if (JSON.stringify(L) !== JSON.stringify(again)) fail("not repeatable", seed, n);
    const [sx, sy] = B.xy(L.source.c);
    if (sx < 1 || sy < 1 || sx > B.COLS - 2 || sy > B.ROWS - 2) fail("the wellhead on the edge", seed, n);
    const a1 = B.beyond(L.source.c, L.source.d), a2 = B.beyond(a1, L.source.d);
    if (a1 < 0 || a2 < 0 || L.cells[a1] || L.cells[a2]) fail("the wellhead's outlet isn't clear", seed, n);
    const count = k => L.cells.filter(c => c?.k === k).length;
    if (count("rock") !== lv.rocks || count("pump") !== lv.pumps || count("tank") !== lv.tanks) fail("the wrong number of rocks, pumps or tanks", seed, n);
    if (!!L.terminal !== lv.terminal) fail("terminal", seed, n);
    if (L.terminal) {
      const f = B.beyond(L.terminal.c, L.terminal.d);
      if (f < 0 || L.cells[f]) fail("the terminal's inlet isn't open", seed, n);
      const [tx, ty] = B.xy(L.terminal.c);
      if (Math.abs(tx - sx) + Math.abs(ty - sy) < 5) fail("the terminal too near the wellhead", seed, n);
    }
    for (let c = 0; c < L.cells.length; c++) {
      const f = L.cells[c];
      if (f?.k !== "pump" && f?.k !== "tank") continue;
      for (const s of B.PIECES[f.piece][0]) { const g = B.beyond(c, s); if (g < 0 || (L.cells[g] && L.cells[g].k !== "pump" && L.cells[g].k !== "tank")) fail("a pump or tank shut at an end", seed, n); }
    }
    // every open square reachable from the outlet: rock walls off no corner
    const passable = c => !L.cells[c] || L.cells[c].k === "pump" || L.cells[c].k === "tank";
    const seen = new Set([a1]), todo = [a1];
    while (todo.length) { const c = todo.pop(); for (let d = 0; d < 4; d++) { const g = B.beyond(c, d); if (g >= 0 && !seen.has(g) && passable(g)) { seen.add(g); todo.push(g); } } }
    if (seen.size !== L.cells.filter((_, c) => passable(c)).length) fail("open ground walled off", seed, n);
  }
  check(problems === 0, `${built} boards: repeatable; the wellhead off the edge, its outlet clear; rock, pumps and tanks as levelOf says; the terminal far off with its inlet open; pumps and tanks passable; no ground walled off`);
  const lv = [1, 6, 15, 25].map(B.levelOf);
  check(lv[0].fill > lv[1].fill && lv[1].fill > lv[2].fill && lv[2].fill === lv[3].fill && lv[0].quota < lv[2].quota && lv[0].countdown > lv[2].countdown,
    `levels speed up and lengthen to a floor: ${lv.map(l => `${l.fill} ms, quota ${l.quota}`).join("; ")}`);
}
// a slower pace: the same board, its countdown and its oil slower
{
  const a = B.deal(808, 6), b = B.deal(808, 6, 2), c = B.deal(808, 6, 1.5);
  check(JSON.stringify(a.cells) === JSON.stringify(b.cells) && b.fill === 2 * a.fill && b.countdown === 2 * a.countdown && c.fill === Math.round(1.5 * a.fill) && b.quota === a.quota,
    "at a slower pace the board is the same, its countdown and every pipe's time stretched (Slower half as long again, Slowest twice)");
  const P = B.newPlay(), Q = B.newPlay();
  B.advance(a, P, 10 * a.fill + a.countdown); B.advance(b, Q, 2 * (10 * a.fill + a.countdown));
  check(P.t * 2 === Q.t && P.path.length === Q.path.length && Math.abs(P.p - Q.p) < 1e-9, "at the Slowest pace the oil gets where the Normal pace takes it in twice the time");
}
// the queue: shuffled bags of thirteen, the same whatever is played
{
  const L = B.deal(4242, 3), counts = {};
  for (let i = 0; i < 13 * 20; i++) counts[B.pieceAt(L, i)] = (counts[B.pieceAt(L, i)] || 0) + 1;
  let bags = true;
  for (let b = 0; b < 20; b++) { const bag = Array.from({ length: 13 }, (_, i) => B.pieceAt(L, b * 13 + i)).sort().join(); if (bag !== "h,h,ne,ne,nw,nw,se,se,sw,sw,v,v,x") bags = false; }
  const order = Array.from({ length: 26 }, (_, i) => B.pieceAt(L, i)).join();
  check(bags && counts.x === 20 && counts.h === 40, "the queue comes in bags of thirteen: two of each straight and bend, one crossing");
  check(order !== Array.from({ length: 26 }, (_, i) => B.pieceAt(B.deal(4243, 3), i)).join() && B.queueOf(L, 5).join() === [5, 6, 7, 8, 9].map(i => B.pieceAt(L, i)).join(), "each board its own queue; the five on show are the next five");
}

// ---------- the board: the rules, on boards laid by hand ----------
// a bare level to lay on: the wellhead at (1,1) facing east, nothing else, the queue replaced by the pieces asked for
function bare(n = 1, extra = {}) {
  const L = { seed: 1, ...B.levelOf(n), cells: Array(B.COLS * B.ROWS).fill(null), source: { c: at(1, 1), d: 1 }, terminal: null, ...extra };
  L.cells[at(1, 1)] = { k: "source", d: 1 };
  return L;
}
const lay = (P, c, piece) => { P.grid[c] = piece; };
const runOut = (L, P) => { for (let i = 0; i < 100000 && !P.over; i++) B.advance(L, P, 50); return P; };
{
  // a straight run east along row 1: five pipes, then the edge
  const L = bare(1, { quota: 5 }), P = B.newPlay();
  for (let x = 2; x <= 6; x++) lay(P, at(x, 1), "h");
  B.advance(L, P, L.countdown - 1);
  check(!P.flowing && P.count === 0, "the oil waits out the countdown");
  runOut(L, P);
  check(P.over?.win && P.over.why === "edge" && P.count === 5 && P.pts.pipe === 5 * B.POINTS.pipe, `five pipes to the edge: the quota met, ${P.pts.pipe} points`);
  const short = bare(1, { quota: 6 }), Q = B.newPlay();
  for (let x = 2; x <= 6; x++) lay(Q, at(x, 1), "h");
  runOut(short, Q);
  check(Q.over && !Q.over.win, "the same short of a quota of six: the run is over");
  // the time it took: half a pipe out of the wellhead, then a pipe each
  check(Math.abs(P.t - (L.countdown + L.fill / 2 + 5 * L.fill)) < 60, `the oil's pace: a pipe every ${L.fill} ms after the countdown`);
}
{
  // spills: into an empty square, a piece that doesn't take it in, rock
  const why = setup => { const L = bare(1, { quota: 1 }), P = B.newPlay(); setup(L, P); runOut(L, P); return P.over.why; };
  check(why((L, P) => lay(P, at(2, 1), "h")) === "open", "a spill into an empty square");
  check(why((L, P) => { lay(P, at(2, 1), "h"); lay(P, at(3, 1), "v"); }) === "shape", "a spill into a piece that doesn't take it in");
  check(why((L, P) => { lay(P, at(2, 1), "h"); L.cells[at(3, 1)] = { k: "rock" }; }) === "rock", "a spill into rock");
}
{
  // a loop through a crossing: east through (3,2), round, and down through it
  const L = bare(1, { quota: 3, source: { c: at(1, 2), d: 1 } }), P = B.newPlay();
  L.cells[at(1, 1)] = null; L.cells[at(1, 2)] = { k: "source", d: 1 };
  // (2,2) h, (3,2) x, (4,2) sw: down to (4,3) nw: west to (3,3)? round: (4,2) sw takes from W out S; (4,3) nw takes N out W;
  // (3,3) ne takes E out N; up into (3,2) x from S out N; (3,1) h? leaves: (3,1) v out N to (3,0): open
  lay(P, at(2, 2), "h"); lay(P, at(3, 2), "x"); lay(P, at(4, 2), "sw"); lay(P, at(4, 3), "nw"); lay(P, at(3, 3), "ne"); lay(P, at(3, 1), "v");
  runOut(L, P);
  check(P.pts.loop === B.POINTS.loop && P.count === 7 && P.filled[at(3, 2)] === 3, `a crossing passed both ways: a loop, +${B.POINTS.loop}, and both passes count`);
  const a = bare(1, { quota: 3, source: { c: at(1, 2), d: 1 } }), Q = B.newPlay();
  a.cells[at(1, 1)] = null; a.cells[at(1, 2)] = { k: "source", d: 1 };
  lay(Q, at(2, 2), "h"); lay(Q, at(3, 2), "x"); lay(Q, at(4, 2), "sw"); lay(Q, at(4, 3), "nw"); lay(Q, at(3, 3), "ne"); lay(Q, at(3, 1), "v");
  const route = B.ahead(a, Q);
  runOut(a, Q);
  check(route.length === Q.count && route.cells.map(s => s.c).join() === Q.path.slice(1).map(s => s.c).join() && route.end.why === Q.over.why, "the route ahead is the way the oil goes, and its length the pipe it passes");
}
{
  // pumps pay, tanks hold the oil back
  const L = bare(1, { quota: 3 }), P = B.newPlay();
  L.cells[at(3, 1)] = { k: "pump", piece: "h" }; L.cells[at(4, 1)] = { k: "tank", piece: "h" };
  lay(P, at(2, 1), "h"); lay(P, at(5, 1), "h");
  runOut(L, P);
  check(P.pts.pump === B.POINTS.pump && P.count === 4, `a pump on the way: +${B.POINTS.pump}`);
  check(Math.abs(P.t - (L.countdown + L.fill / 2 + 3 * L.fill + B.TANK * L.fill)) < 60, `a tank takes ${B.TANK} times a pipe's time to fill`);
}
{
  // the terminal: into it past the quota, a clean end and its bonus; any sooner, refused
  const make = quota => { const L = bare(4, { quota, terminal: { c: at(5, 1), d: 3 } }); L.cells[at(5, 1)] = { k: "terminal", d: 3 }; return L; };
  const P = B.newPlay(), L = make(3);
  for (let x = 2; x <= 4; x++) lay(P, at(x, 1), "h");
  runOut(L, P);
  check(P.over.win && P.over.why === "terminal" && P.pts.terminal === B.POINTS.terminal, `into the terminal past the quota: +${B.POINTS.terminal}`);
  const Q = B.newPlay(), M = make(4);
  for (let x = 2; x <= 4; x++) lay(Q, at(x, 1), "h");
  runOut(M, Q);
  check(!Q.over.win && Q.over.why === "early" && !Q.pts.terminal, "into the terminal short of the quota: refused, a spill");
}
{
  // laying: over your own piece is a blast (points and a moment), never over the oil or what's fixed
  const L = B.deal(77, 2), P = B.newPlay();
  const open = L.cells.findIndex((c, i) => !c && i !== B.beyond(L.source.c, L.source.d));
  check(B.place(L, P, open) === "laid" && P.next === 1, "a tap lays the next piece on an open square");
  check(B.place(L, P, open) === "blast" && P.pts.blast === B.POINTS.blast && P.blasts === 1 && P.next === 2, `a tap on your own piece blasts it: the next one in its place, ${B.POINTS.blast} points`);
  check(B.place(L, P, open) === "busy", "nothing laid while a blast goes off");
  B.advance(L, P, B.BLAST_MS);
  check(B.place(L, P, L.cells.findIndex(c => c)) === "fixed" && B.place(L, P, open) === "blast", `${B.BLAST_MS} ms on, laying again; never on what's fixed`);
  const Q = B.newPlay(), M = bare(1, { quota: 1 });
  lay(Q, at(2, 1), "h");
  B.release(M, Q);
  B.advance(M, Q, M.fill);
  check(B.place(M, Q, at(2, 1)) === "oil", "never over a piece the oil is in");
}
{
  // Oil now pays for the countdown left; Hurry runs it faster and doubles what it fills; unused pieces cost
  const L = bare(1, { quota: 2 }), P = B.newPlay();
  for (let x = 2; x <= 6; x++) lay(P, at(x, 1), "h");
  lay(P, at(4, 5), "v"); lay(P, at(5, 6), "x");
  B.advance(L, P, 3500);
  B.release(L, P);
  check(P.flowing && P.pts.early === B.POINTS.early * Math.floor((L.countdown - 3500) / 1000), `Oil now: +${B.POINTS.early} for each whole second of the countdown left`);
  B.advance(L, P, L.fill / 2 + L.fill * 2);
  const t0 = P.t;
  B.hurry(L, P);
  runOut(L, P);
  check(P.pts.pipe === B.POINTS.pipe * 2 + B.POINTS.pipe * 2 * 3, "Hurry: the pipes it fills from then score double");
  check(Math.abs(P.t - t0 - 3 * L.fill / B.HURRY) < 60, `Hurry: ${B.HURRY} times faster`);
  check(P.pts.unused === 2 * B.POINTS.unused, `two pieces the oil never reached: ${2 * B.POINTS.unused}`);
  const M = bare(1, { quota: 9 }), Q = B.newPlay();
  for (let x = 2; x <= 6; x++) lay(Q, at(x, 1), "h");
  lay(Q, at(4, 5), "v");
  runOut(M, Q);
  check(!Q.over.win && Q.pts.unused === 0, "the spill that ends the run takes nothing for unused pieces");
  const N = bare(1, { quota: 1 }), R = B.newPlay();
  B.release(N, R);
  runOut(N, R);
  check(!R.over.win && R.pts.early === 0 && B.pointsOf(R) === 0, "Oil now on an empty board: spilled, and nothing for the countdown cut short");
}

// ---------- the board: how hard the levels are, for a bot laying a piece every 1.3 s ----------
// It keeps a route in mind from where the oil's way ends (through pieces already laid, as they lie), the one of many
// quick routes the five pieces on show fill furthest before the oil gets there, and lays each piece on the earliest
// square of it that it fits; a piece that fits nowhere goes far off the route. Once the route is long enough, it hurries.
{
  const FIT = {};
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) FIT[`${a}${b}`] = B.KINDS.filter(k => B.PIECES[k].some(([p, q]) => (p === a && q === b) || (p === b && q === a)));
  function walk(L, P, c, a, r, used0) {
    const used = new Set(used0), route = [];
    for (let g = 0; g < 70; g++) {
      if (c < 0 || used.has(c)) break;
      const f = L.cells[c];
      if (f?.k === "terminal") { if (f.d === a) route.term = true; break; }
      if (f && f.k !== "pump" && f.k !== "tank") break;
      const piece = f ? f.piece : P.grid[c];
      let outs;
      if (piece && !(route.length === 0 && !f && r() < 0.5)) { const ch = B.channelOf(piece, a); if (!ch || ((P.filled[c] || 0) & (1 << ch.i))) break; outs = [ch.out]; }
      else outs = [0, 1, 2, 3].filter(d => d !== a);
      used.add(c);
      let best = null, bv = Infinity;
      for (const b of outs) {
        const n = B.beyond(c, b);
        if (n < 0) continue;
        const nf = L.cells[n];
        if (nf?.k === "terminal") { if (nf.d === B.back(b) && route.length + 1 >= L.quota - P.count - 1) { best = b; bv = -1; break; } continue; }
        if (used.has(n) || (nf && !((nf.k === "pump" || nf.k === "tank") && B.PIECES[nf.piece][0].includes(B.back(b))))) continue;
        let deg = 0; for (let d = 0; d < 4; d++) { const m = B.beyond(n, d); if (m >= 0 && !used.has(m) && !L.cells[m]) deg++; }
        const v = deg + r() * 2.2;
        if (v < bv) { bv = v; best = b; }
      }
      if (best == null) { route.push({ c, a, b: -1 }); break; }
      route.push({ c, a, b: best });
      a = B.back(best); c = B.beyond(c, best);
    }
    return route;
  }
  function feasible(L, P, route, rate, lead) {
    const need = route.map(s => (s.b < 0 ? null : L.cells[s.c] ? "fixed" : FIT[`${s.a}${s.b}`]));
    const doneAt = route.map((s, i) => (need[i] === "fixed" || (need[i] && P.grid[s.c] && need[i].includes(P.grid[s.c])) ? 0 : Infinity));
    for (let j = 0; j < B.SHOWN; j++) {
      const kind = B.pieceAt(L, P.next + j), i = route.findIndex((s, i) => doneAt[i] === Infinity && need[i] && need[i] !== "fixed" && need[i].includes(kind));
      if (i >= 0) doneAt[i] = j * rate;
    }
    let n = 0;
    while (n < route.length && need[n] && doneAt[n] <= lead + n * L.fill) n++;
    return n;
  }
  function choose(L, P, r, rate) {
    const ah = B.ahead(L, P), last = ah.cells.length ? ah.cells[ah.cells.length - 1] : P.path.length ? P.path[P.path.length - 1] : { c: L.source.c, b: L.source.d };
    const end = { c: B.beyond(last.c, last.b), a: B.back(last.b) };
    const lead = (P.flowing ? (1 - P.p) * L.fill : L.countdown - P.t + L.fill / 2) + ah.cells.length * L.fill;
    const used = new Set([...P.path.map(s => s.c), ...ah.cells.map(s => s.c)]), want = L.quota + 2 - ah.length;
    let plan = null, best = -Infinity;
    for (let i = 0; i < 40; i++) {
      const route = walk(L, P, end.c, end.a, r, used);
      if (!route.length) continue;
      const n = feasible(L, P, route, rate, lead), v = Math.min(n, want + 4) * 10 + (route.term && n >= route.length - 1 ? 60 : 0) + Math.min(route.length, want + 6);
      if (v > best) { best = v; plan = route; }
    }
    const kind = B.pieceAt(L, P.next);
    if (plan) for (const s of plan) {
      if (s.b < 0) break;
      if (L.cells[s.c]) continue;
      const need = FIT[`${s.a}${s.b}`];
      if (P.grid[s.c] && need.includes(P.grid[s.c])) continue;
      if (need.includes(kind)) return s.c;
    }
    const on = new Set((plan || []).map(s => s.c)), [ex, ey] = B.xy(end.c >= 0 ? end.c : L.source.c);
    let far = -1, fd = -1;
    for (let c = 0; c < B.COLS * B.ROWS; c++) { if (L.cells[c] || P.grid[c] || on.has(c)) continue; const [x, y] = B.xy(c), d = Math.abs(x - ex) + Math.abs(y - ey); if (d > fd) { fd = d; far = c; } }
    return far;
  }
  const play = (seed, n, rate) => {
    const L = B.deal(seed, n), P = B.newPlay(), r = B.rng(seed ^ 0xABCDEF);
    let next = 800;
    while (!P.over && P.t < 900000) {
      const done = (() => { const a = B.ahead(L, P); return a.length >= L.quota + 2 || a.end.why === "terminal"; })();
      if (done && P.flowing) B.hurry(L, P);
      if (!done && P.t >= next && P.t >= P.lockUntil) { const c = choose(L, P, r, rate); if (c >= 0) B.place(L, P, c); next = P.t + rate; }
      B.advance(L, P, done ? 50 : Math.max(1, Math.max(next, P.lockUntil) - P.t));
    }
    return P;
  };
  const rates = {};
  for (const n of [1, 3, 6, 10]) { let won = 0; for (let s = 1; s <= 24; s++) if (play(s * 7919, n, 1300).over?.win) won++; rates[n] = won / 24; }
  check(rates[1] >= 0.9 && rates[3] >= 0.8 && rates[10] <= 0.6 && rates[10] < rates[1], `a bot laying a piece every 1.3 s clears level 1 ${Math.round(rates[1] * 100)}%, 3 ${Math.round(rates[3] * 100)}%, 6 ${Math.round(rates[6] * 100)}%, 10 ${Math.round(rates[10] * 100)}%: easy to start, hard by level 10`);
}

// ---------- the descent: the shaft ----------
{
  let problems = 0;
  const fail = (...why) => { problems++; if (problems < 6) console.log("   ", ...why); };
  let slabs = 0, kinds = { barrel: 0, charge: 0, tank: 0 };
  for (let seed = 1; seed <= 30; seed++) {
    const S = G.shaftOf(seed * 104729), T = G.shaftOf(seed * 104729), DEEP = 120;
    for (let z = 0; z < DEEP; z++) for (let y = 0; y < G.SIDE; y++) for (let x = 0; x < G.SIDE; x++) {
      const m = G.madeAt(S, x, y, z);
      if (m !== G.madeAt(T, x, y, z)) fail("the shaft not repeatable", seed);
      if (m === "rock" && z < 3) fail("rock near the surface", seed, z);
      if (m && m !== "rock") kinds[m]++;
    }
    for (let z = 3; z < DEEP; z++) {
      let rock = 0;
      for (let y = 0; y < G.SIDE; y++) for (let x = 0; x < G.SIDE; x++) if (G.madeAt(S, x, y, z) === "rock") rock++;
      if (rock === G.SIDE * G.SIDE) fail("a layer all rock", seed, z);
      if (rock >= G.SIDE * G.SIDE - 3) slabs++;
    }
    // a way down through open squares from the wellhead's square to the deepest layer
    const k = (x, y, z) => `${x},${y},${z}`, seen = new Set([k(...G.WELL, 0)]), todo = [[...G.WELL, 0]];
    let deepest = 0;
    while (todo.length) {
      const [x, y, z] = todo.pop();
      deepest = Math.max(deepest, z);
      for (const [dx, dy, dz] of G.D3) {
        const nx = x + dx, ny = y + dy, nz = z + dz, m = G.madeAt(S, nx, ny, nz);
        if (nz >= DEEP || m === "wall" || m === "rock" || seen.has(k(nx, ny, nz))) continue;
        seen.add(k(nx, ny, nz)); todo.push([nx, ny, nz]);
      }
    }
    if (deepest < DEEP - 1) fail("no way down", seed, deepest);
  }
  check(problems === 0 && slabs > 30, `30 shafts, 120 layers each: repeatable, no rock within three layers of the surface, never a layer all rock (${slabs} slabs with a gap or few), always a way down`);
  check(kinds.barrel > kinds.charge && kinds.charge > 0 && kinds.tank > 0, `boons along the way: ${kinds.barrel} barrels, ${kinds.charge} charges, ${kinds.tank} tanks`);
  const one = G.shaftOf(1), made = new Set();
  for (let z = 0; z < 60; z++) for (let y = 0; y < G.SIDE; y++) for (let x = 0; x < G.SIDE; x++) made.add(G.madeAt(one, x, y, z));
  check([...made].every(m => [null, "rock", "barrel", "charge", "tank"].includes(m)) && G.madeAt(one, -1, 0, 5) === "wall" && G.madeAt(one, G.SIDE, 2, 5) === "wall" && G.madeAt(one, 0, 0, -1) === "wall",
    "inside the shaft, open ground, rock or a boon; outside it (and above the surface), wall");
}
// the descent's queue: bags of ten
{
  let ok = true;
  for (let b = 0; b < 30; b++) { const bag = Array.from({ length: 10 }, (_, i) => G.pieceAt3(99, b * 10 + i)).sort().join(); if (bag !== "elbow,elbow,elbow,elbow,jog,jog,long,straight,straight,straight") ok = false; }
  check(ok, "the descent's pieces come in bags of ten: three straights, four elbows, two jogs, a long one");
}

// ---------- the descent: laying, turning, the boons, the oil ----------
// a shaft made to order: no rock unless set, boons where asked
function shaftWith(set = {}) {
  const S = G.shaftOf(1);
  G.madeAt(S, 0, 0, 200);                               // make the chunks, then clear them
  for (const c of S.chunks) c.at.clear();
  for (const [k, v] of Object.entries(set)) { const [x, y, z] = k.split(",").map(Number); S.chunks[Math.floor(z / 12)].at.set(G.key3(x, y, z), v); }
  return S;
}
/** The piece in hand made `kind`, turned `turn`, and laid. */
const put = (S, D, kind, turn = 0) => { D.cur = kind; D.turn = turn; return G.lay(S, D); };
{
  const S = shaftWith(), D = G.newDescent(1);
  const ways = k => G.waysOf(D, k);
  check(ways("straight").length === 1 && ways("long").length === 1 && ways("elbow").length === 4 && ways("jog").length === 4, "a straight and a long lay one way; an elbow and a jog four");
  const elbows = ways("elbow").map(w => w.exit.d).join(), jog = ways("jog")[0];
  check(elbows === "0,2,1,3" && jog.cells.length === 2 && jog.exit.d === G.DOWN && jog.cells[1].x === jog.cells[0].x + 1,
    "going down, an elbow turns east, south, west, north as it's turned a quarter at a time; a jog steps a square sideways and on down");
  const across = ways("elbow").length && G.across(0).join() === "2,4,3,5";
  check(across, "going east, a quarter turn takes the elbow's way round south, down, north, up");
  put(S, D, "elbow", 0);                                  // at (1,1,1), turned east: going sideways now
  check(G.waysOf(D, "elbow")[G.firstTurn(S, D, "elbow")].exit.d === G.DOWN, "going sideways, an elbow starts turned down");
  const T = shaftWith({ "2,1,2": "rock" }), E = G.newDescent(1);
  put(T, E, "elbow", 0);                                  // east to (2,1,1), the square below it rock
  const w = G.waysOf(E, "elbow")[G.firstTurn(T, E, "elbow")];
  check(w.exit.d !== G.DOWN && w.exit.d !== G.UP && !G.deadEnd(T, E, w), "with rock below, it starts turned to open ground on the level, not into the rock or back up");
}
{
  // laying: the cap ahead of the oil, rock and wall, boons taken
  const S = shaftWith({ "1,1,2": "barrel", "1,1,3": "charge", "1,1,4": "tank", "1,1,6": "rock" }), D = G.newDescent(1);
  check(put(S, D, "straight") === "laid" && G.openEnd(D).z === 2, "a straight laid down from the wellhead");
  put(S, D, "straight"); put(S, D, "straight"); put(S, D, "straight");
  check(D.barrels === 1 && D.charges === 1 && D.pipe.some(c => c.tank) && G.scoreOf(D) === G.BARREL, `boons laid through are taken: a barrel (+${G.BARREL}), a charge, a tank in the pipe`);
  check(put(S, D, "straight") === "laid" && G.contentAt(S, D, 1, 1, 6) === "rock" && put(S, D, "straight") === "blocked", "rock below: blocked");
  check(G.blast(S, D) && D.charges === 0 && G.contentAt(S, D, 1, 1, 6) === null && put(S, D, "straight") === "laid" && put(S, D, "straight") === "wait",
    `a charge blasts the rock the open end faces; ${G.CAP} laid ahead of the oil, the next waits`);
  const C = shaftWith(), K = G.newDescent(1);
  for (let i = 0; i < G.CAP - 1; i++) put(C, K, "straight");
  check(put(C, K, "long") === "wait" && G.lead(K) === G.CAP - 1 && put(C, K, "straight") === "laid", `a piece of two squares waits for room for both: never more than ${G.CAP} ahead`);
  const W = shaftWith(), E = G.newDescent(1);
  put(W, E, "elbow", 2);                                 // at (1,1,1), turned west
  check(put(W, E, "straight") === "laid" && put(W, E, "straight") === "blocked", "the shaft's wall stops a pipe as rock does");
  const X = shaftWith(), H = G.newDescent(1);
  put(X, H, "elbow", 0);                                 // at (1,1,1), turned east
  put(X, H, "elbow", 3);                                 // at (2,1,1): going east, the fourth way is up
  const upEnd = G.openEnd(H);
  check(upEnd.z === 0 && upEnd.d === G.UP, "a pipe can turn back up");
}
{
  // hold, scrap, the oil's pace, Hurry, the catch
  const S = shaftWith(), D = G.newDescent(5);
  const first = D.cur, second = G.pieceAt3(5, 1), third = G.pieceAt3(5, 2);
  check(G.holdPiece(S, D) && D.hold === first && D.cur === second && !G.holdPiece(S, D), "Hold sets the piece in hand aside for the next; once a piece");
  put(S, D, "straight");
  check(!D.held && D.cur === third && G.holdPiece(S, D) && D.cur === first && D.hold === third, "a piece laid, Hold again: the one set aside comes back");
  const E = G.newDescent(5);
  G.advance(S, E, G.START - 1);
  check(!E.flowing, `the oil waits ${G.START / 1000} s at the wellhead`);
  put(S, E, "straight"); put(S, E, "straight");
  const t = E.t;
  G.advance(S, E, 1 + G.fillTime(0) / 2 + G.fillTime(1) + G.fillTime(2) + 5);
  check(E.over && E.deepest === 2 && Math.abs(E.t - t - (1 + G.fillTime(0) / 2 + G.fillTime(1) + G.fillTime(2))) < 2, "the oil runs a square at a time and catches a pipe left short: over");
  check(G.fillTime(0) === 3200 && G.fillTime(40) < G.fillTime(20) && G.fillTime(400) === 450, `slow at the top (${G.fillTime(0)} ms a square), faster all the way down, to a floor of 450`);
  const W = G.newDescent(5);
  for (let i = 0; i < 4; i++) put(S, W, "straight");
  G.hurry(S, W);
  check(W.flowing && W.hurry, "Hurry while the oil waits at the wellhead lets it go at once");
  const F = G.newDescent(5);
  for (let i = 0; i < 6; i++) put(S, F, "straight");
  G.release(S, F);
  const before = F.t; G.hurry(S, F);
  check(F.hurry, "Hurry with pipe laid ahead");
  for (let i = 0; i < 1000 && F.hurry; i++) G.advance(S, F, 10);
  check(!F.hurry && G.lead(F) === G.HURRY_STOP && F.t - before < (G.fillTime(1) * 4) / G.HURRY3 + 200 + G.fillTime(0) / G.HURRY3, `Hurry runs it ${G.HURRY3} times faster until it's ${G.HURRY_STOP} squares behind`);
  const T = G.newDescent(5);
  put(S, T, "straight"); put(S, T, "straight");
  G.release(S, T);
  const was = T.oil.i;
  G.scrap(S, T);
  check(T.oil.i === was + 1, "Scrap: the next piece, and the oil surges a square");
  // a tank holds it back
  const K = shaftWith({ "1,1,1": "tank" }), M = G.newDescent(5);
  put(K, M, "straight"); put(K, M, "straight");
  G.release(K, M);
  const t0 = M.t; G.advance(K, M, 100000);
  check(Math.abs(M.t - t0 - (G.fillTime(0) / 2 + G.TANK3 * G.fillTime(1) + G.fillTime(2))) < 2, `a tank holds the oil ${G.TANK3} times as long`);
}
{
  // a slower pace: the wait at the wellhead and every square stretched
  const S = shaftWith(), D = G.newDescent(9, 2);
  put(S, D, "straight"); put(S, D, "straight");
  G.advance(S, D, 2 * G.START - 1);
  check(!D.flowing && G.startOf(D) === 2 * G.START, "Slowest: twice the wait at the wellhead");
  const t0 = D.t + 1;
  G.advance(S, D, 1e6);
  check(Math.abs(D.t - t0 - 2 * (G.fillTime(0) / 2 + G.fillTime(1) + G.fillTime(2))) < 2, "and twice as long over every square");
}
{
  // a descent saved and restored plays on the same (the shaft is made again from the seed)
  const S = G.shaftOf(31337), D = G.newDescent(31337, 1.5);
  const move = (S, D, i) => { D.turn = (G.firstTurn(S, D) + (i % 3 === 2 ? 1 : 0)) % G.waysOf(D, D.cur).length; if (G.lay(S, D) !== "laid") { if (!G.holdPiece(S, D)) G.scrap(S, D); } G.advance(S, D, 700); };
  for (let i = 0; i < 20; i++) move(S, D, i);
  const C = JSON.parse(JSON.stringify(D)), S2 = G.shaftOf(31337);
  for (let i = 20; i < 60 && !D.over; i++) { move(S, D, i); move(S2, C, i); }
  check(JSON.stringify(C) === JSON.stringify(D), "a descent saved and restored plays on exactly the same");
}

// ---------- the descent: how far a bot gets at a person's pace ----------
// Every 1.4 s it weighs each way of laying the piece in hand (and the one held), a piece further on, by depth, the open
// ground below, the ways on and the boons; it blasts rock ahead when it can and scraps when nothing fits.
{
  const clone = D => ({ ...D, pipe: D.pipe.slice(), oil: { ...D.oil }, blasted: D.blasted.slice(), taken: D.taken.slice() });
  const blocked = w => w === "wall" || w === "rock" || w === "pipe";
  function value(S, D) {
    const e = G.openEnd(D), w = G.contentAt(S, D, e.x, e.y, e.z);
    let v = e.z * 10 + D.barrels * 50 + D.charges * 25 - (e.d === G.UP ? 15 : 0);
    if (blocked(w)) return v - (w === "rock" && D.charges ? 40 : 400);
    const k = c => `${c.x},${c.y},${c.z}`, seen = new Set([k(e)]), todo = [e];
    let n = 0, deep = e.z;
    while (todo.length && n < 60) {
      const c = todo.shift(); n++; deep = Math.max(deep, c.z);
      for (const d of G.D3) { const m = { x: c.x + d[0], y: c.y + d[1], z: c.z + d[2] }; if (m.z > e.z + 8 || m.z < e.z - 2 || seen.has(k(m)) || blocked(G.contentAt(S, D, m.x, m.y, m.z))) continue; seen.add(k(m)); todo.push(m); }
    }
    v += Math.min(n, 30) * 3 + (deep - e.z) * 12;
    for (const [kind, p] of [["straight", 0.3], ["elbow", 0.4], ["jog", 0.2], ["long", 0.1]]) if (G.waysOf(D, kind).some(x => G.fits(S, D, x) && !G.deadEnd(S, D, x))) v += p * 60;
    return v;
  }
  function best(S, D, depth) {
    let top = [-Infinity, null];
    const kinds = [[D.cur, false]];
    if (!D.held) kinds.push([D.hold ?? G.pieceAt3(D.seed, D.next), true]);
    for (const [kind, swap] of kinds) {
      const ways = G.waysOf(D, kind);
      for (let t = 0; t < ways.length; t++) {
        if (!G.fits(S, D, ways[t])) continue;
        const E = clone(D);
        if (swap) G.holdPiece(S, E);
        E.turn = t;
        E.oil = { i: E.pipe.length - 1, p: 0 };          // looking ahead, the cap doesn't bind
        if (G.lay(S, E) !== "laid") continue;
        let v = value(S, E);
        if (depth > 1) { const [v2] = best(S, E, depth - 1); v = v2 === -Infinity ? v - 150 : Math.max(v * 0.5 + v2 * 0.5, v2 - 5); }
        if (v > top[0]) top = [v, { swap, turn: t }];
      }
    }
    return top;
  }
  const depths = [];
  for (let s = 1; s <= 16; s++) {
    const S = G.shaftOf(s * 104729), D = G.newDescent(s * 104729);
    let next = 500;
    while (!D.over && D.t < 3600000) {
      if (D.t >= next && G.lead(D) < G.CAP) {
        const e = G.openEnd(D);
        if (G.contentAt(S, D, e.x, e.y, e.z) === "rock" && D.charges) G.blast(S, D);
        else {
          const [, a] = best(S, D, 2);
          if (!a) G.scrap(S, D);
          else { if (a.swap) G.holdPiece(S, D); D.turn = a.turn; G.lay(S, D); }
        }
        next = D.t + 1400;
      }
      G.advance(S, D, Math.max(1, next - D.t));
    }
    depths.push(G.depthOf(D));
  }
  depths.sort((a, b) => a - b);
  const median = depths[depths.length >> 1];
  check(median >= 250 && median <= 900 && depths.every(d => d < 3000), `a bot laying every 1.4 s gets down ${median} m (median of 16; ${depths[0]}–${depths[depths.length - 1]}), and the oil always catches it`);
}

if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
