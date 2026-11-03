// Pipes on a solid (README, Pipes): the Puzzle's rules on the faces of a cube. What it has to do: be a closed surface (every side
// of every tile meets one side of one other tile, and that one meets it back); join pipes across the edges (the art square's
// side middles land on the 3D side middles, so a pipe leaving one tile arrives at the middle of the next one's side); follow
// the oil over edges, through crossings and old pipe, past stakes; and be what the levels say it is: every level solved by its
// own solver, which finds the routes the level lists and no others, with every rock, old pipe and stake needed, and a hint
// that, followed, always ends in a solution. Run: node tests/pipes-solid.mjs
import * as Z from "../pipes-solid.js";
import { solve } from "../pipes-solid-solve.js";
import { artMid, artFrame, chanD, solidMatrix, apply, netLayout, netPick, C } from "../pipes-solid-3d.js";
import { LEVELS as CUBE, CHAPTERS as CUBE_CHAPTERS } from "../pipes-cube-levels.js";
import { LEVELS as DODECA, CHAPTERS as DODECA_CHAPTERS } from "../pipes-dodeca-levels.js";
const LEVELS = [...CUBE, ...DODECA], CHAPTERS = [...CUBE_CHAPTERS.map(c => ({ ...c, key: `cube-${c.key}` })), ...DODECA_CHAPTERS.map(c => ({ ...c, key: `dodeca-${c.key}` }))];
const chapterOf = spec => `${spec.solid}-${spec.chapter}`;

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (p, q, e = 1e-6) => Math.hypot(p[0] - q[0], p[1] - q[1], (p[2] ?? 0) - (q[2] ?? 0)) < e;
const to3D = (F, [x, y]) => [0, 1, 2].map(i => F.c[i] + (x - C) * F.ex[i] + (y - C) * F.ey[i]);

// ---------- the solids are closed surfaces and their pipes meet ----------
for (const [name, m, tiles, n] of [["cube", 1, 6, 4], ["cube", 3, 54, 4], ["cube", 4, 96, 4], ["dodeca", 1, 12, 5]]) {
  const S = Z.solidOf(name, m);
  let closed = S.count === tiles;
  for (const [t, T] of S.tiles.entries()) for (const [s, [t2, s2]] of T.nb.entries()) if (S.tiles[t2].nb[s2][0] !== t || S.tiles[t2].nb[s2][1] !== s) closed = false;
  check(closed && S.tiles.every(T => T.n === n), `${name} ${m}×${m}: ${tiles} tiles of ${n} sides, each side meeting one side of another tile that meets it back`);
  let joined = true;
  for (const [t, T] of S.tiles.entries()) {
    const F = artFrame(T);
    for (let s = 0; s < n; s++) {
      const [t2, s2] = T.nb[s];
      if (!near(to3D(F, artMid(n, s)), T.mids[s]) || !near(to3D(artFrame(S.tiles[t2]), artMid(n, s2)), T.mids[s])) joined = false;
    }
  }
  check(joined, `${name} ${m}×${m}: a pipe leaving a side's middle in the art square arrives at the same point of the solid as the next tile's`);
}
{
  const S = Z.solidOf("cube", 3);
  // the picture: a tile's middle, drawn, is hit by a tap on it, and the tile behind is never hit
  const cam = { yaw: .6, pitch: .45, zoom: 1, aspect: 390 / 400 };
  let okPick = true, seen = 0;
  S.tiles.forEach((T, c) => {
    const m = solidMatrix(T, cam, 390, 400);
    if (!m) return;
    seen++;
    const [x, y] = apply(m, [C, C]);
    if (Z.pick(S, cam, x / 390 * 2 - 1, 1 - y / 400 * 2) !== c) okPick = false;
  });
  check(okPick && seen === 27, `a cube turned a little shows three faces (${seen} tiles) and a tap on each tile's middle picks that tile`);
  check(Z.pick(S, cam, 5, 5) === -1, "a tap off the solid picks nothing");
  const net = netLayout(S, 390, 400);
  check(net.tiles.length === 54 && net.cuts.length > 0, "the cube cut open flat has all its tiles and lettered cut edges");
  const hit = net.tiles.every((t, c) => netPick(net, ...apply(t.m, [C, C])) === c);
  check(hit, "a tap on a tile's middle in the net picks that tile");
  const inBox = net.tiles.every(t => t.poly.every(([x, y]) => x >= 0 && y >= 0 && x <= 390 && y <= 400));
  check(inBox, "the net fits the canvas");
  // the net keeps each tile's neighbours' sides: across a joined edge the two art squares touch at the same point
  let touch = true;
  S.tiles.forEach((T, c) => T.nb.forEach(([c2, s2], s) => {
    if (S.tiles[c2].face === T.face) {
      const a = apply(net.tiles[c].m, artMid(4, s)), b = apply(net.tiles[c2].m, artMid(4, s2));
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-6) touch = false;
    }
  }));
  check(touch, "inside a face the net's tiles meet at their side middles");
  const D = Z.solidOf("dodeca", 1), dn = netLayout(D, 390, 400);
  check(dn.tiles.length === 12, "the dodecahedron cuts open without overlap");
  check(chanD(4, 0, 2) !== chanD(4, 0, 1) && chanD(5, 0, 2) !== chanD(5, 0, 1), "a straight, a bend and a pentagon's easy bend are three different paths");
}

// ---------- pieces turn ----------
{
  check(Z.canon(4, "b", 2) === "b0" && Z.canon(4, "b", 3) === "b1" && Z.canon(4, "a", 5) === "a1" && Z.canon(5, "b", 6) === "b1" && Z.canon(4, "x", 3) === "x0", "a piece's turn is kept in one spelling (a straight turned twice is itself; a crossing has none)");
  check(Z.pieceJoining(4, 0, 1) === "a0" && Z.pieceJoining(4, 1, 0) === "a0" && Z.pieceJoining(4, 0, 2) === "b0" && Z.pieceJoining(4, 2, 0) === "b0" && Z.pieceJoining(5, 0, 2) === "b0" && Z.pieceJoining(5, 0, 3) === "b3", "two sides one or two apart are joined by a bend or a straight (a pentagon's easy bend), no others");
  check(Z.exitsOf(4, "a", 0).join() === "1,3" && Z.exitsOf(4, "b", 1).join() === "3" && Z.exitsOf(4, "x", 0).join() === "2", "a bend leaves by either neighbour, a straight and a crossing go straight across");
  check(Z.turned(4, "a3") === "a0" && Z.turned(4, "b0") === "b1" && Z.turned(4, "b1") === "b0" && Z.turned(4, "x0") === "x0", "turning goes round and comes back");
  check(Z.channelOf(4, "a1", 1)?.out === 2 && Z.channelOf(4, "a1", 3) === null, "a bend takes the oil in by its two sides only");
}

// ---------- the oil, as the pieces stand ----------
const parsed = LEVELS.map(spec => ({ spec, L: Z.parseLevel(spec) }));
{
  const { spec, L } = parsed[0];
  const laid = Z.layRoute(L, spec.sols[0]);
  const r = Z.check(L, laid);
  check(r.solved && r.end.why === "terminal" && !r.left, "a level's listed route solves it");
  const crossFaces = new Set(r.passes.map(s => L.S.tiles[s.c].face)).size;
  check(crossFaces >= 3, `the first level's oil crosses edges onto ${crossFaces} faces`);
  const partial = laid.slice();
  const lastCell = r.passes[r.passes.length - 2].c;
  partial[lastCell] = null;
  const q = Z.trace(L, partial);
  check(q.end.why === "open" && q.end.c === lastCell, "with a piece missing the oil stops at it, needing a piece");
  const turnedWrong = laid.slice();
  turnedWrong[r.passes[1].c] = Z.turned(4, turnedWrong[r.passes[1].c]);
  check(Z.trace(L, turnedWrong).end.why !== "terminal" && !Z.check(L, turnedWrong).solved, "a piece turned the wrong way stops the oil");
  const stray = laid.slice(), spare = L.S.tiles.findIndex((_, c) => !L.cells[c] && !laid[c]);
  stray[spare] = "a0";
  check(Z.check(L, stray).strays.includes(spare) && !Z.check(L, stray).solved, "a piece off the oil's way is a stray: not solved");
  const back = Z.feed(L, laid);
  check(back.end.why === "source" && back.passes.length === r.passes.length, "the way back from the terminal reaches the wellhead along the same pieces");
}
{
  // fitted: a piece laid where the oil is waiting is turned to take it in
  const { spec, L } = parsed[0];
  const laid = Z.emptyLaid(L), t = Z.trace(L, laid), c = t.end.c, n = L.S.tiles[c].n;
  const p = Z.fitted(L, laid, c, "a", 0);
  Z.lay(L, laid, c, p);
  const r = Z.trace(L, laid), side = Z.across(L, L.source.c, L.source.d)[1];
  check(t.end.why === "open" && r.passes.length === 1 && Z.channelOf(n, p, side), "a bend laid where the oil waits is turned to take it in");
}

// ---------- the levels ----------
const t0 = Date.now();
let unique = 0, totalNodes = 0;
const hardest = {};
for (const { spec, L } of parsed) {
  const s = solve(L, 5);
  totalNodes += s.nodes;
  if (s.routes.length === 1) unique++;
  const ok = !s.aborted && s.routes.length === spec.sols.length && spec.sols.every(r => s.routes.includes(r));
  if (!ok) check(false, `${spec.id} ${spec.name}: the solver found ${s.routes.length} routes${s.aborted ? " (gave up)" : ""}, the level lists ${spec.sols.length}`);
  hardest[chapterOf(spec)] = Math.max(hardest[chapterOf(spec)] || 0, s.nodes);
  for (const route of spec.sols) {
    const laid = Z.layRoute(L, route), r = laid && Z.check(L, laid);
    if (!r?.solved || Z.laidCount(laid) !== L.total) check(false, `${spec.id}: its listed route doesn't solve it with exactly its hand`);
    const back = laid && Z.feed(L, laid);
    if (!back || back.end.why !== "source" || back.passes.length !== r.passes.length) check(false, `${spec.id}: the way back from the terminal doesn't reach the wellhead along the same pieces`);
  }
}
check(CUBE.length === 20 && DODECA.length === 12 && new Set(LEVELS.map(l => l.id)).size === 32 && LEVELS.every(l => CHAPTERS.some(c => c.key === chapterOf(l))), "twenty cube levels and twelve of the dodecahedron, each with its own id and a chapter");
check(unique === LEVELS.length, `all ${LEVELS.length} levels solve exactly as listed, each with one answer, ${totalNodes.toLocaleString("en-GB")} tiles tried in ${Date.now() - t0} ms`);
console.log(`    hardest by chapter (tiles tried): ${CHAPTERS.map(c => `${c.name} ${hardest[c.key].toLocaleString("en-GB")}`).join(", ")}`);
{
  const needs = { Crossings: L => (L.hand.x || 0) > 0, "Old pipe": L => L.olds > 0, Stakes: L => L.stakes.length > 0 };
  const nameOf = spec => CHAPTERS.find(c => c.key === chapterOf(spec)).name;
  const lacking = parsed.filter(({ spec, L }) => needs[nameOf(spec)] && !needs[nameOf(spec)](L)).map(({ spec }) => spec.id);
  check(!lacking.length, `every level of Crossings, Old pipe and Stakes has its feature${lacking.length ? ` (not ${lacking})` : ""}`);
  const crossing = parsed.filter(({ L }) => (L.hand.x || 0) > 0).every(({ spec, L }) => {
    const laid = Z.layRoute(L, spec.sols[0]), counts = {};
    for (const s of Z.trace(L, laid).passes) counts[s.c] = (counts[s.c] || 0) + 1;
    return Object.values(counts).some(n => n === 2);
  });
  check(crossing, "in every level with a crossing the answer passes it twice");
  const slack = [];
  for (const { spec, L } of parsed) {
    const tries = [];
    for (const c of spec.rocks) tries.push([`rock ${c}`, { ...spec, rocks: spec.rocks.filter(x => x !== c) }]);
    for (const [c, p] of Object.entries(spec.olds)) {
      const olds = { ...spec.olds }; delete olds[c];
      const hand = { ...L.hand, [p[0]]: (L.hand[p[0]] || 0) + 1 };
      tries.push([`old pipe ${c}`, { ...spec, olds, hand: Z.handText(hand) }]);
    }
    spec.stakes.forEach((_, i) => tries.push([`stake ${i + 1}`, { ...spec, stakes: spec.stakes.filter((__, j) => j !== i) }]));
    for (const [what, edit] of tries) if (solve(Z.parseLevel(edit), 2).routes.length < 2) slack.push(`${spec.id} ${what}`);
  }
  check(!slack.length, `every rock, old pipe and stake is needed for the level's one answer${slack.length ? ` (not: ${slack.join("; ")})` : ""}`);
}

// ---------- hints, and getting stuck ----------
{
  let steps = 0, ok = true;
  for (const { spec, L } of parsed) {
    const answer = Z.layRoute(L, spec.sols[0]);
    const cells = answer.map((p, c) => (p ? c : -1)).filter(c => c >= 0);
    const kinds = Z.kindsOf(L.S).filter(k => L.hand[k]);
    const wrong = Z.emptyLaid(L);
    L.cells.forEach((f, c) => { if (!f && c % 3 === 0 && kinds.length) wrong[c] = `${kinds[c % kinds.length]}${c % 2}`; });
    const half = Z.emptyLaid(L);
    cells.slice(0, Math.floor(cells.length / 2)).forEach(c => { half[c] = answer[c]; });
    for (const start of [Z.emptyLaid(L), wrong, half]) {
      const laid = start.slice(), left = { ...L.hand };
      laid.forEach((p, c) => { if (p) { if (left[p[0]] > 0) left[p[0]]--; else laid[c] = null; } });
      for (let guard = 0; guard < 400 && !Z.check(L, laid).solved; guard++) {
        const h = Z.hintFor(L, laid);
        steps++;
        if (!h || h.done) { ok = false; break; }
        if (h.wrong) h.wrong.forEach(c => Z.lift(L, laid, c));
        else if (Z.lay(L, laid, h.c, h.piece) !== "laid") { ok = false; break; }
      }
      if (!Z.check(L, laid).solved) { ok = false; check(false, `${spec.id}: following the hints doesn't end in a solution`); }
    }
  }
  check(ok, `following the hint from nothing, from wrong pieces and from half an answer solves every level (${steps} hints)`);
  const stuck = parsed.filter(({ L }) => L.total > L.cells.filter(f => !f).length).map(({ spec }) => spec.id);
  check(!stuck.length, "every hand has room on its cube");
}
{
  const { L } = parsed[0];
  check(Z.starsFor(L, { hints: 1, lifts: 0 }) === 1 && Z.starsFor(L, { hints: 0, lifts: 0 }) === 3 && Z.starsFor(L, { hints: 0, lifts: 9 }) === 2, "stars: a hint caps the level at one; hardly any lift is three");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
