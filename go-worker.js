// The worker that thinks for Go: it loads the network (the g170 net, unzipped as it arrives) and go-nn.wasm once, then
// answers the page. Messages in: { id, type: "move", game, visits, temperature, seed } for a move and a read of the board,
// { id, type: "read", game } for the read alone (who is ahead, whose each point is). Out: { id, ... } or { error }.
// A search runs to its end before the next message is read, so the page gives every one a limit.
import { loadNet } from "./go-net.js";
import { replay } from "./go-rules.js";
import { search, seededRandom } from "./go-search.js";

const ok = res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res; };

/** The bytes of a gzip file, unzipped (a server that already unzipped it for us is fine too). */
async function unzip(res) {
  const raw = new Uint8Array(await res.arrayBuffer());
  if (raw[0] !== 0x1f || raw[1] !== 0x8b) return raw;
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

let net = null;
const queue = [];
const cache = new Map();

async function start() {
  const [wasm, file] = await Promise.all([
    fetch(new URL("./vendor/go/go-nn.wasm", import.meta.url)).then(ok).then(r => r.arrayBuffer()),
    fetch(new URL("./vendor/go/g170-b6c96-s175395328-d26788732.bin.gz", import.meta.url)).then(ok).then(unzip),
  ]);
  net = await loadNet(file, wasm);
}

function answer(m) {
  cache.clear();                       // a read depends on the komi and the moves before, so none is kept from another game
  const r = replay(m.game);
  const root = { pos: r.pos, made: r.made.slice(-5), seen: r.seen };
  if (m.type === "read") {
    const out = search(net, root, { visits: 1, komi: m.game.komi, cache });
    return { winrate: out.winrate, score: out.score, own: Array.from(out.own, v => Math.round(v * 100) / 100) };
  }
  const out = search(net, root, { visits: m.visits, komi: m.game.komi, temperature: m.temperature, rng: seededRandom(m.seed || 1), cache, noPass: !!m.noPass });
  return { move: out.move, winrate: out.winrate, score: out.score, own: Array.from(out.own, v => Math.round(v * 100) / 100) };
}

onmessage = e => { if (net) run(e.data); else queue.push(e.data); };
function run(m) {
  try { postMessage({ id: m.id, ...answer(m) }); } catch (err) { postMessage({ id: m.id, error: String(err?.message || err) }); }
}
start().then(() => { for (const m of queue.splice(0)) run(m); postMessage({ ready: true }); })
  .catch(err => postMessage({ error: String(err?.message || err) }));
