// Gears' 3D board: what the 2D plate says with ink and the page says in words, drawn on the movement: a click's pawl ring and arrow (a stake on its gear once one is laid),
// the copper dot of a pinned piece that has a goal, the frames of the ghost, the hint and the squares a hint calls wrong, the goals' speed chips (DOM over the canvas,
// following the camera) and the ring a workings chip rings on its square. All of it reads the plan and the frame; nothing here imports the engine.
import * as F from "./pipes-gear-frac.js";

const PLATE_Y = 0.012;

export function createMarks({ THREE, G, P, look, root, host }) {
  const group = new THREE.Group();
  root.add(group);
  const copper = look.basic({ color: 0xc9743f, opacity: 0.95, side: 2 }), ok = look.basic({ color: 0x3fa878, opacity: 0.95, side: 2 }), bad = look.basic({ color: 0xe0503c, opacity: 0.95, side: 2 });
  const disc = look.basic({ color: 0x1a1612, opacity: 0.8, side: 2 });
  let cols = 1, rows = 1, clicks = [], dots = [], frames = [], geoms = [];
  const own = g => { geoms.push(g); return g; };
  let squareFrame = null, chipBox = null, chipList = [], pulses = new Set();

  const at = c => P.squareWorld(c, cols, rows);
  function clear() {
    for (const o of [...group.children]) group.remove(o);
    for (const g of geoms) g.dispose();
    geoms = []; clicks = []; dots = []; frames = [];
  }

  function setLevel(plan) {
    clear();
    cols = plan.cols; rows = plan.rows;
    squareFrame = own(G.frameGeometry(-0.45, 0.45, -0.45, 0.45, 0.035, 0.012));
    // a pinned piece with a goal carries a copper dot at its square's corner, as on the flat plate
    const dotG = own(G.slab(G.shapeOf(G.circle(0.075, 18)), 0.014, 0.003));
    for (const p of plan.pins || []) {
      if (!p.goal) continue;
      const [x, z] = at(p.c), m = new THREE.Mesh(dotG, copper);
      m.position.set(x - 0.34, PLATE_Y, z + 0.34);
      group.add(m);
    }
    // a click: a pawl ring and a big arrow on an empty square, a small stake with the arrow on the gear laid there
    const big = [own(G.arcArrowGeometry(0.27, 0.35, 5.4, 0.04, 0.1)), own(G.arcArrowGeometry(0.27, 0.35, 5.4, 0.04, 0.1))];
    const small = own(G.arcArrowGeometry(0.1, 0.35, 5.4, 0.022, 0.05)), ring = own(G.slab(G.shapeOf(G.circle(0.43, 40), [G.circle(0.4, 40)]), 0.012, 0.003)), plate = own(G.slab(G.shapeOf(G.circle(0.17, 24)), 0.02, 0.004));
    for (const k of plan.clicks || []) {
      const [x, z] = at(k.c), g = new THREE.Group(), s = new THREE.Group();
      g.position.set(x, PLATE_Y, z); s.position.set(x - 0.31, 0, z - 0.31);
      const ccw = k.dir === 1 || k.dir === "ccw";
      const arrow = new THREE.Mesh(big[0], copper), rim = new THREE.Mesh(ring, copper), tiny = new THREE.Mesh(small, copper), back = new THREE.Mesh(plate, disc);
      if (ccw) { arrow.scale.z = -1; tiny.scale.z = -1; }
      rim.material = copper; rim.renderOrder = 2;
      g.add(arrow, rim); s.add(back, tiny); tiny.position.y = 0.012;
      group.add(g, s);
      clicks.push({ c: k.c, g, s, tiny, arrow, rim });
    }
  }

  /** Squares marked with a frame: [{ c, bad }]. Kept as a pool of meshes. */
  function frameAt(list) {
    while (frames.length < list.length) { const m = new THREE.Mesh(squareFrame, copper); group.add(m); frames.push(m); }
    frames.forEach((m, i) => {
      const f = list[i];
      m.visible = !!f;
      if (!f) return;
      const [x, z] = at(f.c);
      m.position.set(x, 0.03, z); m.material = f.bad ? bad : copper;
    });
  }

  /** The frame's part: the clicks' states, the pins' goals, the frames of ghost and hint. */
  function update(frame, ghost, layerTop) {
    for (const k of clicks) {
      const laid = !!frame.laid?.[k.c], st = frame.res?.clicks?.[k.c] || "";
      k.g.visible = !laid; k.s.visible = laid;
      if (laid) { k.s.position.y = layerTop(k.c) + 0.03; k.tiny.material = st === "ok" ? ok : st === "bad" ? bad : copper; }
    }
    const list = [];
    const h = frame.hint;
    for (const c of h?.wrong || []) list.push({ c, bad: true });
    if (h?.piece !== undefined) list.push({ c: h.c });
    if (frame.ghost && frame.ghost.c != null) list.push({ c: frame.ghost.c, bad: frame.ghost.ok === false });
    frameAt(list);
  }

  // ---------- the goals' chips: DOM over the canvas ----------
  const text = cm => (cm.status === "ok" ? `×${F.fmt(cm.want, true)}` : cm.status === "off" ? `wants ×${F.fmt(cm.want, true)}` : cm.status === "wrong" ? "wrong way" : `×${F.fmt(cm.has, true)} → ×${F.fmt(cm.want, true)}`);
  function setChips(frame, byId) {
    if (!chipBox) { chipBox = document.createElement("div"); chipBox.className = "pi-chips"; host.append(chipBox); }
    chipList = [];
    for (const cm of frame.res?.comps || []) {
      if (!cm.want) continue;
      const r = byId.get(cm.c * 8 + cm.w);
      if (!r) continue;
      const span = document.createElement("span");
      span.className = `pi-chip ${cm.status}`;
      span.textContent = text(cm);
      chipList.push({ r, span });
    }
    chipBox.replaceChildren(...chipList.map(x => x.span));
  }
  /** Puts each chip over its wheel: `screenOf(x, y, z)` gives host pixels, `pxPer` the pixels in a world unit, `w` the host's width. */
  function placeChips(screenOf, pxPer, w, layerY) {
    for (const { r, span } of chipList) {
      const [x, y] = screenOf(r.wx, layerY(r.layer) + 0.1, r.wz), top = y - r.tip * pxPer - 4;
      const m = span.offsetWidth / 2 + 4;
      span.style.left = `${Math.round(Math.max(m, Math.min(w - m, x)))}px`;
      span.style.top = `${Math.round(Math.max(span.offsetHeight + 4, top))}px`;
    }
  }

  /** A ring on a square for a moment (a chip on the workings strip was tapped). */
  function pulse(c, screenOf, pxPer) {
    if (!chipBox) return;
    const [x, z] = at(c), [px, py] = screenOf(x, 0.1, z), d = document.createElement("span");
    d.className = "pi-pulse3";
    const s = pxPer * 0.92;
    d.style.cssText = `left:${px}px;top:${py}px;width:${s}px;height:${s}px`;
    chipBox.append(d);
    pulses.add(d);
    setTimeout(() => { d.remove(); pulses.delete(d); }, 1100);
  }

  return {
    setLevel, update, setChips, placeChips, pulse,
    dispose() { clear(); root.remove(group); chipBox?.remove(); chipBox = null; for (const d of pulses) d.remove(); },
  };
}
