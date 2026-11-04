// Gears: the piece catalogue (4 November 2026; docs/pipes.md, docs/pipes-contract.md). Pure: no page, no engine.
// A square is CELL = 60 units. A wheel has a module m (tooth size: 4 fine, 5 standard, 6 coarse), n teeth, pitch radius r = m n / 2, and
// sits on a layer l (1 low, 2 mid, 3 high). Wheels on one arbor (a) are rigid. A piece's PORTS are wheels whose pitch circle touches the
// middle of an edge; the neighbour's port wheel touches the same point from the other side, so any two facing port wheels are tangent
// whatever their sizes. Two facing port wheels of one layer and one module mesh; one layer and two modules clash; two layers ignore each other.
// Every piece's geometry is computed here from its kind id (and checked by tests/pipes-gear.mjs, `problems`); the views ask `shapeOf`.
//   S5.1                 single: one wheel (n = 60/m, r = 30), a port on every side
//   D5.1:4+8   D5.1:4>6e duo, straight (W to E) or elbow (N wheel > E wheel): two meshed wheels, a flip, ratio a:b
//   T5.1:5-4-5 T5.1:4-5-4e trio: port, idler, port (straight or elbow): keeps the turn, ratio a:c
//   K[5.1>5.2]:8/8>4     stack: port wheel n1 (m.l) rigid with a pinion np (m.l) that meshes the out wheel n2 (m.l): changes layer or module
//   R[5.1,4.3]           riser: one arbor through the middle, a full wheel on each of two layers, ports on every side of both
// rot is the number of quarter turns clockwise. The end pieces (barrel, sink) are made by endShape, not named.
export const CELL = 60;
export const MODS = [4, 5, 6];
export const SIDE = "NESW";
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const back = d => (d + 2) % 4;
export const radius = (m, n) => m * n / 2;
export const tipR = (m, n) => radius(m, n) + 0.64 * m;       // tooth tip
export const rootR = (m, n) => radius(m, n) - 0.72 * m;      // tooth root
export const fullTeeth = m => 60 / m * 1;                    // the single: 15, 12, 10 teeth (r = 30)
export const barrelTeeth = m => Math.round(45 / m);           // the barrel's wheel: 11, 9, 8 teeth
export const SHAFT = 2.6;                                     // arbor radius
export const quarter = ([x, y], k) => { for (let i = 0; i < ((k % 4) + 4) % 4; i++) [x, y] = [CELL - y, x]; return [x, y]; };
export const sideTurn = (s, k) => (((s + k) % 4) + 4) % 4;

const W = (x, y, n, m, l, a = 0) => ({ x, y, n, m, l, a });

// ---------- kind ids ----------
const KIND_RE = [
  [/^S(\d)\.(\d)$/, m => ({ f: "S", m: +m[1], l: +m[2] })],
  [/^D(\d)\.(\d):(\d+)\+(\d+)$/, m => ({ f: "D", m: +m[1], l: +m[2], a: +m[3], b: +m[4], elbow: false })],
  [/^D(\d)\.(\d):(\d+)>(\d+)e$/, m => ({ f: "D", m: +m[1], l: +m[2], a: +m[3], b: +m[4], elbow: true })],
  [/^T(\d)\.(\d):(\d+)-(\d+)-(\d+)$/, m => ({ f: "T", m: +m[1], l: +m[2], a: +m[3], b: +m[4], c: +m[5], elbow: false })],
  [/^T(\d)\.(\d):(\d+)-(\d+)-(\d+)e$/, m => ({ f: "T", m: +m[1], l: +m[2], a: +m[3], b: +m[4], c: +m[5], elbow: true })],
  [/^K\[(\d)\.(\d)>(\d)\.(\d)\]:(\d+)\/(\d+)>(\d+)$/, m => ({ f: "K", m1: +m[1], l1: +m[2], m2: +m[3], l2: +m[4], n1: +m[5], np: +m[6], n2: +m[7] })],
  [/^R\[(\d)\.(\d),(\d)\.(\d)\]$/, m => ({ f: "R", m1: +m[1], l1: +m[2], m2: +m[3], l2: +m[4] })],
];
export function parseKind(kind) {
  for (const [re, f] of KIND_RE) { const m = re.exec(kind); if (m) return f(m); }
  return null;
}
export const kindId = {
  S: (m, l) => `S${m}.${l}`,
  D: (m, l, a, b, elbow) => (elbow ? `D${m}.${l}:${a}>${b}e` : `D${m}.${l}:${a}+${b}`),
  T: (m, l, a, b, c, elbow) => `T${m}.${l}:${a}-${b}-${c}${elbow ? "e" : ""}`,
  K: (m1, l1, m2, l2, n1, np, n2) => `K[${m1}.${l1}>${m2}.${l2}]:${n1}/${np}>${n2}`,
  R: (m1, l1, m2, l2) => `R[${m1}.${l1},${m2}.${l2}]`,
};

// ---------- geometry of each family, at rotation 0 ----------
function base(p) {
  const r = (m, n) => radius(m, n);
  if (p.f === "S") {
    const n = fullTeeth(p.m);
    return { wheels: [W(30, 30, n, p.m, p.l)], ports: [0, 1, 2, 3].map(s => ({ s, w: 0 })), mesh: [] };
  }
  if (p.f === "D" && !p.elbow) {
    return { wheels: [W(r(p.m, p.a), 30, p.a, p.m, p.l, 0), W(CELL - r(p.m, p.b), 30, p.b, p.m, p.l, 1)], ports: [{ s: 3, w: 0 }, { s: 1, w: 1 }], mesh: [[0, 1]] };
  }
  if (p.f === "D") {
    const ra = r(p.m, p.a), rb = r(p.m, p.b), bx = CELL - rb, dx = bx - 30, d2 = (ra + rb) ** 2 - dx * dx;
    if (d2 < 0) return null;
    return { wheels: [W(30, ra, p.a, p.m, p.l, 0), W(bx, ra + Math.sqrt(d2), p.b, p.m, p.l, 1)], ports: [{ s: 0, w: 0 }, { s: 1, w: 1 }], mesh: [[0, 1]] };
  }
  if (p.f === "T" && !p.elbow) {
    const ra = r(p.m, p.a), rb = r(p.m, p.b), rc = r(p.m, p.c), ax = ra, cx = CELL - rc, D = cx - ax, d1 = ra + rb, d2 = rc + rb;
    if (d1 + d2 < D || Math.abs(d1 - d2) > D) return null;
    const x = (D * D + d1 * d1 - d2 * d2) / (2 * D), h = Math.sqrt(Math.max(0, d1 * d1 - x * x));
    return { wheels: [W(ax, 30, p.a, p.m, p.l, 0), W(ax + x, 30 - h, p.b, p.m, p.l, 1), W(cx, 30, p.c, p.m, p.l, 2)], ports: [{ s: 3, w: 0 }, { s: 1, w: 2 }], mesh: [[0, 1], [1, 2]] };
  }
  if (p.f === "T") {
    const ra = r(p.m, p.a), rb = r(p.m, p.b), rc = r(p.m, p.c), ax = 30, ay = ra, cx = CELL - rc, cy = 30;
    const D = Math.hypot(cx - ax, cy - ay), d1 = ra + rb, d2 = rc + rb, along = (d1 * d1 - d2 * d2 + D * D) / (2 * D), h2 = d1 * d1 - along * along;
    if (h2 < 0) return null;
    // the idler touches both end wheels: the two circles meet at two points; take the one away from the corner the ports turn round
    const h = Math.sqrt(h2), ex = (cx - ax) / D, ey = (cy - ay) / D;
    const cand = [1, -1].map(sg => [ax + ex * along - ey * h * sg, ay + ey * along + ex * h * sg]);
    const [bx, by] = cand.sort((u, v) => Math.hypot(v[0] - CELL, v[1]) - Math.hypot(u[0] - CELL, u[1]))[0];
    return { wheels: [W(ax, ay, p.a, p.m, p.l, 0), W(bx, by, p.b, p.m, p.l, 1), W(cx, cy, p.c, p.m, p.l, 2)], ports: [{ s: 0, w: 0 }, { s: 1, w: 2 }], mesh: [[0, 1], [1, 2]] };
  }
  if (p.f === "K") {
    const r1 = r(p.m1, p.n1), rp = r(p.m2, p.np), r2 = r(p.m2, p.n2);
    return { wheels: [W(r1, 30, p.n1, p.m1, p.l1, 0), W(r1, 30, p.np, p.m2, p.l2, 0), W(CELL - r2, 30, p.n2, p.m2, p.l2, 1)], ports: [{ s: 3, w: 0 }, { s: 1, w: 2 }], mesh: [[1, 2]], gap: CELL - r2 - r1 - rp - r2 };
  }
  if (p.f === "R") {
    return { wheels: [W(30, 30, fullTeeth(p.m1), p.m1, p.l1, 0), W(30, 30, fullTeeth(p.m2), p.m2, p.l2, 0)], ports: [0, 1, 2, 3].flatMap(s => [{ s, w: 0 }, { s, w: 1 }]), mesh: [] };
  }
  return null;
}

const cache = new Map();
/** The shape of a kind turned `rot` quarter turns: { kind, rot, fam, wheels [{x, y, n, m, l, a}], ports [{s, w}], mesh [[u, v]],
 *  comp (the component each wheel is in: wheels joined by a mesh or an arbor), sides, layers: [lowest, highest] }, or null for a bad id. */
export function shapeOf(kind, rot = 0) {
  rot = ((rot % 4) + 4) % 4;
  const key = `${kind}@${rot}`;
  if (cache.has(key)) return cache.get(key);
  let sh = null;
  const p = parseKind(kind), b = p && base(p);
  if (b) sh = finish(kind, rot, p.f, b.wheels, b.ports, b.mesh, [], b.gap);
  cache.set(key, sh);
  return sh;
}
function finish(kind, rot, fam, wheels0, ports0, mesh, ring, gap) {
  const wheels = wheels0.map(w => { const [x, y] = quarter([w.x, w.y], rot); return { ...w, x, y }; });
  const ports = ports0.map(q => ({ s: sideTurn(q.s, rot), w: q.w }));
  // components: wheels joined by a mesh, a ring mesh or a shared arbor
  const comp = wheels.map((_, i) => i);
  const find = i => (comp[i] === i ? i : (comp[i] = find(comp[i])));
  const join = (i, j) => { comp[find(i)] = find(j); };
  for (const [u, v] of mesh) join(u, v);
  for (const [u, v] of ring) join(u, v);
  wheels.forEach((w, i) => { const first = wheels.findIndex(o => o.a === w.a); if (first !== i) join(first, i); });
  const roots = [...new Set(wheels.map((_, i) => find(i)))];
  return { kind, rot, fam, wheels, ports, mesh, ring, gap, comp: wheels.map((_, i) => roots.indexOf(find(i))), sides: [...new Set(ports.map(q => q.s))].sort(),
    layers: [Math.min(...wheels.map(w => w.l)), Math.max(...wheels.map(w => w.l))] };
}

/**
 * An end piece: the barrel (the mainspring's wheel) or a sink: one wheel of n teeth reaching side `side`, or with ring: a small
 * pinion at the port inside a ring wheel (internal teeth, n = 60/m, on the layer above or below) that it turns the same way.
 */
export function endShape({ side, n, m, l, ring = false, pinion = 4 }) {
  const key = `E${side}.${n}.${m}.${l}.${ring ? pinion : 0}`;
  if (cache.has(key)) return cache.get(key);
  let wheels, mesh = [], rings = [];
  if (ring) {
    wheels = [W(CELL - radius(m, pinion), 30, pinion, m, l, 0), W(30, 30, fullTeeth(m), m, l === 3 ? 2 : l + 1, 1)];
    rings = [[0, 1]];
  } else wheels = [W(CELL - radius(m, n), 30, n, m, l, 0)];
  const sh = finish("E", (side + 3) % 4, ring ? "G" : "E", wheels, [{ s: 1, w: 0 }], mesh, rings);
  sh.kind = key;
  cache.set(key, sh);
  return sh;
}

/** What a shape does on the plate, in no order: which wheel (teeth, module, layer) reaches which side, and the speed each port wheel has
 *  over the others'. Two rotations that do the same are one piece (where a trio's idler sits, or which of two like ends is which, is
 *  only a picture). */
const look = sh => {
  const key = i => `${sh.wheels[i].n}.${sh.wheels[i].m}.${sh.wheels[i].l}`;
  const rate = (u, v) => {
    const sp = Array(sh.wheels.length).fill(null);
    sp[u] = [1, 1];
    for (let k = 0; k < sh.wheels.length * 2; k++) {
      for (const [a, b] of sh.mesh) {
        if (sp[a] && !sp[b]) sp[b] = [-sp[a][0] * sh.wheels[a].n, sp[a][1] * sh.wheels[b].n];
        if (sp[b] && !sp[a]) sp[a] = [-sp[b][0] * sh.wheels[b].n, sp[b][1] * sh.wheels[a].n];
      }
      sh.wheels.forEach((w, i) => sh.wheels.forEach((o, j) => { if (i !== j && w.a === o.a && sp[i] && !sp[j]) sp[j] = sp[i]; }));
    }
    const f = sp[v];
    if (!f) return "-";
    const g = (x, y) => (y ? g(y, x % y) : Math.abs(x));
    const d = g(f[0], f[1]);
    return `${f[0] / d}/${f[1] / d}`;
  };
  const ports = sh.ports.map(q => `${q.s}:${key(q.w)}`).sort();
  const rel = [];
  for (const p of sh.ports) for (const q of sh.ports) if (p !== q) rel.push(`${p.s}:${key(p.w)}>${q.s}:${key(q.w)}=${rate(p.w, q.w)}`);
  return JSON.stringify([ports, rel.sort()]);
};
/** The distinct orientations of a kind: the rotations that give a different arrangement (a single has 1, a straight 6+6 duo 2). */
export function orientations(kind) {
  const seen = new Set(), out = [];
  for (let r = 0; r < 4; r++) {
    const sh = shapeOf(kind, r);
    if (!sh) return out;
    const sig = look(sh);
    if (!seen.has(sig)) { seen.add(sig); out.push(r); }
  }
  return out;
}
/** The orientation of `kind` at `rot` that stands for it (the lowest rotation with the same arrangement), so equal pieces compare equal. */
export function canonRot(kind, rot) {
  const want = look(shapeOf(kind, rot));
  for (let r = 0; r < 4; r++) if (look(shapeOf(kind, r)) === want) return r;
  return rot;
}

/** The piece that is the mirror image (left to right) of kind turned rot, as [kind, rot]: the same geometry reflected, found among the
 *  kinds that differ only in the order of their wheels. */
export function mirrorPiece(kind, rot) {
  const p = parseKind(kind), sh = shapeOf(kind, rot);
  const sig = s => JSON.stringify([s.wheels.map(w => [Math.round(w.x), Math.round(w.y), w.n, w.m, w.l]).sort(), s.ports.map(q => [q.s, s.wheels[q.w].n, s.wheels[q.w].l]).sort()]);
  const want = sig({ wheels: sh.wheels.map(w => ({ ...w, x: CELL - w.x })), ports: sh.ports.map(q => ({ s: q.s % 2 ? 4 - q.s : q.s, w: q.w })) });
  const flipped = p.f === "D" ? [kindId.D(p.m, p.l, p.b, p.a, p.elbow)] : p.f === "T" ? [kindId.T(p.m, p.l, p.c, p.b, p.a, p.elbow)] : [];
  for (const k of [kind, ...flipped]) for (let r = 0; r < 4; r++) {
    const c = shapeOf(k, r);
    if (c && sig(c) === want) return [k, r];
  }
  throw new Error(`no mirror image of ${kind}@${rot}`);
}

// ---------- the piece tests (tests/pipes-gear.mjs runs these on every catalogue entry and rotation) ----------
/** What is wrong with a shape, as strings (empty: it is a legal piece). */
export function problems(sh) {
  const out = [], P = (...a) => out.push(a.join(" "));
  const edgeDist = (w, s) => [w.y, CELL - w.x, CELL - w.y, w.x][s];
  sh.wheels.forEach((w, i) => {
    const r = radius(w.m, w.n);
    for (let s = 0; s < 4; s++) {
      const isPort = sh.ports.some(q => q.s === s && q.w === i), d = edgeDist(w, s);
      if (isPort) {
        if (Math.abs(d - r) > 0.5) P(`wheel ${i} side ${s}: port not tangent to the edge`);
        if (Math.abs((s % 2 ? w.y : w.x) - 30) > 3.1) P(`wheel ${i} side ${s}: port off the middle of the edge by more than 3`);
      } else if (d < tipR(w.m, w.n) - 0.01) P(`wheel ${i} side ${s}: teeth cross an edge without a port`);
    }
  });
  for (const [u, v] of sh.mesh) {
    const a = sh.wheels[u], b = sh.wheels[v], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (Math.abs(d - radius(a.m, a.n) - radius(b.m, b.n)) > 0.4) P(`wheels ${u} and ${v} do not mesh`);
    if (a.l !== b.l) P(`wheels ${u} and ${v} mesh across layers`);
    if (a.m !== b.m) P(`wheels ${u} and ${v} mesh across modules`);
  }
  for (let i = 0; i < sh.wheels.length; i++) for (let j = i + 1; j < sh.wheels.length; j++) {
    const a = sh.wheels[i], b = sh.wheels[j];
    if (a.a === b.a) { if (a.l === b.l) P(`wheels ${i} and ${j} share an arbor and a layer`); continue; }
    const meshed = sh.mesh.some(([u, v]) => (u === i && v === j) || (u === j && v === i)) || sh.ring?.some(([u, v]) => (u === i && v === j) || (u === j && v === i));
    if (a.l !== b.l || meshed) continue;
    if (Math.hypot(a.x - b.x, a.y - b.y) < tipR(a.m, a.n) + tipR(b.m, b.n) - 0.01) P(`wheels ${i} and ${j} touch`);
  }
  // arbor clearance: no wheel on a layer at or below an arbor's top wheel covers its axis
  const arbors = [...new Set(sh.wheels.map(w => w.a))];
  for (const a of arbors) {
    const own = sh.wheels.filter(w => w.a === a), top = Math.max(...own.map(w => w.l)), ax = own[0].x, ay = own[0].y;
    sh.wheels.forEach((w, i) => {
      if (w.a !== a && w.l <= top && Math.hypot(w.x - ax, w.y - ay) < radius(w.m, w.n) + SHAFT) P(`wheel ${i} covers the arbor ${a}`);
    });
  }
  if (sh.gap !== undefined && Math.abs(sh.gap) > 0.4) P(`stack does not close: ${sh.gap}`);
  return out;
}

// ---------- the catalogue ----------
const sortUniq = a => [...new Set(a)];
/** Every legal kind, by family. Built once from the constraints (`problems` on rotation 0). */
function build() {
  const all = { S: [], D: [], T: [], K: [], R: [] };
  const ok = id => { const p = parseKind(id), b = base(p); if (!b) return false; return !problems(finish(id, 0, p.f, b.wheels, b.ports, b.mesh, [], b.gap)).length; };
  // a piece's geometry does not depend on its layer, so the layer-1 pieces are checked and the other layers copied
  for (const m of MODS) {
    const maxn = Math.floor(60 / m), found = { S: [], D: [], T: [] };
    if (ok(kindId.S(m, 1))) found.S.push(kindId.S(m, 1));
    for (let a = 4; a <= maxn; a++) { const b = 60 / m - a; if (b >= 4 && b <= maxn && ok(kindId.D(m, 1, a, b, false))) found.D.push(kindId.D(m, 1, a, b, false)); }
    for (let a = 4; a <= maxn; a++) for (let b = 4; b <= maxn; b++) if (ok(kindId.D(m, 1, a, b, true))) found.D.push(kindId.D(m, 1, a, b, true));
    for (let a = 4; a <= maxn; a++) for (let c = 4; c <= maxn; c++) for (let b = 4; b <= maxn; b++) for (const e of [false, true]) if (ok(kindId.T(m, 1, a, b, c, e))) found.T.push(kindId.T(m, 1, a, b, c, e));
    for (const f of Object.keys(found)) for (let l = 1; l <= 3; l++) for (const id of found[f]) all[f].push(id.replace(/^(\w)(\d)\.1/, `$1$2.${l}`));
  }
  for (const m1 of MODS) for (const m2 of MODS) for (let l1 = 1; l1 <= 3; l1++) for (let l2 = 1; l2 <= 3; l2++) {
    if (l1 === l2) continue;
    for (let n1 = 4; n1 <= 60 / m1; n1++) for (let np = 4; np <= n1; np++) for (let n2 = 4; n2 <= 60 / m2; n2++) {
      if (m1 * n1 + m2 * np + 2 * m2 * n2 === 120 && m2 * np <= m1 * n1 && ok(kindId.K(m1, l1, m2, l2, n1, np, n2))) all.K.push(kindId.K(m1, l1, m2, l2, n1, np, n2));
    }
  }
  for (const m1 of MODS) for (const m2 of MODS) for (let l1 = 1; l1 <= 3; l1++) for (let l2 = l1 + 1; l2 <= 3; l2++) all.R.push(kindId.R(m1, l1, m2, l2));
  for (const f of Object.keys(all)) all[f] = sortUniq(all[f]);
  return all;
}
let catalog = null;
export const CATALOG = () => (catalog ??= build());

const FAMILY_NAME = { S: "single", D: "duo", T: "trio", K: "stack", R: "riser" };
const SIDE_WORD = ["north", "east", "south", "west"];
/** What a kind is called (for labels and the tiles' aria): "duo 4+8, module 5, layer 1". */
export function kindName(kind) {
  const p = parseKind(kind);
  if (!p) return kind;
  if (p.f === "K") return `stack ${p.n1}/${p.np} to ${p.n2}, module ${p.m1} layer ${p.l1} to module ${p.m2} layer ${p.l2}`;
  if (p.f === "R") return `riser, module ${p.m1} layer ${p.l1} and module ${p.m2} layer ${p.l2}`;
  const sizes = p.f === "S" ? "" : p.f === "D" ? ` ${p.a}${p.elbow ? "-" : "+"}${p.b}` : ` ${p.a}-${p.b}-${p.c}`;
  return `${FAMILY_NAME[p.f]}${sizes}, module ${p.m}, layer ${p.l}`;
}
export const familyOf = kind => parseKind(kind)?.f;
export const sidesWord = sh => sh.sides.map(s => SIDE_WORD[s]).join(" and ");
/** The layer ceiling a piece needs: its highest wheel. */
export const topLayer = kind => shapeOf(kind, 0)?.layers[1] ?? 1;
/** The wheel module/layer of the port on side s (rot applied) of a shape, for the channel check: { w, m, l } for each port on that side. */
export const portsOn = (sh, s) => sh.ports.filter(q => q.s === s).map(q => ({ w: q.w, m: sh.wheels[q.w].m, l: sh.wheels[q.w].l }));
