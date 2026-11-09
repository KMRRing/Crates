// Gears' light and materials: the studio of reflections worked out in the metal's shader (copied from shunt-view-3d.js, where it lives inside createView and is
// not exported; Shunt's file is not edited: if both change, extract one shared watch-look.js with Korbi's yes), the polish attribute (a flank or a bevel
// is polished, a face brushed), the jewels, the normal-map textures, and the themes' tints. `createLook(renderer, scene)` returns what the view needs.
import * as THREE from "./vendor/three.js";
import { CanvasTexture } from "./vendor/three-tex.js";
import { satinNormals, grainNormals, genevaNormals, fluteNormals, snailNormals } from "./pipes-3d-tex.js";
import { METALS } from "./pipes-3d-model.js";

export const DOUBLE = 2, ADD = 2;                           // THREE.DoubleSide and AdditiveBlending (not in the bundle's exports)

/** A texture drawn on a canvas by `draw(ctx, size)`. */
export function drawn(size, draw, colour = false, h = size) {
  const c = document.createElement("canvas");
  c.width = size; c.height = h;
  draw(c.getContext("2d"), size, h);
  const t = new CanvasTexture(c);
  if (colour) t.colorSpace = "srgb";
  return t;
}
/** A normal map from the bytes pipes-3d-tex.js makes; `repeat` tiles it. */
export function normalTexture({ size, data }, repeat = false) {
  const t = drawn(size, ctx => ctx.putImageData(new ImageData(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), size, size), 0, 0));
  t.flipY = false;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = 1000;
  return t;
}

export function createLook(renderer, detail = 2) {
  const ENV = { sky: { value: new THREE.Color() }, ground: { value: new THREE.Color() }, win: { value: new THREE.Color() }, dir: { value: new THREE.Vector3(-0.5, 0.78, -0.4).normalize() } };
  const ENV_GLSL = `uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uWin; uniform vec3 uWinDir;
    float shBox(vec3 R, vec3 c, vec2 hs, float soft) {
      float d = dot(R, c); if (d < 0.02) return 0.0;
      vec3 u = normalize(cross(c, vec3(0.0, 1.0, 0.0))), v = cross(c, u);
      vec2 q = clamp((hs - abs(vec2(dot(R, u), dot(R, v)) / d)) / soft, 0.0, 1.0);
      return q.x * q.y * smoothstep(0.02, 0.15, d);
    }
    vec3 shEnv(vec3 R, float soft) {
      vec3 col = mix(uGround, uSky, smoothstep(-0.4, 0.9, R.y));
      col += uWin * 3.2 * shBox(R, normalize(vec3(-0.5, 0.78, 0.42)), vec2(0.62, 0.42), soft + 0.06);
      col += uWin * 1.0 * shBox(R, normalize(vec3(0.1, 0.9, -0.45)), vec2(0.36, 0.3), soft + 0.1);
      col += uWin * vec3(0.6, 0.75, 1.0) * 1.9 * shBox(R, normalize(vec3(0.85, 0.38, -0.25)), vec2(0.10, 0.75), soft + 0.04);
      col += uWin * 0.9 * shBox(R, normalize(vec3(0.1, 0.55, 0.9)), vec2(0.7, 0.12), soft + 0.05);
      col += uWin * 0.8 * shBox(R, normalize(vec3(-0.9, 0.25, -0.4)), vec2(0.2, 0.5), soft + 0.05);
      col += uWin * 2.0 * pow(max(dot(R, uWinDir), 0.0), 90.0) / (1.0 + soft * 6.0);
      return col;
    }`;
  /** Add the studio's reflection to a standard material: k is how much (a polished metal 1, a varnish less); `extra` is more shader, run after it.
   *  `mat.userData.pol` makes the roughness fall on faces the geometry marks polished (attribute pol). */
  function envify(mat, k = 1, extra = "") {
    const pol = !!mat.userData.pol;
    mat.customProgramCacheKey = () => `env${k}|${extra}|${pol}`;
    mat.onBeforeCompile = sh => {
      sh.uniforms.uSky = ENV.sky; sh.uniforms.uGround = ENV.ground; sh.uniforms.uWin = ENV.win; sh.uniforms.uWinDir = ENV.dir;
      if (mat.userData.glow) sh.uniforms.uGlow = mat.userData.glow;
      if (pol) sh.vertexShader = sh.vertexShader.replace("void main() {", "attribute float pol;\nvarying float vPol;\nvoid main() {\n  vPol = pol;");
      sh.fragmentShader = (mat.userData.glow ? "uniform vec3 uGlow;\n" : "") + (pol ? "varying float vPol;\n" : "") + sh.fragmentShader.replace("void main() {", `${ENV_GLSL}\nvoid main() {`)
        .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${pol ? "roughnessFactor = mix(roughnessFactor, 0.08, vPol);" : ""}`)
        .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
        {
          vec3 rv = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
          float nv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
          vec3 F0 = mix(vec3(0.04), diffuseColor.rgb, metalnessFactor);
          vec3 F = F0 + (vec3(1.0) - F0) * pow(1.0 - nv, 5.0) * (1.0 - material.roughness);
          vec3 e = mix(shEnv(rv, material.roughness * 1.4), mix(uGround, uSky, 0.5), clamp(material.roughness * 0.9, 0.0, 0.7));
          reflectedLight.indirectSpecular += e * F * ${(k * 1.6).toFixed(2)};
          ${extra}
        }`);
    };
    return mat;
  }
  const std = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, ...o });
  const polished = (o, k) => { const m = std(o); m.userData.pol = true; return envify(m, k); };
  const basic = (o = {}) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, ...o });
  const RUBY_GLSL = "reflectedLight.indirectDiffuse += uGlow * (0.3 + 0.9 * pow(nv, 2.0));";
  const ruby = (glow, tint, color) => { const m = std({ color, roughness: 0.07, metalness: 0 }); m.userData.glow = { value: new THREE.Color(tint).multiplyScalar(glow) }; return envify(m, 1.2, RUBY_GLSL); };
  const tex = {
    grain: normalTexture(grainNormals(detail >= 2 ? 256 : 128)),
    perlage: normalTexture(satinNormals(detail >= 2 ? 128 : 64), true),
    geneva: normalTexture(genevaNormals(detail >= 2 ? 128 : 64), true),
    flute: normalTexture(fluteNormals(64), true),
    snail: normalTexture(snailNormals(detail >= 2 ? 256 : 128)),
  };
  const N2 = (a, b = a) => new THREE.Vector2(a, b);
  const gearMat = Object.fromEntries([4, 5, 6, "pinion"].map(k => [k, polished({ ...METALS[k], vertexColors: true, normalMap: tex.grain, normalScale: N2(0.5) }, 0.8)]));
  const ghostMat = ok => std({ color: ok ? 0x6fd0a2 : 0xe8806f, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, emissive: ok ? 0x2f7d5b : 0xa8382b, emissiveIntensity: 0.6 });
  const M = {
    plate: envify(std({ color: 0xc9ccd0, metalness: 0.95, roughness: 0.4, normalMap: tex.perlage, normalScale: N2(0.2) }), 0.55),
    plateEdge: polished({ color: 0xc9ccd0, metalness: 1, roughness: 0.12 }, 1),
    caseM: polished({ color: 0xd9a285, metalness: 1, roughness: 0.22 }, 1),
    bridge: envify(std({ color: 0xd8dade, metalness: 1, roughness: 0.26, normalMap: tex.geneva, normalScale: N2(0.9) }), 0.85),
    bridgeEdge: polished({ color: 0xe2e5e9, metalness: 1, roughness: 0.1 }, 1.1),
    steel: polished({ color: 0xb9bec6, metalness: 1, roughness: 0.2, vertexColors: false }, 1),
    blued: polished({ color: 0x28489a, metalness: 0.92, roughness: 0.18 }, 1.1),
    gold: polished({ color: 0xe3b84e, metalness: 1, roughness: 0.18 }, 0.9),
    rose: polished({ color: 0xe0a186, metalness: 1, roughness: 0.2 }, 0.9),
    slot: std({ color: 0x14100c, roughness: 0.95 }),
    snail: envify(std({ color: 0xc9ccd0, metalness: 1, roughness: 0.3, normalMap: tex.snail, normalScale: N2(0.8) }), 0.8),
    enamel: envify(std({ color: 0xf1ede2, roughness: 0.38, metalness: 0 }), 0.35),
    ruby: ruby(0.2, 0xff2a3a, 0x7e0a1c), rubyLit: ruby(0.4, 0xff3a2a, 0xa8101e),
    parts: polished({ color: 0xffffff, metalness: 0.95, roughness: 0.26, vertexColors: true }, 0.9),
    glass: basic({ color: 0xffffff, blending: ADD, opacity: 0.5, side: DOUBLE }),
    red: basic({ color: 0xff3a22, opacity: 0.55, blending: ADD }),
    green: basic({ color: 0x5fd0a0, opacity: 0.5, blending: ADD }),
    spark: basic({ color: 0xffb04a, blending: ADD, opacity: 1 }),
    line: new THREE.LineBasicMaterial({ color: 0xe3b84e, transparent: true, opacity: 0.8 }),
  };
  /** The re-tint of a theme and a day or night (skin from pipes-3d-model.js skinFor). */
  function tint(skin, key, fill, hemi) {
    renderer.toneMappingExposure = skin.exposure;
    key.color.setHex(skin.key); key.intensity = skin.keyI;
    fill.color.setHex(skin.fill); fill.intensity = skin.fillI;
    hemi.color.setHex(skin.sky); hemi.groundColor.setHex(skin.ground); hemi.intensity = skin.hemiI;
    M.plate.color.setHex(skin.plate); M.plateEdge.color.setHex(skin.plate); M.caseM.color.setHex(skin.case);
    M.bridge.color.setHex(skin.bridge); M.bridgeEdge.color.setHex(skin.bridge); M.steel.color.setHex(skin.steel);
    M.snail.color.setHex(skin.plate); M.enamel.color.setHex(skin.paper);
    ENV.sky.value.setHex(skin.envSky); ENV.ground.value.setHex(skin.envGround); ENV.win.value.setHex(skin.envWin); ENV.dir.value.copy(key.position).normalize();
  }
  function dispose() {
    for (const m of [...Object.values(M), ...Object.values(gearMat)]) m.dispose();
    for (const t of Object.values(tex)) t.dispose?.();
  }
  return { ENV, M, gearMat, ghostMat, tex, envify, std, basic, polished, tint, dispose, drawn };
}
