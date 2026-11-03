// Packs Arasan's network for the page: the .nnue file deflated raw at the best level (28.5 MB to 13.6 MB), which the
// page's DecompressionStream("deflate-raw") undoes as it arrives (gambit-arasan.js inflate()). Deterministic: the same
// file and the same zlib give the same bytes.
//   node vendor/arasan/pack-net.mjs <arasanv9-….nnue> <arasan.nnue.z>
import fs from "fs";
import zlib from "zlib";
const [from, to] = process.argv.slice(2);
if (!from || !to) { console.error("usage: node pack-net.mjs <network.nnue> <packed.nnue.z>"); process.exit(1); }
const packed = zlib.deflateRawSync(fs.readFileSync(from), { level: 9, memLevel: 9 });
fs.writeFileSync(to, packed);
console.log(`${from}: ${fs.statSync(from).size} bytes packed to ${packed.length}`);
