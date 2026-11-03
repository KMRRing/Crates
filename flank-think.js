// What the page asks the engine, and how it asks: a worker for the computer's move and one for the coach, so the board
// stays alive however long the search runs; where there is no worker (a test in Node, a browser without module
// workers) the same search runs here a moment later. Also the coach's reading of a search: who is ahead and by how much.
import { scoresFor, sidesOf } from "./flank-bot.js";
import { rootScores } from "./flank-engine.js";

/** The coach looks eight moves ahead and plays the last fourteen squares out: its word is exact from there. */
export const COACH = { depth: 8, exact: 14 };
const INLINE_CAP = 300000;                 // positions, when searching here instead of in a worker

function run(msg, cap = Infinity) {
  if (msg.kind === "move") return scoresFor(msg.b, msg.t, msg.level, cap);
  const [pl, ph, ol, oh] = sidesOf(msg.b, msg.t);
  return rootScores(pl, ph, ol, oh, { depth: msg.depth, exact: msg.exact, all: !!msg.all, nodes: cap });
}
/** A search that can be asked many times; ask() resolves with the scores, or rejects if it was cancelled. */
export function createThinker() {
  let worker = null, broken = typeof Worker === "undefined", next = 0;
  const waiting = new Map();
  function start() {
    if (broken) return null;
    if (worker) return worker;
    try {
      worker = new Worker(new URL("./flank-worker.js", import.meta.url), { type: "module" });
      worker.onmessage = e => {
        const w = waiting.get(e.data.id);
        waiting.delete(e.data.id);
        if (!w) return;
        if (e.data.error) w.reject(new Error(e.data.error)); else w.resolve(e.data.scores);
      };
      worker.onerror = () => { broken = true; worker = null; const all = [...waiting.values()]; waiting.clear(); all.forEach(w => w.fallback()); };
    } catch { broken = true; worker = null; }
    return worker;
  }
  return {
    /** msg: { kind: "move", b, t, level } or { kind: "coach", b, t, depth, exact, all }. */
    ask(msg) {
      return new Promise((resolve, reject) => {
        const inline = () => setTimeout(() => { try { resolve(run(msg, INLINE_CAP)); } catch (e) { reject(e); } }, 0);
        const w = start();
        if (!w) { inline(); return; }
        const id = ++next;
        waiting.set(id, { resolve, reject, fallback: inline });
        w.postMessage({ ...msg, id });
      });
    },
    /** Drops the worker (and what it was thinking): a new one starts at the next ask. */
    stop() {
      if (worker) worker.terminate();
      worker = null;
      const all = [...waiting.values()];
      waiting.clear();
      all.forEach(w => w.reject(new Error("stopped")));
    },
  };
}

/** The disc difference an exact score stands for (dark minus light is the caller's to flip). */
export const exactMargin = score => Math.round((score - Math.sign(score) * 20000) / 100);
/**
 * A search read for the coach, from dark's side: { score (hundredths of a disc, dark's view), exact (the game played
 * out: margin is the result in discs, dark minus light), margin, best (the best move's square) }.
 */
export function verdict(scores, t) {
  if (!scores?.length) return null;
  const top = scores[0], sign = t === "d" ? 1 : -1;
  return { score: top.score * sign, exact: !!top.exact, margin: top.exact ? exactMargin(top.score) * sign : null, best: top.sq };
}
/** Dark's share of the board's balance, 0 to 1, for the meter: the exact margin or the search's score, squashed. */
export function share(v) {
  if (!v) return 0.5;
  if (v.exact) return v.margin === 0 ? 0.5 : v.margin > 0 ? Math.min(0.97, 0.78 + v.margin / 120) : Math.max(0.03, 0.22 + v.margin / 120);
  return 1 / (1 + Math.exp(-v.score / 1600));
}
