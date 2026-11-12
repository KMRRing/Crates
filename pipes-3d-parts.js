// Gears' instruments: the barrels (drum, snailed lid with a window on the coiled mainspring, ratchet and click) and the complications that sit on a train's sink in
// the plate's margin: the time dial (guilloche, blued hands on motion works that really are a 1:12 reduction in meshed wheels), the date ring (numerals and a
// window), the moon (lacquer disc under an aperture), the chime (a pinned disc and a graded comb that rings), the escapement (escape wheel, pallet fork, balance
// and hairspring, pipes-3d-escape.js) and the tourbillon. Every part that turns is driven from a named engine wheel's angle (the view's one clock), never its
// own: `update(ctx)` is given ctx.angle(gearId) in degrees clockwise, ctx.awake(train), the clock ctx.tMs and the explode ctx.ex.
// createParts(env) -> { set(plan, frame, byId), update(ctx), tint(skin), busy(), dispose() }.
import { buildEscapement, buildTourbillon, buildChime, buildDock } from "./pipes-3d-escape.js";

const TAU = Math.PI * 2;
/** The width of a compact instrument (the fraction of its full size) so that it stays within about its sink's square. */
const FACE_AT = 1.22;           // a full-size face: how far from its sink's middle (room for the docking wheel to show between them)
const COMPACT = { hands: 0.74, dial: 0.74, seconds: 0.74, moon: 0.84, chime: 0.62, escape: 0.58, tourbillon: 0.8 };

export function createParts(env) {
  const { THREE, G, look, P, root, cols, rows, onEvent } = env;
  const { M, gearMat } = look;
  const group = new THREE.Group();
  root.add(group);
  let items = [], owned = [], skin = null, plan = null, frame = null;
  const lifts = new Map();                                      // sink id -> how far its docking wheel reaches past the sink's tip, for the goal chip
  const own = o => { owned.push(o); return o; };
  const mk = (geo, mat, parent = group, o = {}) => { const m = new THREE.Mesh(geo, mat); m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false; parent.add(m); own(geo); return m; };
  const ctxB = { THREE, G, look, P, mk, own, onEvent, M, gearMat, lifts };

  function clear() {
    for (const o of owned) o.dispose?.();
    owned = []; items = []; lifts.clear();
    group.clear();
  }

  // ---------- a barrel ----------
  function barrel(r, k) {
    const g = new THREE.Group(), turn = new THREE.Group();
    g.position.set(r.wx, 0, r.wz);
    group.add(g); g.add(turn);
    const root_ = P.rootR(r.n, r.m), tip = P.tipR(r.n, r.m), y0 = P.LAYER_Y[r.layer], H = 0.13;
    // the drum: a toothed ring (solid, with the module's metal), a lid with a window on the spring, a snail of fine lines on the lid by vertex shades
    const drum = G.wheelGeometry({ n: r.n, m: r.m, detail: env.detail, solid: true, pinion: false });
    const drumM = mk(drum, gearMat[r.m] || gearMat[5], turn); drumM.position.y = y0;
    const lidR = root_ * 0.92, win0 = 0.4 + k * 1.1, win1 = win0 + 1.35;
    const lid = G.slab(G.shapeOf(G.circle(lidR, 48), [[...G.arc(lidR * 0.86, win0, win1, 14), ...G.arc(lidR * 0.34, win1, win0, 8)]]), 0.022, 0.006, 1);
    G.polish(lid);
    // sunray: alternate bands of light on the lid (vertex shades by angle), and the spring coiled in the window
    const p = lid.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), band = Math.floor((a + Math.PI) / TAU * 48) % 2 ? 0.9 : 1; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = band; }
    lid.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    lid.translate(0, H - 0.022, 0);
    // 11 Nov 2026, Korbi: "until then quartz": a quartz movement's drum is its motor, the blued spring a copper coil under a dark lid
    const quartz = plan?.power !== "mech";
    const spring = G.tint(G.spiralGeometry(lidR * 0.2, lidR * 0.84, quartz ? 9 : 5, quartz ? 0.02 : 0.014, 0.05, 14), quartz ? 0xb8733a : 0x2b4f9c);
    G.polish(spring); spring.translate(0, 0.02, 0);
    const floor = G.tint(G.slab(G.shapeOf(G.circle(lidR * 0.9, 40)), 0.014, 0.003), 0x6a6e78); G.polish(floor); floor.translate(0, 0.012, 0);
    const lidAll = G.merge([G.tint(lid, quartz ? 0x3a3f48 : 0xcfd3d9), spring, floor]);
    const lidM = mk(lidAll, M.parts, turn); lidM.position.y = y0;
    // the arbor of the barrel is fixed; on it the ratchet wheel (it only turns when winding) with its click
    const rat = G.slab(G.shapeOf(G.ratchetOutline(14, root_ * 0.2, root_ * 0.3), [G.circle(0.02, 8)]), 0.035, 0.005, 1);
    rat.translate(0, H, 0); G.polish(rat, 2); G.tint(rat, 0xc9ced6);
    const click = G.slab(G.shapeOf([[0, 0], [0.09, 0.012], [0.11, 0.036], [0.085, 0.04], [0.02, 0.016], [-0.03, 0.03], [-0.03, 0.006]]), 0.03, 0.004, 1);
    click.translate(root_ * 0.3 - 0.02, H, 0.02); G.polish(click, 2); G.tint(click, 0xe3b84e);
    const stat = mk(G.merge([rat, click]), M.parts, g); stat.position.y = y0;
    const pivot = mk(G.chatonGeometry(0.15, 0.1), M.gold, g, { cast: false }); pivot.position.y = y0 + H + 0.035;
    const stone = mk(G.cabochonGeometry(0.1, 0.075, 0.024), M.rubyLit, g, { cast: false }); stone.position.y = y0 + H + 0.047;
    items.push({ g, update: c => { turn.rotation.y = -c.angle(r.id) * P.DEG; g.position.y = c.layerY(r.layer) - P.LAYER_Y[r.layer]; } });
    void tip;
  }

  // ---------- the time dial and its motion works ----------
  function dialTexture(R) {
    const t = look.drawn(512, (c, s) => {
      c.fillStyle = "#1b2a4d"; c.fillRect(0, 0, s, s);
      c.translate(s / 2, s / 2);
      c.strokeStyle = "rgba(150,175,230,.22)"; c.lineWidth = 1;
      for (let i = 1; i < 22; i++) { c.beginPath(); c.arc(0, 0, s * 0.5 * i / 22 * 0.62, 0, TAU); c.stroke(); }        // guilloche: fine turned rings
      for (let i = 0; i < 90; i++) { const a = i / 90 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * s * 0.12, Math.sin(a) * s * 0.12); c.lineTo(Math.cos(a) * s * 0.31, Math.sin(a) * s * 0.31); c.stroke(); }
      c.strokeStyle = "#e0b85a"; c.fillStyle = "#e0b85a"; c.lineWidth = 2.4;
      c.beginPath(); c.arc(0, 0, s * 0.455, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, s * 0.395, 0, TAU); c.stroke();
      for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, l = i % 5 ? 0.02 : 0.045; c.lineWidth = i % 5 ? 1.2 : 3; c.beginPath(); c.moveTo(Math.cos(a) * s * 0.455, Math.sin(a) * s * 0.455); c.lineTo(Math.cos(a) * s * (0.455 - l), Math.sin(a) * s * (0.455 - l)); c.stroke(); }
      c.font = `600 ${Math.round(s * 0.07)}px Georgia, serif`; c.textAlign = "center"; c.textBaseline = "middle";
      const rom = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
      rom.forEach((t_, i) => { const a = (i * 30 - 90) * Math.PI / 180; c.save(); c.translate(Math.cos(a) * s * 0.335, Math.sin(a) * s * 0.335); c.rotate(a + Math.PI / 2); c.font = `600 ${Math.round(s * (i % 3 ? 0.05 : 0.065))}px Georgia, serif`; c.fillText(t_, 0, 0); c.restore(); });
    }, true);
    t.flipY = false;
    return own(t);
  }
  const breguet = (L, ring = 0.05, wide = 0.026) => {
    const body = G.slab(G.shapeOf([[0, 0.1 * L], [wide * 0.5, 0.02 * L], [wide * 0.28, -L * 0.62], [0.006, -L], [-0.006, -L], [-wide * 0.28, -L * 0.62], [-wide * 0.5, 0.02 * L]]), 0.012, 0.003, 1);
    const eye = G.slab(G.shapeOf(G.circle(ring, 20, 0, -L * 0.66), [G.circle(ring * 0.58, 16, 0, -L * 0.66)]), 0.012, 0.003, 1);
    const hub = G.slab(G.shapeOf(G.circle(0.04, 14), [G.circle(0.012, 8)]), 0.02, 0.004, 1);
    const g = G.merge([body, eye, hub]); G.polish(g, 2); return G.tint(g, 0xf0cd7a);
  };
  function dial(r, k, o = [1, 0], raised = false) {
    const g = new THREE.Group(), at = raised ? 0 : FACE_AT, lift = raised ? 0 : P.LAYER_Y[r.layer] + 0.055;     // a full face lies just above the docking wheel, which is in the sink's own plane
    g.position.set(r.wx + o[0] * at, 0, r.wz + o[1] * at);
    group.add(g);
    const R = 0.62, face = G.slab(G.shapeOf(G.circle(R, 72)), 0.034, 0.008, 2);
    G.faceUV(face, R * 2);
    const dm = new THREE.MeshStandardMaterial({ color: 0xffffff, map: dialTexture(R), roughness: 0.4, metalness: 0 });
    own(dm);
    const faceM = mk(face, dm, g); faceM.position.y = lift;
    const rim = G.tint(G.slab(G.shapeOf(G.circle(R + 0.035, 72), [G.circle(R - 0.004, 72)]), 0.05, 0.008, 2), 0xd8dade); G.polish(rim, 2);
    mk(rim, M.parts, g).position.y = lift;
    // the motion works: cannon pinion 10 (with the minute hand) turns minute wheel 30, whose pinion 8 turns the hour wheel 32 (with the hour hand): 1:12.
    const m = 1.4, y0 = (raised ? 0 : P.LAYER_Y[r.layer] + P.THICK) + 0.05, dist = 28, dirA = (k % 2 ? 150 : 30) * P.DEG;
    const mx = Math.cos(dirA) * dist / 60, mz = Math.sin(dirA) * dist / 60;
    const mini = [{ id: 1, x: 0, y: 0, n: 10 }, { id: 2, x: mx * 60, y: mz * 60, n: 30 }, { id: 4, x: mx * 60, y: mz * 60, n: 8 }, { id: 3, x: 0, y: 0, n: 32 }];
    const ph = P.phasesOf(mini, [{ u: 1, v: 2, kind: "mesh" }, { u: 2, v: 4, kind: "rigid" }, { u: 4, v: 3, kind: "mesh" }], [1]);
    const sk = gearMat.pinion;
    const wheel = (n, pinion, y) => { const geo = G.wheelGeometry({ n, m, detail: env.detail, pinion }); geo.translate(0, y, 0); return geo; };
    const a1 = new THREE.Group(), a2 = new THREE.Group(), a3 = new THREE.Group();
    a1.position.y = y0; a2.position.set(mx, y0, mz); a3.position.y = y0;
    g.add(a1, a2, a3);
    mk(G.merge([wheel(10, true, 0)]), sk, a1);
    const minHand = G.merge([breguet(0.54, 0.04, 0.026).translate(0, 0.22, 0)]);
    mk(minHand, M.parts, a1);
    mk(G.merge([wheel(30, false, 0), wheel(8, true, 0.09).translate(0, 0, 0)]), sk, a2);
    mk(G.merge([wheel(32, false, 0.09)]), sk, a3);
    const hourHand = G.merge([breguet(0.34, 0.05, 0.034).translate(0, 0.17, 0)]);
    mk(hourHand, M.parts, a3);
    const staff = mk(G.staffGeometry(0.014), M.steel, a1); staff.scale.y = 0.34;
    const staff2 = mk(G.staffGeometry(0.014), M.steel, a2); staff2.scale.y = 0.14;
    const cap = mk(G.chatonGeometry(0.06, 0.04), M.gold, a1, { cast: false }); cap.position.y = 0.34;
    items.push({
      g, update: c => {
        const run = c.angle(r.id) - c.phase(r.id);                                      // the sink wheel is the minute wheel: the cannon pinion turns with it
        a1.rotation.y = -((ph.get(1) || 0) + run) * P.DEG;
        a2.rotation.y = -((ph.get(2) || 0) - run * 10 / 30) * P.DEG;
        a3.rotation.y = -((ph.get(3) || 0) + run * 10 / 30 * 8 / 32) * P.DEG;
        g.position.y = c.layerY(r.layer) - P.LAYER_Y[r.layer];
      },
    });
  }

  // ---------- the date ring ----------
  function dateRing(r) {
    const g = new THREE.Group();
    g.position.set(r.wx, 0, r.wz);
    group.add(g);
    const R = P.pitchR(r.n, r.m), outer = R + (R - P.rootR(r.n, r.m)) + 0.2, inner = outer - 0.18, turn = new THREE.Group();
    g.add(turn);
    const face = G.slab(G.shapeOf(G.circle(outer - 0.02, 80), [G.circle(inner, 80)]), 0.012, 0.003, 1);
    G.faceUV(face, outer * 2);
    const tx = look.drawn(1024, (c, s) => {
      c.fillStyle = "#f1ede2"; c.fillRect(0, 0, s, s);
      c.translate(s / 2, s / 2); c.fillStyle = "#20242c"; c.textAlign = "center"; c.textBaseline = "middle";
      for (let d = 1; d <= 31; d++) { const a = (d - 1) / 31 * TAU - Math.PI / 2; c.save(); c.translate(Math.cos(a) * s * (outer - 0.1) / (2 * outer), Math.sin(a) * s * (outer - 0.1) / (2 * outer)); c.rotate(a + Math.PI / 2); c.font = `700 ${Math.round(s * 0.045)}px Georgia, serif`; c.fillText(String(d), 0, 0); c.restore(); }
    }, true);
    tx.flipY = false; own(tx);
    const dm = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.4 }); own(dm);
    const numM = mk(face, dm, turn); numM.position.y = P.LAYER_Y[r.layer] + 0.06;
    // a cover over a quarter of the ring with the date window in it
    const cover = G.tint(G.slab(G.shapeOf([...G.arc(outer + 0.03, -0.5, 0.5, 14), ...G.arc(inner - 0.03, 0.5, -0.5, 10)], [[[inner + 0.03, -0.07], [outer - 0.03, -0.07], [outer - 0.03, 0.07], [inner + 0.03, 0.07]].map(([x, y]) => [x, y])]), 0.03, 0.007, 1), 0xd8dade);
    G.polish(cover, 2);
    const cm = mk(cover, M.parts, g); cm.position.y = P.LAYER_Y[r.layer] + 0.1;
    items.push({ g, update: c => { turn.rotation.y = -c.angle(r.id) * P.DEG; g.position.y = c.layerY(r.layer) - P.LAYER_Y[r.layer]; } });
  }

  // ---------- the moon ----------
  function moon(r, o = [1, 0]) {
    const g = new THREE.Group(), turn = new THREE.Group();
    g.position.set(r.wx + o[0] * 0.85, 0, r.wz + o[1] * 0.85);
    group.add(g); g.add(turn);
    const R = 0.5, disc = G.slab(G.shapeOf(G.circle(R, 64)), 0.03, 0.006, 1);
    G.faceUV(disc, R * 2);
    const tx = look.drawn(512, (c, s) => {
      const gr = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, "#1c2f66"); gr.addColorStop(1, "#0b1536"); c.fillStyle = gr; c.fillRect(0, 0, s, s);
      let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(255,236,180,${0.4 + rnd() * 0.6})`; c.beginPath(); c.arc(rnd() * s, rnd() * s, 0.6 + rnd() * 1.6, 0, TAU); c.fill(); }
      for (const a of [Math.PI * 0.5, Math.PI * 1.5]) { const x = s / 2 + Math.cos(a) * s * 0.3, y = s / 2 + Math.sin(a) * s * 0.3, mr = s * 0.13; const mg = c.createRadialGradient(x - mr * 0.3, y - mr * 0.3, 0, x, y, mr); mg.addColorStop(0, "#fff2c2"); mg.addColorStop(1, "#d8a73e"); c.fillStyle = mg; c.beginPath(); c.arc(x, y, mr, 0, TAU); c.fill(); c.fillStyle = "rgba(120,80,20,.35)"; for (const [dx, dy, rr] of [[0.3, 0.2, 0.2], [-0.25, 0.3, 0.14], [0.1, -0.35, 0.1]]) { c.beginPath(); c.arc(x + dx * mr, y + dy * mr, rr * mr, 0, TAU); c.fill(); } }
    }, true);
    tx.flipY = false; own(tx);
    const dm = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.28, metalness: 0.1 }); own(dm);
    const dMesh = mk(disc, dm, turn); dMesh.position.y = P.LAYER_Y[r.layer] + P.THICK + 0.035;
    // the aperture: a plate over it with an arch cut, so only a segment of the disc shows
    const arch = [...G.arc(R * 0.86, Math.PI * 0.04, Math.PI * 0.96, 20)];
    const cover = G.tint(G.slab(G.shapeOf(G.circle(R + 0.07, 56), [arch]), 0.032, 0.008, 2), 0xd8dade); G.polish(cover, 2);
    const cm = mk(cover, M.parts, g); cm.position.y = P.LAYER_Y[r.layer] + P.THICK + 0.11;
    const post = mk(G.staffGeometry(0.03), M.steel, g); post.scale.y = P.LAYER_Y[r.layer] + P.THICK + 0.13;
    items.push({ g, update: c => { turn.rotation.y = -c.angle(r.id) * P.DEG; g.position.y = c.layerY(r.layer) - P.LAYER_Y[r.layer]; } });
  }

  const outOfTrain = (k, r) => { const t = plan?.trains?.[k]; return t?.sink?.side != null ? P.outOf(t.sink.side) : out(r); };
  function out(r) {                                                      // the way from the board's middle to this wheel, along an axis: where the margin is
    const dx = r.wx, dz = r.wz;
    return Math.abs(dx) * 0.7 > Math.abs(dz) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dz) || 1];
  }

  return {
    set(p, f, byId) {
      if (f === frame && p === plan) return;
      plan = p; frame = f;
      clear();
      let bi = 0;
      for (const r of byId.values()) {
        if (r.role === "barrel" && r.source !== "arbor") barrel(r, bi++);
      }
      const sinkOf = new Map();
      (p.trains || []).forEach((t, k) => { const ring = !!t.sink?.goal?.ring, s = [...byId.values()].find(r => r.train === k && r.role === "sink" && (!ring || r.ring)); if (s) sinkOf.set(k, [s, t.sink?.goal?.type, t.sink?.goal]); });
      let di = 0;
      for (const [k, [r, type, goal]] of sinkOf) {
        // an instrument whose sink is not on the board's edge is built compact, on the sink's own square (its parts drawn narrower, its heights kept)
        const compact = !P.fullSize(p, p.trains[k]) && type !== "date" && !r.ring, before = group.children.length, o = compact ? [0, 0] : outOfTrain(k, r);
        const under = P.LAYER_Y[r.layer] - 0.055, dock = o_ => items.push(buildDock(ctxB, group, r, outOfTrain(k, r), { y: under, ...o_ }));     // the docking wheel lies just under the sink's own layer
        if (type === "hands" || type === "dial" || type === "seconds") { dial(r, di++, o, compact); dock(compact ? { rim: (0.62 + 0.035) * COMPACT[type], stick: 0.2 } : { mesh: true, y: P.LAYER_Y[r.layer] + 0.02 }); }
        else if (type === "date" || r.ring) { const R = P.pitchR(r.n, r.m); dock({ rim: R + (R - P.rootR(r.n, r.m)) + 0.23, plain: true, stick: 0.3 }); dateRing(r); }
        else if (type === "moon") { moon(r, o); dock(compact ? { rim: (0.5 + 0.07) * COMPACT.moon, plain: true, stick: 0.26 } : { mesh: true }); }
        else if (type === "chime") items.push(buildChime(ctxB, group, r, outOfTrain(k, r), goal, k));
        else if (type === "escape") items.push(buildEscapement(ctxB, group, r, outOfTrain(k, r), k));
        else if (type === "tourbillon") items.push(buildTourbillon(ctxB, group, r, outOfTrain(k, r), k));
        if (!compact) continue;
        const sub = new THREE.Group(), S = COMPACT[type] || 0.7;
        sub.position.set(r.wx, type === "hands" || type === "dial" || type === "seconds" ? P.LAYER_Y[r.layer] + P.THICK + 0.04 : 0, r.wz); sub.scale.set(S, 1, S);
        for (const ch of group.children.slice(before)) { if (ch.userData.dock) continue; ch.position.x -= r.wx; ch.position.z -= r.wz; sub.add(ch); }
        group.add(sub);
      }
      // 9 Nov 2026, Korbi: later movements have an escapement between the spring and the movement. A pinned station of type "escape" wears a small one on its wheel (a picture: the
      // rules only see the station's speed and way), reaching out to the board's margin side.
      for (const pin of p.pins || []) {
        if (pin.goal?.type !== "escape") continue;
        const r = byId.get(pin.c * 8 + (pin.goal.w ?? 0));
        if (!r) continue;
        const before = group.children.length;
        items.push(buildEscapement(ctxB, group, r, out(r), pin.train ?? 0, { dock: false }));
        const sub = new THREE.Group();
        sub.position.set(r.wx, 0.12, r.wz); sub.scale.set(COMPACT.escape, 1, COMPACT.escape);
        for (const ch of group.children.slice(before)) { ch.position.x -= r.wx; ch.position.z -= r.wz; sub.add(ch); }
        group.add(sub);
      }
      if (skin) this.tint(skin);
    },
    update(ctx) { for (const it of items) it.update(ctx); },
    tint(s) { skin = s; },
    lifts,
    busy: () => items.some(i => i.busy?.()),
    dispose() { clear(); root.remove(group); },
  };
}
