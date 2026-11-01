// A computer player for Pipes' Plan (README, Pipes), used by tests/pipes-plan.mjs to measure how hard a level is: it
// plans a route to the terminal or the quota several squares ahead, keeping only the stretches of it that the pieces on
// show can fill in time (square i of the route must be down by the oil's i-th beat), lays the next piece where the plan
// can use it and otherwise as far from the oil's end as it can. It thinks no longer than a few tries a move, so it plays
// below a careful person, who may stop and take as long as she likes.
import * as B from "../pipes-engine.js";

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
/** How many squares of the route the pieces on show can fill in time: square i must be down by the (m + i)th piece. */
function feasible(L, P, route, m) {
  const need = route.map(s => (s.b < 0 ? null : L.cells[s.c] ? "fixed" : FIT[`${s.a}${s.b}`]));
  const doneAt = route.map((s, i) => (need[i] === "fixed" || (need[i] && P.grid[s.c] && need[i].includes(P.grid[s.c])) ? -1 : Infinity));
  for (let j = 0; j < B.SHOWN; j++) {
    const kind = B.pieceAt(L, P.next + j), i = route.findIndex((s, i) => doneAt[i] === Infinity && need[i] && need[i] !== "fixed" && need[i].includes(kind));
    if (i >= 0) doneAt[i] = j;
  }
  let n = 0;
  while (n < route.length && need[n] && doneAt[n] <= m + n - 1) n++;
  return n;
}
export function choose(L, P, r, tries = 40) {
  const ah = B.ahead(L, P), last = ah.cells.length ? ah.cells[ah.cells.length - 1] : P.path.length ? P.path[P.path.length - 1] : { c: L.source.c, b: L.source.d };
  const end = { c: B.beyond(last.c, last.b), a: B.back(last.b) };
  const m = (P.flowing ? 0 : P.lead) + 1 + ah.cells.length;
  const used = new Set([...P.path.map(s => s.c), ...ah.cells.map(s => s.c)]), want = L.quota + 2 - ah.length;
  let plan = null, best = -Infinity;
  for (let i = 0; i < tries; i++) {
    const route = walk(L, P, end.c, end.a, r, used);
    if (!route.length) continue;
    const n = feasible(L, P, route, m), v = Math.min(n, want + 4) * 10 + (route.term && n >= route.length - 1 ? 60 : 0) + Math.min(route.length, want + 6);
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
  for (let c = 0; c < B.COLS * B.ROWS; c++) { if (L.cells[c] || P.grid[c] || on.has(c) || B.oiled(P, c)) continue; const [x, y] = B.xy(c), d = Math.abs(x - ex) + Math.abs(y - ey); if (d > fd) { fd = d; far = c; } }
  return far;
}
export function playPlan(seed, n, extra = 2) {
  const L = B.deal(seed, n), P = B.newPlay(L, true), r = B.rng(seed ^ 0xABCDEF);
  for (let g = 0; g < 300 && !P.over; g++) {
    const a = B.ahead(L, P);
    if (B.winsNow(L, P) && (a.length >= L.quota + extra || a.end.why === "terminal")) { B.runOut(L, P); break; }
    const c = choose(L, P, r);
    if (c < 0) break;
    B.place(L, P, c);
  }
  return { P, L };
}
