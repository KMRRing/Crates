// Cartel's 3D table (Menu, View: 3D): Guandan's tipped mahogany cloth (table3d.js) with every opponent given a play zone of their
// own on it, and real things standing in the zones, drawn with three.js (vendor/three.js, kept on the device): a leather cup with a
// brass rim and the number of dice still hidden under it on its top, the dice they have shown as ivory and gold dice with pips,
// and your own dice, the same, in a row on your side of the table. Korbi, 8 Nov 2026: the left opponent halfway down the left
// side, the opposite one at the top, the right one mirroring the left, each with a region of their own; "the cups should be
// real cups and the dice should be real dice", the table larger, "the player dice should be on the player side of the table, and
// all of them should be real".
// The page (cartel.js) is still the master: its dice are the same elements on the flat table, and here they stay in the layout
// (invisible, so taps on them still reach the page's own handlers) while the scene draws a model of each where the element lies.
// So the zones lay the dice out, the cloth is DOM, and a transparent canvas laid over the table draws the objects: nothing in
// the scene decides anything. Drawn only when something moved.
import * as THREE from "./vendor/three.js";
import { CanvasTexture } from "./vendor/three-tex.js";
import { createCloth, slotOf } from "./table3d.js";
import { roundedBox, pipGeometry, showing } from "./dice-geo.js";
import { DIE } from "./yacht-3d-geo.js";

/** Where each opponent's zone is (centre x, centre y, width, height, in per cent of the mat), by how many opponents there are,
 *  in the order play goes round from you: the next seat on your left first. The middle of the cloth stays clear for the bid,
 *  and the bottom is your own. Every zone keeps EDGE per cent clear of the mat's sides, inside the rail and its brass line
 *  (Korbi, 10 Nov 2026: the side zones ran over the rim of the table). */
export const EDGE = 5;
export const ZONES = {
  1: [[50, 30, 66, 30]],
  2: [[23, 46, 34, 42], [77, 46, 34, 42]],
  3: [[20, 53, 29, 46], [50, 21, 38, 32], [80, 53, 29, 46]],
  4: [[21, 66, 31, 30], [35, 27, 30, 27], [65, 27, 30, 27], [79, 66, 31, 30]],
  5: [[21, 70, 31, 26], [21, 42, 31, 24], [50, 24, 36, 24], [79, 42, 31, 24], [79, 70, 31, 26]],
};

/** What a seat's dice come to, read from the page's dice (their labels say hidden or shown, and the kind): dice shown, the
 *  number still hidden, and the gold ones in all. */
export function tally(dice) {
  const shown = [];
  let hidden = 0, gold = 0;
  for (const d of dice) {
    const label = d.getAttribute?.("aria-label") || "", isGold = /gold/.test(label);
    if (isGold) gold++;
    if (label.startsWith("hidden")) hidden++; else shown.push(d);
  }
  return { shown, hidden, gold };
}

/** A die element's kind and number, from its label ("plain 3", "gold 4, Banker"); null for a hidden one. */
export function faceOf(el) {
  const m = /^(plain|gold) ([1-6])/.exec(el.getAttribute?.("aria-label") || "");
  return m ? { kind: m[1], value: Number(m[2]) } : null;
}

const tilt = k => ((k * 53 + 17) % 25) - 12;                      // each die lies at its own small angle, the same every draw
const ELEV = 56 * Math.PI / 180, SIN = Math.sin(ELEV), COS = Math.cos(ELEV);
const MOST = 160;                                                 // dice drawn at most (the rest are still in the page)
const IVORY = new THREE.Color(0xfbf4e4), PIP_IVORY = new THREE.Color(0x1c2a34), PIP_GOLD = new THREE.Color(0x2b1a02);

export function createCartel3d(host, { onLost = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });   // throws where there is no WebGL: the page draws flat
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "ct3-canvas";
  canvas.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 6000);         // one world unit is one pixel; the table is looked at from ELEV
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.7), hemi = new THREE.HemisphereLight(0xfff4e4, 0x4a3a2c, 1.05);
  sun.position.set(-600, 1100, 500);
  scene.add(sun, sun.target, hemi);

  const own = [];
  const track = o => { own.push(o); return o; };
  const std = (color, roughness, metalness = 0) => track(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  // Korbi, 8 Nov 2026: "make the dice pretty". Ivory dice are glossy; the gold ones are cast metal with dark pips, softer edges on both
  const matDie = std(0xffffff, 0.26), matPip = std(0xffffff, 0.45), matRed = std(0xc0262d, 0.4);
  const matGold = track(new THREE.MeshStandardMaterial({ color: 0xffc83a, roughness: 0.3, metalness: 0.62, emissive: 0x4a3200, emissiveIntensity: 0.55 }));
  const matLeather = std(0x6b3a1c, 0.62), matBrass = std(0xcaa23c, 0.34, 0.7);

  // ---------- the dice: one instanced body with its pips, for every die on the table ----------
  const bodyGeo = track(roundedBox(DIE, 0.13)), pipGeo = track(pipGeometry(false)), redGeo = track(pipGeometry(true));
  const body = new THREE.InstancedMesh(bodyGeo, matDie, MOST), gilt = new THREE.InstancedMesh(bodyGeo, matGold, MOST), pips = new THREE.InstancedMesh(pipGeo, matPip, MOST), reds = new THREE.InstancedMesh(redGeo, matRed, MOST);
  for (const m of [body, gilt, pips, reds]) { m.frustumCulled = false; m.count = 0; scene.add(m); }
  // a brass disc under a die of yours that you may pick, lit when it is picked
  const padGeo = track(new THREE.CylinderGeometry(0.64, 0.64, 0.04, 28));
  const pads = new THREE.InstancedMesh(padGeo, std(0xffffff, 0.4, 0.5), 40);
  pads.frustumCulled = false; pads.count = 0; scene.add(pads);

  // soft shadows on the cloth (the bundle has no shadow plane): a dark blob under every die and cup
  const blobTex = track((() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, "rgba(0,0,0,.8)"); g.addColorStop(.55, "rgba(0,0,0,.38)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new CanvasTexture(c); })());
  const blobGeo = track(new THREE.BoxGeometry(1, 0.002, 1));                  // (a thin slab: the bundle has no PlaneGeometry)
  const blobs = new THREE.InstancedMesh(blobGeo, track(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.85 })), MOST + 8);
  blobs.frustumCulled = false; blobs.renderOrder = -1; blobs.count = 0; scene.add(blobs);

  // ---------- the cups: leather beakers standing mouth down, a brass rim, the hidden count on the top ----------
  const cupGeo = track(new THREE.CylinderGeometry(0.5, 0.72, 1.25, 28)), rimGeo = track(new THREE.CylinderGeometry(0.76, 0.76, 0.14, 28)), bandGeo = track(new THREE.CylinderGeometry(0.58, 0.6, 0.1, 28));
  const capGeo = track(new THREE.CylinderGeometry(0.47, 0.47, 0.03, 28));
  const numbers = new Map();
  const numberMat = n => {
    if (!numbers.has(n)) {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      const x = c.getContext("2d"), g = x.createRadialGradient(64, 56, 8, 64, 64, 66);
      g.addColorStop(0, "#8C5A30"); g.addColorStop(1, "#4F2A12");
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      x.fillStyle = "#F6EEE6"; x.font = "800 84px Archivo, Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
      x.shadowColor = "rgba(0,0,0,.7)"; x.shadowBlur = 6;
      x.translate(64, 64); x.rotate(-Math.PI / 2);                                // (a cylinder's top is mapped turned a quarter)
      x.fillText(String(n), 0, 6);
      numbers.set(n, track(new THREE.MeshStandardMaterial({ map: track(new CanvasTexture(c)), roughness: 0.6 })));
    }
    return numbers.get(n);
  };
  const cupPool = [];
  const cupAt = i => {
    if (!cupPool[i]) {
      const group = new THREE.Group(), cup = new THREE.Mesh(cupGeo, matLeather), rim = new THREE.Mesh(rimGeo, matBrass), band = new THREE.Mesh(bandGeo, matBrass), cap = new THREE.Mesh(capGeo, [matBrass, matLeather, matBrass]);
      rim.position.y = 0.07; band.position.y = 1.2; cap.position.y = 1.26;
      cup.position.y = 0.625;
      group.add(cup, rim, band, cap);
      for (const m of group.children) m.frustumCulled = false;
      group.frustumCulled = false;
      scene.add(group);
      cupPool[i] = { group, cap };
    }
    return cupPool[i];
  };

  // ---------- the cloth (DOM) and what stands on it ----------
  let cloth = null, seats = 0, home = null, mineZone = null;
  const zones = new Map();
  let dice = [], cups = [];                                                  // what to draw: the page's elements, read each draw for where they lie

  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), POS = new THREE.Vector3(), SCL = new THREE.Vector3(), COL = new THREE.Color();
  let width = 1, height = 1, dead = false, frameId = 0, watchUntil = 0;
  const rectOf = (el, hr) => { const r = el.getBoundingClientRect(); return { cx: r.left + r.width / 2 - hr.left, cy: r.top + r.height / 2 - hr.top, w: r.width }; };
  /** A world position for a thing whose middle is to be at pixel (cx, cy) and `lift` above the cloth. */
  const world = (cx, cy, lift, out) => out.set(cx - width / 2, lift, (cy - height / 2 + lift * COS) / SIN);
  const blob = (n, x, z, size) => { M4.compose(POS.set(x + size * 0.1, 0.4, z + size * 0.08), Q.identity(), SCL.set(size * 1.6, 1, size * 1.6)); blobs.setMatrixAt(n, M4); };

  function draw() {
    frameId = 0;
    if (dead || !cloth) return;
    const hr = host.getBoundingClientRect();
    if (Math.round(hr.width) !== width || Math.round(hr.height) !== height) { width = Math.max(1, Math.round(hr.width)); height = Math.max(1, Math.round(hr.height)); resize(); }
    let nd = 0, ni = 0, ng = 0, np = 0, nb = 0;
    dice.slice(0, MOST).forEach(({ el, f, k, mine }) => {
      const r = rectOf(el, hr), s = r.w * (mine ? 0.92 : 0.9);
      if (!(s > 1)) return;
      const picked = el.classList.contains("picked"), pickable = el.classList.contains("pickable");
      const lift = s / 2 + (picked ? s * 0.22 : 0);
      world(r.cx, r.cy - (mine ? s * 0.26 : 0) + (picked ? s * 0.1 : 0), lift, POS);   // (yours stand clear of their captions)
      const x = POS.x, z = POS.z;
      M4.compose(POS, Q.copy(showing(f.value, mine ? 0 : tilt(k) * Math.PI / 180)), SCL.setScalar(s));
      if (f.kind === "gold") gilt.setMatrixAt(ng++, M4); else { body.setMatrixAt(ni, M4); body.setColorAt(ni++, IVORY); }
      pips.setMatrixAt(nd, M4); reds.setMatrixAt(nd, M4); pips.setColorAt(nd, f.kind === "gold" ? PIP_GOLD : PIP_IVORY);
      nd++;
      blob(nb++, x, z, s);
      if (mine && (pickable || picked) && np < 40) {
        M4.compose(POS.set(x, 0.8, z), Q.identity(), SCL.setScalar(s * 1.12));
        pads.setMatrixAt(np, M4); pads.setColorAt(np, COL.set(picked ? 0xe9c46a : 0x9aa79a)); np++;
      }
    });
    body.count = ni; gilt.count = ng; pips.count = reds.count = nd; pads.count = np;
    for (const m of [body, gilt, pips, reds, pads]) m.instanceMatrix.needsUpdate = true;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    if (pips.instanceColor) pips.instanceColor.needsUpdate = true;
    if (pads.instanceColor) pads.instanceColor.needsUpdate = true;
    cupPool.forEach(c => { c.group.visible = false; });
    cups.forEach(({ el, n }, i) => {
      const r = rectOf(el, hr), S = r.w * 0.62, c = cupAt(i);
      c.group.visible = true;
      c.group.scale.setScalar(S);
      world(r.cx, r.cy, S * 0.625, POS);
      c.group.position.set(POS.x, 0, POS.z);
      c.cap.material[1] = numberMat(n);
      blob(nb++, POS.x, POS.z, S * 1.4);
    });
    blobs.count = nb;
    blobs.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
    if (performance.now() < watchUntil) frameId = requestAnimationFrame(draw);       // the cloth settling in after a change: follow it
  }
  const redraw = (ms = 0) => { if (ms) watchUntil = Math.max(watchUntil, performance.now() + ms); if (!frameId && !dead) frameId = requestAnimationFrame(draw); };
  function resize() {
    renderer.setPixelRatio(Math.max(1, Math.min(devicePixelRatio || 1, 2, Math.sqrt(2.4e6 / (width * height)))));
    renderer.setSize(width, height, false);
    camera.left = -width / 2; camera.right = width / 2; camera.top = height / 2; camera.bottom = -height / 2;
    camera.position.set(0, SIN * 2500, COS * 2500);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(() => redraw());
  ro.observe(host);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); onLost(); });
  canvas.addEventListener("webglcontextrestored", () => redraw());

  /**
   * model: { n (seats at the table), me (your seat, 0 when watching), seats: the page's seat elements (data-seat, with
   * .ct-dice inside and the classes turn, out, targetable, picked), centre: the page's middle element, mine: your box (its
   * .ct-dice are taken onto the cloth), die: the dice's size }.
   */
  function sync(model) {
    const { n, me, centre } = model;
    if (!cloth || seats !== n) {
      cloth = createCloth(host, { seats: n });
      host.append(canvas);
      seats = n;
      zones.clear();
      mineZone = document.createElement("div");
      mineZone.className = "ct-mine ct3-mine";
      cloth.mat.append(mineZone);
      home ||= { parent: centre.parentNode, next: centre.nextSibling };
      width = height = 0;
    }
    cloth.mat.style.setProperty("--seat-die", model.die || "1rem");
    if (centre.parentNode !== cloth.centre) cloth.centre.append(centre);
    const rooms = ZONES[Math.max(1, Math.min(5, n - 1))];
    dice = []; cups = [];
    for (const el of model.seats) {
      const i = Number(el.dataset.seat), slot = slotOf(i, me, n), [x, y, w, h] = rooms[Math.max(0, slot - 1)] || rooms[0];
      let z = zones.get(i);
      if (!z) { z = document.createElement("div"); cloth.mat.append(z); zones.set(i, z); }
      const has = c => el.classList.contains(c);
      z.className = `ct3-zone${has("turn") ? " on" : ""}${has("out") ? " out" : ""}${has("targetable") ? " tobeat" : ""}${has("picked") ? " picked" : ""}`;
      z.style.cssText = `left:${x}%;top:${y}%;width:${w}%;height:${h}%`;
      z.onclick = has("targetable") ? () => el.click() : null;
      const name = el.querySelector(".ct-plaque b")?.textContent || `Seat ${i + 1}`, who = name.replace(/ · out$/, "");
      const t = tally([...(el.querySelector(".ct-dice")?.children || [])]);
      const head = document.createElement("div"), cup = document.createElement("div"), board = document.createElement("div"), play = document.createElement("div");
      head.className = "ct3-head";
      head.innerHTML = `<span class="tk-s${((i % 6) + 6) % 6}"><span class="tk-med" aria-hidden="true"><b></b></span></span><b class="ct3-name"></b><span class="ct3-gold" title="Gold dice"><i aria-hidden="true"></i><span></span></span>`;
      head.querySelector(".tk-med b").textContent = [...who.trim()][0]?.toUpperCase() || "?";
      head.querySelector(".ct3-name").textContent = name;
      head.querySelector(".ct3-gold span").textContent = `×${t.gold}`;
      cup.className = "ct3-cup";
      cup.title = `${t.hidden} hidden ${t.hidden === 1 ? "die" : "dice"}`;
      cup.hidden = !t.hidden;
      board.className = "ct3-board";
      t.shown.forEach((d, k) => { board.append(d); const f = faceOf(d); if (f) dice.push({ el: d, f, k: i * 7 + k, mine: false }); });
      if (t.hidden) cups.push({ el: cup, n: t.hidden });
      play.className = "ct3-play";
      play.append(cup, board);
      z.replaceChildren(head, play);
    }
    // your own dice, on your side of the table
    const row = model.mine?.querySelector(":scope > .ct-dice"), figs = row ? [...row.children] : [];
    if (row) {
      const k = Math.max(1, Number(model.scale) || 1), gap = (figs.length > 7 ? 4 : 7) * k;
      const room = cloth.mat.offsetWidth * 0.8, die = Math.max(18 * k, Math.min(40 * k, Math.floor((room - (figs.length - 1) * gap) / Math.max(1, figs.length))));
      mineZone.style.setProperty("--mine-gap", `${gap}px`);
      mineZone.style.setProperty("--mine-die", `${die}px`);
      for (const svg of row.querySelectorAll("svg")) svg.style.width = svg.style.height = "var(--mine-die)";
      const lives = figs.filter(fig => faceOf(fig.querySelector("svg") || fig)?.kind === "gold").length, chip = document.createElement("div");
      chip.className = "ct3-gold ct3-mine-gold";
      chip.innerHTML = `<i aria-hidden="true"></i><span></span>`;
      chip.querySelector("span").textContent = `${lives} gold ${lives === 1 ? "die" : "dice"}`;
      mineZone.replaceChildren(row, chip);
      figs.forEach((fig, k2) => { const svg = fig.querySelector("svg"), f = svg && faceOf(svg); if (f) dice.push({ el: svg, f, k: k2, mine: true }); });
    } else mineZone.replaceChildren();
    redraw(700);
  }

  return {
    sync,
    reset() {},
    /** For tests: what the scene is drawing (dice and cups), as the page's elements give it. */
    get drawn() { return { dice: dice.length, cups: cups.map(c => c.n), mine: dice.filter(d => d.mine).length }; },
    dispose() {
      dead = true;
      cancelAnimationFrame(frameId);
      ro.disconnect();
      if (cloth && home && cloth.centre.firstElementChild) home.parent.insertBefore(cloth.centre.firstElementChild, home.next);   // the middle goes back to the page
      for (const o of own) o.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
      host.replaceChildren();
      cloth = null;
      zones.clear();
    },
  };
}
