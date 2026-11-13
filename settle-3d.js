// Settle's foundry in 3D, drawn with three.js (vendor/three.js, kept on the device, so it works offline). 13 November 2026, Korbi: "also
// visual overhaul please. it should be beautifully animated 3D". A brick hearth, its back wall lit by the fire; on it a row of clay-and-
// graphite crucibles cut away at the front, so the metal stands in them in layers, each in its own colour and sheen, glowing with the heat
// (the top of each crucible a molten skin that shimmers); a solid lump of cold copper sits rough and dark until its crucible is fired, and
// a fired crucible has coals glowing under it; the melting pot is the first and wider one. A pour is a bright stream falling into the
// crucible; a block that is cast flares white-gold. The page keeps the game and the touches: this module is handed what the 2D board
// shows (`draw`) and answers where the crucibles are on the screen (`crucibleAt`, `cellRect`, for the page's own sparks and figures, which
// it draws over this on its 2D canvas). Throws where there is no WebGL (the page then keeps the 2D board).
// Frame cost: a few dozen meshes, one shadowless key light and a sky light, pixel ratio at most 2; nothing is made per frame.
import * as THREE from "./vendor/three.js";
import { CanvasTexture } from "./vendor/three-tex.js";
import { METALS } from "./settle-alloys.js";

const DOUBLE = 2, ADD = 2;                                    // THREE.DoubleSide and AdditiveBlending (not in the bundle's exports)
const SP = 1.25, R = 0.5, SLAB = 0.34, BASE = 0.22;           // crucible spacing, inner radius, a parcel's height, the crucible's foot
const TILT = 20 * Math.PI / 180;                              // the camera looks down this much into the crucibles

/** A texture drawn on a canvas by `draw(ctx, size)`. */
function drawn(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = "srgb";
  return t;
}
/** Firebrick: courses of brick with mortar, each brick its own shade, soot towards the top. */
const bricks = () => drawn(512, 256, (c, w, h) => {
  c.fillStyle = "#2a1a12"; c.fillRect(0, 0, w, h);
  const bw = 64, bh = 28;
  for (let y = 0, row = 0; y < h; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < w; x += bw) {
    const k = ((x * 13 + y * 7) % 23) / 23, r = 120 + 50 * k, g = 52 + 22 * k, b = 34 + 10 * k;
    c.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`; c.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    c.fillStyle = "rgba(255,190,120,.08)"; c.fillRect(x + 3, y + 3, bw - 6, 4);
  }
  const soot = c.createLinearGradient(0, 0, 0, h); soot.addColorStop(0, "rgba(10,6,4,.75)"); soot.addColorStop(.7, "rgba(10,6,4,.1)"); soot.addColorStop(1, "rgba(10,6,4,0)");
  c.fillStyle = soot; c.fillRect(0, 0, w, h);
});
/** A soft round glow, white at the middle, for additive light. */
const glowTex = () => drawn(128, 128, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.35, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, w, w); });
/** A metal's alchemical sign, stamped dark on a clear ground, for the front of each layer. */
const signTex = m => drawn(128, 128, (c, w) => {
  c.translate(w / 2 - 36, w / 2 - 36); c.scale(3, 3);
  c.strokeStyle = "rgba(16,10,6,.78)"; c.lineWidth = 2.2; c.lineCap = "round"; c.lineJoin = "round";
  c.stroke(new Path2D(METALS[m].glyph));
});

// the heat each metal glows with as it stands molten (dross and charcoal do not glow)
const HEAT = { Pb: 0.16, Sn: 0.12, Cu: 0.3, Zn: 0.14, Bz: 0.26, Bk: 0.22, Pr: 0.2, X: 0, C: 0.05 };

export function createFoundry(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "st-gl";
  canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);

  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 60);
  const key = new THREE.DirectionalLight(0xfff1dc, 1.6), fire = new THREE.DirectionalLight(0xff8a3c, 1.4), sky = new THREE.HemisphereLight(0xffd9b0, 0x2a1408, 0.7);
  key.position.set(-4, 7, 6); fire.position.set(2, -1, 5);
  scene.add(key, fire, sky);

  // the reflections: a foundry, warm firelight from the hearth's mouth below and in front, a dim sooty roof
  const ENV_GLSL = `vec3 stEnv(vec3 R, float soft) {
      vec3 col = mix(vec3(0.06, 0.03, 0.02), vec3(0.32, 0.22, 0.16), smoothstep(-0.5, 0.9, R.y));
      col += vec3(1.6, 0.72, 0.28) * smoothstep(0.35 + soft, 0.95, dot(R, normalize(vec3(0.1, -0.35, 0.93))));
      col += vec3(0.9, 0.8, 0.7) * pow(max(dot(R, normalize(vec3(-0.45, 0.7, 0.55))), 0.0), 24.0) / (1.0 + soft * 8.0);
      return col;
    }`;
  function envify(mat, k = 1) {
    mat.customProgramCacheKey = () => `stenv${k}`;
    mat.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace("void main() {", `${ENV_GLSL}\nvoid main() {`).replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
        {
          vec3 rv = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
          float nv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
          vec3 F0 = mix(vec3(0.04), diffuseColor.rgb, metalnessFactor);
          vec3 F = F0 + (vec3(1.0) - F0) * pow(1.0 - nv, 5.0) * (1.0 - material.roughness);
          reflectedLight.indirectSpecular += stEnv(rv, material.roughness) * F * ${(k * 1.4).toFixed(2)};
        }`);
    };
    return mat;
  }
  const std = o => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, ...o });
  const glow = glowTex();
  const M = {
    brick: std({ map: bricks(), roughness: 0.95, color: 0x9a7c6c }),
    hearth: std({ color: 0x3a2418, roughness: 0.95 }),
    clay: envify(std({ color: 0x5a4a40, roughness: 0.82, metalness: 0.1 }), 0.4),
    clayIn: std({ color: 0x1c1512, roughness: 0.92, side: DOUBLE, emissive: 0xff5a10, emissiveIntensity: 0.0 }),
    rim: envify(std({ color: 0x8a7464, roughness: 0.55, metalness: 0.2 }), 0.6),
    coals: new THREE.MeshBasicMaterial({ map: glow, color: 0xff6a1c, transparent: true, depthWrite: false, blending: ADD, opacity: 0.9 }),
    halo: new THREE.MeshBasicMaterial({ map: glow, color: 0xffb060, transparent: true, depthWrite: false, blending: ADD, opacity: 0.35 }),
    target: new THREE.MeshBasicMaterial({ map: glow, color: 0xffd47a, transparent: true, depthWrite: false, blending: ADD, opacity: 0.55 }),
    lump: envify(std({ color: 0x6a3a22, roughness: 0.75, metalness: 0.5, flatShading: true }), 0.5),
  };
  /** A metal's three looks: as it stands, flaring as it is cast, and the ghost of where a held parcel would settle. */
  const metal = {};
  for (const [m, k] of Object.entries(METALS)) {
    const base = new THREE.Color(k.base), dull = m === "X" || m === "C";
    metal[m] = {
      body: envify(std({ color: base, metalness: dull ? 0 : 0.75, roughness: dull ? 0.95 : 0.3 - 0.15 * k.shine, emissive: new THREE.Color(0xff6a20).lerp(base, 0.35), emissiveIntensity: HEAT[m] ?? 0.1 }), dull ? 0.2 : 1),
      flash: std({ color: 0xfff0c0, emissive: 0xffd88a, emissiveIntensity: 1.6 }),
      ghost: std({ color: base, transparent: true, opacity: 0.45, depthWrite: false, emissive: base, emissiveIntensity: 0.5 }),
      sign: new THREE.MeshBasicMaterial({ map: signTex(m), transparent: true, depthWrite: false }),
    };
  }
  const slabGeo = new THREE.CylinderGeometry(R - 0.02, R - 0.02, SLAB * 0.96, 40), skinGeo = new THREE.CylinderGeometry(R - 0.03, R - 0.03, 0.012, 40);
  const signGeo = new THREE.BoxGeometry(SLAB * 0.8, SLAB * 0.8, 0.001), lumpGeo = new THREE.IcosahedronGeometry(R * 0.62, 1), quad = new THREE.BoxGeometry(1, 1, 0.001);
  lumpGeo.scale(1, 0.42, 1);

  const world = new THREE.Group();
  scene.add(world);
  let cols = 0, height = 0, pots = [], cells = [], streams = [], wall = null, floor = null;
  const at = (c, l) => [(c - (cols - 1) / 2) * SP, BASE + (l + 0.5) * SLAB];

  /** Builds the hearth and a row of crucibles for so many crucibles so many parcels high (again when a level of another size opens). */
  function layout(nc, nh) {
    if (nc === cols && nh === height) return;
    cols = nc; height = nh;
    world.clear();
    const W = cols * SP + 1.2, H = BASE + height * SLAB + 1.4;
    // the wall and the hearth reach well past the view, so the foundry fills the board whatever its shape
    wall = new THREE.Mesh(new THREE.BoxGeometry(W + 30, H + 30, 0.2), M.brick);
    wall.position.set(0, H / 2 + 6, -R - 0.55);
    M.brick.map.repeat.set((W + 30) / 2.4, (H + 30) / 1.2); M.brick.map.wrapS = M.brick.map.wrapT = 1000;
    floor = new THREE.Mesh(new THREE.BoxGeometry(W + 30, 0.3, 30), M.hearth);
    floor.position.set(0, -0.15, 14);
    world.add(wall, floor);
    pots = []; cells = []; streams = [];
    for (let c = 0; c < cols; c++) {
      const g = new THREE.Group(), [x] = at(c, 0), tall = BASE + height * SLAB + 0.12;
      g.position.x = x;
      // the crucible: the back of a tapered shell, cut away in front (three.js puts theta 0 towards the camera), its inside dark until
      // fired, a foot and a rolled rim
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.07, R - 0.02, tall, 36, 1, true, Math.PI * 0.3, Math.PI * 1.4), M.clay);
      shell.position.y = tall / 2;
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.01, R - 0.05, tall - 0.02, 36, 1, true, Math.PI * 0.3, Math.PI * 1.4), M.clayIn.clone());
      inner.position.y = tall / 2 + 0.01;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.08, BASE, 36), M.clay);
      foot.position.y = BASE / 2;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.1, R + 0.08, 0.06, 36, 1, true, Math.PI * 0.3, Math.PI * 1.4), M.rim);
      rim.position.y = tall;
      const coals = new THREE.Mesh(quad, M.coals.clone()); coals.scale.set(R * 3.2, R * 1.6, 1); coals.position.set(0, 0.05, R + 0.3);
      const halo = new THREE.Mesh(quad, M.halo); halo.scale.set(R * 3, tall * 1.1, 1); halo.position.set(0, tall / 2, -R - 0.3);
      const target = new THREE.Mesh(quad, M.target); target.scale.set(R * 3.4, tall * 1.25, 1); target.position.set(0, tall / 2, -R - 0.32);
      g.add(halo, target, shell, inner, foot, rim, coals);
      world.add(g);
      const row = [];
      for (let l = 0; l < height; l++) {
        const slab = new THREE.Mesh(slabGeo, metal.Sn.body), sign = new THREE.Mesh(signGeo, metal.Sn.sign), skin = new THREE.Mesh(skinGeo, metal.Sn.body), lump = new THREE.Mesh(lumpGeo, M.lump);
        const y = at(c, l)[1];
        slab.position.set(x, y, 0); sign.position.set(x, y, R - 0.01); skin.position.set(x, y + SLAB * 0.49, 0); lump.position.set(x, y, 0);
        world.add(slab, sign, skin, lump);
        row.push({ slab, sign, skin, lump });
      }
      cells.push(row);
      const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1, 12), metal.Sn.body);
      stream.visible = false; world.add(stream); streams.push(stream);
      pots.push({ g, inner, coals, halo, target, tall });
    }
    resize();
  }

  let w = 1, h = 1;
  /** Fits the camera to the row of crucibles and the room above them for a pour. */
  function resize() {
    w = Math.max(1, host.clientWidth); h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    const W = cols * SP + 0.5, H = (BASE + height * SLAB + 0.55) * Math.cos(TILT) + 0.9, aspect = w / h;
    const half = Math.max(W / 2, H / 2 * aspect);
    camera.left = -half; camera.right = half; camera.top = half / aspect; camera.bottom = -half / aspect;
    const cy = Math.max((BASE + height * SLAB) / 2 + 0.2, (camera.top - 0.35) / Math.cos(TILT) - 0.1), d = 20;    // the hearth's floor near the foot of the board
    camera.position.set(0, cy + Math.sin(TILT) * d, Math.cos(TILT) * d);
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const v = new THREE.Vector3();
  /** A point of the world on the screen, in CSS pixels from the canvas's top left. */
  const screen = (x, y, z) => { v.set(x, y, z).project(camera); return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h]; };
  /** The rectangle of a parcel's front on the screen: { x, y, w, h }. */
  function cellRect(c, l) {
    const [x, y] = at(c, l), [x0, y0] = screen(x - R, y + SLAB / 2, R), [x1, y1] = screen(x + R, y - SLAB / 2, R);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  /** The crucible under a point (CSS pixels, relative to the canvas), anywhere over its column, or -1. */
  function crucibleAt(px) {
    for (let c = 0; c < cols; c++) { const [x] = at(c, 0), [a] = screen(x - SP / 2, 0, 0), [b] = screen(x + SP / 2, 0, 0); if (px >= a && px <= b) return c; }
    return -1;
  }

  /** Draws the foundry as the board shows it: { tanks, ghost, ring, flash, stream, target, hot, pot }, at time now (ms). */
  function draw(st, now) {
    if (!cols) return;
    const flash = new Set((st.flash || []).map(([c, l]) => `${c},${l}`)), ring = new Set((st.ring || []).map(([c, l]) => `${c},${l}`));
    for (let c = 0; c < cols; c++) {
      const t = st.tanks[c] || [], P = pots[c], hot = !!st.hot?.[c], wide = st.pot && c === 0 ? 1.12 : 1;
      P.g.scale.set(wide, 1, wide);
      P.coals.visible = hot;
      P.coals.material.opacity = 0.65 + 0.3 * Math.sin(now / 260 + c * 2);
      P.inner.material.emissiveIntensity = hot ? 0.3 + 0.08 * Math.sin(now / 340 + c) : 0.03;
      P.halo.material.opacity = 0.2 + 0.08 * Math.sin(now / 900 + c);
      P.target.visible = st.target === c;
      for (let l = 0; l < height; l++) {
        const cell = cells[c][l], p = t[l], ghost = st.ghost && st.ghost.c === c && st.ghost.level === l ? st.ghost : null, top = l === t.length - 1;
        const show = (p && !p.s) || (ghost && !ghost.s), lump = (p && p.s && !ghost) || ghost?.s;
        const m = (ghost ? ghost.m : p?.m) || "Sn", look = metal[m] || metal.Sn;
        cell.slab.visible = !!show;
        cell.slab.material = ghost ? look.ghost : flash.has(`${c},${l}`) ? look.flash : look.body;
        cell.slab.scale.set(wide, 1, wide);
        cell.sign.visible = cell.slab.visible; cell.sign.material = look.sign;
        cell.lump.visible = !!lump;
        cell.lump.rotation.y = c * 1.7 + l;
        // the molten top shimmers: a skin a little brighter, breathing
        cell.skin.visible = !!(show && top);
        if (cell.skin.visible) { cell.skin.material = look.body; cell.skin.position.y = at(c, l)[1] + SLAB * 0.49 + Math.sin(now / 420 + c * 1.3) * 0.006; }
        const lift = ring.has(`${c},${l}`) ? 0.03 * (0.5 + 0.5 * Math.sin(now / 120)) : 0;
        cell.slab.position.z = lift; cell.sign.position.z = R - 0.01 + lift;
      }
      const s = streams[c];
      if (st.stream && st.stream.c === c) {
        const k = Math.min(1, (now - st.stream.t0) / 260), topY = BASE + height * SLAB + 1.1, toY = BASE + t.length * SLAB, len = Math.max(0.01, (topY - toY) * k);
        s.visible = true; s.material = (metal[st.stream.m] || metal.Sn).body;
        s.scale.set(1, len, 1); s.position.set(at(c, 0)[0], topY - len / 2, 0.05);
      } else s.visible = false;
    }
    renderer.render(scene, camera);
  }
  function destroy() { renderer.dispose(); canvas.remove(); }
  return { layout, draw, resize, crucibleAt, cellRect, destroy, canvas };
}
