// Crucible's masonry, made on the device for the 3D foundry (settle-3d.js): old brick in English bond for the wall, pale firebrick
// for the firebox, and sandstone for the furnace arch. Each is a colour map and a normal map (so the light catches the sunk joints and
// the worn, chipped arrises), and each tiles both ways. Korbi, 25 November 2026: "I think the bricks are the big issue with
// crucibles. firstly make them look better and more realistic".
import { CanvasTexture } from "./vendor/three-tex.js";

const REPEAT = 1000;                                          // THREE.RepeatWrapping (not in the bundle's exports)
const fade = t => t * t * (3 - 2 * t);
const seeded = seed => () => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff);

/** Tileable value noise over a w×h texture, `cx` cells across and `cy` down: (x, y) in pixels → 0..1. */
function lattice(w, h, cx, cy, rand) {
  const v = Float32Array.from({ length: cx * cy }, rand), sx = cx / w, sy = cy / h;
  return (x, y) => {
    const gx = x * sx, gy = y * sy, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = fade(gx - x0), fy = fade(gy - y0);
    const i0 = ((x0 % cx) + cx) % cx, i1 = (i0 + 1) % cx, j0 = ((y0 % cy) + cy) % cy, r0 = j0 * cx, r1 = ((j0 + 1) % cy) * cx;
    const a = v[r0 + i0] + (v[r0 + i1] - v[r0 + i0]) * fx, b = v[r1 + i0] + (v[r1 + i1] - v[r1 + i0]) * fx;
    return a + (b - a) * fy;
  };
}
/** HSL (hue in degrees) → linear-ish 0..1 RGB, as the canvas takes it. */
function hsl(h, s, l) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map(n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
}
/** The colour map (sRGB) and the normal map of a texture from its colours and its height field; `bump` steepens the normals. */
function textures(w, h, rgb, height, bump) {
  const map = document.createElement("canvas"), nor = document.createElement("canvas");
  map.width = nor.width = w; map.height = nor.height = h;
  const a = map.getContext("2d").createImageData(w, h), b = nor.getContext("2d").createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const up = ((y + h - 1) % h) * w, down = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const k = y * w + x, p = k * 4;
      a.data[p] = rgb[k * 3] * 255; a.data[p + 1] = rgb[k * 3 + 1] * 255; a.data[p + 2] = rgb[k * 3 + 2] * 255; a.data[p + 3] = 255;
      // canvas rows run down and the texture's v up, so a rise down the canvas tips the normal up
      const nx = -(height[y * w + (x + 1) % w] - height[y * w + (x + w - 1) % w]) * bump, ny = (height[down + x] - height[up + x]) * bump, l = Math.hypot(nx, ny, 1);
      b.data[p] = (nx / l * 0.5 + 0.5) * 255; b.data[p + 1] = (ny / l * 0.5 + 0.5) * 255; b.data[p + 2] = (0.5 / l + 0.5) * 255; b.data[p + 3] = 255;
    }
  }
  map.getContext("2d").putImageData(a, 0, 0); nor.getContext("2d").putImageData(b, 0, 0);
  const tm = new CanvasTexture(map), tn = new CanvasTexture(nor);
  tm.colorSpace = "srgb";
  for (const t of [tm, tn]) { t.wrapS = t.wrapT = REPEAT; t.anisotropy = 4; }
  return { map: tm, normal: tn };
}

const KINDS = {
  // hand-made brick: reds and browns, one in ten overburnt near black, a few pale and orange; a grey lime mortar
  red: {
    seed: 11, mortar: [0.42, 0.39, 0.35], speck: 0.62,
    brick: r => { const k = r(); return k < 0.1 ? hsl(4 + r() * 10, 0.22 + r() * 0.12, 0.1 + r() * 0.06) : k < 0.2 ? hsl(16 + r() * 8, 0.42, 0.34 + r() * 0.06) : hsl(4 + r() * 14, 0.36 + r() * 0.2, 0.2 + r() * 0.11); },
  },
  // firebrick: buff and cream, some scorched brown; a pale fireclay mortar
  fire: {
    seed: 23, mortar: [0.62, 0.58, 0.52], speck: 1.22,
    brick: r => { const k = r(); return k < 0.18 ? hsl(26 + r() * 8, 0.28, 0.3 + r() * 0.1) : hsl(32 + r() * 10, 0.22 + r() * 0.14, 0.5 + r() * 0.14); },
  },
};
/** Brick in English bond, a course of stretchers then a course of headers, each brick its own colour, mottled, flecked and burnt
 *  darker at one end, its arrises worn and chipped, the joints sunk; `kind` "red" (the wall) or "fire" (the firebox). Six stretchers
 *  across, ten courses down: `size` is the patch it covers, in the scene's units (a stretcher 0.6 long, a course 0.18 high). */
export function brickwork(kind) {
  // 512 across is about two texels to a screen pixel on an iPad, and a quarter of the work of 1024 (a phone makes these as the page opens)
  const K = KINDS[kind], r = seeded(K.seed), W = 512, H = 256, ROWS = 10, rh = H / ROWS, JOINT = 3.6;
  const rgb = new Float32Array(W * H * 3), hgt = new Float32Array(W * H);
  const mottle = lattice(W, H, 24, 12, r), grain = lattice(W, H, 128, 64, r), fine = lattice(W, H, 256, 128, r), wear = lattice(W, H, 160, 80, r);
  const courses = Array.from({ length: ROWS }, (_, row) => Array.from({ length: row % 2 ? 12 : 6 }, () => ({ c: K.brick(r), burn: (r() - 0.5) * 0.6, face: 0.9 + r() * 0.2 })));
  for (let y = 0; y < H; y++) {
    const row = Math.floor(y / rh), ly = y - row * rh, n = row % 2 ? 12 : 6, bw = W / n, off = row % 2 ? bw / 2 : 0;
    for (let x = 0; x < W; x++) {
      const xx = (x - off + W) % W, b = Math.floor(xx / bw), lx = xx - b * bw, B = courses[row][b], k = y * W + x;
      const inside = Math.min(lx, bw - lx, ly, rh - ly) - JOINT / 2, worn = 0.5 + 2.6 * wear(x, y) ** 3, g = grain(x, y), f = fine(x, y);
      if (inside > worn * 0.4) {
        const round = fade(Math.min(1, (inside - worn * 0.4) / (worn + 0.8))), pit = f < 0.1;
        hgt[k] = 0.5 + 0.5 * round + (f - 0.5) * 0.1 - (pit ? 0.22 : 0);
        const m = (0.78 + 0.36 * mottle(x, y)) * (0.9 + 0.2 * g) * (1 + B.burn * (lx / bw - 0.5)) * (0.84 + 0.16 * round) * B.face * (f > 0.88 ? K.speck : 1) * (pit ? 0.7 : 1);
        for (let c = 0; c < 3; c++) rgb[k * 3 + c] = Math.min(1, B.c[c] * m);
      } else {
        hgt[k] = 0.1 + 0.12 * g + 0.06 * f;
        const m = 0.72 + 0.34 * g + 0.12 * f;
        for (let c = 0; c < 3; c++) rgb[k * 3 + c] = K.mortar[c] * m;
      }
    }
  }
  return { ...textures(W, H, rgb, hgt, 1.7), size: [3.6, 1.8] };
}

/** Sandstone for the arch: a warm buff, clouded and bedded in faint bands, gritty and pitted; `size` as for brickwork. */
export function sandstone() {
  const r = seeded(31), S = 256, rgb = new Float32Array(S * S * 3), hgt = new Float32Array(S * S);
  const cloud = lattice(S, S, 3, 3, r), mid = lattice(S, S, 12, 12, r), bed = lattice(S, S, 2, 40, r), grit = lattice(S, S, 128, 128, r), stain = lattice(S, S, 4, 4, r);
  const base = hsl(34, 0.3, 0.55), rust = hsl(24, 0.5, 0.42);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = y * S + x, g = grit(x, y), s = fade(Math.max(0, stain(x, y) - 0.55) / 0.45), pit = g < 0.08;
    const m = (0.8 + 0.2 * cloud(x, y) + 0.12 * mid(x, y) + 0.1 * (bed(x, y) - 0.5) + 0.1 * g) * (pit ? 0.72 : 1);
    for (let c = 0; c < 3; c++) rgb[k * 3 + c] = Math.min(1, (base[c] * (1 - s * 0.6) + rust[c] * s * 0.6) * m);
    hgt[k] = 0.5 + 0.3 * mid(x, y) + 0.2 * g - (pit ? 0.3 : 0);
  }
  return { ...textures(S, S, rgb, hgt, 1.6), size: [1.2, 1.2] };
}
