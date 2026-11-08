// Slipway, pure: a timber block to be cut down to a piece you are not shown. You are given a cut list, a few rules in words
// ("Saw off the top layer. Within the lowest two layers, chisel away the dark cubes."), and have to work out what is left
// when they have been carried out, then cut that out of the timber. The rules are deterministic: each step names cubes by
// where they are (a layer, a kind of cube, a shaft, a diagonal, a chequer shade) and cuts them away or keeps only them,
// optionally only within a part of the block. Cubes are numbered from 1: left to right, front to back, bottom to top.
// A seed makes the same list and the same piece on every device. Nothing here is timed.

/** A seeded stream of numbers in [0, 1) (mulberry32). */
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// steps: how many; within: the share of steps limited to a part of the block; kinds: which selectors may be drawn; need: one of these must be in
export const LEVELS = {
  easy: { n: 3, steps: [2, 3], within: 0, kinds: ["slab", "cell", "bore"], need: null, size: [6, 20] },
  medium: { n: 4, steps: [3, 3], within: 0.5, kinds: ["slab", "cell", "bore", "chequer", "diagonal"], need: null, size: [14, 46] },
  hard: { n: 4, steps: [4, 4], within: 0.75, kinds: ["slab", "cell", "bore", "chequer", "diagonal"], need: ["chequer", "diagonal"], size: [14, 46] },
};
export const LEVEL_IDS = Object.keys(LEVELS);

export const at = (n, x, y, z) => x + n * (y + n * z);
export const xyz = (n, k) => [k % n, ((k / n) | 0) % n, (k / (n * n)) | 0];

// ---------- the ways of naming cubes ----------
const WORD = ["", "", "two", "three", "four"];
const SIDES = [["left", "right", "slice"], ["front", "back", "slice"], ["bottom", "top", "layer"]];
const AXIS_NAME = ["left number", "front number", "height number"];
/** What the words need explaining, for the cut list's footnotes: by the kinds a list uses. */
export const NOTES = {
  count: "Count from 1: left to right, front to back, bottom to top.",
  cell: "A corner cube touches three faces of the block, an edge cube two, a face cube one, the heart none.",
  chequer: "Dark and light cubes alternate in every direction; the bottom-left-front cube is dark.",
};
/** The footnotes a list of steps needs. */
export const notesFor = steps => [NOTES.count, ...["cell", "chequer"].filter(k => steps.some(s => s.sel.kind === k || s.within?.kind === k)).map(k => NOTES[k])];
/** Every way of naming cubes in an n-block: { id, kind, text, test(x, y, z) } (coordinates from 0; the text counts from 1). */
export function selectors(n) {
  const out = [], last = n - 1;
  const add = (kind, id, text, test) => out.push({ kind, id, text, test });
  // slabs: the outer k slices, layers or columns on one side
  for (let a = 0; a < 3; a++) for (let side = 0; side < 2; side++) for (let k = 1; k <= Math.floor(n / 2); k++) {
    const [lo, hi, noun] = SIDES[a], name = side ? hi : lo, plural = k > 1;
    add("slab", `s${a}${side}${k}`, `the ${plural ? `${WORD[k]} ` : ""}${name} ${noun}${plural ? "s" : ""}`, (...c) => (side ? c[a] >= n - k : c[a] < k));
  }
  // kinds of cube, by how many of its coordinates are at the edge of the block
  const extreme = (x, y, z) => (x === 0 || x === last ? 1 : 0) + (y === 0 || y === last ? 1 : 0) + (z === 0 || z === last ? 1 : 0);
  add("cell", "k3", "the corner cubes", (...c) => extreme(...c) === 3);
  add("cell", "k2", "the edge cubes", (...c) => extreme(...c) === 2);
  add("cell", "k1", "the face cubes", (...c) => extreme(...c) === 1);
  add("cell", "k0", "the heart", (...c) => extreme(...c) === 0);
  // shafts and tunnels
  for (let u = 0; u < n; u++) for (let v = 0; v < n; v++) {
    add("bore", `bz${u}${v}`, `the shaft at left ${u + 1}, front ${v + 1}`, (x, y) => x === u && y === v);
    add("bore", `bx${u}${v}`, `the tunnel from left to right at front ${u + 1}, height ${v + 1}`, (x, y, z) => y === u && z === v);
    add("bore", `by${u}${v}`, `the tunnel from front to back at left ${u + 1}, height ${v + 1}`, (x, y, z) => x === u && z === v);
  }
  // the chequer: cubes alternate dark and light in every direction, the bottom-left-front corner being dark
  add("chequer", "dark", "the dark cubes", (x, y, z) => (x + y + z) % 2 === 0);
  add("chequer", "light", "the light cubes", (x, y, z) => (x + y + z) % 2 === 1);
  // diagonals: one number against another
  for (const [a, b] of [[2, 0], [2, 1], [0, 1]]) {
    add("diagonal", `d${a}${b}>`, `the cubes whose ${AXIS_NAME[a]} is more than their ${AXIS_NAME[b]}`, (...c) => c[a] > c[b]);
    add("diagonal", `d${a}${b}=`, `the cubes whose ${AXIS_NAME[a]} is the same as their ${AXIS_NAME[b]}`, (...c) => c[a] === c[b]);
  }
  return out;
}
/** Regions a step may be limited to: slabs and the kinds of cube, never the one it works on. */
const regionsOf = n => selectors(n).filter(s => s.kind === "slab" || (s.kind === "cell" && s.id !== "k0"));

// ---------- a cut list and what it leaves ----------
const cap = t => t[0].toUpperCase() + t.slice(1);
const VERB = { slab: "Saw off", bore: "Bore out", cell: "Chisel away", chequer: "Chisel away", diagonal: "Saw away" };
/** A step in words. */
export function wording({ act, sel, within }) {
  const where = within ? `Within ${within.text}, ` : "";
  const body = act === "cut" ? `${VERB[sel.kind].toLowerCase()} ${sel.text}` : `keep only ${sel.text}`;
  return within ? `${where}${body}.` : `${cap(body)}.`;
}
/** The cubes left (a Uint8Array over the n³ cells, 1 for there) after the steps. */
export function carryOut(n, steps) {
  const left = new Uint8Array(n ** 3).fill(1);
  for (const { act, sel, within } of steps) {
    for (let k = 0; k < left.length; k++) {
      if (!left[k]) continue;
      const [x, y, z] = xyz(n, k);
      if (within && !within.test(x, y, z)) continue;
      const hit = sel.test(x, y, z);
      if (act === "cut" ? hit : !hit) left[k] = 0;
    }
  }
  return left;
}
const count = a => a.reduce((s, v) => s + v, 0);
/** One piece, by faces: every cube reachable from the first. */
export function connected(n, cells) {
  const first = cells.indexOf(1);
  if (first < 0) return false;
  const seen = new Uint8Array(cells.length), todo = [first];
  seen[first] = 1;
  let got = 1;
  while (todo.length) {
    const [x, y, z] = xyz(n, todo.pop());
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const X = x + dx, Y = y + dy, Z = z + dz;
      if (X < 0 || Y < 0 || Z < 0 || X >= n || Y >= n || Z >= n) continue;
      const k = at(n, X, Y, Z);
      if (cells[k] && !seen[k]) { seen[k] = 1; got++; todo.push(k); }
    }
  }
  return got === count(cells);
}
/** A plain box is no piece worth cutting. */
function isBox(n, cells) {
  const lo = [n, n, n], hi = [-1, -1, -1];
  cells.forEach((v, k) => { if (v) xyz(n, k).forEach((c, i) => { lo[i] = Math.min(lo[i], c); hi[i] = Math.max(hi[i], c); }); });
  return count(cells) === (hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1);
}

// ---------- the tools, and a par ----------
/** The cubes a tool takes at cube k: a chisel the cube, a bore the line through it along `axis`, a saw the whole layer at its place along `axis`. */
export function reach(n, tool, axis, k) {
  const c = xyz(n, k), out = [];
  if (tool === "chisel") return [k];
  for (let i = 0; i < n; i++) {
    const p = c.slice();
    p[axis] = i;
    if (tool === "bore") { out.push(at(n, ...p)); continue; }
    for (let j = 0; j < n; j++) { const q = p.slice(); q[(axis + 1) % 3] = i; q[(axis + 2) % 3] = j; q[axis] = c[axis]; out.push(at(n, ...q)); }
  }
  return tool === "bore" ? out : [...new Set(out)];
}
/** The best way down by the greedy rule (always the tool that takes most unwanted cubes and spoils none): its operations, in order. */
export function parOps(n, target, from = null) {
  const cur = from ? Uint8Array.from(from) : new Uint8Array(n ** 3).fill(1), ops = [];
  while (cur.some((v, k) => v && !target[k])) {
    let best = null;
    for (let k = 0; k < cur.length; k++) {
      if (!cur[k] || target[k]) continue;
      for (const [tool, axis] of [["chisel", 0], ["bore", 0], ["bore", 1], ["bore", 2], ["saw", 0], ["saw", 1], ["saw", 2]]) {
        const cells = reach(n, tool, axis, k).filter(j => cur[j]);
        if (cells.some(j => target[j])) continue;
        if (!best || cells.length > best.cells.length) best = { tool, axis, k, cells };
      }
    }
    for (const j of best.cells) cur[j] = 0;
    ops.push({ tool: best.tool, axis: best.axis, k: best.k, cells: best.cells });
  }
  return ops;
}

// ---------- dealing ----------
const pick = (rand, xs) => xs[Math.floor(rand() * xs.length)];
/**
 * A cut list of the level and the piece it leaves: { n, steps (with their words), text: [..], target (0/1 per cell), par,
 * chequer (whether the dark cubes are marked) } or null if this seed gave nothing (the caller tries the next).
 */
export function dealCut(seed, level) {
  const L = LEVELS[level], n = L.n, rand = seeded(Math.imul(seed | 0, 2654435761) + n);
  const every = selectors(n), byKind = L.kinds.map(k => every.filter(s => s.kind === k)), regions = regionsOf(n);
  for (let tries = 0; tries < 600; tries++) {
    const len = L.steps[0] + Math.floor(rand() * (L.steps[1] - L.steps[0] + 1)), steps = [], used = new Set();
    for (let i = 0; i < len; i++) {
      const sel = pick(rand, pick(rand, byKind));          // (a kind first, so the many shafts do not crowd the rest out)
      if (used.has(sel.id)) continue;
      used.add(sel.id);
      const limited = rand() < (sel.kind === "slab" ? L.within * 0.4 : L.within), within = limited ? pick(rand, regions.filter(r => r.id !== sel.id)) : null;
      steps.push({ act: ["chequer", "diagonal", "slab"].includes(sel.kind) || rand() < 0.8 ? "cut" : "keep", sel, within });
    }
    if (steps.length < L.steps[0]) continue;
    const target = carryOut(n, steps), size = count(target);
    if (size < L.size[0] || size > L.size[1] || !connected(n, target) || isBox(n, target)) continue;
    // every step must matter (leave it out and the piece differs), and cut something when its turn comes
    let ok = true, prior = new Uint8Array(n ** 3).fill(1);
    for (let i = 0; i < steps.length && ok; i++) {
      const next = carryOut(n, steps.slice(0, i + 1));
      if (count(next) === count(prior)) ok = false;
      prior = next;
      const without = carryOut(n, steps.filter((_, j) => j !== i));
      if (without.every((v, k) => v === target[k])) ok = false;
    }
    if (!ok) continue;
    if (L.need && !steps.some(s => L.need.includes(s.sel.kind))) continue;
    if (new Set(steps.map(s => s.sel.kind)).size < 2 && level !== "easy") continue;
    return { n, steps, text: steps.map(wording), notes: notesFor(steps), target: Array.from(target), par: parOps(n, target).length, chequer: steps.some(s => s.sel.kind === "chequer" || s.within?.kind === "chequer") };
  }
  return null;
}
/** Stars: one for the piece cut; two for no hint asked and no more than two cuts into the piece; three for neither and no more than one cut over par. */
export function starsFor({ hints, slips, cuts, par }) {
  if (hints > 0 || slips > 2) return 1;
  return slips === 0 && cuts <= par + 1 ? 3 : 2;
}
