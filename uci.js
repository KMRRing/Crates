// The engines Gambit and River play, each in a worker of its own, spoken to in UCI (the Universal Chess Interface:
// lines of text such as "position fen …" and "go nodes 100000", answered by "info …" lines and a "bestmove"). Gambit
// plays Stockfish (vendor/stockfish), River Fairy-Stockfish (vendor/fairy-stockfish, through uci-fairy.js): both are
// GPL, shipped unchanged or with the patch that built them, and loaded only when a game against one starts.
//
// An Engine starts its worker on first use and runs one search at a time. Strength comes from the engine's own limiter
// (UCI_LimitStrength with UCI_Elo, or Skill Level) and, below the limiter's floor, from choose(): one of the engine's
// MultiPV moves (its best few, each with its score) drawn with a weight that falls with how much the move gives up,
// so a weak level misses what a weak player misses rather than playing at random.

/** The workers, by engine. Paths are literal so the app's offline list finds them (tools/offline.mjs). */
export const WORKERS = {
  stockfish: () => new Worker(new URL("./vendor/stockfish/stockfish-19-lite-single.js", import.meta.url)),
  fairy: () => new Worker(new URL("./uci-fairy.js", import.meta.url), { type: "module" }),
};

/** An "info" line's search result: { multipv, depth, cp | mate, pv }, or null for a line without a score and a pv. */
export function parseInfo(line) {
  if (!line.startsWith("info ") || !/ pv /.test(line) || !/ score /.test(line)) return null;
  const t = line.split(/\s+/), at = k => t.indexOf(k), num = k => (at(k) >= 0 ? Number(t[at(k) + 1]) : null);
  const s = at("score"), kind = t[s + 1], value = Number(t[s + 2]);
  if (!["cp", "mate"].includes(kind) || !Number.isFinite(value)) return null;
  return { multipv: num("multipv") || 1, depth: num("depth") || 0, ...(kind === "cp" ? { cp: value } : { mate: value }), pv: t.slice(at("pv") + 1) };
}

/** A line's score for ordering, from the side to move's view: a mate sooner is better, a mate against later is better. */
export const valueOf = line => (line.mate != null ? (line.mate > 0 ? 100000 - 100 * line.mate : -100000 - 100 * line.mate) : line.cp);

/**
 * One of a search's moves, for a level below the engine's own limiter: each MultiPV move weighted by exp(−loss / temper),
 * its loss the centipawns it gives up against the best (a missed mate counts as about ten pawns, so a weak level
 * sometimes misses one, and walks into one as rarely as it hangs a chariot). `rand` is the source of chance.
 */
export function choose(lines, temper, rand = Math.random) {
  if (!lines.length) return null;
  if (!(temper > 0)) return lines[0].pv[0];
  const clip = v => Math.max(-1000, Math.min(1000, v));          // past ten pawns, everything is "lost" alike
  // a search cut off by its limit reports some lines a ply shallower than others, so the best is the best scored
  const best = Math.max(...lines.map(l => clip(valueOf(l))));
  const weights = lines.map(l => Math.exp(-(best - clip(valueOf(l))) / temper));
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lines.length; i++) { r -= weights[i]; if (r <= 0) return lines[i].pv[0]; }
  return lines[lines.length - 1].pv[0];
}

/**
 * An engine in a worker. spawn() makes the worker (WORKERS.stockfish, or a stand-in with postMessage, onmessage,
 * onerror and terminate in the tests); `setup` are commands sent once it has said "uciok" (the variant, say).
 */
export class Engine {
  constructor(spawn, { setup = [], timeout = 45000 } = {}) {
    this.spawn = spawn;
    this.setup = setup;
    this.timeout = timeout;
    this.worker = null;
    this.ready = null;
    this.sent = new Map();                                          // option -> the value last sent
    this.listener = null;
    this.chain = Promise.resolve();
  }
  /** Starts the worker (once) and waits until the engine is ready. Rejects if it can't start. */
  start() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      let worker;
      try { worker = this.worker = this.spawn(); } catch (e) { reject(e); return; }
      let started = false;
      const fail = why => { this.stop(); reject(new Error(why)); };
      const timer = setTimeout(() => fail("the engine didn't start"), this.timeout);
      worker.onmessage = e => {
        const d = e.data;
        if (d && typeof d === "object" && d.error) { clearTimeout(timer); fail(d.error); return; }
        if (typeof d !== "string") return;                          // progress reports some builds send
        for (const line of d.split("\n")) {
          if (line === "uciok") { for (const c of this.setup) worker.postMessage(c); worker.postMessage("isready"); }
          else if (line === "readyok" && !started) { started = true; clearTimeout(timer); resolve(); }
          this.listener?.(line);
        }
      };
      worker.onerror = e => { clearTimeout(timer); e?.preventDefault?.(); fail(e?.message || "the engine stopped"); this.listener?.(null); };
      worker.postMessage("uci");
    });
    this.ready.catch(() => {});
    return this.ready;
  }
  /** Lets the worker go (leaving the page, or a broken engine): the next search starts a new one. */
  stop() {
    try { this.worker?.terminate(); } catch { /* gone already */ }
    this.worker = null;
    this.ready = null;
    this.sent.clear();
  }
  /**
   * A search from a position (fen, and the moves since, in the engine's words) to a limit ("nodes 120000", "depth 8",
   * "movetime 800"), with options set first ({ MultiPV: 4, UCI_LimitStrength: true, UCI_Elo: 1500 }, sent only when
   * changed). Resolves { best, lines }: the move it would play, and its last line for each MultiPV rank, best first.
   */
  search({ fen, moves = [], limit = "nodes 100000", options = {} }) {
    const run = async () => {
      await this.start();
      const worker = this.worker;
      for (const [name, value] of Object.entries(options)) {
        if (this.sent.get(name) === String(value)) continue;
        this.sent.set(name, String(value));
        worker.postMessage(`setoption name ${name} value ${value}`);
      }
      return new Promise((resolve, reject) => {
        const lines = new Map();
        this.listener = line => {
          if (line === null) { this.listener = null; reject(new Error("the engine stopped")); return; }
          const info = parseInfo(line);
          if (info) { lines.set(info.multipv, info); return; }
          if (line.startsWith("bestmove")) {
            this.listener = null;
            const best = line.split(/\s+/)[1];
            const ranked = [...lines.values()].sort((a, b) => a.multipv - b.multipv);
            resolve({ best: best && best !== "(none)" && best !== "0000" ? best : null, lines: ranked });
          }
        };
        worker.postMessage(`position fen ${fen}${moves.length ? ` moves ${moves.join(" ")}` : ""}`);
        worker.postMessage(`go ${limit}`);
      });
    };
    const done = this.chain.then(run, run);
    this.chain = done.catch(() => {});
    return done;
  }
}

/**
 * The move a level plays in a position: { move, lines }. A level is { limit, elo?, skill?, multipv?, temper? }: with
 * `elo` the engine's own limiter plays (UCI_LimitStrength), with `skill` its Skill Level, and with `temper` choose()
 * draws among its `multipv` best moves; every option is set each time, so one level's never carries into the next.
 */
export async function levelMove(engine, level, { fen, moves = [], rand = Math.random }) {
  const options = { MultiPV: level.multipv || 1, "Skill Level": level.skill ?? 20, UCI_LimitStrength: !!level.elo, ...(level.elo ? { UCI_Elo: level.elo } : {}) };
  const r = await engine.search({ fen, moves, limit: level.limit, options });
  return { move: (level.temper ? choose(r.lines, level.temper, rand) : r.best) || r.best, lines: r.lines };
}
