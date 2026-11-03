// A seeded relaxation in three dimensions, for laying the knowledge graph out as a sky (almanac-sky-build.mjs runs it once,
// offline; the page never does). Pure and deterministic: only + - * / and sqrt, which every JavaScript engine rounds
// the same way, and a seeded generator, so the same graph and seed always give the same positions.
//
// Positional relaxation (each step moves things straight to where their constraints want them, a fraction of the way,
// as in Jakobsen's verlet cloth) rather than velocities: nothing explodes, and a cooling factor settles it.
//   spacing   things nearer than this push apart (found through a hash grid, so it is near-linear in the count)
//   springs   an edge pulls its two ends toward a rest length, weakly (a hub with a hundred edges must not drag them all)
//   anchors   each thing is drawn toward the point its subject gives it, so a subject's stars stay together

/** A seeded generator of floats in [0, 1) (mulberry32). */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Positions for `n` things, as a Float64Array of x, y, z in turn.
 *   edges   [[a, b, strength]…] indexes into the things; strength 0..1, how hard it pulls
 *   start   Float64Array(3n), where each begins
 *   anchor  Float64Array(3n), where each is drawn to; pull: Float64Array(n), how hard (a share of the way, per step)
 *   limit   Float64Array(n), if given: no thing strays further than this from its anchor (a region is a ball, not a smear)
 */
export function relax({ n, edges, start, anchor, pull, limit = null, spacing = 2, rest = 1.6, steps = 220, seed = 1 }) {
  const p = Float64Array.from(start), rnd = seeded(seed);
  const SIZE = 1 << 15, head = new Int32Array(SIZE), next = new Int32Array(n), cx = new Int32Array(n), cy = new Int32Array(n), cz = new Int32Array(n);
  const keyOf = (x, y, z) => ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) >>> 0) & (SIZE - 1);
  const dx = new Float64Array(3 * n);
  const degree = new Float64Array(n);
  for (const [a, b] of edges) { degree[a]++; degree[b]++; }
  for (let step = 0; step < steps; step++) {
    const temp = 1 - 0.85 * (step / steps);
    dx.fill(0);
    // the grid: each cell's things in a list, the cells hashed
    head.fill(-1);
    for (let i = 0; i < n; i++) {
      cx[i] = Math.floor(p[3 * i] / spacing); cy[i] = Math.floor(p[3 * i + 1] / spacing); cz[i] = Math.floor(p[3 * i + 2] / spacing);
      const k = keyOf(cx[i], cy[i], cz[i]);
      next[i] = head[k]; head[k] = i;
    }
    const seen = new Int32Array(27);
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) {
        const k = keyOf(cx[i] + ox, cy[i] + oy, cz[i] + oz);
        let dup = false;
        for (let q = 0; q < m; q++) if (seen[q] === k) { dup = true; break; }       // two cells that hash alike are scanned once
        if (dup) continue;
        seen[m++] = k;
        for (let j = head[k]; j >= 0; j = next[j]) {
          if (j <= i) continue;
          let ex = p[3 * j] - p[3 * i], ey = p[3 * j + 1] - p[3 * i + 1], ez = p[3 * j + 2] - p[3 * i + 2];
          const d2 = ex * ex + ey * ey + ez * ez;
          if (d2 >= spacing * spacing) continue;
          let d = Math.sqrt(d2);
          if (d < 1e-6) { ex = rnd() - 0.5; ey = rnd() - 0.5; ez = rnd() - 0.5; d = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1; }
          const push = 0.5 * (spacing - d) / d * 0.6;
          dx[3 * i] -= ex * push; dx[3 * i + 1] -= ey * push; dx[3 * i + 2] -= ez * push;
          dx[3 * j] += ex * push; dx[3 * j + 1] += ey * push; dx[3 * j + 2] += ez * push;
        }
      }
    }
    for (const [a, b, w] of edges) {
      const ex = p[3 * b] - p[3 * a], ey = p[3 * b + 1] - p[3 * a + 1], ez = p[3 * b + 2] - p[3 * a + 2];
      const d = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (d < 1e-9) continue;
      // normalised by the busier end's degree, so a hub's hundred edges together pull about as hard as one
      const pullBy = 0.5 * w * (d - rest) / d * 0.25 / Math.sqrt(Math.max(1, Math.sqrt(degree[a] * degree[b])));
      dx[3 * a] += ex * pullBy; dx[3 * a + 1] += ey * pullBy; dx[3 * a + 2] += ez * pullBy;
      dx[3 * b] -= ex * pullBy; dx[3 * b + 1] -= ey * pullBy; dx[3 * b + 2] -= ez * pullBy;
    }
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        const k = 3 * i + c;
        p[k] += (dx[k] + (anchor[k] - p[k]) * pull[i]) * temp;
      }
      if (limit) {
        const ax = p[3 * i] - anchor[3 * i], ay = p[3 * i + 1] - anchor[3 * i + 1], az = p[3 * i + 2] - anchor[3 * i + 2];
        const d = Math.sqrt(ax * ax + ay * ay + az * az), soft = 0.8 * limit[i];
        // a soft wall from four fifths of the way out (a hard one cuts a region off flat), a hard one a quarter beyond
        if (d > soft) {
          const to = Math.min(limit[i] * 1.2, d - (d - soft) * 0.3) / d;
          p[3 * i] = anchor[3 * i] + ax * to; p[3 * i + 1] = anchor[3 * i + 1] + ay * to; p[3 * i + 2] = anchor[3 * i + 2] + az * to;
        }
      }
    }
  }
  return p;
}
