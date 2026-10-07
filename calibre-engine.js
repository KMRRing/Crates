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

/** A gear's pitch radius from its teeth: every gear is cut to the train's module unless it has its own (a moon disc's
 * fine teeth, say), and only gears of one module can mesh. */
export const radius = (teeth, m = MODULE) => (teeth * m) / 2;

// The escapement, laid out as a straight-line Swiss lever: the escape wheel, the pallet fork's pivot and the balance
// staff in a line. The escape wheel is cut to its own, larger module, so its size is fixed whatever its teeth; the
// fork's pallet stones reach its teeth from FORK_REACH away, and its horns reach the balance's impulse pin from
// FORK_LENGTH beyond its pivot. The balance is the largest part of the movement.
export const ESCAPE_R = 1.5, FORK_REACH = 2.0, FORK_LENGTH = 2.8, BALANCE_R = 2.6;
const FIT = 0.15;                                                // how far off its place a fork or balance may sit
/** A part's footprint on the plan: its pitch circle, or for the escape wheel and balance their own sizes. */
export const partRadius = p => (p.kind === "escape" ? ESCAPE_R : p.kind === "balance" ? BALANCE_R : p.kind === "star" ? (p.internal ? 0 : p.r) : p.kind === "finger" ? 0 : p.teeth ? radius(p.teeth, p.m) : 0);
/** Turns of the barrel a fully wound mainspring gives: with the classic 8:1 to the centre wheel, forty hours. */
export const MAINSPRING_TURNS = 5;
/** Does a part of radius r at (x, y) lie within the plate? A plate is round (its radius) or rectangular ({ w, h }). */
export const onPlate = (plate, x, y, r) => (typeof plate === "number" ? Math.hypot(x, y) + r <= plate + MESH_TOL
  : Math.abs(x) + r <= plate.w / 2 + MESH_TOL && Math.abs(y) + r <= plate.h / 2 + MESH_TOL);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Two arbors on one centre (the hour wheel's tube round the centre arbor) are separate bodies that never touch. */
const concentric = (a, b) => a.on === b.id || b.on === a.id || (!!a.on && a.on === b.on);
/** Layers 6 to 8 lie under the dial, on the far side of the main plate from the train (layers 1 to 5, and the escape
 * wheel's 9): the motion works there never meet the train's wheels, and a stud there doesn't reach through. */
export const DIAL_LAYERS = [6, 7, 8];
const side = layer => (DIAL_LAYERS.includes(layer) ? "dial" : "train");
/** The sides of the plate an arbor reaches: those its parts sit on; an empty arbor, both, until it carries something. */
const sides = a => { const s = new Set((a.parts || []).map(p => side(p.layer))); return s.size ? s : new Set(["dial", "train"]); };
const has = (a, kind) => (a.parts || []).find(p => p.kind === kind);
/**
 * The escapement as it is built: for each escape wheel, a pallet fork whose stones reach its teeth, and a balance whose
 * impulse pin sits in the fork's horns, in line. Without a fork the escape wheel spins free and the spring runs away;
 * a fork with no balance locks the wheel after one tick; with both, the balance's beat sets the pace.
 * Returns [{ escape, fork, balance, state: "free" | "locked" | "running", vph, teeth }].
 */
export function escapements(arbors) {
  return arbors.filter(a => has(a, "escape")).map(e => {
    const fork = arbors.find(f => has(f, "fork") && Math.abs(dist(f, e) - FORK_REACH) <= FIT);
    const balance = fork && arbors.find(b => {
      if (!has(b, "balance") || Math.abs(dist(b, fork) - FORK_LENGTH) > FIT) return false;
      const ux = (fork.x - e.x) / dist(fork, e), uy = (fork.y - e.y) / dist(fork, e);   // in line, within 30 degrees
      return ((b.x - fork.x) * ux + (b.y - fork.y) * uy) / dist(b, fork) >= Math.cos(Math.PI / 6);
    });
    return { escape: e.id, fork: fork?.id || null, balance: balance?.id || null, state: !fork ? "free" : !balance ? "locked" : "running",
      vph: balance ? has(balance, "balance").vph : null, teeth: has(e, "escape").teeth };
  });
}

/**
 * Runs a design. design = { plate (radius, mm), arbors: [{ id, x, y, parts: [{ kind, teeth, layer }], drive?, power?,
 * regulator?: { vph, escape }, on? }] }. A drive is a fixed rate (a hand crank); power is the barrel's direction, the
 * escapement's regulator then setting how fast the whole train may run: vph / (2 × escape-wheel teeth) turns an hour.
 * Returns { meshes, clashes, rates: { arbor: rev/h | null }, jammed: [arbor], runaway: bool, idle: [arbor] }.
 */
export function run(design) {
  const arbors = design.arbors, byId = new Map(arbors.map(a => [a.id, a]));
  const toothed = arbors.flatMap(a => (a.parts || []).filter(p => partRadius(p)).map(p => ({ a, p, r: partRadius(p) })));
  const meshes = [], clashes = [];
  for (let i = 0; i < toothed.length; i++) for (let j = i + 1; j < toothed.length; j++) {
    const A = toothed[i], B = toothed[j];
    if (A.a === B.a || A.p.layer !== B.p.layer || concentric(A.a, B.a)) continue;
    const gap = dist(A.a, B.a) - (A.r + B.r), gears = A.p.teeth && B.p.teeth && !["escape", "star"].includes(A.p.kind) && !["escape", "star"].includes(B.p.kind);
    if (gears && (A.p.m || MODULE) === (B.p.m || MODULE) && Math.abs(gap) <= MESH_TOL) meshes.push({ a: A.a.id, b: B.a.id, ta: A.p.teeth, tb: B.p.teeth, layer: A.p.layer, ra: A.r, rb: B.r });
    else if (gap < 0) clashes.push({ kind: "overlap", arbors: [A.a.id, B.a.id], layer: A.p.layer });
  }
  // an arbor runs from plate to bridge, so no wheel, at any height on that side of the plate, may pass over its pivot
  for (const T of toothed) for (const X of arbors) {
    if (X === T.a || concentric(X, T.a) || !sides(X).has(side(T.p.layer))) continue;
    if (dist(X, T.a) < T.r + PIVOT_CLEAR - 1e-9) clashes.push({ kind: "pivot", arbors: [T.a.id, X.id], layer: T.p.layer });
  }
  for (const T of toothed) if (!onPlate(design.plate, T.a.x, T.a.y, T.r)) clashes.push({ kind: "outside", arbors: [T.a.id], layer: T.p.layer });

  // rates: each mesh turns the other arbor the other way, faster by the ratio of teeth
  const edges = new Map(arbors.map(a => [a.id, []]));
  for (const m of meshes) { edges.get(m.a).push([m.b, -m.ta / m.tb]); edges.get(m.b).push([m.a, -m.tb / m.ta]); }
  // a finger on one arbor pushes a star wheel, or a ring's inner teeth, on by one tooth each turn it makes: the star
  // turns once in as many turns of the finger as it has teeth, the other way (a ring, being pushed from inside, the same way)
  const fingers = [];
  for (const A of arbors) for (const f of (A.parts || []).filter(p => p.kind === "finger")) for (const B of arbors) for (const st of (B.parts || []).filter(p => p.kind === "star" && p.layer === f.layer)) {
    if (A === B || Math.abs(dist(A, B) - st.r) > f.len) continue;
    const k = (st.internal ? 1 : -1) / st.teeth;
    edges.get(A.id).push([B.id, k]); edges.get(B.id).push([A.id, 1 / k]);
    fingers.push({ a: A.id, b: B.id, teeth: st.teeth });
  }
  const rates = Object.fromEntries(arbors.map(a => [a.id, null]));
  const jammed = new Set(), escs = escapements(arbors);
  let runaway = false, locked = false, relative = null;
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
      relative = new Map(got);                                   // the train's ratios from one turn of the barrel
      const esc = escs.find(x => got.has(x.escape) && got.get(x.escape) !== 0);
      if (esc?.state === "running") {
        const scale = esc.vph / (2 * esc.teeth) / Math.abs(got.get(esc.escape));
        got = new Map([...got].map(([id, r]) => [id, r * scale]));
      } else if (esc?.state === "locked") { locked = true; got = new Map([...got].map(([id]) => [id, 0])); }
      else runaway = true;                                       // nothing holds it back: the spring lets go at once
    }
    for (const [id, r] of got) rates[id] = jam ? 0 : runaway && src.drive == null ? null : r;
    if (jam) for (const id of got.keys()) jammed.add(id);
  }
  const idle = arbors.filter(a => rates[a.id] == null && !runaway).map(a => a.id);
  return { meshes, fingers, edges, clashes, rates, jammed: [...jammed], runaway, locked, relative: relative && Object.fromEntries(relative), escapements: escs, idle, byId };
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
    if (g.escapement) { const e = out.escapements[0]; return { goal: g, ok: e?.state === g.escapement, actual: e?.state || "none" }; }
    if (g.reserve) { const h = reserveOf(design, out); return { goal: g, ok: h != null && h >= g.reserve - 1e-6 && (!g.most || h <= g.most + 1e-6), actual: h }; }
    if (g.sign) { const r = out.rates[g.arbor]; return { goal: g, ok: r != null && r !== 0 && Math.sign(r) === g.sign, actual: r }; }
    const actual = out.rates[g.arbor];
    const ok = actual != null && actual !== 0 && (g.abs ? near(Math.abs(actual), Math.abs(g.rate)) : near(actual, g.rate));
    return { goal: g, ok, actual };
  });
  const problems = [];
  const name = id => out.byId.get(id)?.label || "a wheel";
  for (const c of out.clashes) problems.push(c.kind === "overlap" ? `Two wheels overlap on layer ${c.layer}: ${name(c.arbors[0])} and ${name(c.arbors[1])}.`
    : c.kind === "pivot" ? `A wheel on ${name(c.arbors[0])} passes over the pivot of ${name(c.arbors[1])}.` : `A wheel on ${name(c.arbors[0])} sticks out of the plate.`);
  if (out.jammed.length) problems.push("The train is locked: somewhere wheels mesh in a loop that can't turn.");
  if (out.runaway) problems.push("Nothing holds the spring back: with no pallet fork on the escape wheel, it unwinds at once.");
  if (out.locked && !(level.goals || []).some(g => g.escapement === "locked")) problems.push("The pallet fork locks the escape wheel: with no balance to swing it, the watch stops after one tick.");
  return { ok: goals.every(g => g.ok) && !problems.length, out, goals, problems };
}

/** The power reserve: hours a fully wound mainspring lasts at the barrel's rate (needs a running escapement). */
export function reserveOf(design, out) {
  const b = design.arbors.find(a => a.power != null && (a.parts || []).some(p => p.kind === "barrel"));
  const r = b && out.rates[b.id];
  return r ? MAINSPRING_TURNS / Math.abs(r) : null;
}

/** How an arbor is driven: the path of meshes from the power (crank, barrel or escapement) to it, each step a ratio. */
export function workings(design, out, target) {
  const sources = design.arbors.filter(a => a.drive != null || a.power != null).map(a => a.id);
  const prev = new Map(sources.map(id => [id, null])), queue = [...sources];
  while (queue.length) { const id = queue.shift(); for (const [to] of out.edges.get(id) || []) if (!prev.has(to)) { prev.set(to, id); queue.push(to); } }
  if (!prev.has(target)) return null;
  const steps = [];
  for (let at = target; prev.get(at) != null; at = prev.get(at)) {
    const from = prev.get(at), m = out.meshes.find(x => (x.a === from && x.b === at) || (x.b === from && x.a === at)), f = out.fingers.find(x => x.a === from && x.b === at);
    steps.unshift(m ? { from, to: at, driver: m.a === from ? m.ta : m.tb, driven: m.a === from ? m.tb : m.ta } : { from, to: at, finger: f?.teeth });
  }
  return steps;
}

/** A level's starting design: its fixed arbors and anything placed in advance, copied so play never changes the level.
 * A part marked loose sits on a fixed arbor but may be taken off: the suspect in a repair. */
export function startDesign(level) {
  const copy = a => ({ ...a, parts: (a.parts || []).map(p => ({ ...p, fixed: a.fixed !== false && !a.placed && !p.loose })) });
  return { plate: level.plate, arbors: [...(level.fixed || []).map(a => ({ ...copy(a), fixed: true })), ...(level.placed || []).map(a => ({ ...copy(a), placed: true }))] };
}

/** A level's worked solution applied to its start: { remove: [arbor], add: [{ arbor | at: {x, y, id}, part }] }. */
export function solved(level) {
  const d = startDesign(level);
  for (const id of level.solution.remove || []) d.arbors = d.arbors.filter(a => a.id !== id);
  for (const t of level.solution.takeOff || []) { const a = d.arbors.find(x => x.id === t.arbor); a.parts = a.parts.filter(p => !(p.kind === t.kind && (p.teeth ?? p.vph) === (t.teeth ?? t.vph) && p.loose)); }
  for (const s of level.solution.add || []) {
    let a = s.arbor ? d.arbors.find(x => x.id === s.arbor) : d.arbors.find(x => x.id === s.at.id);
    if (!a) d.arbors.push(a = { id: s.at.id, x: s.at.x, y: s.at.y, parts: [], label: s.at.label });
    a.parts.push({ ...s.part });
  }
  return d;
}

/** The parts a design uses beyond the level's own: what par counts. */
export const partsUsed = design => design.arbors.reduce((n, a) => n + (a.parts || []).filter(p => !p.fixed).length, 0);

/** Where a pallet fork or a balance must sit: the fork towards the tap from the escape wheel, the balance in line beyond. */
export function snapEscapement(design, x, y, kind) {
  const escapes = design.arbors.filter(a => has(a, "escape"));
  if (!escapes.length) return null;
  if (kind === "fork") {
    const e = escapes.reduce((m, a) => (dist(a, { x, y }) < dist(m, { x, y }) ? a : m));
    const d = Math.hypot(x - e.x, y - e.y) || 1;
    return { x: e.x + ((x - e.x) / d) * FORK_REACH, y: e.y + ((y - e.y) / d) * FORK_REACH };
  }
  for (const e of escapes) {
    const f = design.arbors.find(a => has(a, "fork") && Math.abs(dist(a, e) - FORK_REACH) <= FIT);
    if (f) { const d = dist(f, e); return { x: f.x + ((f.x - e.x) / d) * FORK_LENGTH, y: f.y + ((f.y - e.y) / d) * FORK_LENGTH }; }
  }
  return null;
}

/** Where a new arbor should sit so its part meshes with a neighbour's: on the line from that neighbour to the tap. */
export function snap(design, x, y, teeth, layer, exclude, m = MODULE) {
  const r = radius(teeth, m);
  let best = null;
  for (const a of design.arbors) {
    if (a.id === exclude) continue;
    for (const p of a.parts || []) {
      if (p.layer !== layer || !p.teeth || ["escape", "star"].includes(p.kind) || (p.m || MODULE) !== m) continue;
      const d = r + radius(p.teeth, p.m), dx = x - a.x, dy = y - a.y, len = Math.hypot(dx, dy) || 1;
      const sx = a.x + (dx / len) * d, sy = a.y + (dy / len) * d, off = Math.hypot(sx - x, sy - y);
      if (off < Math.max(1.2, r) && (!best || off < best.off)) best = { x: sx, y: sy, off, to: a.id };
    }
  }
  return best;
}
