// Lays the knowledge base out as a sky and writes almanac-sky-layout.js. Run it by hand when kb/ has grown a good deal
// (`node almanac-sky-build.mjs`): the page keeps this file's result and never lays anything out itself, so every device
// sees the same sky. A thing added to kb/ since is still placed (near its neighbours: almanac-sky-place.js) and
// tests/almanac-sky.mjs only asks that nearly all things have their place from here.
//
// The sky has regions: each of Settings' subjects gets a centre (subjects whose things link to each other sit nearer), a
// thing is drawn toward its subject's centre (or between the centres of its several), and within a region linked things
// settle near each other. Everything is seeded, so running it again on the same kb/ gives the same file byte for byte.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { subjectsOf, SUBJECT_IDS } from "./almanac-sky-subjects.js";
import { relax, seeded } from "./almanac-sky-force.js";

const SEED = 2711;
/** The width of the sky: the farthest star (nearly) is this far from the middle. */
export const RADIUS = 100;
const SHELL = 62, FLAT = 0.8;        // the regions sit on a shell this wide, a little flatter than a ball: a sky to fly into, hollow in the middle
const FILL = 2.05, MAX_REGION = 21;  // a region is a ball whose radius grows with the cube root of its stars, so every region is about as dense

/**
 * Where each subject's region is centred ([x, y, z] for each of SUBJECT_IDS) and how wide it is. The centres are
 * twenty-odd evenly spread points on the shell; the subjects are dealt to them so that subjects whose things link
 * to each other (`between`, per pair) end up neighbours: swaps, taken while any one shortens the total distance.
 */
export function regionCentres(count, between) {
  const S = SUBJECT_IDS.length;
  const slot = Array.from({ length: S }, (_, k) => {          // a Fibonacci spiral of points: even, and the same every time
    const y = 1 - 2 * (k + 0.5) / S, r = Math.sqrt(1 - y * y), a = k * 2.399963;
    return [r * Math.cos(a) * SHELL, y * SHELL * FLAT, r * Math.sin(a) * SHELL];
  });
  const gap = slot.map(p => slot.map(q => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2));
  const at = [...Array(S).keys()];                              // at[subject] = its slot
  const cost = () => { let c = 0; for (let s = 0; s < S; s++) for (let t = s + 1; t < S; t++) c += between[s * S + t] * gap[at[s]][at[t]]; return c; };
  let best = cost();
  for (let pass = 0; pass < 40; pass++) {
    let better = false;
    for (let s = 0; s < S; s++) for (let t = s + 1; t < S; t++) {
      [at[s], at[t]] = [at[t], at[s]];
      const c = cost();
      if (c < best - 1e-9) { best = c; better = true; } else [at[s], at[t]] = [at[t], at[s]];
    }
    if (!better) break;
  }
  const p = new Float64Array(3 * S);
  for (let s = 0; s < S; s++) p.set(slot[at[s]], 3 * s);
  return { p, radius: count.map(c => Math.min(MAX_REGION, FILL * Math.cbrt(c + 1))) };
}

/**
 * The layout of a knowledge base: { ids, xyz } for every thing that isn't a copy of another, positions as a
 * Float64Array of x, y, z in turn, scaled so the farthest few are RADIUS from the middle.
 */
export function buildLayout(entities, links) {
  const S = SUBJECT_IDS.length;
  const subj = subjectsOf(entities, links);
  const index = new Map(), ids = [], of = [];
  entities.forEach((e, i) => { if (!e.same) { index.set(e.id, ids.length); ids.push(e.id); of.push(i); } });
  entities.forEach(e => { if (e.same && index.has(e.same)) index.set(e.id, index.get(e.same)); });
  const n = ids.length, primary = of.map(i => subj[i][0]);
  const count = new Array(S).fill(0);
  for (const s of primary) count[s]++;
  // edges, one per pair, and how many links run between each pair of subjects
  const seen = new Set(), edges = [], between = new Float64Array(S * S);
  for (const l of links) {
    const a = index.get(l.from), b = index.get(l.to);
    if (a == null || b == null || a === b) continue;
    const key = a < b ? a * n + b : b * n + a;
    if (seen.has(key)) continue;
    seen.add(key);
    const sa = primary[a], sb = primary[b];
    if (sa !== sb) { between[sa * S + sb]++; between[sb * S + sa]++; }
    edges.push([a, b, sa === sb ? 1 : 0.15]);
  }
  // things in one subject that point at the same answer (the energy clues to Norway) are chained, so each such group
  // settles as a clump: the sky has clusters inside its regions, not an even fog
  const group = new Map();
  for (const l of links) {
    if (l.rel !== "clue") continue;
    const a = index.get(l.from), b = index.get(l.to);
    if (a == null || b == null || a === b) continue;
    const key = `${b}:${primary[a]}`;
    (group.get(key) || group.set(key, []).get(key)).push(a);
  }
  for (const members of group.values()) {
    const unique = [...new Set(members)];
    for (let k = 0; k + 1 < unique.length; k++) edges.push([unique[k], unique[k + 1], 1]);
    if (unique.length > 2) edges.push([unique[unique.length - 1], unique[0], 1]);
  }
  const norm = new Float64Array(S * S);
  for (let s = 0; s < S; s++) for (let t = 0; t < S; t++) norm[s * S + t] = between[s * S + t] / Math.sqrt((count[s] + 1) * (count[t] + 1));
  const { p: centre, radius } = regionCentres(count, norm);
  // where each thing is drawn: its subject's centre, or between its subjects' (the first counting double)
  const rnd = seeded(SEED + 2), anchor = new Float64Array(3 * n), start = new Float64Array(3 * n), pull = new Float64Array(n), limit = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const own = subj[of[i]], w = own.map((_, k) => (k === 0 ? 2 : 1)), total = w.reduce((a, b) => a + b, 0);
    for (let c = 0; c < 3; c++) anchor[3 * i + c] = own.reduce((a, s, k) => a + centre[3 * s + c] * w[k], 0) / total;
    // a thing of several subjects floats in the space between their regions, a small ball of its own; one of a single subject fills its region
    const r = own.length === 1 ? radius[primary[i]] : 5;
    let x, y, z;
    do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1);
    start[3 * i] = anchor[3 * i] + x * r * 0.9; start[3 * i + 1] = anchor[3 * i + 1] + y * r * 0.9; start[3 * i + 2] = anchor[3 * i + 2] + z * r * 0.9;
    pull[i] = 0.03; limit[i] = r;
  }
  const spaced = relax({ n, edges, start, anchor, pull, limit, spacing: 2.3, rest: 1.7, steps: 260, seed: SEED });
  // centre it and scale it: the 99.5th percentile of the distances from the middle becomes RADIUS
  const mid = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) mid[c] += spaced[3 * i + c] / n;
  const dist = [];
  for (let i = 0; i < n; i++) dist.push(Math.hypot(spaced[3 * i] - mid[0], spaced[3 * i + 1] - mid[1], spaced[3 * i + 2] - mid[2]));
  const scale = RADIUS / [...dist].sort((a, b) => a - b)[Math.floor(0.995 * (n - 1))];
  const xyz = new Float64Array(3 * n);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) xyz[3 * i + c] = (spaced[3 * i + c] - mid[c]) * scale;
  return { ids, xyz };
}

/** The layout as the file keeps it: positions to 1/300 of a unit in 16 bits each, in base 64. */
export function encode({ ids, xyz }) {
  const STEP = 250, buf = Buffer.alloc(2 * xyz.length);
  xyz.forEach((v, k) => buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * STEP))), 2 * k));
  return { step: STEP, ids: ids.join("\n"), xyz: buf.toString("base64") };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { ENTITIES } = await import("./kb/entities.js");
  const { LINKS } = await import("./kb/links.js");
  const t = Date.now();
  const lay = buildLayout(ENTITIES, LINKS), file = encode(lay);
  const out = `// The sky's layout: where each thing in kb/ is. Written by almanac-sky-build.mjs (run it again when kb/ has grown a good
// deal; things added since are placed near their neighbours). Positions are x, y, z as 16-bit integers in base 64, in
// the order of \`ids\`, each 1/\`step\` of a unit; the sky is about 100 units across from the middle.
export const LAYOUT = ${JSON.stringify(file)};
`;
  writeFileSync(new URL("./almanac-sky-layout.js", import.meta.url), out);
  console.log(`${lay.ids.length} things laid out in ${Date.now() - t} ms, ${(out.length / 1024).toFixed(0)} KB`);
}
