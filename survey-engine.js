// Survey: a mining concession hides ore in a few bodies (clusters of 2–3 connected cells that never touch). You
// buy readings with a budget of credits: a seismic line along a row or column (how many ore cells on it), a
// magnetometer at a cell (how many in the 3×3 around it), or a drill (the truth about one cell). Mark what you
// deduce and file a claim when your marks are exactly right. What you have left is your score.

export const TOOLS = { line: { cost: 2, name: "Seismic line" }, magnet: { cost: 3, name: "Magnetometer" }, drill: { cost: 5, name: "Drill" } };
export const WRONG_CLAIM = 10;
export const SIZES = {
  small: { label: "Small", n: 5, bodies: 2, budget: 40 },
  medium: { label: "Medium", n: 6, bodies: 3, budget: 55 },
  large: { label: "Large", n: 7, bodies: 3, budget: 60 },
  vast: { label: "Vast", n: 8, bodies: 4, budget: 75 },
};

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const key = (x, y) => `${x},${y}`;
const mix = (a, b) => (Math.imul(a ^ 0x9E3779B1, 0x85EBCA6B) ^ Math.imul(b + 1, 0xC2B2AE35)) >>> 0;

/**
 * A concession: { n, ore: Set of "x,y", bodies: [[cells]], budget }. Bodies are 2–3 orthogonally connected cells;
 * no two bodies touch, not even at a corner.
 */
export function makeConcession(seed, sizeId) {
  const size = SIZES[sizeId], r = rng(mix(seed, Object.keys(SIZES).indexOf(sizeId)));
  const n = size.n;
  for (let attempt = 0; attempt < 500; attempt++) {
    const ore = new Set(), bodies = [];
    let ok = true;
    for (let b = 0; b < size.bodies && ok; b++) {
      let placed = false;
      for (let tries = 0; tries < 60 && !placed; tries++) {
        const len = int(r, 2, 3);
        const cells = [[int(r, 0, n - 1), int(r, 0, n - 1)]];
        while (cells.length < len) {
          const [x, y] = cells[cells.length - 1], d = [[1, 0], [-1, 0], [0, 1], [0, -1]][int(r, 0, 3)];
          const nx = x + d[0], ny = y + d[1];
          if (nx < 0 || ny < 0 || nx >= n || ny >= n || cells.some(([cx, cy]) => cx === nx && cy === ny)) break;
          cells.push([nx, ny]);
        }
        if (cells.length !== len) continue;
        // keep clear of other bodies, corners included
        const clear = cells.every(([x, y]) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (ore.has(key(x + dx, y + dy))) return false; return true; });
        if (!clear) continue;
        for (const [x, y] of cells) ore.add(key(x, y));
        bodies.push(cells);
        placed = true;
      }
      if (!placed) ok = false;
    }
    if (ok) return { n, ore, bodies, budget: size.budget, size: sizeId };
  }
  throw new Error("couldn't lay out a concession");
}

/** A reading: how many ore cells a tool finds. */
export function read(c, tool, a, b) {
  if (tool === "line") {                           // a = "row" | "col", b = index
    let count = 0;
    for (let i = 0; i < c.n; i++) if (c.ore.has(a === "row" ? key(i, b) : key(b, i))) count++;
    return count;
  }
  if (tool === "magnet") {                         // a, b = x, y: the 3×3 around it, clipped at the edges
    let count = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (c.ore.has(key(a + dx, b + dy))) count++;
    return count;
  }
  return c.ore.has(key(a, b)) ? 1 : 0;             // drill
}

/** Does a layout obey the rules: exactly `count` bodies of 2–3 connected cells, none touching another? */
export function isBodies(ore, count) {
  const seen = new Set(), comps = [];
  for (const start of ore) {
    if (seen.has(start)) continue;
    const comp = [], stack = [start];
    seen.add(start);
    while (stack.length) {
      const k = stack.pop(); comp.push(k);
      const [x, y] = k.split(",").map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nk = key(x + dx, y + dy); if (ore.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); } }
    }
    comps.push(comp);
  }
  if (comps.length !== count || comps.some(cmp => cmp.length < 2 || cmp.length > 3)) return false;
  for (let i = 0; i < comps.length; i++) for (let j = i + 1; j < comps.length; j++) {
    const touch = comps[i].some(a => comps[j].some(b => { const [x, y] = a.split(",").map(Number), [u, v] = b.split(",").map(Number); return Math.abs(x - u) <= 1 && Math.abs(y - v) <= 1; }));
    if (touch) return false;
  }
  return true;
}

/** Does a set of marked cells match the ore exactly? */
export const claimRight = (c, marks) => marks.size === c.ore.size && [...marks].every(k => c.ore.has(k));

/**
 * A run of a concession as the page keeps it: credits, readings taken ({ tool, a, b, value }), marks, claims.
 * These are pure helpers so the page and the tests agree.
 */
export function newRun(c) { return { credits: c.budget, readings: [], ore: new Set(), barren: new Set(), claims: 0, done: false }; }
export function probe(c, run, tool, a, b) {
  const cost = TOOLS[tool].cost;
  if (run.done || run.credits < cost) return null;
  if (run.readings.some(x => x.tool === tool && x.a === a && x.b === b)) return null;   // already read
  const value = read(c, tool, a, b);
  run.credits -= cost;
  run.readings.push({ tool, a, b, value });
  return value;
}
export function claim(c, run) {
  if (run.done) return false;
  run.claims++;
  if (claimRight(c, run.ore)) { run.done = true; return true; }
  run.credits = Math.max(0, run.credits - WRONG_CLAIM);
  return false;
}

/**
 * Every ore layout consistent with the readings so far: used to tell the player when the board is settled
 * (one layout left) and, in tests, that readings pin things down. Counts up to cap.
 */
export function layoutsConsistent(c, readings, cap = 200) {
  const n = c.n, size = c.ore.size, cells = [];
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) cells.push([x, y]);
  const found = [];
  const fits = ore => readings.every(r => read({ n, ore }, r.tool, r.a, r.b) === r.value) && isBodies(ore, c.bodies.length);
  // choose `size` cells; prune by the drill and line readings as we go, with a full check at the end
  const chosen = [];
  const drilledOre = readings.filter(r => r.tool === "drill" && r.value === 1).map(r => key(r.a, r.b));
  const drilledBarren = new Set(readings.filter(r => r.tool === "drill" && r.value === 0).map(r => key(r.a, r.b)));
  const rec = i => {
    if (found.length >= cap) return;
    if (chosen.length === size) { const ore = new Set(chosen); if (drilledOre.every(k => ore.has(k)) && fits(ore)) found.push(ore); return; }
    if (i >= cells.length || cells.length - i < size - chosen.length) return;
    const k = key(...cells[i]);
    if (!drilledBarren.has(k)) { chosen.push(k); rec(i + 1); chosen.pop(); }
    rec(i + 1);
  };
  rec(0);
  return found;
}
