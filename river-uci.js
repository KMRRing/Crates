// River's engine spoken to in UCI (the Universal Chess Interface: lines of text such as "position fen …" and "go nodes
// 100000", answered by "info …" lines and a "bestmove"), the little of it uci.js's Engine uses: a position, a limit
// (nodes, depth or movetime), MultiPV, searchmoves and Hash. The worker (river-engine-worker.js) runs one session; the
// tests and tools run it in a process. A search runs to its end inside the command, so the page gives every search a limit.
import { Engine, START, MATE } from "./river-engine.js";

/** The centipawns reported to the page per internal centipawn: the page's thresholds (the coach, the hint's words, the
 *  review) were set for a score of Fairy-Stockfish's, in which a soldier at home is worth about 1.25 of chess's pawn. */
export const REPORT = 1;

/** A UCI session on a fresh engine: `command(line)` takes one line, `out(line)` gets each line the engine writes. */
export function createSession(out) {
  const engine = new Engine();
  let fen = START, moves = [], multipv = 1;
  const setPosition = tokens => {
    let at = 1;
    if (tokens[at] === "startpos") { fen = START; at++; }
    else if (tokens[at] === "fen") { at++; const parts = []; while (at < tokens.length && tokens[at] !== "moves") parts.push(tokens[at++]); fen = parts.join(" "); }
    moves = tokens[at] === "moves" ? tokens.slice(at + 1) : [];
    engine.setFen(fen);
    for (const m of moves) if (!engine.play(m)) throw new Error(`the move ${m} isn't legal in ${fen}`);
  };
  const info = l => {
    const score = l.mate != null ? `mate ${l.mate}` : `cp ${Math.round(l.cp * REPORT)}`;
    out(`info depth ${l.depth} multipv ${l.multipv} score ${score} nodes ${l.nodes} time ${l.time} pv ${l.pv.join(" ")}`);
  };
  const go = tokens => {
    const num = k => { const i = tokens.indexOf(k); return i >= 0 ? Number(tokens[i + 1]) : undefined; };
    if (tokens[1] === "perft") {
      const depth = Number(tokens[2]) || 1;
      let total = 0;
      for (const [m, n] of engine.divide(depth)) { out(`${m}: ${n}`); total += n; }
      out(""); out(`Nodes searched: ${total}`);
      return;
    }
    const at = tokens.indexOf("searchmoves");
    const searchmoves = at >= 0 ? tokens.slice(at + 1).filter(t => /^[a-i]\d+[a-i]\d+$/.test(t)) : null;
    let movetime = num("movetime");
    if (num("depth") === undefined && num("nodes") === undefined && movetime === undefined) movetime = 1000;   // no "infinite": nothing could stop it
    const r = engine.think({ depth: num("depth"), nodes: num("nodes"), movetime, multipv, searchmoves, onInfo: info });
    out(`bestmove ${r.best || "(none)"}`);
  };
  return {
    engine,
    command(line) {
      const tokens = String(line).trim().split(/\s+/);
      switch (tokens[0]) {
        case "uci": out("id name River"); out("id author the Codex"); out("uciok"); break;
        case "isready": out("readyok"); break;
        case "ucinewgame": engine.clearHash(); break;
        case "setoption": {
          const name = tokens.slice(tokens.indexOf("name") + 1, tokens.indexOf("value") < 0 ? undefined : tokens.indexOf("value")).join(" ").toLowerCase();
          const value = tokens.slice(tokens.indexOf("value") + 1).join(" ");
          if (name === "multipv") multipv = Math.max(1, Math.min(32, Number(value) || 1));
          else if (name === "hash") engine.setHash(Number(value) || 8);
          else if (name === "clear hash") engine.clearHash();
          break;                                             // the rest (the variant, NNUE, strength limits) means nothing here
        }
        case "position": setPosition(tokens); break;
        case "go": go(tokens); break;
        default: break;
      }
    },
  };
}

/**
 * Something a Worker's user can't tell from the worker, in this process (the tests and tools run the engine so): the
 * same session, each command run to its end inside postMessage, each line it writes delivered a moment later.
 */
export function localWorker() {
  const w = { onmessage: null, onerror: null, gone: false };
  const session = createSession(line => queueMicrotask(() => { if (!w.gone) w.onmessage?.({ data: line }); }));
  w.postMessage = cmd => {
    if (w.gone) return;
    try { session.command(String(cmd)); } catch (err) { queueMicrotask(() => w.onmessage?.({ data: { error: String(err?.message || err) } })); }
  };
  w.terminate = () => { w.gone = true; };
  return w;
}
export { MATE };
