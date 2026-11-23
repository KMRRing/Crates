// The network of L'Attaque's strongest computer player: Ataraxos's policy (Nature, 2026; code and weights MIT-licensed, Copyright
// (c) 2023 Gabriele Farina, github.com/AtaraxosAI/stratego; vendor/ataraxos/NOTE.txt says what was taken and how it was packed).
// It reads what one side knows of the game (attaque-sight.js builds it: 92 squares, lakes left out, each 643 numbers) and gives a
// score to every move the side may make, and the game's worth to it (lose, draw, win). Plain JavaScript: a transformer of eight
// layers, 384 wide, 8 heads, as Ataraxos's TransformerRL (legacy_rl.py) computes it, its matrices in 8-bit integers (a scale a row).
export const CELLS = 92, FEATURES = 643, WIDTH = 384, HEADS = 8, LAYERS = 8, FF = 1536;
const HEAD = WIDTH / HEADS, TOKENS = CELLS + 1;

/** float16 bits to float32. */
function halfToFloat(src) {
  const out = new Float32Array(src.length), f = new Float32Array(1), u = new Uint32Array(f.buffer);
  for (let i = 0; i < src.length; i++) {
    const h = src[i], s = (h & 0x8000) << 16, e = (h >> 10) & 0x1f, m = h & 0x3ff;
    if (e === 0) out[i] = (s ? -1 : 1) * m * 2 ** -24;
    else if (e === 31) { u[0] = s | 0x7f800000 | (m << 13); out[i] = f[0]; }
    else { u[0] = s | ((e + 112) << 23) | (m << 13); out[i] = f[0]; }
  }
  return out;
}
/** The weights, from the packed file's bytes (unzipped; vendor/ataraxos/pack-net.mjs writes it): { name: Float32Array (a vector)
 *  or { q: Int8Array, s: Float32Array (a scale a row), rows, cols } (a matrix) }. */
export function weightsFrom(bytes) {
  const buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const magic = new TextDecoder().decode(new Uint8Array(buf, 0, 4));
  if (magic !== "ATX1") throw new Error("not L'Attaque's network");
  const len = new DataView(buf).getUint32(4, true), { tensors } = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, len)));
  const data = 8 + len + ((4 - ((8 + len) % 4)) % 4), w = {};
  for (const t of tensors) {
    const size = t.shape.reduce((a, b) => a * b, 1), at = data + t.offset;
    if (t.type === "f16") { w[t.name] = halfToFloat(new Uint16Array(buf, at, size)); continue; }
    const [rows, cols] = t.shape;
    w[t.name] = { s: new Float32Array(buf, at, rows), q: new Int8Array(buf, at + 4 * rows, size), rows, cols };
  }
  return w;
}

/** y[t][o] = b[o] + x[t] . W[o] for rows t of x (n by inp), W (out by inp: 8-bit, a scale S a row); into y (n by out). Two rows
 *  of x against four rows of W at a time: each number read serves several products (about three times as fast as one dot product
 *  at a time). */
function linear(x, n, inp, { q: W, s: S }, b, out, y) {
  let t = 0;
  for (; t + 1 < n; t += 2) {
    const xa = t * inp, xb = xa + inp, ya = t * out, yb = ya + out;
    let o = 0;
    for (; o + 3 < out; o += 4) {
      const w0 = o * inp, w1 = w0 + inp, w2 = w1 + inp, w3 = w2 + inp;
      let a0 = 0, a1 = 0, a2 = 0, a3 = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0;
      for (let i = 0; i < inp; i++) {
        const u = x[xa + i], v = x[xb + i], k0 = W[w0 + i], k1 = W[w1 + i], k2 = W[w2 + i], k3 = W[w3 + i];
        a0 += u * k0; a1 += u * k1; a2 += u * k2; a3 += u * k3;
        b0 += v * k0; b1 += v * k1; b2 += v * k2; b3 += v * k3;
      }
      const s0 = S[o], s1 = S[o + 1], s2 = S[o + 2], s3 = S[o + 3];
      y[ya + o] = a0 * s0 + b[o]; y[ya + o + 1] = a1 * s1 + b[o + 1]; y[ya + o + 2] = a2 * s2 + b[o + 2]; y[ya + o + 3] = a3 * s3 + b[o + 3];
      y[yb + o] = b0 * s0 + b[o]; y[yb + o + 1] = b1 * s1 + b[o + 1]; y[yb + o + 2] = b2 * s2 + b[o + 2]; y[yb + o + 3] = b3 * s3 + b[o + 3];
    }
    for (; o < out; o++) {
      const wo = o * inp;
      let a0 = 0, b0 = 0;
      for (let i = 0; i < inp; i++) { a0 += x[xa + i] * W[wo + i]; b0 += x[xb + i] * W[wo + i]; }
      y[ya + o] = a0 * S[o] + b[o]; y[yb + o] = b0 * S[o] + b[o];
    }
  }
  for (; t < n; t++) {
    const xo = t * inp, yo = t * out;
    for (let o = 0; o < out; o++) {
      const wo = o * inp;
      let s0 = 0;
      for (let i = 0; i < inp; i++) s0 += x[xo + i] * W[wo + i];
      y[yo + o] = s0 * S[o] + b[o];
    }
  }
}
function layerNorm(x, n, g, b, y) {
  for (let t = 0; t < n; t++) {
    const o = t * WIDTH;
    let m = 0;
    for (let i = 0; i < WIDTH; i++) m += x[o + i];
    m /= WIDTH;
    let v = 0;
    for (let i = 0; i < WIDTH; i++) { const d = x[o + i] - m; v += d * d; }
    const r = 1 / Math.sqrt(v / WIDTH + 1e-5);
    for (let i = 0; i < WIDTH; i++) y[o + i] = (x[o + i] - m) * r * g[i] + b[i];
  }
}

/**
 * A network over the weights: forward(sight) → { logits: Float32Array(92 * 92) (from square to square, lakes left out, scaled),
 * value: [lose, draw, win] (log-probabilities) }. sight: Float32Array(92 * 643), as attaque-sight.js builds it. Only the features
 * that are not zero are read for the first layer (most of them are: the piece numbers are one of 256).
 */
export function createNet(w) {
  const x = new Float32Array(TOKENS * WIDTH), h = new Float32Array(TOKENS * WIDTH), qkv = new Float32Array(TOKENS * 3 * WIDTH);
  const att = new Float32Array(TOKENS * WIDTH), ff = new Float32Array(TOKENS * FF), tmp = new Float32Array(TOKENS * WIDTH), scores = new Float32Array(TOKENS);
  const L = Array.from({ length: LAYERS }, (_, i) => {
    const p = n => w[`transformer.${i}.${n}`];
    return { g1: p("layer_norm1.weight"), b1: p("layer_norm1.bias"), Wqkv: p("mha.qkv_proj.weight"), bqkv: p("mha.qkv_proj.bias"), Wo: p("mha.out_proj.weight"), bo: p("mha.out_proj.bias"),
      g2: p("layer_norm2.weight"), b2: p("layer_norm2.bias"), W1: p("linear1.weight"), bf1: p("linear1.bias"), W2: p("linear2.weight"), bf2: p("linear2.bias") };
  });
  // the first layer, column by column, so a feature that is zero costs nothing
  const E = w["embedder.weight"], Et = new Float32Array(FEATURES * WIDTH);
  for (let o = 0; o < WIDTH; o++) for (let i = 0; i < FEATURES; i++) Et[i * WIDTH + o] = E.q[o * FEATURES + i] * E.s[o];
  const scale = 1 / Math.sqrt(HEAD);

  function forward(sight) {
    const pos = w.positional_encoding, eb = w["embedder.bias"];
    for (let i = 0; i < WIDTH; i++) x[i] = pos[i];                                       // the value token: no features of its own
    for (let t = 0; t < CELLS; t++) {
      const xo = (t + 1) * WIDTH, so = t * FEATURES;
      for (let i = 0; i < WIDTH; i++) x[xo + i] = eb[i] + pos[xo + i];
      for (let f = 0; f < FEATURES; f++) {
        const v = sight[so + f];
        if (v === 0) continue;
        const eo = f * WIDTH;
        for (let i = 0; i < WIDTH; i++) x[xo + i] += v * Et[eo + i];
      }
    }
    for (const l of L) {
      layerNorm(x, TOKENS, l.g1, l.b1, h);
      linear(h, TOKENS, WIDTH, l.Wqkv, l.bqkv, 3 * WIDTH, qkv);
      for (let hd = 0; hd < HEADS; hd++) {
        const qo = hd * HEAD, ko = WIDTH + hd * HEAD, vo = 2 * WIDTH + hd * HEAD;
        for (let t = 0; t < TOKENS; t++) {
          const tq = t * 3 * WIDTH + qo;
          let mx = -Infinity;
          for (let s = 0; s < TOKENS; s++) {
            const sk = s * 3 * WIDTH + ko;
            let d = 0;
            for (let i = 0; i < HEAD; i++) d += qkv[tq + i] * qkv[sk + i];
            d *= scale;
            scores[s] = d;
            if (d > mx) mx = d;
          }
          let sum = 0;
          for (let s = 0; s < TOKENS; s++) { const e = Math.exp(scores[s] - mx); scores[s] = e; sum += e; }
          const ao = t * WIDTH + hd * HEAD;
          for (let i = 0; i < HEAD; i++) att[ao + i] = 0;
          for (let s = 0; s < TOKENS; s++) {
            const p = scores[s] / sum, sv = s * 3 * WIDTH + vo;
            for (let i = 0; i < HEAD; i++) att[ao + i] += p * qkv[sv + i];
          }
        }
      }
      linear(att, TOKENS, WIDTH, l.Wo, l.bo, WIDTH, tmp);
      for (let i = 0; i < x.length; i++) x[i] += tmp[i];
      layerNorm(x, TOKENS, l.g2, l.b2, h);
      linear(h, TOKENS, WIDTH, l.W1, l.bf1, FF, ff);
      for (let i = 0; i < ff.length; i++) if (ff[i] < 0) ff[i] = 0;
      linear(ff, TOKENS, FF, l.W2, l.bf2, WIDTH, tmp);
      for (let i = 0; i < x.length; i++) x[i] += tmp[i];
    }
    layerNorm(x, TOKENS, w["norm_out.weight"], w["norm_out.bias"], h);
    const vh = new Float32Array(3);
    linear(h, 1, WIDTH, w["value_head.weight"], w["value_head.bias"], 3, vh);
    const vm = Math.max(...vh), vz = Math.log(vh.reduce((a, b) => a + Math.exp(b - vm), 0)) + vm;
    const qk = new Float32Array(CELLS * 2 * WIDTH), logits = new Float32Array(CELLS * CELLS), ks = 1 / Math.sqrt(WIDTH);
    linear(h.subarray(WIDTH), CELLS, WIDTH, w["qk_proj.weight"], w["qk_proj.bias"], 2 * WIDTH, qk);
    for (let a = 0; a < CELLS; a++) for (let b = 0; b < CELLS; b++) {
      let d = 0;
      const qa = a * 2 * WIDTH, kb = b * 2 * WIDTH + WIDTH;
      for (let i = 0; i < WIDTH; i++) d += qk[qa + i] * qk[kb + i];
      logits[a * CELLS + b] = d * ks;
    }
    return { logits, value: [...vh].map(v => v - vz) };
  }
  return { forward };
}
