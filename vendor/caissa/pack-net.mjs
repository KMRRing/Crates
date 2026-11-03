// Packs a Caissa network (a .pnn file) for the page, losing nothing: the feature transformer's int16 weights are split
// into a plane of their low bytes and a plane of their high bytes (the high bytes are nearly all small numbers, so
// they deflate well), the header and the small layers stay as they are, and the whole is deflated raw. 75.7 MB
// become 37.7 MB, which a browser unpacks with DecompressionStream; fillNet() in gambit-caissa.js is the way back.
//   node vendor/caissa/pack-net.mjs <net.pnn> [out = vendor/caissa/caissa.pnn.z]
import fs from "fs";
import zlib from "zlib";
import { HEADER, WEIGHTS } from "../../gambit-caissa.js";

const [from, to = new URL("caissa.pnn.z", import.meta.url).pathname] = process.argv.slice(2);
const pnn = fs.readFileSync(from);
if (pnn.length < HEADER + 2 * WEIGHTS) throw new Error(`${from} isn't a network of Caissa's size`);
const packed = Buffer.alloc(pnn.length);
pnn.copy(packed, 0, 0, HEADER);
for (let i = 0; i < WEIGHTS; i++) {
  packed[HEADER + i] = pnn[HEADER + 2 * i];
  packed[HEADER + WEIGHTS + i] = pnn[HEADER + 2 * i + 1];
}
pnn.copy(packed, HEADER + 2 * WEIGHTS, HEADER + 2 * WEIGHTS);
fs.writeFileSync(to, zlib.deflateRawSync(packed, { level: 9 }));
console.log(`${from}: ${pnn.length} bytes -> ${to}: ${fs.statSync(to).size} bytes`);
