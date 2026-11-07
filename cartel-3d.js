// Cartel's 3D table (Menu, View: 3D): a Hanseatic counting-house table drawn with three.js under the page's own boxes. The
// page (cartel.js) is the master of the layout: every seat, your row, the bid's marker and each die is a DOM box, still there
// for taps, text and screen readers, and this scene reads their rectangles and stands the thing in each: a leather ledger
// under each seat, your dice on a blotter, a brass plate under the bid with its die standing on it, gold role dice with
// engraved faces, leather cups over the dice you can't see, a dashed frame round one only you know and a dot on one
// everyone has seen (dice3d.js), in a rim of oak edged in brass, round a strongbox for the bank's dice, a candle and a pair
// of balance scales. It takes no input and keeps no state of the game: `sync(model)` is everything it is told, so what it
// shows is exactly what the flat table shows. Nothing in the room moves on its own (it draws only while a die, a cup or the
// scales move), so a quiet table costs nothing.
import { createDiceStage, lathe, slab, merge } from "./dice3d.js";
import { ROLE_GOLD } from "./cartel-glyphs.js";
import { CanvasTexture, SRGBColorSpace } from "./vendor/three-tex.js";

const SPAN = 20;                                                     // world units across the box: a pixel is 20 / width of them
const clamp01 = u => Math.max(0, Math.min(1, u));

// the table's colours by day and night: Guandan's mahogany under brass, ledgers of the same wood (Korbi, 7 Nov 2026)
const LOOK = {
  day: { baize: 0x7a4026, oak: 0x4b2e1b, oakTop: 0x6b4527, brass: 0xc9a24a, brassHi: 0xf0cf79, seat: 0x5a3420, seatTurn: 0x73421f, seatOut: 0x2e190d,
    mine: 0x5f3820, aim: 0xf1ead8, picked: 0xe76f51, plate: 0xd2a64a, plateHi: 0xf3d98c, held: 0x2c7a52, broke: 0xa8382b, open: 0x24130b },
  night: { baize: 0x55291a, oak: 0x2f1d12, oakTop: 0x45301d, brass: 0xa98838, brassHi: 0xd2b25f, seat: 0x3e2315, seatTurn: 0x56301a, seatOut: 0x21110a,
    mine: 0x432919, aim: 0xd8d1c0, picked: 0xd8603f, plate: 0xb48e3c, plateHi: 0xd9bb69, held: 0x1f5c3d, broke: 0x85291f, open: 0x180c06 },
};
const HEX = c => [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255];

export function createCartel3d(host, { onLost = () => {} } = {}) {
  const stage = createDiceStage(host, { camera: { span: SPAN, elev: 56, fov: 24 }, clear: n => (n ? 0x1a0d07 : 0x2a1509), onLost, capacity: 64, exposure: 0.92, light: { sun: [1.55, 1.3], hemi: [0.62, 0.62] } });
  const { THREE, std, mesh, worldAt, track } = stage;
  let look = LOOK.day, rem = 1, upp = 0.05, last = null, dead = false;

  // ---------- the table top: polished mahogany, the card room's (Korbi, 7 Nov 2026: "use the new table"), with a long grain ----------
  const baizeTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    x.fillStyle = "#808080"; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 700; i++) { x.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.09)"; x.fillRect(0, Math.random() * 256, 256, Math.random() * 2.2 + .3); }
    for (let i = 0; i < 160; i++) { x.fillStyle = "rgba(0,0,0,.06)"; x.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 90 + 20, 1); }
    const t = new CanvasTexture(c);
    t.wrapS = t.wrapT = 1000; t.repeat.set(8, 8); t.needsUpdate = true;
    return track(t);
  })();
  const baizeMat = std(0xffffff, 0.98, 0, { map: baizeTex, color: look.baize });
  mesh(track(new THREE.BoxGeometry(80, 0.5, 80)), baizeMat, { cast: false }).position.set(0, -0.25, 0);

  // ---------- flat things laid in pixels: a stack of levels (inset in px, height in px, colour) round a rectangle ----------
  const MAT = std(0xffffff, 0.55, 0.05, { vertexColors: true, side: 2 });
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3();
  /** A solid read off the page: rectangle `rect` (px), seen at each level inset and raised, strips between levels, a top if `fill`. */
  function layered(levels, { fill = false } = {}) {
    const quads = (levels.length - 1) * 4 + (fill ? 1 : 0), count = quads * 6;
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    const m = mesh(geo, MAT);
    const L = levels.map(l => ({ ...l }));
    const pts = L.map(() => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    function update(r, { lift = 0, colors = null } = {}) {
      if (colors) colors.forEach((c, i) => { if (c != null) L[i].c = c; });
      const pos = geo.attributes.position.array, nor = geo.attributes.normal.array, col = geo.attributes.color.array;
      L.forEach((l, k) => {
        const i = l.inset * rem, y = (l.y * rem + lift * rem) * upp;
        for (const [j, [px, py]] of [[r.x + i, r.y + i], [r.x + r.w - i, r.y + i], [r.x + r.w - i, r.y + r.h - i], [r.x + i, r.y + r.h - i]].entries()) {
          const p = worldAt(px, py, y) || A.set(0, y, 0);
          pts[k][j].copy(p);
        }
      });
      const centre = N.set((pts[0][0].x + pts[0][2].x) / 2, -1, (pts[0][0].z + pts[0][2].z) / 2).clone();
      let v = 0;
      const put = (p, c, n) => { pos[v * 3] = p.x; pos[v * 3 + 1] = p.y; pos[v * 3 + 2] = p.z; nor[v * 3] = n.x; nor[v * 3 + 1] = n.y; nor[v * 3 + 2] = n.z; const k = HEX(c); col[v * 3] = k[0]; col[v * 3 + 1] = k[1]; col[v * 3 + 2] = k[2]; v++; };
      const quad = (a, b, c, d, ca, cb, cc, cd) => {
        N.copy(b).sub(a); B.copy(c).sub(a); N.cross(B).normalize();
        A.copy(a).add(b).add(c).add(d).multiplyScalar(0.25).sub(centre);
        let q = [[a, ca], [b, cb], [c, cc], [d, cd]];
        if (N.dot(A) < 0) { q = [q[0], q[3], q[2], q[1]]; N.negate(); }
        const n = N.clone();
        for (const i of [0, 1, 2, 0, 2, 3]) put(q[i][0], q[i][1], n);
      };
      for (let k = 0; k < L.length - 1; k++) for (let s = 0; s < 4; s++) quad(pts[k][s], pts[k][(s + 1) % 4], pts[k + 1][(s + 1) % 4], pts[k + 1][s], L[k].c, L[k].c, L[k + 1].c, L[k + 1].c);
      if (fill) { const t = pts[L.length - 1], c = L[L.length - 1].c; quad(t[0], t[1], t[2], t[3], c, c, c, c); }
      geo.attributes.position.needsUpdate = geo.attributes.normal.needsUpdate = geo.attributes.color.needsUpdate = true;
    }
    return { mesh: m, update, set visible(v) { m.visible = v; } };
  }

  // the rim: oak edged in brass round the whole box, its inner edge just clear of the page's own padding
  const rim = layered([{ inset: -10, y: 9, c: look.oakTop }, { inset: 2, y: 9, c: look.oakTop }, { inset: 3.5, y: 8, c: look.oak }, { inset: 4.4, y: 6, c: look.brass },
    { inset: 5.4, y: 6, c: look.brassHi }, { inset: 6.2, y: 5, c: look.brass }, { inset: 7, y: 0, c: look.oak }]);
  // seats: a ledger of leather with a brass-edged top, one for each opponent and a blotter for you
  const padLevels = (leather, ring) => [{ inset: 0, y: 0, c: leather }, { inset: 0, y: 4, c: leather }, { inset: 1.2, y: 5, c: ring }, { inset: 3, y: 5, c: ring }, { inset: 3, y: 5, c: leather }, { inset: 5, y: 5, c: leather }];
  const pads = [];
  const padAt = k => pads[k] || (pads[k] = layered(padLevels(look.seat, look.brass), { fill: true }));
  const minePad = layered(padLevels(look.mine, look.brass), { fill: true });
  const plate = layered([{ inset: 0, y: 0, c: look.plate }, { inset: 0, y: 6, c: look.plate }, { inset: 2, y: 7, c: look.plateHi }, { inset: 4, y: 7, c: look.plate }], { fill: true });

  // ---------- props ----------
  const group = () => { const g = new THREE.Group(); stage.scene.add(g); return g; };
  const solid = (g, geo, color, rough = 0.5, metal = 0) => {
    const o = new THREE.Mesh(track(geo), std(color, rough, metal));
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; g.add(o); return o;
  };
  const vcol = std(0xffffff, 0.45, 0.2, { vertexColors: true, side: 2 });
  const vsolid = (g, geo, metal = 0.2) => { const o = new THREE.Mesh(track(geo), vcol); o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; g.add(o); void metal; return o; };
  const OAK = 0x5b3a22, BRASS = 0xc9a24a, IRON = 0x2b2622;
  /** The strongbox: oak bound with brass, a lock at the front. Unit: 1 wide, 0.62 tall. */
  const chest = group();
  vsolid(chest, merge([slab(-0.5, 0, -0.3, 0.5, 0.38, 0.3, OAK), slab(-0.52, 0.38, -0.32, 0.52, 0.46, 0.32, 0x4a2e1a), slab(-0.46, 0.46, -0.26, 0.46, 0.56, 0.26, 0x4a2e1a), slab(-0.4, 0.56, -0.18, 0.4, 0.62, 0.18, 0x553620),
    ...[-0.34, 0, 0.34].map(x => slab(x - 0.045, -0.005, -0.31, x + 0.045, 0.62, 0.31, BRASS)),
    slab(-0.07, 0.3, 0.3, 0.07, 0.5, 0.34, 0xe0b95a), slab(-0.025, 0.34, 0.34, 0.025, 0.4, 0.36, IRON),
    ...[[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]].map(([x, z]) => slab(x - 0.04, 0.0, z - 0.04, x + 0.04, 0.46, z + 0.04, BRASS))]));
  /** A candlestick: a brass foot and stem, a drip tray, a cream candle, a flame. Unit: 1.25 tall. */
  const candle = group();
  vsolid(candle, lathe([[0, 0, BRASS], [0.27, 0, BRASS], [0.27, 0.04, 0xe0b95a], [0.2, 0.08, BRASS], [0.09, 0.16, BRASS], [0.06, 0.2, BRASS], [0.11, 0.26, 0xe0b95a], [0.06, 0.32, BRASS], [0.05, 0.45, BRASS],
    [0.1, 0.5, 0xe0b95a], [0.17, 0.54, BRASS], [0.15, 0.57, BRASS], [0.08, 0.58, BRASS], [0.08, 0.66, BRASS], [0.06, 0.66, IRON], [0, 0.66, IRON]], 20));
  { const c = solid(candle, new THREE.CylinderGeometry(0.058, 0.062, 0.5, 14), 0xeee3c4, 0.7); c.position.y = 0.9; }
  { const f = new THREE.Mesh(track((() => { const g = new THREE.SphereGeometry(0.055, 12, 8); g.scale(1, 2, 1); return g; })()), track(new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false })));
    f.position.y = 1.22; f.frustumCulled = false; candle.add(f);
    const core = new THREE.Mesh(track((() => { const g = new THREE.SphereGeometry(0.03, 10, 6); g.scale(1, 1.8, 1); return g; })()), track(new THREE.MeshBasicMaterial({ color: 0xfff5d0, toneMapped: false })));
    core.position.y = 1.2; core.frustumCulled = false; candle.add(core); }
  /** The balance scales: a brass column, a beam that tips, a pan hung from each end by chains. Unit: 1.1 tall, 1.7 wide. */
  const scales = group();
  const beam = new THREE.Group(), panL = new THREE.Group(), panR = new THREE.Group();
  vsolid(scales, lathe([[0, 0, BRASS], [0.4, 0, BRASS], [0.4, 0.05, 0xe0b95a], [0.3, 0.1, BRASS], [0.1, 0.17, BRASS], [0.045, 0.22, BRASS], [0.045, 0.98, BRASS], [0.075, 1.0, 0xe0b95a], [0, 1.04, 0xe0b95a]], 20));
  beam.position.y = 0.98; scales.add(beam);
  vsolid(beam, merge([slab(-0.8, -0.02, -0.025, 0.8, 0.025, 0.025, 0xe0b95a), slab(-0.04, -0.06, -0.03, 0.04, 0.07, 0.03, BRASS)]));
  for (const [pan, x] of [[panL, -0.78], [panR, 0.78]]) {
    pan.position.set(x, 0, 0); beam.add(pan);
    vsolid(pan, merge([slab(-0.012, -0.58, -0.012, 0.012, 0, 0.012, 0xb08a38), ...[-0.3, 0.3].map(dx => { const g = slab(-0.006, -0.55, -0.006, 0.006, 0, 0.006, 0xb08a38); g.rotateZ(dx > 0 ? -0.5 : 0.5); g.translate(0, 0, 0); return g; })]));
    const bowl = lathe([[0.3, -0.5, BRASS], [0.27, -0.58, BRASS], [0.14, -0.64, 0xe0b95a], [0, -0.65, 0xe0b95a], [0, -0.66, BRASS], [0.14, -0.65, BRASS], [0.28, -0.59, BRASS], [0.31, -0.5, 0xe0b95a]], 20);
    vsolid(pan, bowl);
  }
  // the light a candle makes on the cloth: a few layers of warm glow laid on, added (no point lights in the bundle)
  const glow = group();
  for (let k = 0; k < 16; k++) {
    const m = new THREE.Mesh(track(lathe([[1 - k / 16 * 0.9, 0.02, 0xffffff], [0, 0.02, 0xffffff]], 28)), track(new THREE.MeshBasicMaterial({ color: 0xffa646, transparent: true, opacity: 0.018, depthWrite: false, blending: 2, side: 2, toneMapped: false })));
    m.frustumCulled = false; m.renderOrder = 2; glow.add(m);
  }
  const quatZ = (o, a) => o.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
  let tilt = 0, tiltTo = 0;
  function tipScales(to) {
    if (to === tiltTo) return;
    tiltTo = to;
    const from = tilt, t0 = performance.now();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { tilt = to; quatZ(beam, tilt); quatZ(panL, -tilt); quatZ(panR, -tilt); return; }
    stage.go(t => {
      const u = clamp01((t - t0) / 900), e = u * u * (3 - 2 * u), over = Math.sin(u * Math.PI * 3) * (1 - u) * 0.08 * Math.abs(to - from);
      tilt = from + (to - from) * e + over;
      quatZ(beam, tilt); quatZ(panL, -tilt); quatZ(panR, -tilt);
      return u < 1;
    });
  }

  // ---------- reading the page ----------
  const centreOf = r => worldAt(r.x + r.w / 2, r.y + r.h / 2);
  const BANK = [0, 1, 2];
  const bankSpot = {};                                               // where the strongbox is (dice fly to and from it)

  function skin(night) {
    look = night ? LOOK.night : LOOK.day;
    baizeMat.color.set(look.baize);
    rim.update(lastRect || { x: 0, y: 0, w: 1, h: 1 }, { colors: [look.oakTop, look.oakTop, look.oak, look.brass, look.brassHi, look.brass, look.oak] });
    stage.sun.color.set(night ? 0xffe2b8 : 0xfff0d8);
    if (last) sync(last);
  }
  let lastRect = null, lastKey = "";

  /**
   * What the page says (rectangles in px from the table box's top left): { w, h, seats: [{ idx, x, y, w, h, turn, out, aim, picked }],
   * mine: { x, y, w, h, turn }, centre, marker: { x, y, w, h, state: "open" | "bid" | "held" | "broke" }, verdict: "held" | "broke" | null,
   * dice: [{ id, kind: "gold" | "plain", face | null, how, seen, picked, x, y, w, h }], from: { dieId: "bank" | seatIdx | "me" },
   * to: { dieId: … } }. Anything it names that is not there is left out.
   */
  function sync(model, { snap = false } = {}) {
    if (dead) return;
    // the page redraws its boxes whenever anything changes: the scene draws again only when what it was told did
    const key = JSON.stringify(model, (k, v) => (typeof v === "number" ? Math.round(v * 2) / 2 : v)) + (snap ? "!" : "") + rem + look.baize;
    if (key === lastKey && !snap) return;
    lastKey = key;
    last = model;
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1;
    const whole = { x: 0, y: 0, w: model.w, h: model.h };
    lastRect = whole;
    upp = stage.unitsPerPx(model.w / 2, model.h / 2) || 0.05;
    rim.update(whole);
    seatPads(model);
    if (model.mine) minePad.update(model.mine, { lift: model.mine.turn ? 2 : 0, colors: [look.mine, look.mine, model.mine.turn ? look.brassHi : look.brass, model.mine.turn ? look.brassHi : look.brass, look.mine, look.mine] });
    minePad.mesh.visible = !!model.mine;
    bidPlate(model);
    props(model);
    stage.setDice(diceOf(model), { snap, to: toOf(model) });
    tipScales(model.verdict === "held" ? 0.22 : model.verdict === "broke" ? -0.22 : 0);
    stage.invalidate();
  }
  function seatPads(model) {
    model.seats.forEach((s, k) => {
      const pad = padAt(k);
      const leather = s.out ? look.seatOut : s.picked ? look.seat : s.turn ? look.seatTurn : look.seat;
      const ring = s.picked ? look.picked : s.aim ? look.aim : s.turn ? look.brassHi : s.out ? 0x5a4a30 : look.brass;
      pad.update({ x: s.x - 1.5 * rem, y: s.y - 1.5 * rem, w: s.w + 3 * rem, h: s.h + 3 * rem }, { lift: s.turn || s.picked ? 2.5 : 0, colors: [leather, leather, ring, ring, leather, leather] });
      pad.mesh.visible = true;
    });
    for (let k = model.seats.length; k < pads.length; k++) pads[k].mesh.visible = false;
  }
  function bidPlate(model) {
    // the part of the marker the page shows (the middle clips it when the seats leave it little room)
    const m0 = model.marker, c = model.centre, m = m0 && c ? { ...m0, y: Math.max(m0.y, c.y), h: Math.min(m0.y + m0.h, c.y + c.h) - Math.max(m0.y, c.y) } : m0;
    plate.mesh.visible = !!m && m.h > 4;
    if (!plate.mesh.visible) return;
    const fill = { bid: look.plate, held: look.held, broke: look.broke, open: look.open }[m.state] || look.plate;
    const hi = { bid: look.plateHi, held: 0x6fb893, broke: 0xd9776a, open: look.brass }[m.state] || look.plateHi;
    plate.update({ x: m.x - 3 * rem, y: m.y - 1 * rem, w: m.w + 6 * rem, h: m.h + 2 * rem }, { colors: [fill, fill, hi, fill] });
  }
  /** The props stand in the free ends of the middle: what is left either side of the bid. */
  function props(model) {
    const c = model.centre, m = model.marker;
    if (!c || !m) { for (const g of [chest, candle, scales, glow]) g.visible = false; return; }
    const edge = 12 * rem, left = { x: c.x + edge, w: Math.max(0, m.x - 4 * rem - c.x - edge) }, right = { x: m.x + m.w + 4 * rem, w: Math.max(0, c.x + c.w - edge - (m.x + m.w + 4 * rem)) };
    const baseY = c.y + c.h * 0.8;
    // `tall` and `deep` are the prop's height and depth in its own units; from this camera they cover tall x .56 + deep x .83 of a unit of screen
    const place = (g, slot, deep, wide, tall, frac = 0.5) => {
      const pxFit = Math.min(slot.w * 0.8 / wide, (c.h * 1.35) / (tall * 0.56 + deep * 0.83), 46 * rem / tall);
      if (pxFit < 15 * rem) { g.visible = false; return null; }
      const p = worldAt(slot.x + slot.w * frac, baseY, 0);
      g.visible = !!p;
      if (!p) return null;
      g.position.set(p.x, 0, p.z);
      g.scale.setScalar(pxFit * upp);
      return { x: p.x, z: p.z, s: pxFit * upp };
    };
    const ch = place(chest, left, 0.62, 1.3, 0.62, 0.45);
    bankSpot.chest = ch;
    // the candle goes at the right, the scales beside it when there's room for both
    const roomy = right.w > 70 * rem && c.h > 56 * rem;
    const cd = place(candle, roomy ? { x: right.x, w: right.w * 0.42 } : right, 0.55, 0.6, 1.3, 0.5);
    const sc = roomy ? place(scales, { x: right.x + right.w * 0.4, w: right.w * 0.6 }, 0.5, 2.1, 1.1, 0.5) : (scales.visible = false, null);
    glow.visible = !!cd;
    if (cd) { glow.position.set(cd.x, 0, cd.z); glow.scale.set(cd.s * 4.4, 1, cd.s * 4.4 * 0.9); }
    void sc;
  }
  const seatCentre = (model, idx) => { const s = idx === "me" ? model.mine : model.seats.find(x => x.idx === idx); return s ? centreOf(s) : null; };
  const spotOf = (model, where) => {
    if (where === "bank") return bankSpot.chest ? { x: bankSpot.chest.x, z: bankSpot.chest.z } : null;
    const p = seatCentre(model, where);
    return p ? { x: p.x, z: p.z } : null;
  };
  function diceOf(model) {
    const out = [];
    for (const d of model.dice) {
      const cx = d.x + d.w / 2, cy = d.y + d.h / 2, p = worldAt(cx, cy + d.h * 0.1);
      if (!p) continue;
      const hidden = d.face == null, id = String(d.id);
      out.push({ id, style: d.kind === "gold" ? ROLE_GOLD : "bone", value: hidden ? 1 : d.face, cover: hidden, gold: d.kind === "gold", dashed: d.how === "peek", dot: !!d.seen,
        lift: !!d.picked, x: p.x, z: p.z, size: d.w * stage.unitsPerPx(cx, cy), from: model.from?.[d.id] != null ? spotOf(model, model.from[d.id]) || undefined : undefined });
    }
    // the bank's own dice, a few ebony ones by the strongbox
    const ch = bankSpot.chest;
    if (ch && chest.visible) BANK.forEach(i => out.push({ id: `bank${i}`, style: "ebony", value: [4, 2, 6][i], cover: false, x: ch.x + ch.s * (-0.3 + i * 0.32), z: ch.z + ch.s * (0.55 + (i % 2) * 0.12), yaw: 0.5 * i + 0.3, size: ch.s * 0.26 }));
    return out;
  }
  function toOf(model) {
    const to = new Map();
    for (const [id, where] of Object.entries(model.to || {})) { const s = spotOf(model, where); if (s) to.set(String(id), s); }
    return to;
  }

  stage.onSkin(skin);
  stage.onResize(() => { if (last) sync(last, { snap: true }); });
  // props and pads are drawn from the first sync on; until then nothing stands in the room
  for (const g of [chest, candle, scales, glow]) g.visible = false;
  minePad.mesh.visible = plate.mesh.visible = false;

  return {
    stage, sync,
    /** A new game: everything stands where it should at once, nothing flies in. */
    reset() { stage.reset(); },
    /** For tests: each die's face up as it lies, by id. */
    faceUp: id => stage.faceUp(String(id)),
    get dice() { return stage.dice; },
    dispose() { dead = true; stage.dispose(); },
  };
}
