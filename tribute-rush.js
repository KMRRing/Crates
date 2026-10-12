// Tribute's puzzle rush: positions from the computer players' own hands where one play is clearly best, the bank in
// tribute-puzzles.js (tools/tribute-puzzles.mjs finds them). A puzzle is the deal and the moves that led to it, so it
// replays through the engine to exactly the table the player saw; with it come the plays weighed and what each was
// worth when the rest of the hand was played out in hundreds of deals of the cards the player couldn't see. Pure: the
// page, the tests and the generator share it.
import * as E from "./tribute-engine.js";

// ---------- a puzzle as text ----------
// A move: a pass "-", a return "r" and its card, a play its cards (each card two base-36 digits) and a full stop.
const id2 = id => id.toString(36).padStart(2, "0");
export const encodeAction = a => (a.t === "pass" ? "-" : a.t === "return" ? `r${id2(a.card)}` : `${a.cards.map(id2).join("")}.`);
export function decodeActions(s) {
  const out = [];
  for (let i = 0; i < s.length;) {
    if (s[i] === "-") { out.push({ t: "pass" }); i++; continue; }
    if (s[i] === "r") { out.push({ t: "return", card: parseInt(s.slice(i + 1, i + 3), 36) }); i += 3; continue; }
    const cards = [];
    while (s[i] !== ".") { cards.push(parseInt(s.slice(i, i + 2), 36)); i += 2; }
    out.push({ t: "play", cards });
    i++;
  }
  return out;
}
/** The hand a puzzle comes from: the first of a match (h 0), or a later one with its levels and tribute (h 1). */
export function gameOf(p) {
  const game = { v: 1, opts: E.DEFAULTS, levels: [2, 2], declarer: -1, handNo: 0, lastOrder: null, results: [] };
  return p.h ? { ...game, levels: p.lv, declarer: p.dc, handNo: 1, lastOrder: p.lo } : game;
}
/** The puzzle's table: the deal, every move before it made again, and the seat to move. */
export function replay(p) {
  const st = E.deal(gameOf(p), p.s);
  for (const a of decodeActions(p.acts)) E.act(st, E.waitingOn(st)[0], a);
  if (E.waitingOn(st)[0] !== p.seat) throw new Error(`puzzle ${p.id}: seat ${p.seat} isn't to move`);
  return st;
}

// ---------- telling plays apart ----------
// Two plays alike by the engine's signature are the same answer (a pair of 9s is a pair of 9s in any suits).
const { signature } = E;
export { signature };
/** The puzzle's plays weighed: [{ action, value }], and which is best and which do as well. */
export function weighed(p) {
  const opts = p.opts.map((s, i) => ({ action: decodeActions(s)[0], value: p.vals[i] }));
  return { opts, best: opts[p.best], ok: p.ok.map(i => opts[i]) };
}

/**
 * The verdict on a move: { verdict: "best" | "fine" | "wrong" | "unweighed", mine, best, gap } — mine the option the
 * move is (by signature), gap how many levels a hand it falls short of the best on average. A move outside the plays
 * weighed is "unweighed": the page tries it against the best with a look-ahead of its own.
 */
export function judge(p, state, action) {
  const { opts, best, ok } = weighed(p);
  const sig = signature(action, state.level);
  const mine = opts.find(o => signature(o.action, state.level) === sig);
  if (!mine) return { verdict: "unweighed", mine: null, best, gap: null };
  const gap = best.value - mine.value;
  return { verdict: mine === best ? "best" : ok.includes(mine) ? "fine" : "wrong", mine, best, gap };
}

// ---------- a run ----------
/**
 * The order a run deals its puzzles: rising difficulty, three or so at each step, chosen at random within a step from
 * those not seen lately (`recent`: ids), any seen if a step runs dry.
 */
export function runOrder(bank, seed, recent = []) {
  const r = E.rng(seed), seen = new Set(recent), out = [], used = new Set();
  for (let step = 1; step <= 10; step++) {
    const pool = bank.filter(p => p.r === step && !used.has(p.id));
    const fresh = pool.filter(p => !seen.has(p.id)), from = fresh.length >= 3 ? fresh : pool;
    for (let i = 0; i < 4 && from.length; i++) {
      const j = Math.floor(r() * from.length), p = from.splice(j, 1)[0];
      out.push(p.id); used.add(p.id);
    }
  }
  // then anything left, hardest first, for a run that goes on
  for (const p of bank.filter(x => !used.has(x.id)).sort((a, b) => b.r - a.r)) out.push(p.id);
  return out;
}
