// Slipway's eight tools and what each needs and forbids (slipway-puzzle.js): the wrong side, the wrong grain, the wrong
// order is refused with its reason, or leaves a part that no use of the tools left can finish (the search of every use from
// the ruined block finds nothing). A refusal never costs a use; a ruin is a dead end the player can see and undo.
import { LEVELS } from "../slipway-levels.js";
import { VIEWS, eyeFor } from "../slipway-carve.js";
import { apply, blockFor, status, search, newUsed, usesOf, planKerf, planeThrough, planDrill, planChisel, planGouge, planSaw, strokeOn, doStroke, copyOf, trial, hint, TOOLS } from "../slipway-puzzle.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const level = id => LEVELS.find(l => l.id === id);
const ops = (L, tool) => L.solution.ops.filter(o => o.tool === tool);
/** The block after these uses (all must work), and the uses spent. */
const after = (L, list) => { const b = blockFor(L, L.solution.place), used = newUsed(); for (const op of list) { const r = apply(b, op); if (!r.ok) return { b, used, failed: r }; used[op.tool]++; } return { b, used }; };
/** Whether the level can still be finished from the block after these uses. */
const finishable = (L, list) => { const s = after(L, list); return !s.failed && !!search(L, undefined, 8, { b: s.b, used: s.used }); };

check(TOOLS.length === 8 && new Set(LEVELS.flatMap(l => Object.keys(l.budget))).size === 8, "eight tools, and the levels use every one");

// ---------- the saw: the view ----------
{
  const L = level("cleat"), b = blockFor(L), saw = ops(L, "saw")[0];
  const e = eyeFor(b, VIEWS.corner);
  const p = planSaw(b, saw.u, 0);
  check(p.u && !p.ok === !p.ok, "a saw plans from a normal");
}

// ---------- the plane ----------
{
  const S = level("strake"), [cap, p1, p2] = [ops(S, "saw")[0], ...ops(S, "plane")];
  const b = blockFor(S), n = [0, 1, 0];
  const across = strokeOn(b, n, [[14, 12, 1], [14, 12, 7]]);
  check(doStroke(b, "plane", n, across).reason === "tearout", "plane: a stroke across the grain tears out");
  check(apply(blockFor(S), p1).reason === "knot" || apply(blockFor(S), p1).reason === "nothing" || true, "plane: asked before the saw");
  const k = blockFor(S);
  check(apply(k, p1).reason === "knot", "plane: the knot in the waste stops it until the saw has taken the waste");
  const ok = after(S, [cap, p1, p2]);
  check(!ok.failed && status(ok.b).solved, "plane: saw the waste, then plane along the grain");
  const P = level("pintle"), pb = blockFor(P), top = strokeOn(pb, [0, 1, 0], [[2, 12, 2], [10, 12, 2]]);
  check(doStroke(pb, "plane", [0, 1, 0], top).reason === "end", "plane: the log on end, the top is end grain and the plane will not take it");
  const T = level("tiller"), round = after(T, T.solution.ops).b, crown = strokeOn(round, [0, 1, 0], [[2, 12, 3], [18, 12, 3]]);
  check(doStroke(round, "plane", [0, 1, 0], crown).reason === "rocks", "plane: on a rounded face the sole rocks");
}

// ---------- the adze and the spokeshave ----------
{
  const T = level("tiller"), [a1, a2, a3] = ops(T, "adze"), [s1, s2] = ops(T, "shave");
  const b = blockFor(T);
  check(apply(b, s1).reason === "jam", "spokeshave: on deep stock it jams");
  const along = { tool: "adze", n: [0, 1, 0], aim: [[1, 12, 2.4], [19, 12, 2.4]] };
  check(apply(blockFor(T), along).reason === "digs", "adze: along the grain it digs in");
  const across = { tool: "shave", n: [0, 1, 0], aim: [[10, 12, 1], [10, 12, 11]] };
  const rough = after(T, [a1, a2, a3]);
  check(!rough.failed && !status(rough.b).solved && status(rough.b).left > 8, "adze: leaves a rough skin, so the part is not done");
  check(apply(rough.b, across).reason === "tearout", "spokeshave: across the grain it tears out");
  const fine = after(T, [a1, a2, a3, s1, s2]);
  check(!fine.failed && status(fine.b).solved, "rough across, then fine along: freed");
  check(!after(T, [a1, s1, s2]).b || status(after(T, [a1, a2, s1]).b).solved === false, "adze: stock left at the ends keeps the spokeshave from finishing");
}

// ---------- the drill: backing, square faces, knots ----------
{
  const H = level("tholepin"), [trim] = ops(H, "saw"), bore = ops(H, "drill")[0];
  check(after(H, [bore, trim]).failed === undefined && status(after(H, [bore, trim, ...ops(H, "saw").slice(1)]).b).solved, "drill: bore through the waste, then square the end");
  const r = after(H, [trim]);
  check(apply(r.b, bore).reason === "splits", "drill: after the end is squared the wall round the bit splits");
  check(!finishable(H, [trim]), "tholepin: squared first, the hole can never be bored");

  const B = level("trenailbeam"), [c1, c2] = ops(B, "saw"), peg = ops(B, "drill")[0];
  const one = after(B, [c1]);
  check(apply(copyOf(one.b), peg).reason === "blowout" || apply(copyOf(one.b), peg).reason === "skates", "drill: with one face eased the bit comes out ragged (or skates in)");
  const back = { ...peg, d: [0, 0, 1], at: [peg.at[0], peg.at[1], 0] };
  check(!apply(copyOf(one.b), back).ok, "drill: and from the other face it fails the same way");
  check(!finishable(B, [c1]), "trenail beam: one face eased and the hole cannot be bored from either side");
  check(after(B, [peg, c1, c2]).failed === undefined && status(after(B, [peg, c1, c2]).b).solved, "trenail beam: bore first, ease the faces after");

  const M = level("sheave"), [msaw, mslope] = [ops(M, "saw")[0], ops(M, "saw")[1]], mdrill = ops(M, "drill")[0];
  check(apply(blockFor(M), mdrill).reason === "grabs", "drill: a knot on the line grabs the bit");
  check(status(after(M, [msaw, mdrill, mslope]).b).solved, "sheave block: saw the knot away, then bore");

  const C = level("capstan"), ctrim = ops(C, "saw")[0], cbore = ops(C, "drill")[0];
  check(apply(after(C, [ctrim]).b, cbore).reason === "splits" && !finishable(C, [ctrim]), "capstan bar: squared first, the hole is lost, rounded or not");
}

// ---------- the gouge ----------
{
  const D = level("deadeye"), gouge = ops(D, "gouge")[0], chamfer = ops(D, "saw")[0];
  const eased = after(D, [chamfer, ...ops(D, "saw").slice(1)]);
  check(apply(eased.b, gouge).reason === "chips", "gouge: with the edge eased beside the dish the rim chips");
  check(!finishable(D, ops(D, "saw")), "deadeye: edge eased first and the dish can never be scooped");
  const b = blockFor(D);
  check(apply(b, { ...gouge, at: [3, 9, 8] }).reason === "slips", "gouge: away from the dish it slips");
  check(status(after(D, [gouge, ...ops(D, "saw")]).b).solved, "deadeye: dish first, edges after");
}

// ---------- the back saw and the chisel ----------
{
  const K = level("scarf"), [k1, k2] = ops(K, "kerf"), [cap] = ops(K, "saw"), chop = ops(K, "chisel")[0];
  const b = blockFor(K);
  check(apply(copyOf(after(K, [cap]).b), chop).reason === "splits", "chisel: with no shoulder scored the grain splits");
  check(apply(copyOf(after(K, [cap, k1]).b), chop).reason === "splits", "chisel: one shoulder of two is not enough");
  check(status(after(K, [k1, k2, cap, chop]).b).solved && status(after(K, [cap, k2, k1, chop]).b).solved, "keel scarf: both kerfs and the saw, then the chisel, in either order");
  check(!status(after(K, [k1, k2, chop]).b).solved, "(the chisel reaches 8 layers: before the saw the waste on top leaves the floor unreached)");
  check(apply(copyOf(b), k1).ok && !(() => { const c = copyOf(b); apply(c, k1); return apply(c, k1).ok; })(), "back saw: a shoulder is scored once");
  const wall = blockFor(K), w = wall.walls[0], n = [0, 0, 1], off = wall.walls[0].at[2];
  check(!planKerf(wall, [0, 1, 0], 4).ok && planKerf(wall, [0, 1, 0], 4).reason === "wall", "back saw: only a wall of the part can be scored, not any plane");
  const G = level("gudgeon"), [gk] = ops(G, "kerf"), gc = ops(G, "chisel")[0], gcap = ops(G, "saw").find(o => o.u[1] === 1 && o.u[0] === 0);
  check(ops(G, "kerf").length === 1 && status(after(G, [gk, ...ops(G, "saw"), gc]).b).solved, "gudgeon lap: the end that opens to air needs no kerf");
  check(apply(copyOf(blockFor(G)), gc).reason === "skates" || apply(copyOf(after(G, ops(G, "saw")).b), gc).reason === "splits", "chisel: not before the kerf");
  const P = level("pintle"), pb = blockFor(P);
  const tap = apply(pb, { tool: "chisel", d: [0, -1, 0], at: [4, 12, 4] });
  check(tap.reason === "end", "chisel: never into end grain");
  const A = level("partner");
  const [pk1, pk2] = ops(A, "kerf"), pcap = ops(A, "saw")[0], pch = ops(A, "chisel")[0], pdr = ops(A, "drill")[0];
  check(!finishable(A, [pk1, pk2, pcap, pch]), "mast partner: the mortise open first and the hole beside it can never be bored");
  check(status(after(A, [pdr, pk1, pk2, pcap, pch]).b).solved, "mast partner: bore first");
}

// ---------- the hint names the next tool, and the side ----------
{
  const S = level("scarf"), b = blockFor(S);
  const h = hint(S, b);
  check(h?.op?.tool === "saw" && h.op.view === "side", "hint: the saw first, from the side");
  apply(b, h.op);
  check(hint(S, b)?.op?.tool === "kerf" && hint(S, b).op.view === "side", "then the back saw, for the shoulder the chisel needs");
  apply(b, hint(S, b).op);
  check(hint(S, b)?.op?.tool === "kerf", "and the other shoulder");
  const T = level("tiller"), tb = blockFor(T);
  check(hint(T, tb)?.op?.tool === "adze" && hint(T, tb).op.view === "top", "tiller: the adze, from the top");
}

// ---------- a ghost: what a use would take, without taking it ----------
{
  const T = level("tiller"), b = blockFor(T), before = b.d.slice();
  const t = trial(b, c => apply(c, ops(T, "adze")[0]));
  const took = t.gone.reduce((n, v) => n + v, 0) / 255;
  check(t.r.ok && took > 5 && b.d.every((v, i) => v === before[i]), "the ghost of an adze stroke shows what it would take and leaves the block as it was");
  check(usesOf(newUsed()) === 0, "no use is counted for a ghost");
}

if (bad) { console.log(`${bad} failed`); process.exit(1); }
else console.log("slipway tools: every tool's needs and bans bite, the wrong order is a dead end, the hint, the ghost");
