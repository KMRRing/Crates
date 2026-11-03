// Manifest in 3D: the quay and the League's packages drawn with three.js (vendor/three.js, kept on the device, so it plays
// offline). One renderer and one WebGL context serve every picture on the page (the stack coming in, the four stacks of a
// question, a small package beside an answer): each is drawn into the renderer's canvas and copied at once into a plain
// 2D canvas, so the page never holds more than one context (iPhones give a page only a few) and a picture, once drawn, costs
// nothing. manifest-art.js owns the pictures and when they move; this file only draws a scene on request.
//
// The camera is orthographic and true isometric, framed exactly as the flat drawing frames it (manifest-model.js), and a
// package is the box of its cell, nothing larger: what shows through a stack is what the engine says shows. The packing
// is worked out in the shader (manifest-glsl.js), so nothing here is a picture and nothing changes a silhouette.
import * as THREE from "./vendor/three.js";
import { WARES, BOX } from "./manifest-engine.js";
import { packageShader, QUAY } from "./manifest-glsl.js";
import { cameraOf, QUAY_DEPTH } from "./manifest-model.js";

const BACK = 1;                                                    // THREE.BackSide (the bundle exports no constants for sides)
const TARP = 0xAEA690, LIT = 0xFFF8E4;
/** The ware numbers as the shader has them: 0 a tarpaulin, 1 to 5 the wares, 6 the tarpaulin's lit package. */
const HEX = [TARP, ...WARES.map(w => parseInt(w.hex.slice(1), 16)), LIT];

// ---------- the page's colours: read from its tokens, so every theme and each day and night is its own ----------
let probe = null, probeCtx = null;
const rgbOf = css => {
  const m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(css);
  if (m) return [+m[1], +m[2], +m[3]];
  const c = /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)/.exec(css);
  if (c) return [c[1], c[2], c[3]].map(v => Math.round(v * 255));
  probeCtx ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });   // any other notation: let a canvas parse it
  probeCtx.clearRect(0, 0, 1, 1);
  probeCtx.fillStyle = "#000"; probeCtx.fillStyle = css; probeCtx.fillRect(0, 0, 1, 1);
  return [...probeCtx.getImageData(0, 0, 1, 1).data].slice(0, 3);
};
/** A token's colour as [r, g, b] in 0 to 255 (an expression like var(--ink), or any colour). */
export function tokenRgb(expr) {
  if (!probe) { probe = document.createElement("i"); probe.setAttribute("aria-hidden", "true"); probe.style.cssText = "position:fixed;left:-9px;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none"; document.body.appendChild(probe); }
  probe.style.color = "#000";
  probe.style.color = expr;
  return rgbOf(getComputedStyle(probe).color);
}
export const cssOf = ([r, g, b]) => `rgb(${r},${g},${b})`;
/** The colours the picture is made of, now: the quay's timber, the ink, the teal, the page's tone, whether it's night. */
export function tokens() {
  const floor = tokenRgb("var(--mf-floor)"), ink = tokenRgb("var(--ink)"), mark = tokenRgb("var(--mf-in)"), wave = tokenRgb("var(--mf-wave)"), yard = tokenRgb("var(--yard)");
  const luma = (yard[0] * 0.3 + yard[1] * 0.59 + yard[2] * 0.11) / 255;
  return { floor, ink, mark, wave, yard, night: luma < 0.45, key: [floor, ink, mark, yard].join("|") };
}

// ---------- the scene ----------
/** Bolts a surface shader (manifest-glsl.js) onto three's physical material. */
function inject(shader, S, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${S.vertexHead}`).replace("#include <begin_vertex>", `#include <begin_vertex>\n${S.vertexBody}`);
  let f = shader.fragmentShader.replace("#include <common>", `#include <common>\n${S.fragmentHead}`).replace("#include <color_fragment>", `#include <color_fragment>\n${S.color}`)
    .replace("#include <roughnessmap_fragment>", S.rough).replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${S.normal}`);
  if (S.metal) f = f.replace("#include <metalnessmap_fragment>", S.metal);
  shader.fragmentShader = f;
}

export function createGL() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "low-power" }); } catch { return null; }
  if (typeof WebGL2RenderingContext === "undefined" || !(renderer.getContext() instanceof WebGL2RenderingContext)) { renderer.dispose(); return null; }
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = 1;                                       // PCFShadowMap (the bundle exports no constant for it)
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  const out = { canvas, alive: true };
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); out.alive = false; });
  canvas.addEventListener("webglcontextrestored", () => { out.alive = true; });

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 140);
  const sun = new THREE.DirectionalLight(0xffffff, 1), hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1), fill = new THREE.DirectionalLight(0xffffff, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 2.5;
  scene.add(sun, sun.target, hemi, fill, fill.target);

  // geometry: a unit box per ware (the ware is an attribute, so every package shares one program)
  const boxGeo = ware => { const g = new THREE.BoxGeometry(1, 1, 1); g.setAttribute("aWare", new THREE.Float32BufferAttribute(new Float32Array(24).fill(ware), 1)); return g; };
  const geos = HEX.map((_, i) => boxGeo(i));
  const plain = new THREE.BoxGeometry(1, 1, 1);

  // materials: one per package (its own dimming and fade-in), all one program
  const wareColours = HEX.map(h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; });
  const PKG = packageShader(wareColours);
  const makePackageMaterial = () => {
    const U = { uDim: { value: 0 }, uFade: { value: 1 }, uDimTo: { value: new THREE.Color(0x888888) } };
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
    m.customProgramCacheKey = () => "manifest-package";
    m.onBeforeCompile = shader => inject(shader, PKG, U);
    m.userData.U = U;
    return m;
  };
  const QU = { uTimber: { value: new THREE.Color() }, uCell: { value: new THREE.Vector2(1.9, 1) }, uAlong: { value: 0 }, uDepth: { value: 0.4 } };
  const quayMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  quayMat.customProgramCacheKey = () => "manifest-quay";
  quayMat.onBeforeCompile = shader => inject(shader, QUAY, QU);
  const quay = new THREE.Mesh(plain, quayMat);
  quay.receiveShadow = true;
  scene.add(quay);
  const tileMat = new THREE.MeshBasicMaterial({ color: 0x1f6e66 });
  const tile = new THREE.Mesh(plain, tileMat);
  scene.add(tile);
  const hullMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: BACK });

  const pool = [], hulls = [];
  const packageAt = i => {
    if (!pool[i]) {
      const mesh = new THREE.Mesh(geos[0], makePackageMaterial());
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
      pool.push(mesh);
    }
    return pool[i];
  };
  const hullAt = i => {
    if (!hulls[i]) { const h = new THREE.Mesh(plain, hullMat); scene.add(h); hulls.push(h); }
    return hulls[i];
  };

  // the light: a low sun over the right shoulder (the right face brighter than the left, the top brightest), a sky that
  // fills the shadows, and a little from the left to keep that face readable. Night is moonlight: cooler, a little dimmer.
  const LIGHT = {
    day: { sun: [0xfff3e0, 2.8], sky: [0xeaf1ff, 0.8], ground: [0xdccdb2], fill: [0xdfe8ff, 0.25] },
    night: { sun: [0xd6e0ff, 2.3], sky: [0xb9c9f2, 0.72], ground: [0x8f93a8], fill: [0xc8d6ff, 0.25] },
  };
  const SUN_AT = [5.5, 9, 3], FILL_AT = [-2.5, 3, 7];

  let shadowSize = 1024;
  /** Everything about the picture's scene for one stack: placements, dimming, outlines, the quay. */
  function arrange(spec, tk, lifts) {
    const { X, Y, Z, b, items, opts } = spec;
    const sx = X * b.X, sz = Y * b.Y, sy = Z * b.H, depth = QUAY_DEPTH * b.H;
    const turned = b.X < b.Y;
    // the quay: a slab under the floor
    quay.visible = spec.quay !== false;                            // not for a package alone, beside an answer
    quay.scale.set(sx, depth, sz);
    quay.position.set(sx / 2, -depth / 2, sz / 2);
    QU.uTimber.value.set(cssOf(tk.floor));
    QU.uCell.value.set(b.X, b.Y);
    QU.uAlong.value = turned ? 1 : 0;
    QU.uDepth.value = depth;
    // a marked place on the floor, where the question asks about a spot with nothing standing on it
    const m = opts.markTile;
    tile.visible = !!m;
    if (m) { tile.scale.set(b.X, 0.006, b.Y); tile.position.set((m.x + 0.5) * b.X, 0.003, (m.y + 0.5) * b.Y); tileMat.color.set(cssOf(tk.mark)); }
    // the packages
    const skin = tk.night ? LIGHT.night : LIGHT.day, to = new THREE.Color(cssOf(tk.yard));
    let n = 0, h = 0;
    for (const it of items) {
      const mesh = packageAt(n++), U = mesh.material.userData.U, lift = lifts?.get(it.key) || { lift: 0, squash: 1, fade: 1 };
      mesh.visible = lift.fade > 0;
      mesh.geometry = geos[it.ware];
      const sq = lift.squash, wide = 1 / Math.sqrt(sq);
      mesh.scale.set(BOX.L * wide, BOX.H * sq, BOX.W * wide);
      mesh.rotation.set(0, turned ? Math.PI / 2 : 0, 0);
      mesh.position.set(it.box.cx, it.box.cy - it.box.sy * (1 - sq) / 2 + lift.lift * b.H, it.box.cz);
      U.uFade.value = lift.fade;
      U.uDim.value = it.dim ? 1 : 0;
      U.uDimTo.value.copy(to);
      if (it.outline) {                                            // an outline: the package's own box, a little larger, seen from inside
        const hull = hullAt(h++), e = 0.075;
        hull.visible = true;
        hull.scale.set(it.box.sx + e * 2, it.box.sy * sq + e * 2, it.box.sz + e * 2);
        hull.position.copy(mesh.position);
      }
    }
    for (; n < pool.length; n++) pool[n].visible = false;
    for (; h < hulls.length; h++) hulls[h].visible = false;
    hullMat.color.set(cssOf(tk.ink));
    // the light
    const at = spec.cam.at, reach = Math.hypot(sx / 2, sz / 2, sy / 2 + 1.7) + 0.6;
    const dist = 26, SL = Math.hypot(...SUN_AT);
    sun.color.set(skin.sun[0]); sun.intensity = skin.sun[1];
    sun.position.set(at[0] + SUN_AT[0] / SL * dist, at[1] + SUN_AT[1] / SL * dist, at[2] + SUN_AT[2] / SL * dist);
    sun.target.position.set(at[0], at[1], at[2]);
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: dist - reach - 2, far: dist + reach + 2 });
    sun.shadow.camera.updateProjectionMatrix();
    hemi.color.set(skin.sky[0]); hemi.groundColor.set(skin.ground[0]); hemi.intensity = skin.sky[1];
    fill.color.set(skin.fill[0]); fill.intensity = skin.fill[1];
    fill.position.set(at[0] + FILL_AT[0], at[1] + FILL_AT[1], at[2] + FILL_AT[2]);
    fill.target.position.set(at[0], at[1], at[2]);
    // the camera
    const c = spec.cam, D = 60;
    camera.left = c.left; camera.right = c.right; camera.top = c.top; camera.bottom = c.bottom;
    camera.near = 1; camera.far = D * 2;
    camera.position.set(at[0] + D / Math.sqrt(3), at[1] + D / Math.sqrt(3), at[2] + D / Math.sqrt(3));
    camera.up.set(0, 1, 0);
    camera.lookAt(at[0], at[1], at[2]);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
  }

  /**
   * Draws the spec's stack at w by h pixels into the renderer's canvas (valid until the next draw) and returns it.
   * lifts: a Map from a package's key to { lift, squash, fade } for the ones in the air.
   */
  out.draw = (spec, w, h, tk, lifts = null) => {
    const size = Math.max(w, h) > 1300 ? 2048 : 1024;
    if (size !== shadowSize) { shadowSize = size; sun.shadow.map?.dispose(); sun.shadow.map = null; sun.shadow.mapSize.set(size, size); }
    if (canvas.width !== w || canvas.height !== h) renderer.setSize(w, h, false);
    arrange(spec, tk, lifts);
    renderer.render(scene, camera);
    return canvas;
  };
  /** The same scene with the packages flat, one colour each (its index + 1, in the red and green), to count what shows. */
  out.ids = (spec, w, h, tk) => {
    arrange(spec, tk, null);
    quay.visible = false; tile.visible = false;
    const saved = [];
    pool.forEach((m, i) => { if (!m.visible) return; saved.push([m, m.material]); m.material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(((i + 1) & 255) / 255, (((i + 1) >> 8) & 255) / 255, 0, "srgb-linear") }); });
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = 0;
    renderer.setSize(w, h, false);
    renderer.render(scene, camera);
    const gl = renderer.getContext(), px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    saved.forEach(([m, mat]) => { m.material.dispose(); m.material = mat; });
    renderer.shadowMap.enabled = true;
    const seen = new Map();
    for (let i = 0; i < px.length; i += 4) if (px[i + 3] === 255) { const id = px[i] + px[i + 1] * 256; if (id) seen.set(id - 1, (seen.get(id - 1) || 0) + 1); }
    return { seen, items: spec.items };
  };
  out.debug = { scene, pool, THREE, LIGHT };
  out.dispose = () => renderer.dispose();
  return out;
}
