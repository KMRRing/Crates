// Calibre's engine. A movement is drawn the way watchmakers draw it, as a calibre plan: the plate seen from above,
// each arbor (the axle a wheel turns on) a point on it, each wheel or pinion a circle of its pitch diameter on one of
// several layers, the height it sits at between plate and bridge. The engine runs that plan as kinematics: which
// arbor turns, how fast and which way. It knows nothing of levels or screens, so the tests run it directly.
//
// Units: millimetres on the plate, and rates in revolutions per hour, positive clockwise as seen from the dial.

/** Millimetres of pitch diameter per tooth: every wheel in a watch is cut to one module, so size follows tooth count. */
export const MODULE = 0.1;
/** How near to touching two pitch circles must be to mesh. */
export const MESH_TOL = 0.04;
/** The room a pivot needs: a wheel must clear every other arbor by this much, or it rubs on it. */
export const PIVOT_CLEAR = 0.15;

export const radius = teeth => (teeth * MODULE) / 2;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Two arbors on one centre (the hour wheel's tube round the centre arbor) are separate bodies that never touch. */
const concentric = (a, b) => a.on === b.id || b.on === a.id || (!!a.on && a.on === b.on);
/** Layers 6 to 8 lie under the dial, on the far side of the main plate from the train (layers 1 to 5, and the escape
 * wheel's 9): the motion works there never meet the train's wheels, and a stud there doesn't reach through. */
export const DIAL_LAYERS = [6, 7, 8];
const side = layer => (DIAL_LAYERS.includes(layer) ? "dial" : "train");
/** The sides of the plate an arbor reaches: those its parts sit on; an empty arbor, both, until it carries something. */
const sides = a => { const s = new Set((a.parts || []).filter(p => p.teeth).map(p => side(p.layer))); return s.size ? s : new Set(["dial", "train"]); };
/** What regulates a train: an arbor's own regulator, or a balance fitted beside its escape wheel. */
export const regulatorOf = a => a.regulator || ((a.parts || []).some(p => p.kind === "balance") && (a.parts || []).some(p => p.kind === "escape")
  ? { vph: a.parts.find(p => p.kind === "balance").vph, escape: a.parts.find(p => p.kind === "escape").teeth } : null);

/**
 * Runs a design. design = { plate (radius, mm), arbors: [{ id, x, y, parts: [{ kind, teeth, layer }], drive?, power?,
 * regulator?: { vph, escape }, on? }] }. A drive is a fixed rate (a hand crank); power is the barrel's direction, the
 * escapement's regulator then setting how fast the whole train may run: vph / (2 × escape-wheel teeth) turns an hour.
 * Returns { meshes, clashes, rates: { arbor: rev/h | null }, jammed: [arbor], runaway: bool, idle: [arbor] }.
 */
export function run(design) {
  const arbors = design.arbors, byId = new Map(arbors.map(a => [a.id, a]));
  const toothed = arbors.flatMap(a => (a.parts || []).filter(p => p.teeth).map(p => ({ a, p, r: radius(p.teeth) })));
  const meshes = [], clashes = [];
  for (let i = 0; i < toothed.length; i++) for (let j = i + 1; j < toothed.length; j++) {
    const A = toothed[i], B = toothed[j];
    if (A.a === B.a || A.p.layer !== B.p.layer || concentric(A.a, B.a)) continue;
    const gap = dist(A.a, B.a) - (A.r + B.r);
    if (Math.abs(gap) <= MESH_TOL) meshes.push({ a: A.a.id, b: B.a.id, ta: A.p.teeth, tb: B.p.teeth, layer: A.p.layer });
    else if (gap < 0) clashes.push({ kind: "overlap", arbors: [A.a.id, B.a.id], layer: A.p.layer });
  }
  // an arbor runs from plate to bridge, so no wheel, at any height on that side of the plate, may pass over its pivot
  for (const T of toothed) for (const X of arbors) {
    if (X === T.a || concentric(X, T.a) || !sides(X).has(side(T.p.layer))) continue;
    if (dist(X, T.a) < T.r + PIVOT_CLEAR - 1e-9) clashes.push({ kind: "pivot", arbors: [T.a.id, X.id], layer: T.p.layer });
  }
  for (const T of toothed) if (Math.hypot(T.a.x, T.a.y) + T.r > design.plate + MESH_TOL) clashes.push({ kind: "outside", arbors: [T.a.id], layer: T.p.layer });

  // rates: each mesh turns the other arbor the other way, faster by the ratio of teeth
  const edges = new Map(arbors.map(a => [a.id, []]));
  for (const m of meshes) { edges.get(m.a).push([m.b, -m.ta / m.tb]); edges.get(m.b).push([m.a, -m.tb / m.ta]); }
  const rates = Object.fromEntries(arbors.map(a => [a.id, null]));
  const jammed = new Set();
  let runaway = false;
  const spread = (seed, rate) => {                               // one connected train from one source
    const got = new Map([[seed, rate]]), queue = [seed];
    let jam = false;
    while (queue.length) {
      const id = queue.shift();
      for (const [to, k] of edges.get(id)) {
        const want = got.get(id) * k;
        if (!got.has(to)) { got.set(to, want); queue.push(to); }
        else if (!near(got.get(to), want)) jam = true;           // round a loop the turns disagree: it locks
      }
    }
    return { got, jam };
  };
  for (const src of arbors.filter(a => a.drive != null || a.power != null)) {
    if (rates[src.id] != null) continue;
    let { got, jam } = spread(src.id, src.drive ?? src.power);
    if (!jam && src.drive == null) {
      // powered by a barrel: the escapement lets the train turn only as fast as the balance beats
      const reg = arbors.find(a => regulatorOf(a) && got.has(a.id));
      if (reg && got.get(reg.id) !== 0) {
        const { vph, escape } = regulatorOf(reg);
        const scale = vph / (2 * escape) / Math.abs(got.get(reg.id));
        got = new Map([...got].map(([id, r]) => [id, r * scale]));
      } else runaway = true;                                     // nothing holds it back: the spring lets go at once
    }
    for (const [id, r] of got) rates[id] = jam ? 0 : runaway && src.drive == null ? null : r;
    if (jam) for (const id of got.keys()) jammed.add(id);
  }
  const idle = arbors.filter(a => rates[a.id] == null && !runaway).map(a => a.id);
  return { meshes, clashes, rates, jammed: [...jammed], runaway, idle, byId };
}

/** Rates in words: once a minute is 60 an hour; the unit is chosen to make the number readable. */
export function rateText(r) {
  if (r == null) return "still";
  if (r === 0) return "locked";
  const a = Math.abs(r), dir = r > 0 ? "clockwise" : "anticlockwise";
  const n = x => (Math.abs(x - Math.round(x)) < 1e-6 ? String(Math.round(x)) : x.toPrecision(3).replace(/\.?0+$/, ""));
  const how = a >= 60 ? `${n(a / 60)} a minute` : a >= 1 ? `${n(a)} an hour` : a * 24 >= 1 ? `once every ${n(1 / a)} hours` : `once every ${n(1 / a / 24)} days`;
  return `${how}, ${dir}`;
}

/**
 * Checks a design against a level's goals: every goal met, nothing clashing, the train neither jammed nor running away.
 * A goal is { arbor, rate (rev/h), abs? (either direction) }. Returns { ok, out, goals: [{ goal, ok, actual }], problems }.
 */
export function judge(level, design) {
  const out = run(design);
  const goals = (level.goals || []).map(g => {
    const actual = out.rates[g.arbor];
    const ok = actual != null && actual !== 0 && (g.abs ? near(Math.abs(actual), Math.abs(g.rate)) : near(actual, g.rate));
    return { goal: g, ok, actual };
  });
  const problems = [];
  const name = id => out.byId.get(id)?.label || "a wheel";
  for (const c of out.clashes) problems.push(c.kind === "overlap" ? `Two wheels overlap on layer ${c.layer}: ${name(c.arbors[0])} and ${name(c.arbors[1])}.`
    : c.kind === "pivot" ? `A wheel on ${name(c.arbors[0])} passes over the pivot of ${name(c.arbors[1])}.` : `A wheel on ${name(c.arbors[0])} sticks out of the plate.`);
  if (out.jammed.length) problems.push("The train is locked: somewhere wheels mesh in a loop that can't turn.");
  if (out.runaway) problems.push("Nothing holds the spring back: without the escapement in the train it unwinds at once.");
  return { ok: goals.every(g => g.ok) && !problems.length, out, goals, problems };
}

/** A level's starting design: its fixed arbors and anything placed in advance, copied so play never changes the level. */
export function startDesign(level) {
  const copy = a => ({ ...a, parts: (a.parts || []).map(p => ({ ...p, fixed: a.fixed !== false && !a.placed })) });
  return { plate: level.plate, arbors: [...(level.fixed || []).map(a => ({ ...copy(a), fixed: true })), ...(level.placed || []).map(a => ({ ...copy(a), placed: true }))] };
}

/** A level's worked solution applied to its start: { remove: [arbor], add: [{ arbor | at: {x, y, id}, part }] }. */
export function solved(level) {
  const d = startDesign(level);
  for (const id of level.solution.remove || []) d.arbors = d.arbors.filter(a => a.id !== id);
  for (const s of level.solution.add || []) {
    let a = s.arbor ? d.arbors.find(x => x.id === s.arbor) : d.arbors.find(x => x.id === s.at.id);
    if (!a) d.arbors.push(a = { id: s.at.id, x: s.at.x, y: s.at.y, parts: [], label: s.at.label });
    a.parts.push({ ...s.part });
  }
  return d;
}

/** The parts a design uses beyond the level's own: what par counts. */
export const partsUsed = design => design.arbors.reduce((n, a) => n + (a.parts || []).filter(p => !p.fixed).length, 0);

/** Where a new arbor should sit so its part meshes with a neighbour's: on the line from that neighbour to the tap. */
export function snap(design, x, y, teeth, layer, exclude) {
  const r = radius(teeth);
  let best = null;
  for (const a of design.arbors) {
    if (a.id === exclude) continue;
    for (const p of a.parts || []) {
      if (p.layer !== layer || !p.teeth) continue;
      const d = r + radius(p.teeth), dx = x - a.x, dy = y - a.y, len = Math.hypot(dx, dy) || 1;
      const sx = a.x + (dx / len) * d, sy = a.y + (dy / len) * d, off = Math.hypot(sx - x, sy - y);
      if (off < Math.max(1.2, r) && (!best || off < best.off)) best = { x: sx, y: sy, off, to: a.id };
    }
  }
  return best;
}
