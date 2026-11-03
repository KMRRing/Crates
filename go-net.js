// Go's network: reads a KataGo-format net (version 8: the g170 run's, CC0) and runs it over vendor/go/go-nn.wasm.
// No network is fetched here: the caller gives the unzipped net file and the module's bytes (go-worker.js, tests/go-net.mjs).
// The file is text tokens with float blocks after "@BIN@"; the order of layers is the engine's (cpp/neuralnet/desc.cpp).

const B = 2; // the border of zero cells the module expects round every tensor

class Reader {
  constructor(bytes) { this.b = bytes; this.i = 0; }
  tok() {
    const b = this.b;
    while (this.i < b.length && b[this.i] <= 32) this.i++;
    const from = this.i;
    while (this.i < b.length && b[this.i] > 32) this.i++;
    let s = "";
    for (let k = from; k < this.i; k++) s += String.fromCharCode(b[k]);
    return s;
  }
  int() { return parseInt(this.tok(), 10); }
  num() { return parseFloat(this.tok()); }
  floats(n) {
    const b = this.b;
    let skipped = 0;
    while (b[this.i] !== 64) { this.i++; if (++skipped > 100) throw new Error("go-net: no float block"); }
    if (String.fromCharCode(b[this.i + 1], b[this.i + 2], b[this.i + 3], b[this.i + 4]) !== "BIN@") throw new Error("go-net: bad float block");
    this.i += 5;
    const out = new Float32Array(n);
    new Uint8Array(out.buffer).set(b.subarray(this.i, this.i + 4 * n));
    this.i += 4 * n;
    return out;
  }
  conv() {
    const name = this.tok(), ky = this.int(), kx = this.int(), ic = this.int(), oc = this.int(), dy = this.int(), dx = this.int();
    if (dy !== 1 || dx !== 1 || ky !== kx) throw new Error("go-net: dilated or odd conv " + name);
    return { name, k: ky, ic, oc, w: this.floats(ky * kx * ic * oc) };
  }
  bn() {
    const name = this.tok(), c = this.int(), eps = this.num(), hasScale = this.int(), hasBias = this.int();
    const mean = this.floats(c), variance = this.floats(c);
    const scale = hasScale ? this.floats(c) : new Float32Array(c).fill(1);
    const bias = hasBias ? this.floats(c) : new Float32Array(c);
    const s = new Float32Array(c), t = new Float32Array(c);
    for (let k = 0; k < c; k++) { s[k] = scale[k] / Math.sqrt(variance[k] + eps); t[k] = bias[k] - mean[k] * s[k]; }
    return { name, c, s, t };
  }
  act() { this.tok(); }
  matmul() { const name = this.tok(), ic = this.int(), oc = this.int(); return { name, ic, oc, w: this.floats(ic * oc) }; }
  matbias() { const name = this.tok(), c = this.int(); return { name, c, w: this.floats(c) }; }
}

export function parseNet(bytes) {
  const r = new Reader(bytes);
  const name = r.tok(), version = r.int(), inC = r.int(), inG = r.int();
  if (version !== 8) throw new Error("go-net: net version " + version + ", this reader knows 8");
  if (r.tok() !== "trunk") throw new Error("go-net: no trunk");
  const nBlocks = r.int(), trunkC = r.int(), midC = r.int(), regC = r.int();
  r.int(); // dilated channels, unused
  const gpoolC = r.int();
  const trunk = { initial: r.conv(), global: r.matmul(), blocks: [] };
  for (let k = 0; k < nBlocks; k++) {
    const kind = r.tok(), bname = r.tok();
    const blk = { kind, name: bname, preBN: r.bn() };
    r.act();
    blk.regular = r.conv();
    if (kind === "gpool_block") {
      blk.gconv = r.conv(); blk.gBN = r.bn(); r.act(); blk.gToBias = r.matmul();
    } else if (kind !== "ordinary_block") throw new Error("go-net: block kind " + kind);
    blk.midBN = r.bn(); r.act(); blk.final = r.conv();
    trunk.blocks.push(blk);
  }
  trunk.tipBN = r.bn(); r.act();
  r.tok(); // policy head's name
  const policy = { p1: r.conv(), g1: r.conv(), g1BN: r.bn() };
  r.act();
  policy.toBias = r.matmul(); policy.p1BN = r.bn(); r.act(); policy.p2 = r.conv(); policy.toPass = r.matmul();
  r.tok(); // value head's name
  const value = { v1: r.conv(), v1BN: r.bn() };
  r.act();
  value.v2 = r.matmul(); value.v2b = r.matbias(); r.act(); value.v3 = r.matmul(); value.v3b = r.matbias();
  value.sv3 = r.matmul(); value.sv3b = r.matbias(); value.own = r.conv();
  return { name, version, inC, inG, trunkC, midC, regC, gpoolC, trunk, policy, value };
}

// Weights of a conv with the out channels padded with zeros to a multiple of four (the module's rule).
function padOut(conv) {
  const oc4 = (conv.oc + 3) & ~3;
  if (oc4 === conv.oc) return { ...conv, oc4, w: conv.w };
  const n = conv.k * conv.k * conv.ic, w = new Float32Array(n * oc4);
  for (let j = 0; j < n; j++) for (let o = 0; o < conv.oc; o++) w[j * oc4 + o] = conv.w[j * conv.oc + o];
  return { ...conv, oc4, w };
}

export async function loadNet(netBytes, wasmBytes) {
  const net = parseNet(netBytes);
  const mod = await WebAssembly.instantiate(wasmBytes, {});
  const X = mod.instance.exports;
  const mem = X.memory;
  let top = (X.__heap_base.value || X.__heap_base) + 15 & ~15;
  const room = (floats) => {
    const at = top;
    top = (top + floats * 4 + 15) & ~15;
    if (top > mem.buffer.byteLength) mem.grow(Math.ceil((top - mem.buffer.byteLength) / 65536));
    return at;
  };
  const put = (arr) => { const at = room(arr.length); new Float32Array(mem.buffer, at, arr.length).set(arr); return at; };
  // one fixed place for the short vectors a call hands the module (never part of a tensor, whose borders must stay zero)
  const scratch = room(1024);
  const tmp = (arr) => { new Float32Array(mem.buffer, scratch, arr.length).set(arr); return scratch; };
  const f32 = (at, n) => new Float32Array(mem.buffer, at, n);

  const cv = (conv) => { const p = padOut(conv); return { ic: p.ic, oc: p.oc4, k: p.k, w: put(p.w) }; };
  const bnp = (bn) => ({ c: bn.c, s: put(bn.s), t: put(bn.t) });
  const T = net.trunk, P = net.policy, V = net.value;
  const L = {
    init: cv(T.initial),
    blocks: T.blocks.map((b) => ({
      gp: b.kind === "gpool_block", preBN: bnp(b.preBN), regular: cv(b.regular), midBN: bnp(b.midBN), final: cv(b.final),
      gconv: b.gconv && cv(b.gconv), gBN: b.gBN && bnp(b.gBN), gToBias: b.gToBias,
    })),
    tipBN: bnp(T.tipBN),
    p1: cv(P.p1), g1: cv(P.g1), g1BN: bnp(P.g1BN), p1BN: bnp(P.p1BN), p2: cv(P.p2),
    v1: cv(V.v1), v1BN: bnp(V.v1BN), own: cv(V.own),
  };

  // a tensor of c channels for a board of h x w (with the border), in module memory; kept per size
  const sets = new Map();
  const tensors = (h, w) => {
    const key = h + "x" + w;
    if (sets.has(key)) return sets.get(key);
    const cells = (h + 2 * B) * (w + 2 * B);
    const t = (c) => ({ at: room(cells * c), n: cells * c, c });
    // a scratch tensor keeps one channel count for good: its zero border sits where that stride puts it
    const by = new Map();
    const s = {
      input: t(net.inC), x: t(net.trunkC), a: t(net.trunkC),
      r: (c) => { if (!by.has("r" + c)) by.set("r" + c, t(c)); return by.get("r" + c); },
      g: (c) => { if (!by.has("g" + c)) by.set("g" + c, t(c)); return by.get("g" + c); },
      p1: t(P.p1.oc), g1: t(P.g1.oc), p2: t(4), v1: t(V.v1.oc), own: t(4),
      mean: room(256), max: room(256),
    };
    sets.set(key, s);
    return s;
  };

  const matmul = (m, v) => {
    const out = new Float32Array(m.oc);
    for (let i = 0; i < m.ic; i++) { const a = v[i]; if (a === 0) continue; const row = i * m.oc; for (let o = 0; o < m.oc; o++) out[o] += a * m.w[row + o]; }
    return out;
  };
  const withBias = (out, b) => { for (let o = 0; o < out.length; o++) out[o] += b.w[o]; return out; };

  // pooled features of an activated tensor: mean, mean scaled by the board's size, max
  const pool = (S, ten, c, h, w, kind) => {
    X.gpool(ten.at, c, h, w, S.mean, S.max);
    const mean = f32(S.mean, c), max = f32(S.max, c), out = new Float32Array(3 * c);
    const q = (Math.sqrt(h * w) - 14) / 10;
    for (let k = 0; k < c; k++) {
      out[k] = mean[k];
      out[c + k] = mean[k] * q;
      out[2 * c + k] = kind === "value" ? mean[k] * (q * q - 0.1) : max[k];
    }
    return out;
  };

  // spatial: Float32Array h*w*inC (NHWC), globals: Float32Array(inG). Returns the net's outputs for the player to move.
  function evaluate(spatial, globals, h, w) {
    const S = tensors(h, w), Wp = w + 2 * B;
    const inp = f32(S.input.at, S.input.n);
    for (let y = 0; y < h; y++) inp.set(spatial.subarray(y * w * net.inC, (y + 1) * w * net.inC), ((y + B) * Wp + B) * net.inC);
    X.conv(S.input.at, net.inC, L.init.w, S.x.at, L.init.oc, h, w, L.init.k, 0);
    const gb = matmul(T.global, globals);
    X.addbias(S.x.at, tmp(gb), net.trunkC, h, w);
    const C = net.trunkC;
    for (const b of L.blocks) {
      X.bnact(S.x.at, b.preBN.s, b.preBN.t, S.a.at, C, h, w, 1);
      const R = S.r(b.regular.oc);
      X.conv(S.a.at, C, b.regular.w, R.at, b.regular.oc, h, w, b.regular.k, 0);
      if (b.gp) {
        const G = S.g(b.gconv.oc);
        X.conv(S.a.at, C, b.gconv.w, G.at, b.gconv.oc, h, w, b.gconv.k, 0);
        X.bnact(G.at, b.gBN.s, b.gBN.t, G.at, b.gconv.oc, h, w, 1);
        const vec = pool(S, G, b.gconv.oc, h, w, "policy");
        X.addbias(R.at, tmp(matmul(b.gToBias, vec)), b.regular.oc, h, w);
      }
      X.bnact(R.at, b.midBN.s, b.midBN.t, R.at, b.regular.oc, h, w, 1);
      X.conv(R.at, b.regular.oc, b.final.w, S.x.at, C, h, w, b.final.k, 1);
    }
    X.bnact(S.x.at, L.tipBN.s, L.tipBN.t, S.x.at, C, h, w, 1); // S.x is now the trunk's output
    // policy
    X.conv(S.x.at, C, L.p1.w, S.p1.at, L.p1.oc, h, w, 1, 0);
    X.conv(S.x.at, C, L.g1.w, S.g1.at, L.g1.oc, h, w, 1, 0);
    X.bnact(S.g1.at, L.g1BN.s, L.g1BN.t, S.g1.at, L.g1.oc, h, w, 1);
    const gv = pool(S, S.g1, L.g1.oc, h, w, "policy");
    X.addbias(S.p1.at, tmp(matmul(P.toBias, gv)), L.p1.oc, h, w);
    X.bnact(S.p1.at, L.p1BN.s, L.p1BN.t, S.p1.at, L.p1.oc, h, w, 1);
    X.conv(S.p1.at, L.p1.oc, L.p2.w, S.p2.at, L.p2.oc, h, w, 1, 0);
    const pass = matmul(P.toPass, gv)[0];
    // value
    X.conv(S.x.at, C, L.v1.w, S.v1.at, L.v1.oc, h, w, 1, 0);
    X.bnact(S.v1.at, L.v1BN.s, L.v1BN.t, S.v1.at, L.v1.oc, h, w, 1);
    const vv = pool(S, S.v1, L.v1.oc, h, w, "value");
    const v2 = withBias(matmul(V.v2, vv), V.v2b).map((x) => (x > 0 ? x : 0));
    const v3 = withBias(matmul(V.v3, v2), V.v3b), sv = withBias(matmul(V.sv3, v2), V.sv3b);
    X.conv(S.v1.at, L.v1.oc, L.own.w, S.own.at, L.own.oc, h, w, 1, 0);
    const p2 = f32(S.p2.at, S.p2.n), ow = f32(S.own.at, S.own.n);
    const logits = new Float32Array(h * w + 1), own = new Float32Array(h * w);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cell = (y + B) * Wp + x + B;
      logits[y * w + x] = p2[cell * 4];
      own[y * w + x] = Math.tanh(ow[cell * 4]);
    }
    logits[h * w] = pass;
    const m = Math.max(v3[0], v3[1], v3[2]), e = [Math.exp(v3[0] - m), Math.exp(v3[1] - m), Math.exp(v3[2] - m)], z = e[0] + e[1] + e[2];
    return { logits, win: e[0] / z, loss: e[1] / z, noResult: e[2] / z, own, scoreMean: sv[0] * 20 };
  }
  return { evaluate, info: { name: net.name, inC: net.inC, inG: net.inG, trunkC: net.trunkC, blocks: T.blocks.map((b) => b.kind) } };
}
