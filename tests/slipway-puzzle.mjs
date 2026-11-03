// Slipway as a puzzle (slipway-levels.js, slipway-puzzle.js): every level is solved by its own solution through the same
// rules the page uses, within its budget and at its par, and no use of it can be left out; a search of every way to use
// the level's tools finds nothing shorter; and what the puzzle is about is shown to bite: a cut drawn from the wrong side
// goes wrong, a hole bored after the slope is cut is refused, a plane stroke before the saw runs out of strokes, a part
// left where the knot is can't be finished.
import { LEVELS } from "../slipway-levels.js";
import { VIEWS, eyeFor, woodBox, hit } from "../slipway-carve.js";
import { planSaw, planeThrough, outline, planDrill, soleFacing, strokeFacing, doPlane, strokeOn, status, starsFor, play, apply, blockFor, search, hint, newUsed, left, library, total, support } from "../slipway-puzzle.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const level = id => LEVELS.find(l => l.id === id);
const solved = (L, ops, at) => { const b = blockFor(L, at || L.solution.place), used = newUsed(); let ok = true; for (const op of ops) { const r = apply(b, op); if (!r.ok) ok = false; else used[op.tool]++; } return { b, used, ok, solved: status(b).solved }; };
const same = (a, b) => { let n = 0; for (let m = 0; m < a.d.length; m++) if (Math.abs(a.d[m] - b.d[m]) > 128) n++; return n; };

// ---------- the levels ----------
{
  check(new Set(LEVELS.map(l => l.id)).size === LEVELS.length && LEVELS.every(l => l.name && l.line && l.par > 0 && l.solution?.ops?.length === l.par), "every level has its own id, a name, what it's for, and a solution as long as its par");
  const fit = LEVELS.every(l => { const b = blockFor(l); const cells = b.d.length; return cells <= 26000 && b.inside.length > 100 && b.inside.length < cells * 0.9; });
  check(fit, "every part lies in its block with waste to take, and no block is too big for a phone (26,000 cells)");
  const knots = LEVELS.every(l => l.knots.every(k => k.length === 4) && l.knots.length <= 3);
  check(knots, "knots are placed by hand, three at most");
}

// ---------- every level is solved by its solution, within its budget, at its par ----------
for (const L of LEVELS) {
  const r = play(L), st = status(r.b);
  const uses = r.used.saw + r.used.plane + r.used.drill;
  check(r.results.every(x => x.ok) && st.solved, `${L.name}: its solution works through the rules (${r.results.map(x => (x.ok ? "ok" : x.reason)).join(", ")})`);
  check(Object.keys(L.budget).every(t => r.used[t] <= L.budget[t]) && uses === L.par && starsFor(L, uses) === 3, `${L.name}: within its budget, at its par of ${L.par}, three stars`);
  check(starsFor(L, L.par + 1) === 2 && starsFor(L, L.par + 2) === 1 && total(L) >= L.par, `${L.name}: a tool over is two stars, two over one`);
  // every use is needed: leave any one out and it isn't solved
  const spare = L.solution.ops.every((_, i) => solved(L, L.solution.ops.filter((__, j) => j !== i)).solved === false);
  check(spare, `${L.name}: leave any one use out and it isn't solved`);
}

// ---------- nothing shorter: a search of every use of the tools ----------
for (const L of LEVELS) {
  const r = search(L, L.solution.place || L.place);
  check(r && r.best === L.par && r.orders >= 1, `${L.name}: the search of every use finds nothing shorter than its par ${L.par} (${r ? r.orders : 0} orders solve it)`);
}

// ---------- the angle: the cut is the plane through your eye and your line ----------
{
  const planeOf = (b, op) => { const u = [op.u[0] * (b.flip ? -1 : 1), op.u[1], op.u[2]]; return planSaw(b, u, support(b, u).h + 0.25); };
  // the longest edge of the cut's outline that is not along the line of sight (that edge is a point from there, not a line)
  const longest = (poly, eye, b) => {
    const w = woodBox(b), mid = [(w[0] + w[3]) / 2, (w[1] + w[4]) / 2, (w[2] + w[5]) / 2], sight = eye.map((v, i) => v - mid[i]), sl = Math.hypot(...sight);
    return poly.reduce((best, x, i) => {
      const y = poly[(i + 1) % poly.length], d = [y[0] - x[0], y[1] - x[1], y[2] - x[2]], l = Math.hypot(...d);
      const along = Math.abs(d[0] * sight[0] + d[1] * sight[1] + d[2] * sight[2]) / (l * sl);
      return along < 0.94 && l > best[2] ? [x, y, l] : best;
    }, [null, null, -1]);
  };
  /** The cut laid by a line drawn along an edge of the wanted cut, seen from `view`. */
  const drawn = (b, want, view, move = [0, 0, 0]) => {
    const eye = eyeFor(b, VIEWS[view] || view), [p, q] = longest(outline(b, want.u, want.s), eye, b), shift = v => v.map((c, i) => c + move[i]);
    const { n, d0 } = planeThrough(eye, shift(p), shift(q));
    return planSaw(b, n, d0);
  };
  const lands = (r, want) => r.ok && Math.abs(r.u.reduce((s, v, i) => s + v * want.u[i], 0)) > 0.9999 && Math.abs(r.s - want.s) < 1e-6;
  const views = { side: "side", top: "top", end: "end", diag: [-45, 0] };
  let right = 0, wrong = 0, tried = 0;
  for (const L of LEVELS) {
    const b = blockFor(L, L.solution.place);
    for (const op of L.solution.ops.filter(o => o.tool === "saw")) {
      const want = planeOf(b, op);
      tried++;
      if (lands(drawn(b, want, views[op.view]), want)) right++;
      if (!lands(drawn(b, want, "corner"), want)) wrong++;
    }
  }
  check(right === tried, `a line drawn along a face seen edge-on cuts that face, in every level (${right} of ${tried})`);
  check(wrong === tried, `the same line seen from the corner view lays another plane, and the face isn't cut (${wrong} of ${tried})`);
  // and a finger isn't a ruler: a line a few degrees off, or a cell or two outside the face, is laid on the face; five cells outside is not
  const w = level("wedge"), b = blockFor(w), want = planeOf(b, w.solution.ops[0]);
  const e = eyeFor(b, VIEWS.side), [p, q] = longest(outline(b, want.u, want.s), e, b), turned = ang => { const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], c = Math.cos(ang), s = Math.sin(ang); return [p[0] + d[0] * c - d[1] * s, p[1] + d[0] * s + d[1] * c, p[2] + d[2]]; };
  const through = (p1, p2) => { const { n, d0 } = planeThrough(e, p1, p2); return planSaw(b, n, d0); };
  check([-0.06, 0.06].every(a => lands(through(p, turned(a)), want)), "a line 3° off the face is laid on it");
  check([1, 2].every(dy => lands(drawn(b, want, "side", [0, dy, 0]), want)) && lands(drawn(b, want, "side", [0, -1, 0]), want), "so is one a cell or two outside it, or a cell inside");
  check(!lands(drawn(b, want, "side", [0, 5, 0]), want) && drawn(b, want, "side", [0, 5, 0]).ok, "five cells off is a cut of its own, leaving waste");
  check(!drawn(b, want, "side", [0, -5, 0]).ok && drawn(b, want, "side", [0, -5, 0]).reason === "into", "and five cells inside is refused: it would go into the part");
}

// ---------- the order ----------
{
  const L = level("shell"), saws = L.solution.ops.filter(o => o.tool === "saw"), drillOp = L.solution.ops.find(o => o.tool === "drill");
  const b = blockFor(L);
  apply(b, saws[0]);                                                    // the slope the hole goes through
  const r = apply(b, drillOp);
  check(!r.ok && r.reason === "skates", "block shell: bore after the slope is cut and the bit skates off it");
  const c = blockFor(L);
  apply(c, saws[1]);
  check(apply(c, drillOp).ok, "but the other slope may be cut first: the hole's own top is still square");
  check([[drillOp, saws[0], saws[1]], [drillOp, saws[1], saws[0]], [saws[1], drillOp, saws[0]]].every(o => solved(L, o).solved) && !solved(L, [saws[0], saws[1], drillOp]).solved && !solved(L, [saws[0], drillOp, saws[1]]).solved,
    "block shell: bore before the hole's slope is cut, whatever else goes first; after it, nothing works");
  const sh = blockFor(L), hitTop = [6, 16, 4];
  check(planDrill(sh, hitTop, [0, 1, 0], [0.7, -0.7, 0]).reason === "skates" && planDrill(sh, hitTop, [0, 1, 0], [-0.45, -0.44, -0.78]).reason === "skates", "the bit needs the line of sight square to the face: from the corner view it skates");

  const S = level("step"), [saw, p1, p2] = S.solution.ops;
  check(solved(S, [saw, p1, p2]).solved && !solved(S, [p1, saw, p2]).solved && !solved(S, [p1, p2, saw]).solved, "mast step: the saw before the planes, or the planes run out (they take three layers a stroke)");
  const threeStrokes = solved(S, [p1, p1, p1, saw]);
  check(threeStrokes.solved && threeStrokes.used.plane === 3 && left(S, threeStrokes.used, "plane") < 0, "(three planes would do it unsawn, and the budget is two)");

  const M = level("mast"), [dr, flat, tl, tr, pl1, pl2] = M.solution.ops;
  const tapered = blockFor(M);
  apply(tapered, tl);
  check(apply(tapered, dr).reason === "skates" && !solved(M, [flat, tl, tr, pl1, pl2, dr]).solved, "masthead: the drill after the left taper is refused, and the hole is left");
  check(solved(M, [dr, flat, tl, tr, pl1, pl2]).solved && solved(M, [dr, tr, flat, pl1, pl2, tl]).solved && !solved(M, [dr, tl, tr, pl1, pl2, flat]).solved, "masthead: drill first, the top level before the planes, the rest in any order");

  const P = level("pin");
  const fits = [{ off: 0, flip: false }, { off: 0, flip: true }, { off: 10, flip: true }].every(at => search(P, at)?.best === 3);
  const stuck = [{ off: 5, flip: false }, { off: 10, flip: false }, { off: 5, flip: true }, { off: 2, flip: false }].every(at => !search(P, at));
  check(fits && stuck, "belaying pin: slid flush against the left end, or turned and slid flush right, it comes out in three; anywhere else it is out of tools or has the knot in it");
}

// ---------- knots ----------
{
  const T = level("treenail"), b = blockFor(T);
  const stroke = T.strokes.find(s => s.aim[0][1] === 10 && s.aim[0][2] > 5);
  const n = soleFacing(b, stroke.n), r = doPlane(b, n, strokeOn(b, n, stroke.aim));
  check(!r.ok && r.reason === "knot", "treenail: the plane stops on the knot, taking nothing");
  const { b: done } = play(T);
  check(status(done).knots === 0, "treenail: the knot is in the corner that is sawn away");
  const bk = blockFor(T);
  bk.knots = [[12, 5, 5, 1.4]];
  for (const op of T.solution.ops) apply(bk, op);
  check(status(bk).knots === 1 && !status(bk).solved, "a knot left in the part is a part that isn't done");
}

// ---------- the sole follows the stroke, not its first touch ----------
{
  const S = level("step"), b = blockFor(S);
  apply(b, S.solution.ops[0]); apply(b, S.solution.ops[1]);
  // after the first stroke the pocket's wall (smoothed by the surface) is steep at both ends of the floor: a stroke begun there must not tip the sole
  const wall = hit(b, [11, 40, 3.5], [0, -1, 0]).n, floor = hit(b, [15, 40, 3.5], [0, -1, 0]).n;
  check(wall[1] < 0.5 && floor[1] > 0.99, "the pocket's wall is steep where the floor meets it");
  const run = [wall, floor, floor, floor, hit(b, [19, 40, 3.5], [0, -1, 0]).n];
  check(strokeFacing(b, run).join() === "0,1,0" && soleFacing(b, wall).join() !== "0,1,0", "a stroke that starts and ends on the wall takes the floor's facing, though the wall alone would tip it");
  const slope = [0.8, 0.6, 0];
  check(strokeFacing(b, [slope, slope, slope]).join() === slope.join(), "a stroke wholly on a slope that is no face of the part keeps the slope's facing");
}

// ---------- the drill finds its hole ----------
{
  const L = level("shell"), b = blockFor(L);
  const near = planDrill(b, [7.5, 16, 4.5], [0, 1, 0], [0, -1, 0]), far = planDrill(b, [9.5, 16, 4], [0, 1, 0], [0, -1, 0]);
  check(near.ok && near.snapped && near.p[0] === 6 && near.p[2] === 4 && !far.snapped, "the bit finds the hole within two cells, and not at three");
}

// ---------- the hint names what the block still wants ----------
{
  const S = level("step"), b = blockFor(S);
  check(hint(S, b)?.op.tool === "saw", "mast step: the hint names the saw first");
  apply(b, S.solution.ops[0]);
  check(hint(S, b)?.op.tool === "plane", "and the plane once it is cut");
  apply(b, S.solution.ops[1]); apply(b, S.solution.ops[2]);
  check(hint(S, b) === null, "and nothing when it is done");
  const P = level("pin"), pb = blockFor(P);
  check(hint(P, pb)?.place?.off === 0, "belaying pin: the hint says to slide the part first");
  const D = level("shell"), db = blockFor(D);
  check(hint(D, db)?.op.tool === "drill", "block shell: the hint says the drill first");
}

if (bad) { console.log(`${bad} failed`); process.exit(1); }
else console.log("slipway puzzle: every level solved at its par with nothing to spare, nothing shorter, the angle, the order and the knot bite, the hint");
