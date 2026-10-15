// The double-dummy solver: DDS (Bo Haglund and Soren Hein's, the solver bridge programs use), as WebAssembly
// (vendor/dds/dds.wasm, from @bridge-tools/dd: vendor/dds/NOTE.txt). "Double dummy" is bridge with every card seen:
// given the four hands as they stand, the cards already played to the trick under way and the strain, it says for
// each card the player to move may play how many of the tricks still to come that player's side takes, everyone
// playing their best. Contract's card play (contract-play.js) asks it about many deals of the cards it can't see; it
// runs in the game's worker (contract-worker.js) and in Node for the tests, started here with the little the module
// asks of its host (a few system calls, all of them refused or no-ops: it reads no files and prints nothing we read).
import { suitOf, rankOf } from "./contract-core.js";

const RANK_LETTERS = "23456789TJQKA";
// DDS numbers the hands North 0, East 1, South 2, West 3 and the suits spades 0 to clubs 3; Contract's seats run
// South 0, West 1, North 2, East 3 and its suits clubs 0 to spades 3
const DDS_HAND = seat => (seat + 2) % 4;
const DDS_SUIT = suit => 3 - suit;
const DDS_TRUMP = strain => (strain === 4 ? 4 : 3 - strain);

/** A hand in PBN, suits spades first, each high to low: "AK5.QJ3.742.K98". */
function pbnHand(cards) {
  return [3, 2, 1, 0].map(s => cards.filter(c => suitOf(c) === s).sort((a, b) => b - a).map(c => RANK_LETTERS[rankOf(c)]).join("")).join(".");
}

/**
 * The solver, started from the module's bytes (the page's worker fetches them; the tests read the file). Resolves
 * { solve(hands, trick, strain) → Map(card → tricks), solves (how many so far) }: hands are the cards each seat still
 * holds (seats 0–3, the current trick's cards not among them), trick the cards played to it so far [{ seat, card }]
 * (its first card's seat leads it; with none, `leader` says who leads). Tricks are the remaining tricks, this one
 * included, that the side of the player to move takes.
 */
export async function loadSolver(bytes) {
  let memory = null;
  const refuse = what => () => { throw new Error(`dds: ${what}`); };
  const view = () => new DataView(memory.buffer);
  const env = {
    __assert_fail: refuse("assertion failed"), __cxa_throw: refuse("exception"), exit: refuse("exit"), abort: refuse("abort"),
    emscripten_memcpy_big: (dest, src, n) => { new Uint8Array(memory.buffer).copyWithin(dest, src, src + n); },
    emscripten_resize_heap: () => 0,                             // its memory is fixed: 50 MB, of which the solver's tables take 40
    __syscall_openat: () => -44, __syscall_fcntl64: () => 0, __syscall_ioctl: () => 0, strftime_l: () => 0,
  };
  const wasi = {
    fd_write: (fd, iovs, n, written) => { let t = 0; for (let k = 0; k < n; k++) t += view().getUint32(iovs + 8 * k + 4, true); view().setUint32(written, t, true); return 0; },
    fd_read: () => 8, fd_close: () => 0, fd_seek: () => 70,
    environ_sizes_get: (count, size) => { view().setUint32(count, 0, true); view().setUint32(size, 0, true); return 0; },
    environ_get: () => 0,
  };
  const { instance } = await WebAssembly.instantiate(bytes, { env, wasi_snapshot_preview1: wasi });
  const x = instance.exports;
  memory = x.memory;
  x.emscripten_stack_init();
  x.__wasm_call_ctors();
  x.dds_init();
  const dealPtr = x.malloc(80), out = x.malloc(13 * 12);
  let solves = 0;

  function solve(hands, trick = [], strain = 4, leader = null) {
    const first = trick.length ? trick[0].seat : leader;
    const text = `N:${[2, 3, 0, 1].map(s => pbnHand(hands[s])).join(" ")}\0`;
    new Uint8Array(memory.buffer, dealPtr, text.length).set(new TextEncoder().encode(text));
    const res = new Int32Array(memory.buffer, out, 39);
    res.fill(-1);
    const c = i => trick[i] ? [DDS_SUIT(suitOf(trick[i].card)), rankOf(trick[i].card) + 2] : [0, 0];
    x.dds_solve_board(DDS_TRUMP(strain), DDS_HAND(first), ...c(0), ...c(1), ...c(2), dealPtr, out);
    solves++;
    const toMove = (first + trick.length) % 4, mine = hands[toMove], scores = new Map();
    const got = Array.from(new Int32Array(memory.buffer, out, 39));
    for (let i = 0; i < 13; i++) {
      const rank = got[i * 3], suit = got[i * 3 + 1], tricks = got[i * 3 + 2];
      if (rank <= 0) break;
      scores.set((3 - suit) * 13 + rank - 2, tricks);
    }
    if (!scores.size) throw new Error("dds: no answer for that deal");
    // DDS answers once for cards that are as good as each other (the queen and jack of a suit with nothing between
    // them still out): the lower ones get the higher one's answer
    const out2 = new Map(scores);
    for (const [card, tricks] of scores) {
      const s = suitOf(card), left = hands.flat().filter(o => suitOf(o) === s).sort((a, b) => b - a);
      for (let k = left.indexOf(card) + 1; k < left.length && mine.includes(left[k]); k++) if (!out2.has(left[k])) out2.set(left[k], tricks);
    }
    return out2;
  }
  return { solve, get solves() { return solves; } };
}

/** The solver's bytes, fetched (a page's worker): the path is written out so the app's offline list finds the file. */
export async function fetchSolver() {
  const res = await fetch(new URL("./vendor/dds/dds.wasm", import.meta.url));
  if (!res.ok) throw new Error(`dds: HTTP ${res.status}`);
  return loadSolver(await res.arrayBuffer());
}
