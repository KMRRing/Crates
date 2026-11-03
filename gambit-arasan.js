// Arasan (vendor/arasan/NOTE.txt) started for Chess, in the page's worker (gambit-engine-worker.js) and in Node (the
// tests and tools, through tests/gambit-uci-node.js): the engine's WebAssembly, its network unpacked straight into the
// room the engine gives it, and the few Stockfish options Chess's levels set, which Arasan's own strength limiter
// replaces, dropped.
import { startWasi } from "./gambit-wasi.js";

/** The transposition table, in megabytes: a phone's tab has the network's 28 MB (twice, while it is read) to hold besides. */
const HASH_MB = 16;

// Skill Level is Stockfish's; Arasan's own limiter (UCI_LimitStrength, UCI_Elo) is left off: a level plays by the nodes
// it is given, and the draw among its moves (choose() in uci.js), so every level is the same engine at a different effort.
const NOT_OURS = /^setoption name (Skill Level|UCI_LimitStrength|UCI_Elo)\b/i;
// bounds are search lines cut short (a window failing), not scores to draw from
const wanted = line => !/ (lowerbound|upperbound)\b/.test(line);

/**
 * The packed network (vendor/arasan/pack-net.mjs) as it comes out of a decompressor: the bytes of the .nnue file,
 * placed in `room`, which the engine reads in place. `chunks` is any (async) iterable of byte arrays; resolves the
 * number of bytes placed.
 */
export async function fillNet(chunks, room) {
  let at = 0;
  for await (const chunk of chunks) {
    if (at + chunk.length > room.length) throw new Error("the network is larger than Arasan's");
    room.set(chunk, at);
    at += chunk.length;
  }
  return at;
}

/** Decompresses a stream of the packed network (deflate, raw), chunk by chunk, as it arrives. */
export async function* inflate(stream) {
  const reader = stream.pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    yield value;
  }
}

/**
 * Starts the engine: `wasm` its bytes, `net` the packed network as chunks (inflate() of what was fetched), `onLine`
 * told each line it writes. Resolves { command(line) }; a command runs to its end before it returns, a search included.
 */
export async function startArasan(wasm, net, onLine) {
  // Arasan prints a depth's lines together, but a depth cut short by the node limit prints those it got to, and the
  // ranks it hadn't reached stay at the depth before: lines of two depths, a move twice. So a depth's lines are held
  // until the depth is whole (as many lines as the depth before had; as were asked, for the first), and an iteration
  // cut short is dropped.
  const held = { lines: new Map(), depth: -1, size: 0, sent: false };    // a depth's lines by rank (a rank can be said again)
  let asked = 1;                                                    // the lines the search in hand may print
  const whole = () => held.lines.size >= (held.size || asked) || !held.sent;
  const release = () => {
    [...held.lines].sort((a, b) => a[0] - b[0]).forEach(([, l]) => onLine(l));
    Object.assign(held, { lines: new Map(), size: held.lines.size, sent: true });
  };
  const hear = line => {
    if (!wanted(line)) return;
    if (/^info (?:multipv \d+ )?depth \d+ .* pv /.test(line) && / score /.test(line)) {
      const depth = Number(/ depth (\d+)/.exec(line)[1]);
      if (depth !== held.depth) {
        if (held.lines.size && whole()) release();
        held.lines = new Map();
        held.depth = depth;
      }
      held.lines.set(Number(/ multipv (\d+)/.exec(line)?.[1] || 1), line);
      return;
    }
    if (line.startsWith("bestmove")) {
      if (held.lines.size && whole()) release();
      Object.assign(held, { lines: new Map(), depth: -1, size: 0, sent: false });
    }
    onLine(line);
  };
  const e = await startWasi(wasm, hear);
  const size = e.exports.net_size(), at = e.exports.net_alloc();      // (allocating may grow the memory: look at its buffer after)
  const room = new Uint8Array(e.memory.buffer, at, size);
  const placed = await fillNet(net, room);
  if (placed !== size || !e.exports.net_ready()) throw new Error("the network isn't one Arasan can read");
  e.command(`setoption name Hash value ${HASH_MB}`);
  let lines = 1;                                                    // the MultiPV last set
  let set = null, searched = null, said = null;                     // the position last given; the one last searched; its command
  return {
    command(line) {
      if (NOT_OURS.test(line)) return;
      const multipv = /^setoption name MultiPV value (\d+)/i.exec(line);
      if (multipv) lines = Number(multipv[1]);
      const position = /^position (.+?)(?: moves (.*))?$/.exec(line);
      if (position) { set = { base: position[1], moves: position[2] ? position[2].split(" ") : [] }; said = line; }
      if (!line.startsWith("go")) { e.command(line); return; }
      // The table stays (kept, it scored 15.5 of 24 against cleared before every move) while a search is a later position of the
      // last one's game, and is cleared for anything else: a puzzle, a review's position or a new game then gets the
      // same answer whatever came before it.
      const later = set && searched && set.base === searched.base && set.moves.length > searched.moves.length
        && searched.moves.every((m, i) => set.moves[i] === m);
      if (!later) { e.command("ucinewgame"); if (said) e.command(said); }   // (a new game resets the board too: say where we are again)
      searched = set;
      // a search told which moves to search can have fewer lines than were asked for
      const only = /\bsearchmoves ((?:[a-h][1-8][a-h][1-8][qrbn]? ?)+)/.exec(line)?.[1].trim().split(" ").length ?? Infinity;
      asked = Math.min(lines, only);
      e.command(line);
    },
  };
}
