// Settle's foundry in 3D (rebuilt 23 November 2026, Korbi: "the 3D view needs to be rebuilt and beautiful and topical"), drawn with
// three.js (vendor/three.js, kept on the device, so it works offline). A brick furnace room lit by its hearth: a bed of coals glowing
// under a row of fired-clay crucibles, each cut away at the front as the old smelting books drew them, so the molten metal shows in
// layers by weight, each glowing in its own colour with its alchemical sign; embers drift up past the soot-black wall. A pour lifts
// the crucible over the one it pours into and tips it; a bright stream falls; what is heavier sinks through what is lighter. A cast
// flares white-gold, throws sparks and drains away. The same scene as the 2D view (settle-draw.js), handed over each frame by the page.
// Throws where there is no WebGL (the page then keeps the 2D foundry).
// Frame cost: a few dozen meshes, two lights, one instanced mesh for sparks and embers, pixel ratio at most 2; nothing is made per frame.
import * as THREE from "./vendor/three.js";
import { CanvasTexture } from "./vendor/three-tex.js";
import { METALS } from "./settle-alloys.js";

const DOUBLE = 2, ADD = 2;                                    // THREE.DoubleSide and AdditiveBlending (not in the bundle's exports)
const R = 0.5, SLAB = 0.52, BASE = 0.2, GAP = 0.3;            // a crucible's inner radius, a measure's height, its foot, the room between
const CUT = Math.PI * 0.62;                                   // how much of the front is cut away

function drawn(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = "srgb";
  return t;
}
/** Firebrick, sooty above, warmer where the hearth lights it. */
const bricks = () => drawn(512, 256, (c, w, h) => {
  c.fillStyle = "#1c120d"; c.fillRect(0, 0, w, h);
  const bw = 64, bh = 28;
  for (let y = 0, row = 0; y < h; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < w; x += bw) {
    const k = ((x * 13 + y * 7) % 23) / 23, r = 96 + 46 * k, g = 44 + 20 * k, b = 30 + 10 * k;
    c.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`; c.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    c.fillStyle = "rgba(255,190,120,.07)"; c.fillRect(x + 3, y + 3, bw - 6, 4);
  }
});
const glowTex = () => drawn(128, 128, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, w, w); });
/** A metal's sign, stamped on a clear ground, for the cut face of each layer. */
const signTex = m => drawn(128, 128, (c, w) => {
  c.translate(w / 2 - 36, w / 2 - 36); c.scale(3, 3);
  c.strokeStyle = METALS[m].shine > 0.6 ? "rgba(30,20,14,.7)" : "rgba(255,236,210,.75)"; c.lineWidth = 2.2; c.lineCap = "round"; c.lineJoin = "round";
  c.stroke(new Path2D(METALS[m].glyph));
});
// how much each metal glows as it stands molten
const HEAT = { Pb: 0.32, Cu: 0.45, Sn: 0.28 };

export function createFoundry(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setClearColor(0x0d0806, 1);
  const canvas = renderer.domElement;
  canvas.className = "st-canvas";
  canvas.setAttribute("role", "img");
  host.append(canvas);

  const scene = new THREE.Scene();
  // a perspective camera made from an orthographic one's parts (the bundle has none), as Chess's is
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.isOrthographicCamera = false; camera.isPerspectiveCamera = true; camera.updateProjectionMatrix = () => {};
  const FOV = 34 * Math.PI / 180;
  const key = new THREE.DirectionalLight(0xffe2c0, 1.1), fire = new THREE.DirectionalLight(0xff7a2c, 2.2), sky = new THREE.HemisphereLight(0xffc896, 0x1a0c06, 0.45);
  key.position.set(-3, 6, 5); fire.position.set(0.5, -2, 4);
  scene.add(key, fire, sky);

  // reflections of a furnace room: dark soot above, the hearth's orange glow below and in front
  const ENV = `vec3 stEnv(vec3 R, float soft) {
      vec3 col = mix(vec3(0.05, 0.025, 0.015), vec3(0.22, 0.14, 0.1), smoothstep(-0.5, 0.9, R.y));
      col += vec3(1.8, 0.75, 0.26) * smoothstep(0.3 + soft, 0.95, dot(R, normalize(vec3(0.0, -0.45, 0.89))));
      return col;
    }`;
  function envify(mat, k = 1) {
    mat.customProgramCacheKey = () => `stenv${k}`;
    mat.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace("void main() {", `${ENV}\nvoid main() {`).replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
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
  const brickTex = bricks();
  brickTex.wrapS = brickTex.wrapT = 1000;
  const M = {
    brick: std({ map: brickTex, roughness: 0.95, color: 0x8a6a5a }),
    hearth: std({ color: 0x2a1910, roughness: 0.95 }),
    clay: envify(std({ color: 0x8a5634, roughness: 0.8, metalness: 0.05 }), 0.35),
    clayIn: std({ color: 0x140b07, roughness: 0.95, side: DOUBLE, emissive: 0xff4a10, emissiveIntensity: 0.05 }),
    cutFace: std({ color: 0x6a3d24, roughness: 0.9, side: DOUBLE }),
    rim: envify(std({ color: 0xb57a4c, roughness: 0.55, metalness: 0.1 }), 0.5),
    coals: new THREE.MeshBasicMaterial({ map: glow, color: 0xff5a14, transparent: true, depthWrite: false, blending: ADD, opacity: 0.85 }),
    ring: new THREE.MeshBasicMaterial({ map: glow, color: 0xffcf7a, transparent: true, depthWrite: false, blending: ADD, opacity: 0 }),
    spark: new THREE.MeshBasicMaterial({ map: glow, color: 0xffc070, transparent: true, depthWrite: false, blending: ADD }),
  };
  const signs = Object.fromEntries(["Pb", "Cu", "Sn"].map(m => [m, new THREE.MeshBasicMaterial({ map: signTex(m), transparent: true, depthWrite: false })]));
  /** A layer's own material (its opacity and heat change while it is cast), dressed as metal m. */
  const layerMat = () => envify(std({}), 0.7);
  // each metal keeps its own colour (lead blue-grey, copper red, tin silver) with a little heat of its own; a cast runs white-gold
  const dress = (mat, m, hot = 0, a = 1) => {
    const k = METALS[m];
    mat.color.set(k.base).lerp(new THREE.Color(0xfff2c8), hot * 0.8);
    mat.metalness = 0.55; mat.roughness = 0.38 - 0.18 * k.shine;
    mat.emissive.set(k.base).lerp(new THREE.Color(0xff7a30), 0.25).lerp(new THREE.Color(0xffe0a0), hot);
    mat.emissiveIntensity = (HEAT[m] ?? 0.2) + hot * 2.2;
    mat.opacity = a; mat.transparent = a < 0.99; mat.depthWrite = a > 0.98;
  };

  const world = new THREE.Group();
  scene.add(world);
  const room = new THREE.Group();
  world.add(room);
  // the wall and the hearth, well past the view whatever its shape
  const wall = new THREE.Mesh(new THREE.BoxGeometry(60, 40, 0.2), M.brick);
  wall.position.set(0, 18, -1.6);
  brickTex.repeat.set(60 / 2.6, 40 / 1.3);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(60, 0.3, 30), M.hearth);
  floor.position.set(0, -0.15, 13);
  room.add(wall, floor);
  const quad = new THREE.BoxGeometry(1, 1, 0.001);          // (the bundle has no PlaneGeometry: a thin box serves)
  const coals = [];
  for (let k = 0; k < 9; k++) {
    const c = new THREE.Mesh(quad, M.coals.clone());
    c.rotation.x = -Math.PI / 2; c.position.set(0, 0.02, 0.4); coals.push(c); room.add(c);
  }
  const wallGlow = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: glow, color: 0xff7a2a, transparent: true, depthWrite: false, blending: ADD, opacity: 0.35 }));
  // soot: the wall darkens upward, away from the fire, so the eye stays on the crucibles
  const soot = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: drawn(4, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "rgba(8,4,3,.97)"); g.addColorStop(0.55, "rgba(8,4,3,.7)"); g.addColorStop(1, "rgba(8,4,3,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h); }) }));
  soot.scale.set(60, 8, 1); soot.position.set(0, 5.2, -1.45);
  room.add(wallGlow, soot);

  // sparks and embers: one instanced mesh of glowing quads facing the camera
  const N_FX = 90;
  const fx = new THREE.InstancedMesh(quad, M.spark, N_FX);
  fx.frustumCulled = false;
  scene.add(fx);
  const embers = Array.from({ length: 30 }, (_, i) => ({ x: Math.random() * 2 - 1, z: Math.random() * 0.8 - 0.6, s: 0.6 + Math.random() * 0.8, p: i * 1.7 }));
  let sparks = [];

  let caps = [], pots = [], xs = [], tallOf = [], span = 1;
  const slabGeo = new THREE.CylinderGeometry(R - 0.015, R - 0.015, 1, 40);
  const signGeo = new THREE.BoxGeometry(SLAB * 0.72, SLAB * 0.72, 0.001);
  function layout(c) {
    caps = c.slice();
    for (const p of pots) world.remove(p.g);
    pots = [];
    const n = caps.length;
    xs = caps.map((_, i) => (i - (n - 1) / 2) * (2 * R + 0.24 + GAP));
    span = n * (2 * R + 0.24) + (n - 1) * GAP;
    tallOf = caps.map(k => BASE + k * SLAB + 0.08);
    caps.forEach((k, i) => {
      const g = new THREE.Group(), tall = tallOf[i];
      // the crucible: a tapered shell of fired clay cut away in front (three.js puts theta 0 towards the camera), its dark inside,
      // the clay's cut edges, a foot and a rolled rim
      const th0 = CUT / 2, thL = Math.PI * 2 - CUT;
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.1, R + 0.02, tall, 40, 1, true, th0, thL), M.clay);
      shell.position.y = tall / 2;
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.01, R - 0.04, tall - 0.02, 40, 1, true, th0, thL), M.clayIn);
      inner.position.y = tall / 2 + 0.01;
      /** The clay's section where the shell is cut, at angle a (its wall between the inside and the outside). */
      const cut = a => {
        const sh = new THREE.Shape();
        sh.moveTo(R - 0.04, -tall / 2); sh.lineTo(R + 0.02, -tall / 2); sh.lineTo(R + 0.1, tall / 2); sh.lineTo(R + 0.01, tall / 2); sh.closePath();
        const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), M.cutFace);
        m.position.y = tall / 2; m.rotation.y = a - Math.PI / 2;     // the shape's x turned to the radius at a
        return m;
      };
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.02, R - 0.06, BASE, 40), M.clay);
      foot.position.y = BASE / 2;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.14, R + 0.12, 0.06, 40, 1, true, th0, thL), M.rim);
      rim.position.y = tall;
      const ring = new THREE.Mesh(quad, M.ring.clone());
      ring.rotation.x = -Math.PI / 2; ring.scale.set(R * 3.4, R * 2.2, 1); ring.position.set(0, tall + 0.02, 0);
      g.add(shell, inner, cut(th0), cut(th0 + thL), foot, rim, ring);
      const layers = Array.from({ length: k + 2 }, () => {
        const slab = new THREE.Mesh(slabGeo, layerMat()), sign = new THREE.Mesh(signGeo, signs.Sn);
        g.add(slab, sign);
        return { slab, sign };
      });
      g.position.x = xs[i];
      world.add(g);
      pots.push({ g, ring, layers, tall });
    });
    // the coals under the row
    coals.forEach((c, k) => { c.position.x = (k / (coals.length - 1) - 0.5) * span * 1.05; c.scale.set(1.2, 1.1, 1); });
    wallGlow.scale.set(span * 2.2, 3.2, 1); wallGlow.position.set(0, 1.2, -1.45);
    resize();
  }

  // the stream: short glowing segments along its curve
  const N_SEG = 14, segGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 10);
  const streamMat = layerMat();
  const segs = Array.from({ length: N_SEG }, () => { const s = new THREE.Mesh(segGeo, streamMat); s.visible = false; world.add(s); return s; });

  let w = 1, h = 1, look = new THREE.Vector3(), dist = 10;
  function resize() {
    w = Math.max(1, host.clientWidth); h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    if (!caps.length) return;
    // fit the row and the room above it for a pour, looking down a little
    const aspect = w / h, tall = Math.max(...tallOf), needW = span + 0.45, needH = tall + 1.5;
    const t = Math.tan(FOV / 2), d = Math.max(needH / 2 / t, needW / 2 / (t * aspect)) + 1.2;
    dist = d;
    // the hearth's floor a little above the foot of the view, whatever is left over above (a tall narrow view: the wall)
    look.set(0, d * t * 0.78 - 0.1, 0);
    const tilt = 0.4;                                          // looking down into the crucibles a little
    camera.position.set(0, look.y + Math.sin(tilt) * d, Math.cos(tilt) * d);
    camera.lookAt(look);
    const near = 0.1, top = near * t, right = top * aspect;
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, 100);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld();
  }

  /** Where crucible i stands: as the 2D view's poseOf, in the world (its foot's middle, its turn about the camera's axis). */
  function poseOf(i, cup) {
    const rest = { x: xs[i], y: (cup.lift || 0) * 0.12, turn: 0 };
    if (!cup.go) return rest;
    const j = cup.go.to, dir = Math.sign(xs[j] - xs[i]) || 1, k = cup.go.k, turn = -dir * 1.05, tall = pots[i].tall;
    const mx = xs[j] - dir * (R + 0.55), my = pots[j].tall + 0.75;
    const fx = mx - Math.sin(-turn) * tall, fy = my - Math.cos(turn) * tall;
    return { x: rest.x + (fx - rest.x) * k, y: rest.y + (fy - rest.y) * k, turn: turn * k };
  }
  const v = new THREE.Vector3();
  const screen = (x, y, z = 0) => { v.set(x, y, z).project(camera); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h }; };

  function frame(sc, now) {
    if (!caps.length || !sc) return;
    // the hearth breathes
    coals.forEach((c, k) => { c.material.opacity = 0.55 + 0.3 * Math.sin(now / (430 + k * 37) + k); });
    wallGlow.material.opacity = 0.28 + 0.07 * Math.sin(now / 1700);
    fire.intensity = 2.0 + 0.35 * Math.sin(now / 520) + 0.15 * Math.sin(now / 173);
    sc.cups.forEach((cup, i) => {
      const P = pots[i], pose = poseOf(i, cup);
      P.g.position.set(pose.x, pose.y, cup.go ? 0.35 : 0);
      P.g.rotation.z = pose.turn;
      P.ring.material.opacity = cup.picked ? 0.75 + 0.2 * Math.sin(now / 160) : cup.target ? 0.3 : 0;
      P.layers.forEach((L, k) => {
        const b = cup.bands[k];
        L.slab.visible = L.sign.visible = !!b && b.h > 0.02 && (b.a ?? 1) > 0.02;
        if (!L.slab.visible) return;
        const y = BASE + (b.y + b.h / 2) * SLAB;
        L.slab.scale.set(1, Math.max(0.01, b.h * SLAB * 0.985), 1); L.slab.position.set(0, y, 0);
        dress(L.slab.material, b.m, b.hot || 0, b.a ?? 1);
        L.sign.material = signs[b.m] || signs.Sn; L.sign.position.set(0, y, R + 0.01); L.sign.scale.set(1, Math.min(1, b.h * 1.2), 1);
        L.sign.visible = L.sign.visible && b.h > 0.5 && (b.a ?? 1) > 0.5;
      });
    });
    // the stream: from the tipped crucible's lip down into the other's mouth
    const st = sc.stream;
    if (st) {
      const i = st.from, pose = poseOf(i, sc.cups[i]), dir = Math.sign(xs[st.to] - xs[i]) || 1, tall = pots[i].tall;
      const lx = dir * (R + 0.12), ly = tall, c = Math.cos(pose.turn), s = Math.sin(pose.turn);
      const a = new THREE.Vector3(pose.x + lx * c - ly * s, pose.y + lx * s + ly * c, 0.35), b = new THREE.Vector3(xs[st.to], pots[st.to].tall - 0.05, 0);
      const ctl = new THREE.Vector3((a.x + b.x) / 2, Math.max(a.y, b.y) + 0.25, 0.2);
      const at = t => new THREE.Vector3((1 - t) ** 2 * a.x + 2 * (1 - t) * t * ctl.x + t * t * b.x, (1 - t) ** 2 * a.y + 2 * (1 - t) * t * ctl.y + t * t * b.y, (1 - t) ** 2 * a.z + 2 * (1 - t) * t * ctl.z + t * t * b.z);
      dress(streamMat, st.m, 0.35, 1);
      segs.forEach((sg, k) => {
        const t0 = st.t1 + (st.t0 - st.t1) * k / N_SEG, t1 = st.t1 + (st.t0 - st.t1) * (k + 1) / N_SEG, p = at(t0), q = at(t1), d = q.clone().sub(p), len = d.length();
        sg.visible = len > 0.001;
        if (!sg.visible) return;
        sg.position.copy(p).add(q).multiplyScalar(0.5);
        sg.scale.set(1, len * 1.15, 1);
        sg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      });
    } else segs.forEach(sg => { sg.visible = false; });
    // sparks and embers, each a glowing quad turned to the camera
    const m4 = new THREE.Matrix4(), qCam = camera.quaternion;
    let n = 0;
    sparks = sparks.filter(sp => now - sp.t0 < 1000);
    for (const sp of sparks) for (const p of sp.parts) {
      if (n >= N_FX) break;
      const t = (now - sp.t0) / 1000, size = 0.07 * (1 - t);
      m4.compose(new THREE.Vector3(sp.x + p.vx * t, sp.y + p.vy * t - 1.6 * t * t, 0.5 + p.vz * t), qCam, new THREE.Vector3(size, size, size));
      fx.setMatrixAt(n++, m4);
    }
    for (const e of embers) {
      if (n >= N_FX) break;
      const t = (now / 9000 * e.s + e.p) % 1, size = 0.035 * (1 - t);
      m4.compose(new THREE.Vector3(e.x * span * 0.7 + Math.sin(now / 1300 + e.p) * 0.15, t * 4.2, e.z), qCam, new THREE.Vector3(size, size, size));
      fx.setMatrixAt(n++, m4);
    }
    fx.count = n; fx.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  }

  return {
    canvas,
    layout,
    resize,
    frame,
    burst(i) {
      const top = pots[i].tall, x = pots[i].g.position.x;
      sparks.push({ t0: performance.now(), x, y: top, parts: Array.from({ length: 28 }, () => { const a = Math.random() * Math.PI, v = 0.8 + Math.random() * 1.4; return { vx: Math.cos(a) * v * 0.7, vy: Math.sin(a) * v + 0.4, vz: (Math.random() - 0.5) * 0.6 }; }) });
    },
    cupAt(px, py) {
      const r = canvas.getBoundingClientRect(), x = px - r.left, y = py - r.top;
      if (y < 0 || y > r.height || !xs.length) return -1;
      let best = -1, bd = Infinity;
      xs.forEach((cx, i) => { const p = screen(cx, pots[i].tall / 2); const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = i; } });
      const half = Math.abs(screen(xs[0] + R + 0.3, 0).x - screen(xs[0], 0).x);
      return bd <= half * 1.3 ? best : -1;
    },
    mouthOnPage(i) { const r = canvas.getBoundingClientRect(), p = screen(xs[i], pots[i].tall); return { x: r.left + p.x, y: r.top + p.y }; },
    destroy() { renderer.dispose(); canvas.remove(); },
  };
}
