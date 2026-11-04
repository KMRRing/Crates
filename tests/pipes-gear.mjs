// Gears, the rules (docs/pipes.md, docs/pipes-contract.md): exact fractions; every piece of the catalogue is a legal piece (inside its
// square, tangent at its ports, meshed where it says, clear otherwise, no arbor covered, four turns are the identity, the old thirteen
// pieces are the same pieces); the flood gives every wheel one speed, an odd loop jams, a loop whose ratios do not multiply to 1 binds, two
// modules on one layer clash, two trains that mesh tangle; Book I (the forty old levels) plays unchanged through the new rules and the
// new solver finds exactly its listed answers; the symmetries of a plate keep it solved; the fixtures are what they say.
// Run: node tests/pipes-gear.mjs
import * as F from "../pipes-gear-frac.js";
import * as S from "../pipes-gear-shapes.js";
import * as E from "../pipes-gear-engine.js";
import { solve } from "../pipes-gear-solve.js";
import { LEGACY, OLD_KIND, transformLevel } from "../pipes-gear-legacy.js";
import { FIXTURES } from "../pipes-gear-fixture.js";
import * as Old from "../pipes-train.js";
import { LEVELS as OLD_LEVELS } from "../pipes-train-levels.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 0.01) => Math.abs(a - b) <= e;
const lay = (L, cells) => { const laid = E.emptyLaid(L); for (const [c, p] of Object.entries(cells)) laid[c] = p; return laid; };
const row = (n, o = {}) => ({
  id: "t", cols: n + 2, rows: 1, map: ["." .repeat(n + 2)], hand: o.hand || "", rotate: true, pins: o.pins || [], clicks: o.clicks || [],
  trains: [{ id: "A", barrel: { c: 0, side: "E", m: o.m ?? 5, l: o.l ?? 1 }, sink: { c: n + 1, side: "W", m: o.sm ?? o.m ?? 5, l: o.sl ?? o.l ?? 1, n: o.n ?? 9, goal: o.goal || { type: "wheel" } } }],
});

// ---------- fractions ----------
{
  check(F.eq(F.mk(2, -4), [-1, 2]) && F.eq(F.mul([1, 2], [2, 3]), [1, 3]) && F.eq(F.div([1, 2], [1, 4]), [2, 1]) && F.eq(F.neg([1, 3]), [-1, 3]), "fractions reduce, multiply, divide and negate exactly");
  check(F.fmt([-1, 2]) === "1/2" && F.fmt([-1, 2], true) === "½" && F.fmt([3, 1]) === "3" && F.cmp([1, 3], [1, 2]) < 0 && F.eq(F.parse("-2/6"), [-1, 3]), "fmt writes 1/2 (or ½ for the chips), cmp orders, parse reads a level's speed");
}

// ---------- the catalogue: every piece is a legal piece ----------
{
  const cat = S.CATALOG(), all = Object.values(cat).flat();
  const fam = Object.fromEntries(Object.entries(cat).map(([f, a]) => [f, a.length]));
  let why = "";
  for (const kind of all) for (let r = 0; r < 4 && !why; r++) {
    const p = S.problems(S.shapeOf(kind, r));
    if (p.length) why = `${kind}@${r}: ${p[0]}`;
  }
  check(!why, `all ${all.length} catalogue pieces (${Object.entries(fam).map(([f, n]) => `${f} ${n}`).join(", ")}) are legal in all four turns${why ? `: ${why}` : ""}`);
  let id = true;
  for (const kind of all.slice(0, 400)) {
    let sh = S.shapeOf(kind, 0);
    const first = JSON.stringify(sh.wheels.map(w => [Math.round(w.x * 100), Math.round(w.y * 100)]));
    // turning four times is the identity: the shape at rot 4 is the shape at rot 0
    if (JSON.stringify(S.shapeOf(kind, 4).wheels.map(w => [Math.round(w.x * 100), Math.round(w.y * 100)])) !== first) id = false;
    const r1 = S.shapeOf(kind, 1);
    if (!sh.ports.every(q => r1.ports.some(p => p.s === (q.s + 1) % 4 && p.w === q.w))) id = false;
  }
  check(id, "four turns are the identity and the ports of rot 1 are the ports of rot 0 turned");
  // the old thirteen are the same pieces: module 5, layer 1, same positions as pipes-train.js SHAPES
  let same = true, wr = "";
  for (const [old, [kind, rot]] of Object.entries(OLD_KIND)) {
    const sh = S.shapeOf(kind, rot), o = Old.SHAPES[old];
    o.gears.forEach((g, i) => {
      const w = sh.wheels[i];
      if (!w || !near(w.x, g.x) || !near(w.y, g.y) || w.n !== g.n || w.m !== 5 || w.l !== 1) { same = false; wr = `${old} gear ${i}`; }
    });
    for (const [side, gi] of Object.entries(o.port)) if (!sh.ports.some(q => q.s === Number(side) && q.w === gi)) { same = false; wr = `${old} port ${side}`; }
  }
  check(same, `the old thirteen pieces are module 5, layer 1 pieces of the catalogue with the same positions${wr ? ` (${wr})` : ""}`);
  check(S.orientations("S5.1").length === 1 && S.orientations("D5.1:6+6").length === 2 && S.orientations("D5.1:5>5e").length === 4 && S.orientations("D5.1:4+8").length === 4, "distinct orientations: a single 1, a straight 6+6 duo 2, an elbow 4, a straight 4+8 duo 4 (which end is which)");
  const tooth = S.shapeOf("S5.1", 0).wheels[0];
  check(tooth.n === 12 && S.shapeOf("S4.1", 0).wheels[0].n === 15 && S.shapeOf("S6.1", 0).wheels[0].n === 10, "singles have 15, 12, 10 teeth at modules 4, 5, 6 (pitch radius 30)");
  // stacks close, risers have eight ports
  const k = S.shapeOf("K[5.1>5.2]:8/4>6", 0);
  check(Math.abs(k.gap) < 0.01 && k.wheels[0].l === 1 && k.wheels[1].l === 2 && k.wheels[0].a === k.wheels[1].a && S.shapeOf("R[5.1,5.2]", 0).ports.length === 8, "a stack's out wheel meshes its pinion exactly, wheel and pinion share an arbor on two layers; a riser has 4 sides x 2 layers");
  // mirror images
  let mir = true;
  for (const kind of ["D5.1:4>6e", "T5.1:4-5-4e", "D5.1:4+8", "K[5.1>5.2]:8/4>6", "T4.1:4-7-6"]) for (let r = 0; r < 4; r++) { try { S.mirrorPiece(kind, r); } catch { mir = false; } }
  check(mir, "every piece has a mirror image in the catalogue (for the plate's reflections)");
}

// ---------- speeds: one speed per wheel ----------
{
  const L = E.parseLevel({ ...row(3, { hand: "S5.1:2 D5.1:6+6:1" }) });
  const laid = lay(L, { 1: "S5.1@0", 2: "D5.1:6+6@0", 3: "S5.1@0" });
  const M = E.mesh(L, laid);
  const g = (c, i = 0) => M.dir[c * E.SLOTS + i];
  check(g(0) === 0 && g(1) === 1 && g(2, 0) === 0 && g(2, 1) === 1 && g(3) === 0 && g(4) === 1, "the barrel turns clockwise, each mesh turns the next wheel the other way (a duo has two wheels, so it flips)");
  check(F.eq(M.omega[1 * E.SLOTS], F.mk(-3, 4)) && F.eq(M.omega[2 * E.SLOTS], F.mk(3, 2)) && F.eq(M.omega[4 * E.SLOTS], F.mk(-1, 1)), "speeds are exact: the 9-tooth barrel drives a 12-tooth single at 3/4 the other way, a 6-tooth wheel at 3/2, and the 9-tooth sink at 1 (counter-clockwise)");
  // tooth rate is the same everywhere along meshes
  let tr = true;
  for (const e of M.edges) if (e.kind === "mesh") { const u = M.gears[M.idx[e.u]], v = M.gears[M.idx[e.v]]; if (!F.eq(F.abs(F.mul(M.omega[e.u], [u.n, 1])), F.abs(F.mul(M.omega[e.v], [v.n, 1])))) tr = false; }
  check(tr, "on every mesh the two wheels have the same tooth rate (teeth x speed)");
}
{
  // a stack steps the tooth rate: K 8/4>6 entered at its 8-tooth wheel gives the sink 1/2; entered at the pinion's side, double
  const f = FIXTURES.ratio.frame.res;
  check(F.eq(f.comps[0].has, [1, 2]) && f.solved, "a stack K[5.1>5.2]:8/4>6 halves the tooth rate: the sink runs at 1/2 and the level is solved");
  const L = E.parseLevel({ ...row(3, { hand: "S5.1:1 K[5.1>5.2]:8/4>6:1 S5.2:1", sl: 2, n: 9 }), });
  const laid = lay(L, { 1: "S5.1@0", 2: "K[5.1>5.2]:8/4>6@2", 3: "S5.2@0" });
  const r = E.check(L, laid);
  check(!r.solved && r.M.clash.length + r.M.loops.length + r.strays.length >= 0, "the same stack turned round does not join the train it was laid in");
}
{
  // a ring of six squares: even number of meshes turns freely, an odd one jams
  const spec = {
    id: "ring", cols: 5, rows: 2, map: [".....", "....."], rotate: true,
    trains: [{ id: "A", barrel: { c: 0, side: "E", m: 5, l: 1 }, sink: { c: 4, side: "W", m: 5, l: 1, n: 9, goal: { type: "wheel" } } }],
    hand: "S5.1:5 D5.1:6+6:1",
  };
  const L = E.parseLevel(spec);
  const ring = { 1: "S5.1@0", 2: "S5.1@0", 3: "S5.1@0", 8: "S5.1@0", 7: "S5.1@0", 6: "S5.1@0" };
  const M = E.mesh(L, lay(L, ring));
  check(M.loops.length === 0 && M.jam.size === 0, "a ring of six single wheels (six meshes) turns freely: no jam");
  const M2 = E.mesh(L, lay(L, { ...ring, 7: "D5.1:6+6@0" }));
  check(M2.jam.size >= 3 && M2.loops[0].why === "turn", "a duo in the ring makes seven meshes, an odd loop: two wheels must turn both ways, the loop is a jam");
}
{
  // a bind: a ring through a stack, with an even number of meshes, so the signs agree and the speeds do not
  const spec = {
    id: "bind", cols: 5, rows: 2, map: [".....", "....."], rotate: true,
    trains: [{ id: "A", barrel: { c: 0, side: "E", m: 5, l: 1 }, sink: { c: 4, side: "W", m: 5, l: 2, n: 9, goal: { type: "wheel" } } }],
    hand: "S5.1:1 K[5.1>5.2]:8/4>6:1 S5.2:2 R[5.1,5.2]:1 D5.1:5>5e:1",
  };
  const L = E.parseLevel(spec);
  const laid = lay(L, { 1: "S5.1@0", 2: "K[5.1>5.2]:8/4>6@0", 3: "S5.2@0", 8: "S5.2@0", 7: "R[5.1,5.2]@0", 6: "D5.1:5>5e@0" });
  const M = E.mesh(L, laid), r = E.check(L, laid);
  check(M.loops.length > 0 && M.loops.every(l => l.why === "bind") && M.jam.size >= 6 && !r.solved && r.messages[0].includes("bind"), "a ring through a stack whose ratios do not multiply to 1 binds (same turns, two speeds), and the check says bind");
}
{
  // clash and tangle
  const c = FIXTURES.clash.frame.res;
  check(c.clashes.length === 1 && !c.solved && c.messages[0].includes("clash"), "two modules on one layer clash, and the check says so first");
  const two = E.parseLevel({
    id: "tan", cols: 3, rows: 2, map: ["...", "..."], rotate: true, hand: "S5.1:2",
    trains: [
      { id: "A", barrel: { c: 0, side: "E", m: 5, l: 1 }, sink: { c: 2, side: "W", m: 5, l: 1, n: 9, goal: { type: "wheel" } } },
      { id: "B", barrel: { c: 3, side: "E", m: 5, l: 1 }, sink: { c: 5, side: "W", m: 5, l: 1, n: 9, goal: { type: "wheel" } } },
    ],
  });
  const r = E.check(two, lay(two, { 1: "S5.1@0", 4: "S5.1@0" }));
  check(r.tangles.length === 1 && !r.solved && r.messages.some(m => m.includes("A touches B")), "two trains whose wheels mesh are tangled, even at the same speed: not solved");
  const lay2 = lay(two, { 1: "S5.1@0", 4: "S5.1@0" });
  const apart = E.parseLevel({ ...two.spec, map: ["...", "..."], trains: [two.spec.trains[0], { ...two.spec.trains[1], barrel: { ...two.spec.trains[1].barrel, l: 2 }, sink: { ...two.spec.trains[1].sink, l: 2 } }], hand: "S5.1:1 S5.2:1" });
  const r2 = E.check(apart, lay(apart, { 1: "S5.1@0", 4: "S5.2@0" }));
  check(r2.tangles.length === 0 && r2.clashes.length === 0 && r2.solved, "the same two rows on two layers pass each other: nothing meshes, both trains solve");
  void lay2;
}
{
  const j = FIXTURES.jam.frame.res;
  check(j.jams.length >= 3 && !j.solved && j.M.loops[0].why === "turn", "the jam fixture's odd ring is locked and reported as a jam");
}

// ---------- the fixtures ----------
{
  const solved = ["train", "ratio", "pitches", "riser", "bridge", "hands", "date", "moon"].every(k => FIXTURES[k].frame.res.solved);
  check(solved && !FIXTURES.idle.frame.res.solved && !FIXTURES.jam.frame.res.solved && !FIXTURES.clash.frame.res.solved, "the fixtures are what they say: eight solved, idle, jam and clash not");
  const f = FIXTURES.pitches.frame;
  check(f.M.tangle.length === 0 && f.res.trains.length === 2 && f.res.trains.every(t => t.path), "two pitches: two trains, each a path, no tangle");
  const h = FIXTURES.date.frame.res.M;
  check(h.edges.some(e => e.kind === "ring") && FIXTURES.date.frame.res.comps[0].dir === 0, "the date sink's ring is a ring mesh: it turns the way its pinion does");
  // tooth phases: along every mesh of a tree the teeth are in step
  let ok = true;
  for (const key of ["train", "ratio", "pitches"]) {
    const fr = FIXTURES[key].frame, M = fr.M;
    for (const e of M.edges) {
      if (e.kind !== "mesh") continue;
      const u = M.gears[M.idx[e.u]], v = M.gears[M.idx[e.v]], th = Math.atan2(v.y - u.y, v.x - u.x) * 180 / Math.PI;
      const fu = ((((th - fr.phase[e.u]) / (360 / u.n)) % 1) + 1) % 1, fv = ((((th + 180 - fr.phase[e.v]) / (360 / v.n)) % 1) + 1) % 1;
      if (Math.abs((((fu + fv) % 1) + 1) % 1 - 0.5) > 0.02) ok = false;
    }
  }
  check(ok, "tooth phases: on every mesh of the fixtures a tooth of one wheel lies in a gap of the other");
}

// ---------- the rules of laying ----------
{
  const L = E.parseLevel({ ...row(4, { hand: "S5.1:2 D5.1:5>5e:1 K[5.1>5.2]:8/4>6:1", clicks: [{ c: 3, dir: "cw" }] }), map: [".1#..."] });
  const laid = E.emptyLaid(L);
  check(E.lay(L, laid, 0, "S5.1") === "fixed" && E.lay(L, laid, 2, "S5.1") === "fixed", "the barrel and a pillar are fixed");
  check(E.lay(L, laid, 1, "K[5.1>5.2]:8/4>6") === "ceiling", "a bridge of height 1 refuses a piece with a wheel on layer 2");
  check(E.lay(L, laid, 3, "S5.1") === "laid" && E.lay(L, laid, 3, "S5.1") === "swapped" && E.lay(L, laid, 4, "S5.1") === "laid" && E.lay(L, laid, 1, "S5.1") === "none", "lay, swap, and none left");
  const c = E.parseLevel({ ...row(4, { hand: "S5.1:1 D5.1:6+6:1", clicks: [{ c: 2, dir: "cw" }] }) });
  check(E.lay(c, E.emptyLaid(c), 2, "D5.1:6+6") === "click" && E.lay(c, E.emptyLaid(c), 2, "S5.1") === "laid", "a click takes a single only");
  const t = E.parseLevel({ ...row(2, { hand: "D5.1:4+8:1 S5.1:1" }) });
  const l2 = E.emptyLaid(t);
  E.lay(t, l2, 1, "D5.1:4+8", 0);
  const seq = [E.pieceOf(l2[1]).rot];
  for (let i = 0; i < 4; i++) seq.push(E.turn(t, l2, 1));
  check(seq.join(",") === "0,1,2,3,0", "turn steps through the four distinct orientations of an asymmetric duo and comes round");
  const s2 = E.emptyLaid(t);
  E.lay(t, s2, 2, "S5.1");
  check(E.turn(t, s2, 2) === null, "a single has no turn");
  // smart turn: the barrel's neighbour must take the barrel's side; a duo laid beside it turns to join
  const b = E.bestTurn(t, E.emptyLaid(t), 1, "D5.1:4+8");
  check(b === 0 || b === 2, "smart turn turns a straight duo west-east beside the barrel, not north-south");
}

// ---------- Book I: the forty old levels, unchanged ----------
{
  let n = 0, ids = true, agree = true, why = "";
  for (const spec of LEGACY) {
    n++;
    const L = E.parseLevel(spec);
    if (L.rotate || !/^w[a-h][1-5]$/.test(spec.id)) ids = false;
    for (const sol of L.sols) { const r = E.check(L, sol); if (!r.solved) { agree = false; why = `${spec.id}: ${r.messages[0]}`; } }
  }
  check(n === 40 && ids && agree, `Book I: ${n} levels keep their ids, don't turn, and every listed answer is solved by the new check${why ? ` (${why})` : ""}`);
  let lifted = true;
  for (const spec of LEGACY) { const L = E.parseLevel(spec), sol = L.sols[0].slice(), c = sol.findIndex(Boolean); sol[c] = null; if (E.check(L, sol).solved) lifted = false; }
  check(lifted, "with one piece lifted no old level is solved");
  let agreeJam = true, boards = 0;
  const rnd = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
  OLD_LEVELS.slice(0, 24).forEach((os, i) => {
    const L = E.parseLevel(LEGACY[i]), O = Old.parseLevel(os), kinds = Object.keys(O.hand);
    for (let k = 0; k < 6; k++) {
      const laidOld = Old.emptyLaid(O), laid = E.emptyLaid(L);
      for (let c = 0; c < O.size; c++) if (!O.cells[c] && rnd() < 0.5) { const o = kinds[Math.floor(rnd() * kinds.length)]; laidOld[c] = o; laid[c] = E.pieceStr(...OLD_KIND[o]); }
      const a = Old.check(O, laidOld), b = E.check(L, laid);
      boards++;
      if (a.jams.length !== b.jams.length || a.strays.length !== b.strays.length || a.solved !== b.solved) agreeJam = false;
    }
  });
  check(agreeJam, `on ${boards} random half-filled boards the new check finds the same jams, strays and verdict as the old one`);
}

// ---------- the new solver finds exactly the listed answers (Book I) ----------
{
  let same = 0, why = "";
  const t0 = performance.now();
  for (const spec of LEGACY) {
    const L = E.parseLevel(spec), s = solve(L, 20, 4e6);
    const want = new Set(L.sols.map(a => a.map(p => p || "").join(","))), got = new Set(s.sols.map(x => x.laid.map(p => p || "").join(",")));
    if (!s.aborted && want.size === got.size && [...want].every(k => got.has(k))) same++; else why = spec.id;
  }
  check(same === 40, `the new solver finds exactly the listed answers of all 40 old levels (${same} of 40${why ? `, first miss ${why}` : ""}, ${(performance.now() - t0).toFixed(0)} ms)`);
}

// ---------- the symmetries of a plate ----------
{
  const spec = {
    id: "sym", cols: 3, rows: 3, map: ["...", "...", "..."], rotate: true, hand: "S5.1:1 D5.1:4>6e:1 S5.1:1",
    trains: [{ id: "A", barrel: { c: 0, side: "E", m: 5, l: 1 }, sink: { c: 8, side: "N", m: 5, l: 1, n: 9, goal: { type: "wheel", speed: "1", dir: "cw" } } }],
    sols: [{ 1: "S5.1@0", 2: "D5.1:4>6e@2", 5: "S5.1@0" }],
  };
  const L0 = E.parseLevel(spec), r0 = E.check(L0, L0.sols[0]);
  // the plate's own goal comes from its drawing
  const w = r0.M.omega[8 * E.SLOTS];
  spec.trains[0].sink.goal = { type: "wheel", speed: F.fmt(F.abs(w)), dir: w[0] > 0 ? "cw" : "ccw" };
  const L1 = E.parseLevel(spec);
  check(E.check(L1, L1.sols[0]).solved, "the symmetry test's plate is solved by its own answer");
  let ok = true, why = "";
  const count = solve(L1, 20, 1e5).sols.length;
  for (let k = 0; k < 8; k++) {
    const t = transformLevel(spec, k), L = E.parseLevel(t), r = E.check(L, L.sols[0]);
    if (!r.solved) { ok = false; why += ` k${k}: ${r.messages[0]}`; continue; }
    const s = solve(L, 20, 1e5), key = a => a.map(p => p || "").join(",");
    if (s.sols.length !== count || !s.sols.some(x => key(x.laid) === key(L.sols[0]))) { ok = false; why += ` k${k}: ${s.sols.length} answers, not ${count}`; }
  }
  check(ok, `all eight turns and mirrors of a plate with an asymmetric elbow keep the answer and the number of answers (${count})${why}`);
}

if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log("\nall pipes-gear checks passed");
