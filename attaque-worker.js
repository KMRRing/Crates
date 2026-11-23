// L'Attaque's computer off the page (attaque.js), so the board stays alive while it thinks. "move" is the computer's move, "hint"
// the coach's for a person, with its words for it (attaque-coach.js). Hard and the coach are Ataraxos's network (attaque-deep.js; loaded, unzipped, once, the first time
// either is wanted); Easy and Medium, and Hard if the network can't be had here, the search of attaque-ai.js from viewOf (never
// the other side's hidden kinds). The network reads only what the side has seen as well (attaque-sight.js).
import { think } from "./attaque-ai.js";
import { viewOf } from "./attaque-rules.js";
import { seeded, mix } from "./seats.js";
import { weightsFrom, createNet } from "./attaque-net.js";
import { deepMove } from "./attaque-deep.js";
import { explain } from "./attaque-coach.js";

const ok = res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res; };
/** The bytes of a gzip file, unzipped (a server that already unzipped it is fine too). */
async function unzip(res) {
  const raw = new Uint8Array(await res.arrayBuffer());
  if (raw[0] !== 0x1f || raw[1] !== 0x8b) return raw;
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
let net = null;
const loadNet = () => (net ||= fetch(new URL("./vendor/ataraxos/ataraxos.bin.gz", import.meta.url)).then(ok).then(unzip).then(b => createNet(weightsFrom(b))).catch(err => {
  console.warn("L'Attaque: no network here, so Hard is the search.", err);
  return null;
}));

self.onmessage = async e => {
  const { id, kind, state, side, level, seed, n } = e.data;
  try {
    const rng = kind === "move" ? seeded(mix(seed ^ 0xB0B, n + 1)) : seeded(mix(seed ^ 0xC0C, n + 1));
    const view = viewOf(state, side);
    if ((kind === "hint" || level === "hard") && state.t === side) {
      const nn = await loadNet(), r = nn && deepMove(nn, state, { rng, best: kind === "hint" });
      if (r) {
        const why = kind === "hint" ? explain(view, r.code, { odds: r.odds[r.legal.indexOf(r.code)], value: r.value, rng }) : undefined;
        self.postMessage({ id, code: r.code, why, deep: true });
        return;
      }
    }
    const code = think(view, level, { rng }).code;
    self.postMessage({ id, code, why: kind === "hint" && code != null ? explain(view, code, { rng }) : undefined });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
