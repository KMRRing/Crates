// Gears' escapement, tourbillon and chime (pipes-3d-parts.js builds the rest). Each builder returns { update(ctx), busy() } and adds its meshes to `group` at the
// sink wheel's place, turned so that local +x points out of the plate (away from the board). They are driven by the named engine wheel: the escape wheel turns
// with the sink's (stepped) angle, and the fork and balance follow the same beat counter `b = barrel turns / beat`, one beat being half a swing of the balance
// and one step of the escape wheel (design section 5, rule 6). An unsolved train rests: the balance stands at its centre and the fork on a banking.
import { METALS } from "./pipes-3d-model.js";

const TAU = Math.PI * 2;
/** The metal of the train a sink ends: its wheels' colour by module (rose, gilt, blued), so the instrument reads as part of the train that drives it. */
const metalOf = r => (METALS[r.m] || METALS[5]).color;

/** The escape wheel's club teeth: n teeth, a long ramp and a short drop, between radii r0 and r1, clockwise on the screen. */
function escapeOutline(n, r0, r1) {
  const pts = [], s = TAU / n;
  for (let k = 0; k < n; k++) {
    const a = k * s;
    pts.push([Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a + s * 0.58) * r1 * 0.96, Math.sin(a + s * 0.58) * r1 * 0.96], [Math.cos(a + s * 0.68) * r1, Math.sin(a + s * 0.68) * r1], [Math.cos(a + s * 0.74) * r0, Math.sin(a + s * 0.74) * r0]);
  }
  return pts;
}
const smooth = u => u * u * (3 - 2 * u);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** The escapement's parts in a group at the origin facing +x: escape wheel at 0, fork pivot at 0.58, balance at 1.15. Returns { group, pose(b, awake, wheelAngleRad) }. */
function escapementSet(c, scale = 1, metal = 0xd9a949) {
  const { THREE, G, M, mk } = c, g = new THREE.Group();
  const tint = G.tint, slab = G.slab, S = G.shapeOf, C = G.circle;
  const RE = 0.3, PX = 0.58, BX = 1.15, RB = 0.4;
  // escape wheel: 15 club teeth, five windows, a pinion; rotates with the sink
  const wheelG = new THREE.Group(); g.add(wheelG);
  const holes = [C(0.025, 8), ...Array.from({ length: 5 }, (_, i) => { const a0 = i * TAU / 5 + 0.2, a1 = a0 + TAU / 5 - 0.5, w = []; for (let s = 0; s <= 4; s++) { const a = a0 + (a1 - a0) * s / 4; w.push([Math.cos(a) * RE * 0.68, Math.sin(a) * RE * 0.68]); } for (let s = 4; s >= 0; s--) { const a = a0 + (a1 - a0) * s / 4; w.push([Math.cos(a) * RE * 0.36, Math.sin(a) * RE * 0.36]); } return w; })];
  const ew = slab(S(escapeOutline(15, RE * 0.82, RE), holes), 0.03, 0.005, 1); G.polish(ew, 3); tint(ew, metal);
  mk(ew, M.parts, wheelG);
  // pallet fork: two arms to ruby pallets either side of the wheel, a tail with a horn towards the balance, a pivot
  const fork = new THREE.Group(); fork.position.x = PX; g.add(fork);
  const arm = sgn => [[0.02, sgn * 0.012], [-0.37 + 0.02, sgn * 0.215], [-0.37 - 0.03, sgn * 0.23], [-0.37 - 0.035, sgn * 0.205], [-0.05, sgn * 0.0]];
  const pallet = sgn => S([[-0.34, sgn * 0.205], [-0.41, sgn * 0.22], [-0.41, sgn * 0.26], [-0.34, sgn * 0.25]]);
  const body = G.merge([slab(S(arm(1)), 0.026, 0.004, 1), slab(S(arm(-1)), 0.026, 0.004, 1), slab(S([[-0.02, -0.02], [0.3, -0.012], [0.32, -0.03], [0.36, -0.03], [0.36, 0.03], [0.32, 0.03], [0.3, 0.012], [-0.02, 0.02]]), 0.026, 0.004, 1), slab(S(C(0.04, 14), [C(0.015, 8)]), 0.04, 0.005, 1)]);
  G.polish(body, 2); tint(body, metal);
  mk(body, M.parts, fork);
  const stones = G.merge([slab(pallet(1), 0.03, 0.004, 1), slab(pallet(-1), 0.03, 0.004, 1)]); tint(stones, 0xd02a3a); G.polish(stones, 2);
  mk(stones, M.parts, fork, { cast: false });
  // balance: a rim with three arms, four gold timing screws, a roller with the impulse pin; its hairspring
  const bal = new THREE.Group(); bal.position.x = BX; g.add(bal);
  const rim = slab(S(C(RB, 40), [C(RB - 0.035, 40)]), 0.034, 0.006, 1);
  const arms = [0, 1, 2].map(i => { const a = i * TAU / 3 + 0.5, cx = Math.cos(a), cz = Math.sin(a), w = 0.022; return slab(S([[-cz * w, cx * w], [cx * (RB - 0.03) - cz * w * 0.6, cz * (RB - 0.03) + cx * w * 0.6], [cx * (RB - 0.03) + cz * w * 0.6, cz * (RB - 0.03) - cx * w * 0.6], [cz * w, -cx * w]]), 0.026, 0.004, 1); });
  const roller = slab(S(C(0.085, 20), [C(0.02, 8)]), 0.05, 0.006, 1);
  const balAll = G.merge([rim, ...arms, roller]); G.polish(balAll, 2); tint(balAll, metal);
  const screws = G.merge([0.5, 1.5, 2.5, 3.5].map(q => { const a = q * Math.PI / 2 + 0.3, s = slab(S(C(0.03, 12)), 0.048, 0.008, 1); s.translate(Math.cos(a) * (RB - 0.02), 0, Math.sin(a) * (RB - 0.02)); return s; })); tint(screws, 0xf0c860); G.polish(screws, 2);
  const pin = slab(S(C(0.014, 8)), 0.06, 0.003, 1); pin.translate(-0.07, 0, 0); tint(pin, 0xd02a3a);
  mk(G.merge([balAll, screws, pin]), M.parts, bal);
  const spring = G.tint(G.spiralGeometry(0.045, 0.285, 7, 0.0075, 0.012, 14), 0x2b4f9c); G.polish(spring, 2);
  const hs = new THREE.Group(); hs.position.set(BX, 0.04, 0); g.add(hs);
  mk(spring, M.parts, hs, { cast: false });
  // the balance cock: a Geneva bridge over the staff, with its ruby and two blued screws; the index and stud
  const cock = mk(G.bridgeGeometry(0.62, 0.2, 0.05, 0.07, 0.1, 0.01), [M.bridge, M.bridgeEdge], g); cock.position.set(BX + 0.34, 0.1, 0.0);
  const cj = mk(G.chatonGeometry(0.1, 0.065), M.gold, g, { cast: false }); cj.position.set(BX, 0.15, 0);
  const cr = mk(G.cabochonGeometry(0.07, 0.05, 0.018), M.rubyLit, g, { cast: false }); cr.position.set(BX, 0.162, 0);
  for (const dx of [0.52, 0.12]) { const sc = mk(G.screwGeometry(0.04), M.steel, g, { cast: false }); sc.position.set(BX + dx + 0.3 - 0.3, 0.152, 0); }
  const sx = mk(G.staffGeometry(0.014), M.steel, g, { cast: false }); sx.position.set(BX, -0.04, 0); sx.scale.y = 0.2;
  g.scale.setScalar(scale);
  return {
    group: g,
    pose(b, awake, wheelRad) {
      const A = awake ? 4.4 * Math.sin(Math.PI * b) : 0, k = Math.floor(b), u = smooth(clamp((b - k) / 0.3, 0, 1)), side = (k % 2 ? -1 : 1);
      const psi = awake ? 0.1 * side * (2 * u - 1) : 0.1;
      bal.rotation.y = -A; hs.rotation.y = -A * 0.4; hs.scale.set(1 + 0.16 * A / 4.4, 1, 1 + 0.16 * A / 4.4);
      fork.rotation.y = -psi;
      wheelG.rotation.y = -wheelRad;
      return k;
    },
  };
}

/** The wheel that drives a sink, drawn on the side the power comes in by (opposite the way the instrument reaches out): larger than the sink's own, of the train's
 *  metal, meshed with it and turning the other way, so a player can see which side to bring the train to. It lies at the plate (under the layer-1 wheels): a wheel
 *  laid on that side hides it, and it is only a picture (the engine's sink has one port, on this side). */
function driverGear(c, group, r, out) {
  const { THREE, G, P, mk, gearMat } = c, ns = r.n, m = r.m;
  const nd = Math.max(ns + 4, Math.min(Math.round(ns * 2), Math.floor(120 / m)));
  const geo = G.wheelGeometry({ n: nd, m, pinion: false }), a = Math.atan2(out[1], out[0]), cAng = a + Math.PI;     // the contact direction, from the sink to this wheel
  const g = new THREE.Group(); g.position.set(r.wx, 0, r.wz); g.rotation.y = -a; g.userData.dock = true; group.add(g);     // `dock`: a compact instrument's scaling leaves it alone
  const turn = new THREE.Group(); turn.position.x = -(P.pitchR(ns, m) + P.pitchR(nd, m)); g.add(turn);
  const body = mk(geo, gearMat[m] || gearMat[5], turn, { cast: false }); body.position.y = 0.005;
  return {
    update(cx) {
      const s = cx.angle(r.id) * P.DEG, d = cAng + Math.PI + Math.PI / nd - (ns / nd) * (s - cAng);          // a tooth of the sink at the contact meets a gap here
      turn.rotation.y = -d + a;
      g.position.y = cx.layerY(r.layer) - P.LAYER_Y[r.layer];
    },
  };
}

/** Escapement on a sink: the escape wheel stands on the sink's arbor, the fork and balance beyond it, out into the margin. */
export function buildEscapement(c, group, r, out, k) {
  const { THREE, P } = c, g = new THREE.Group();
  g.position.set(r.wx, 0, r.wz); g.rotation.y = -Math.atan2(out[1], out[0]);
  group.add(g);
  const metal = metalOf(r), set = escapementSet(c, 1, metal), drive = driverGear(c, group, r, out);
  g.add(set.group);
  const base = P.LAYER_Y[r.layer] + P.THICK + 0.03;
  set.group.position.y = base;
  let lastK = -1;
  return {
    busy: () => true,
    update(cx) {
      const awake = cx.awake(k), beat = cx.beat(k), b = awake && beat ? cx.g / beat : 0;
      const kk = set.pose(b, awake, cx.angle(r.id) * P.DEG);
      g.position.y = cx.layerY(r.layer) - P.LAYER_Y[r.layer];
      drive.update(cx);
      if (awake && kk !== lastK) { c.onEvent?.({ type: "tick", train: k, tock: kk % 2 === 1 }); }
      lastK = awake ? kk : -1;
    },
  };
}

/** Tourbillon on a sink: a cage of three posts between a polished upper ring and a Geneva lower one turns at the sink's speed, and in it an escapement beats. */
export function buildTourbillon(c, group, r, out, k) {
  const { THREE, G, M, P, mk } = c, g = new THREE.Group(), cage = new THREE.Group();
  g.position.set(r.wx, 0, r.wz);
  group.add(g); g.add(cage);
  const y0 = P.LAYER_Y[r.layer] + P.THICK + 0.04, R = 0.56, metal = metalOf(r), drive = driverGear(c, group, r, out);
  const low = G.tint(G.slab(G.shapeOf(G.circle(R, 56), [G.circle(R - 0.07, 56)]), 0.03, 0.007, 1), metal), up = G.tint(G.slab(G.shapeOf(G.circle(R, 56), [G.circle(R - 0.07, 56)]), 0.03, 0.007, 1), metal);
  G.polish(low, 2); G.polish(up, 2); up.translate(0, 0.3, 0);
  const posts = G.merge([0, 1, 2].map(i => { const a = i * TAU / 3 + 0.4, p = new THREE.CylinderGeometry(0.034, 0.034, 0.3, 10); p.translate(Math.cos(a) * (R - 0.035), 0.15, Math.sin(a) * (R - 0.035)); G.tint(p, metal); return p.toNonIndexed(); }));
  const arm = G.tint(G.slab(G.shapeOf([[-R, -0.03], [R, -0.03], [R, 0.03], [-R, 0.03]]), 0.026, 0.004, 1), metal); G.polish(arm, 2); arm.translate(0, 0.002, 0);
  mk(G.merge([low, up, posts, arm]), M.parts, cage).position.y = y0;
  const inner = escapementSet(c, 0.42, metal);
  inner.group.position.set(-0.18, y0 + 0.05, 0);
  cage.add(inner.group);
  const stone = mk(G.cabochonGeometry(0.1, 0.075, 0.024), M.rubyLit, g, { cast: false }); stone.position.y = y0 + 0.33;
  const chat = mk(G.chatonGeometry(0.15, 0.1), M.gold, g, { cast: false }); chat.position.y = y0 + 0.32;
  const stud = mk(G.staffGeometry(0.02), M.steel, g, { cast: false }); stud.scale.y = y0 + 0.32;
  return {
    busy: () => true,
    update(cx) {
      const awake = cx.awake(k), a = cx.angle(r.id) * P.DEG;
      cage.rotation.y = -a;
      inner.pose(awake ? cx.tMs / 190 : 0, awake, a * 17);
      drive.update(cx);
      g.position.y = cx.layerY(r.layer) - P.LAYER_Y[r.layer];
    },
  };
}

/** A chime: a pinned disc turning with the sink, steel, studded with gold pins in rows, and a comb of graded tines lying over it that each ring (swing) when a pin
 *  passes their tip. A pin passing is an event (`chime`, note = the tine). */
export function buildChime(c, group, r, out, goal, k) {
  const { THREE, G, M, P, mk } = c, g = new THREE.Group(), turn = new THREE.Group();
  g.position.set(r.wx, 0, r.wz); g.rotation.y = -Math.atan2(out[1], out[0]);
  group.add(g); g.add(turn);
  const y0 = P.LAYER_Y[r.layer] + P.THICK + 0.04, RD = 0.56, NT = 7, step = 0.062, metal = metalOf(r), drive = driverGear(c, group, r, out);
  const tipX = i => 0.12 + 0.065 * i + 0.08, tz = i => (i - (NT - 1) / 2) * step;     // tine i's tip over the disc (graded: longer tines are lower notes)
  const disc = G.tint(G.slab(G.shapeOf(G.circle(RD, 64), [G.circle(0.04, 10)]), 0.04, 0.008, 2), metal); G.polish(disc, 2);
  const tune = Array.isArray(goal?.tune) ? goal.tune : [0, 2, 4, 2, 5, 4, 2, 0, 3, 1, 4, 6, 4, 2, 1, 3];
  const pins = [];
  const alpha = i => Math.atan2(tz(i), tipX(i)), rad = i => Math.hypot(tipX(i), tz(i));
  tune.forEach((n, s) => {
    const i = clamp(n | 0, 0, NT - 1), a = alpha(i) - s * TAU / tune.length, p = G.slab(G.shapeOf(G.circle(0.016, 8)), 0.07, 0.004, 1);
    p.translate(Math.cos(a) * rad(i), 0.04, Math.sin(a) * rad(i)); G.tint(p, 0xf0c860); pins.push(p); tune[s] = i; pins[s].userData = { a, i };
  });
  const pinned = G.merge([disc, ...pins]);
  G.polish(pinned, 2);
  const dm = mk(pinned, M.parts, turn); dm.position.y = y0;
  const tines = new THREE.InstancedMesh(G.tint(new THREE.BoxGeometry(1, 0.012, 0.03).toNonIndexed(), 0xffffff), M.parts, NT);
  tines.castShadow = true; tines.frustumCulled = false; g.add(tines);
  for (let i = 0; i < NT; i++) tines.setColorAt(i, new THREE.Color(0.78 - i * 0.02, 0.8 - i * 0.02, 0.84));
  const base = G.tint(G.slab(G.shapeOf([[-0.12, -0.25], [0.12, -0.25], [0.12, 0.25], [-0.12, 0.25]]), 0.06, 0.008, 1), metal); G.polish(base, 2);
  const bm = mk(base, M.parts, g); bm.position.set(tipX(NT - 1) + 0.28, y0 + 0.02, 0);
  const sc = mk(G.screwGeometry(0.04), M.steel, g, { cast: false }); sc.position.set(tipX(NT - 1) + 0.28, y0 + 0.085, 0.1);
  const sc2 = mk(G.screwGeometry(0.04), M.steel, g, { cast: false }); sc2.position.set(tipX(NT - 1) + 0.28, y0 + 0.085, -0.1);
  const post = mk(G.staffGeometry(0.03), M.steel, g); post.scale.y = y0 + 0.1;
  const amp = new Float32Array(NT), last = new Float32Array(tune.length).fill(NaN), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  const wrap = v => { v = ((v + Math.PI) % TAU + TAU) % TAU - Math.PI; return v; };
  let tPrev = 0;
  return {
    busy: () => true,
    update(cx) {
      const a = cx.angle(r.id) * P.DEG, awake = cx.awake(k) || true;
      turn.rotation.y = -cx.angle(r.id) * P.DEG;
      g.position.y = cx.layerY(r.layer) - P.LAYER_Y[r.layer];
      drive.update(cx);
      const dt = Math.max(0, (cx.tMs - tPrev) / 1000); tPrev = cx.tMs;
      for (let i = 0; i < NT; i++) amp[i] *= Math.exp(-dt * 5.5);
      if (awake) tune.forEach((n, s) => {
        const d = wrap(pins[s].userData.a + a - alpha(n));
        if (!Number.isNaN(last[s]) && last[s] < 0 && d >= 0 && Math.abs(d) < 0.6 && Math.abs(last[s]) < 0.6) { amp[n] = 1; if (cx.awake(k)) c.onEvent?.({ type: "chime", train: k, note: n }); }
        last[s] = d;
      });
      for (let i = 0; i < NT; i++) {
        const xb = tipX(NT - 1) + 0.28, L = xb - tipX(i), flex = amp[i] * Math.sin(cx.tMs / 1000 * (60 + i * 9)) * 0.012;
        s3.set(L, 1, 1); p3.set((xb + tipX(i)) / 2, y0 + 0.1 + flex, tz(i));
        q.identity(); tines.setMatrixAt(i, m4.compose(p3, q, s3));
      }
      tines.instanceMatrix.needsUpdate = true;
    },
  };
}

/** What docks a dial, a moon or a date ring to its train: ONE small gear in the train's metal (the sink's module), the open-work twin of the sink wheel, lying under the
 *  face so that a toothed part of it sticks out past the face's rim on the side the power comes in by (opposite `out`). A face out in the margin (`mesh`) has it on the
 *  sink's side of the face, meshed with the sink wheel and turning the other way; a compact face sits on its sink, so its twin turns with the sink wheel. `o`: { y: height
 *  of its underside, rim: the face's rim radius from the sink, mesh, plain: a solid disc instead of spokes }. Always a picture: the face's own motion works are
 *  driven from the sink as before. */
export function buildDock(c, group, r, out, o = {}) {
  const { THREE, G, M, P, mk } = c, metal = metalOf(r), a = Math.atan2(out[1], out[0]), ns = r.n, m = r.m;
  const g = new THREE.Group(), turn = new THREE.Group();
  g.position.set(r.wx, 0, r.wz); g.rotation.y = -a; g.userData.dock = true; group.add(g); g.add(turn);
  // a sink wheel too small to reach out from under its face is twinned by a larger one of the same module; a ring's or moon's twin is a smaller, plain one
  const nt = o.mesh ? ns : o.plain ? Math.max(5, Math.round(ns * 0.7)) : Math.max(ns, Math.ceil(0.32 * 120 / m)), pt = P.pitchR(nt, m), ps = P.pitchR(ns, m);
  const off = o.mesh ? 0 : Math.max(0, o.rim + (o.stick ?? 0.15) - P.tipR(nt, m));
  turn.position.x = o.mesh ? ps + pt : -off;
  c.lifts?.set(r.id, o.mesh || out[1] <= 0 ? 0 : Math.max(0, off + P.tipR(nt, m) - P.tipR(ns, m)));       // the goal chip rides above it when the power comes in at the top of the screen
  const root = P.rootR(nt, m), hole = o.plain ? 0.07 : Math.max(0.1, root - 0.07), t = 0.03;
  const parts = [G.slab(G.shapeOf(P.toothOutline(nt, m, 2), [G.circle(hole, 40)]), t, 0.006, 1)];
  if (!o.plain) {
    for (let i = 0; i < 4; i++) { const q = i * Math.PI / 2 + 0.4, cx = Math.cos(q), cz = Math.sin(q), w = 0.03; parts.push(G.slab(G.shapeOf([[cx * 0.08 - cz * w, cz * 0.08 + cx * w], [cx * (hole + 0.02) - cz * w, cz * (hole + 0.02) + cx * w], [cx * (hole + 0.02) + cz * w, cz * (hole + 0.02) - cx * w], [cx * 0.08 + cz * w, cz * 0.08 - cx * w]]), t, 0.004, 1)); }
    parts.push(G.slab(G.shapeOf(G.circle(0.11, 24), [G.circle(0.045, 12)]), t + 0.012, 0.006, 1));
  }
  const gear = G.tint(G.merge(parts), metal); G.polish(gear, 2);
  mk(gear, M.parts, turn, { cast: false }).position.y = o.y;
  return {
    busy: () => true,
    update(cx) {
      g.position.y = cx.layerY(r.layer) - P.LAYER_Y[r.layer];
      const s = cx.angle(r.id) * P.DEG;
      // meshed: a tooth of the sink at the contact meets a gap here (the driving wheel's rule); otherwise it turns with the sink wheel
      turn.rotation.y = o.mesh ? a - (a + Math.PI + Math.PI / nt - (ns / nt) * (s - a)) : a - s;
    },
  };
}
