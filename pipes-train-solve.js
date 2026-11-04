// Gears, the solver that proves a level has its answer (and how many). It runs the power from the mainspring, tries at every
// open square each piece of the hand that takes the power in, and keeps the walks that use the hand exactly, run through every
// fixed gear, turn every load its way, end in the load turning its way, and jam nowhere: a gear laid beside a gear it would
// mesh with must turn the other way from it. Used by the generator (pipes-train-make.js) and tests/pipes-train.mjs; no page
// loads it, the levels carry their answers.
import { SHAPES, END, KINDS, beyond, back, exitsFrom, routeChar, clsOf } from "./pipes-train.js";

/**
 * Every answer of the level L, up to `cap`: { sols: [{ route, laid }], nodes, capped }. A route is the side each square is left
 * by (pipes-train.js: layRoute turns it into pieces); two walks that lay the same pieces on the same squares are one answer.
 * `capped` is true when it stopped at the cap or at `limit` squares tried (then `aborted` too). opts.jams false: ignore jams
 * (to count how many answers the jam rule rules out). opts.order(kinds) puts the pieces to try in another order.
 */
export function solve(L, cap = 2, limit = 4e6, opts = {}) {
  const n = L.size, jams = opts.jams !== false, kinds = KINDS.filter(k => L.hand[k]), hand = { ...L.hand };
  const shapeNow = Array(n).fill(null), laidNow = Array(n).fill(null), turnAt = new Int8Array(n * 3).fill(-1);
  const sols = [], seen = new Set(), route = [];
  const t = beyond(L, L.terminal.c, L.terminal.d);
  if (t < 0 || beyond(L, L.source.c, L.source.d) < 0) return { sols, nodes: 0, capped: false, aborted: false };
  const [tx, ty] = [t % L.cols, Math.floor(t / L.cols)];
  const dist = Array.from({ length: n }, (_, c) => Math.abs(c % L.cols - tx) + Math.abs(Math.floor(c / L.cols) - ty));
  shapeNow[L.source.c] = END[L.source.d]; turnAt[L.source.c * 3] = 0;
  let nodes = 0, left = L.total, oldsLeft = L.olds, aborted = false;

  /** Whether the gears of `sh` at c, turning as `turns`, clash with a gear already down that they would mesh with. */
  const clash = (c, sh, turns) => {
    for (const s of sh.sides) {
      const m = beyond(L, c, s), o = m >= 0 ? shapeNow[m] : null;
      if (!o || o.port[back(s)] === undefined) continue;
      const u = turnAt[m * 3 + o.port[back(s)]];
      if (u >= 0 && u === turns[sh.port[s]]) return true;
    }
    return false;
  };
  function record() {
    const key = laidNow.map(p => p || "").join(",");
    if (seen.has(key)) return;
    seen.add(key);
    sols.push({ route: route.join(""), laid: laidNow.slice() });
  }
  function go(c, a, e) {
    if (aborted || sols.length >= cap) return;
    if (++nodes > limit) { aborted = true; return; }
    const f = L.cells[c];
    if (f) {
      if (f.k === "terminal") { if (f.d === a && !left && !oldsLeft && e === L.spin) record(); return; }
      if (f.k !== "old") return;
    }
    if (shapeNow[c]) return;
    const m = left + oldsLeft;
    if (!m || dist[c] > m - 1 || ((m - 1 - dist[c]) & 1)) return;
    const load = L.load[c];
    const step = (kind, isOld) => {
      const sh = SHAPES[kind];
      if (sh.port[a] === undefined || (load >= 0 && (kind !== "g" || e !== load))) return;
      const at = sh.port[a], turns = sh.gears.map((_, i) => e ^ (Math.abs(i - at) & 1));
      if (jams && clash(c, sh, turns)) return;
      shapeNow[c] = sh; turns.forEach((v, i) => { turnAt[c * 3 + i] = v; });
      if (isOld) oldsLeft--; else { hand[kind]--; left--; laidNow[c] = kind; }
      for (const b of exitsFrom(kind, a)) {
        const next = beyond(L, c, b);
        if (next < 0) continue;
        route.push(routeChar(clsOf(kind), b));
        go(next, back(b), turns[sh.port[b]] ^ 1);
        route.pop();
      }
      if (isOld) oldsLeft++; else { hand[kind]++; left++; laidNow[c] = null; }
      shapeNow[c] = null; for (let i = 0; i < 3; i++) turnAt[c * 3 + i] = -1;
    };
    if (f) return step(f.piece, true);
    for (const k of opts.order ? opts.order(kinds) : kinds) if (hand[k] > 0) step(k, false);
  }
  go(beyond(L, L.source.c, L.source.d), back(L.source.d), 1);
  return { sols, nodes, capped: sols.length >= cap || aborted, aborted };
}
