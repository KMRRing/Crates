// Packs Ataraxos's policy for L'Attaque (attaque-net.js reads it): from export.py's float16 file and its layout, one file of
// every weight matrix as 8-bit integers with a float32 scale for each row (its largest magnitude over 127), and every vector
// (biases, layer norms, the positional encoding) as float16, gzipped.
//   node vendor/ataraxos/pack-net.mjs net.bin net.bin.json vendor/ataraxos/ataraxos.bin.gz
// The file: "ATX1", a uint32 (little-endian) length, that many bytes of JSON ({ tensors: [{ name, shape, type: "q8" | "f16",
// offset }] }, offsets from the start of the data, every one a multiple of 4), padding to a multiple of 4, the data. A q8
// tensor of shape [rows, cols] is rows float32 scales, then rows * cols int8.
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const [src, layoutFile, out] = process.argv.slice(2);
const layout = JSON.parse(readFileSync(layoutFile, "utf8")), raw = readFileSync(src);
const half = new Uint16Array(raw.buffer, raw.byteOffset, layout.count);
const f = new Float32Array(1), u = new Uint32Array(f.buffer);
const toFloat = h => {
  const s = (h & 0x8000) << 16, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return (s ? -1 : 1) * m * 2 ** -24;
  u[0] = e === 31 ? s | 0x7f800000 | (m << 13) : s | ((e + 112) << 23) | (m << 13);
  return f[0];
};
const tensors = [], parts = [];
let offset = 0, worst = 0;
const push = buf => { const pad = (4 - (buf.length % 4)) % 4; parts.push(buf, Buffer.alloc(pad)); offset += buf.length + pad; };
for (const t of layout.tensors) {
  const size = t.shape.reduce((a, b) => a * b, 1), vals = half.subarray(t.offset, t.offset + size);
  const matrix = t.shape.length === 2 && t.name !== "positional_encoding";
  tensors.push({ name: t.name, shape: t.shape, type: matrix ? "q8" : "f16", offset });
  if (!matrix) { push(Buffer.from(vals.buffer, vals.byteOffset, vals.byteLength)); continue; }
  const [rows, cols] = t.shape, scales = new Float32Array(rows), q = new Int8Array(size);
  for (let r = 0; r < rows; r++) {
    let mx = 0;
    for (let c = 0; c < cols; c++) mx = Math.max(mx, Math.abs(toFloat(vals[r * cols + c])));
    const s = mx / 127 || 1;
    scales[r] = s;
    for (let c = 0; c < cols; c++) {
      const v = toFloat(vals[r * cols + c]), k = Math.max(-127, Math.min(127, Math.round(v / s)));
      q[r * cols + c] = k;
      worst = Math.max(worst, Math.abs(k * s - v) / (mx || 1));
    }
  }
  push(Buffer.from(scales.buffer));
  push(Buffer.from(q.buffer));
}
const head = Buffer.from(JSON.stringify({ tensors }));
const len = Buffer.alloc(4); len.writeUInt32LE(head.length);
const pad = Buffer.alloc((4 - ((8 + head.length) % 4)) % 4);
const file = Buffer.concat([Buffer.from("ATX1"), len, head, pad, ...parts]);
const zipped = gzipSync(file, { level: 9 });
writeFileSync(out, zipped);
console.log(`${tensors.length} tensors, ${(file.length / 1e6).toFixed(2)} MB, gzipped ${(zipped.length / 1e6).toFixed(2)} MB; worst rounding ${(worst * 100).toFixed(2)}% of a row's largest`);
