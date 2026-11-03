// Caissa (vendor/caissa/NOTE.txt) started for Gambit, in the page's worker (gambit-engine-worker.js) and in Node (the
// tests and tools, through tests/gambit-uci-node.js): the engine's WebAssembly, its network unpacked straight into the
// room the engine gives it, and the few Stockfish options Gambit's levels set, which Caissa doesn't have, dropped.
import { startWasi } from "./gambit-wasi.js";

/** The transposition table, in megabytes: a phone's tab has the network's 76 MB to hold besides. */
const HASH_MB = 16;

/** The network is a 64-byte header, the feature transformer (24,576 inputs x 1,536 int16 weights), then the small layers. */
export const HEADER = 64, WEIGHTS = 32 * 12 * 64 * 1536;

// Skill Level and the limiter are Stockfish's: Caissa plays by the nodes it is given, and the level's own draw (choose()).
const NOT_CAISSAS = /^setoption name (Skill Level|UCI_LimitStrength|UCI_Elo)\b/i;
// the "info string" lines are its chatter; a bound is a search line cut short, not a score to draw from
const wanted = line => !line.startsWith("info string") && !/ (lowerbound|upperbound)\b/.test(line);

/**
 * The packed network (vendor/caissa/pack-net.mjs) as it comes out of a decompressor: the header, then the weights' low
 * bytes, then their high bytes, then the rest. Interleaved into `room`, the bytes of the .pnn file the engine reads in
 * place. `chunks` is any (async) iterable of byte arrays; resolves the number of bytes placed.
 */
export async function fillNet(chunks, room) {
  const lo = HEADER, hi = HEADER + WEIGHTS, rest = HEADER + 2 * WEIGHTS;
  let at = 0;
  for await (const chunk of chunks) {
    for (let i = 0; i < chunk.length;) {
      const end = at < lo ? lo : at < hi ? hi : at < rest ? rest : Infinity, n = Math.min(chunk.length - i, end - at);
      if (at + n > room.length) throw new Error("the network is larger than Caissa's");
      if (at < lo) room.set(chunk.subarray(i, i + n), at);
      else if (at < hi) for (let k = 0; k < n; k++) room[HEADER + 2 * (at - lo + k)] = chunk[i + k];
      else if (at < rest) for (let k = 0; k < n; k++) room[HEADER + 2 * (at - hi + k) + 1] = chunk[i + k];
      else room.set(chunk.subarray(i, i + n), at);
      at += n; i += n;
    }
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
export async function startCaissa(wasm, net, onLine) {
  const e = await startWasi(wasm, line => { if (wanted(line)) onLine(line); });
  const size = e.exports.net_size(), at = e.exports.net_alloc();      // (allocating may grow the memory: look at its buffer after)
  const room = new Uint8Array(e.memory.buffer, at, size);
  const placed = await fillNet(net, room);
  if (placed !== size || !e.exports.net_ready()) throw new Error("the network isn't one Caissa can read");
  e.command(`setoption name Hash value ${HASH_MB}`);
  let lines = 1;                                                    // the MultiPV last set
  let set = null, searched = null;                                  // the position last given; the one last searched
  return {
    command(line) {
      if (NOT_CAISSAS.test(line)) return;
      const multipv = /^setoption name MultiPV value (\d+)/i.exec(line);
      if (multipv) lines = Number(multipv[1]);
      const position = /^position (.+?)(?: moves (.*))?$/.exec(line);
      if (position) set = { base: position[1], moves: position[2] ? position[2].split(" ") : [] };
      if (!line.startsWith("go")) { e.command(line); return; }
      // The table is worth a lot between the moves of one game (a search from scratch lost to Stockfish's at twice the
      // nodes), so it stays while a search is a later position of the last one's game, and is cleared for anything
      // else: a puzzle, a review's position or a new game then gets the same answer whatever came before it.
      const later = set && searched && set.base === searched.base && set.moves.length > searched.moves.length
        && searched.moves.every((m, i) => set.moves[i] === m);
      if (!later) e.command("ucinewgame");
      searched = set;
      // a search that asks for more lines than the moves it may search never ends (Caissa waits for lines that can't come)
      const only = /\bsearchmoves ((?:[a-h][1-8][a-h][1-8][qrbn]? ?)+)/.exec(line)?.[1].trim().split(" ").length ?? Infinity;
      if (only < lines) e.command(`setoption name MultiPV value ${only}`);
      e.command(line);
      if (only < lines) e.command(`setoption name MultiPV value ${lines}`);
    },
  };
}
