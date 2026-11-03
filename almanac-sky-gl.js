// The star field's drawing, straight on WebGL: every star one point of a single buffer, every line of the chart one segment
// of another, so a whole sky is two draws however many stars. No three.js: the vendored copy has no points, no shader
// material and no perspective camera, and a bundle of its own would add 400 KB to what the device keeps for the sake of
// two shaders. Nothing here knows what a star is a star of (almanac-sky.js does); it takes arrays and a camera matrix.
//
// Safari's WebGL is the same as everyone's: WebGL 1 only, point sizes capped by the device (asked for, below), the pixel
// ratio capped at 2, additive blending (a star is light, so overlapping stars add) onto a transparent canvas the page's own
// backdrop shows through, and no SVG filter anywhere.

const POINT_VERT = `
attribute vec3 a_pos;
attribute vec3 a_col;
attribute vec4 a_misc;          // size (px at the reference distance), lit 0..1, twinkles 0|1, on 0|1
uniform mat4 u_vp;
uniform float u_dpr, u_dist, u_time, u_dim, u_max, u_ref;
varying vec3 v_col;
varying float v_a;
varying float v_lit;
void main() {
  vec4 p = u_vp * vec4(a_pos, 1.0);
  float depth = max(p.w, 0.5);
  float lit = a_misc.y;
  float tw = a_misc.z > 0.5 ? 0.62 + 0.38 * sin(u_time * 2.4 + dot(a_pos, vec3(12.9898, 78.233, 37.719))) : 1.0;
  // growing slower than the screen as the camera closes in: a star is a point of light, never a ball
  float size = a_misc.x * pow(u_ref / depth, 0.55) * (1.0 + 1.25 * lit);
  gl_PointSize = clamp(size * u_dpr, 1.0, u_max);
  // far stars recede, so a region reads as the near side of a body, not a flat spill
  float fade = clamp(1.5 - depth / (u_dist + 200.0), 0.45, 1.0);
  v_a = (u_dim + (1.0 - u_dim) * lit) * fade * tw * a_misc.w;
  v_col = a_col;
  v_lit = lit;
  gl_Position = a_misc.w > 0.5 ? p : vec4(2.0, 2.0, 2.0, 1.0);      // a star switched off is outside the picture
}`;
const POINT_FRAG = `
precision mediump float;
varying vec3 v_col;
varying float v_a;
varying float v_lit;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * 3.6);
  float halo = (1.0 - r2) * (1.0 - r2) * v_lit * 0.45;           // only a learned star has a halo
  vec3 c = v_col * (core + halo) + vec3(1.0) * core * core * v_lit * 0.7;
  gl_FragColor = vec4(c * v_a, (core + halo) * v_a);
}`;
const LINE_VERT = `
attribute vec3 a_pos;
attribute vec4 a_col;           // rgb and how much of it
uniform mat4 u_vp;
uniform float u_dist, u_boost;
varying vec4 v_c;
void main() {
  vec4 p = u_vp * vec4(a_pos, 1.0);
  float fade = clamp(1.5 - max(p.w, 0.5) / (u_dist + 200.0), 0.3, 1.0);
  v_c = vec4(a_col.rgb, a_col.a * fade * u_boost);
  gl_Position = a_col.a > 0.0 ? p : vec4(2.0, 2.0, 2.0, 1.0);
}`;
const LINE_FRAG = `
precision mediump float;
varying vec4 v_c;
void main() { gl_FragColor = vec4(v_c.rgb * v_c.a, v_c.a); }`;

function program(gl, vs, fs) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
  const at = {}, un = {};
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); i < n; i++) { const a = gl.getActiveAttrib(p, i); at[a.name] = gl.getAttribLocation(p, a.name); }
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const u = gl.getActiveUniform(p, i); un[u.name] = gl.getUniformLocation(p, u.name); }
  return { p, at, un };
}

/** Whether this device can draw the sky at all. */
export function canDrawSky() {
  try {
    const c = document.createElement("canvas"), gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    return !!gl;
  } catch { return false; }
}

/**
 * The sky's drawing in `canvas`. Throws where there's no WebGL. Calls:
 *   setStars({ xyz, col, misc })   xyz Float32Array(3n); col Float32Array(3n) rgb 0..1; misc Float32Array(4n) size, lit, twinkles, on
 *   setLines(Float32Array)         7 floats a vertex: x, y, z, r, g, b, a; two vertices a line
 *   setFocus(Float32Array)         the same, for the lines of the chosen star, drawn brighter on top
 *   draw(vp, { dist, time, dim, boost })   one frame for a view-projection matrix
 *   resize(cssWidth, cssHeight)    sets the canvas to the screen's pixels (ratio capped at 2); returns the ratio
 *   lost()                         whether the context is gone (the page redraws on the restore event it listens for)
 */
export function createSkyGL(canvas) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power", preserveDrawingBuffer: false })
    || canvas.getContext("experimental-webgl");
  if (!gl) throw new Error("no WebGL");
  let stars = null, lines = null, focus = null, dpr = 1, W = 1, H = 1, pts = null, lns = null, count = 0, lineVerts = 0, focusVerts = 0;
  const bufs = {};
  const MAX_POINT = (() => { const r = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE); return Math.max(8, Math.min(64, r ? r[1] : 32)); })();

  function init() {
    pts = program(gl, POINT_VERT, POINT_FRAG);
    lns = program(gl, LINE_VERT, LINE_FRAG);
    for (const k of ["xyz", "col", "misc", "lines", "focus"]) bufs[k] = gl.createBuffer();
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.clearColor(0, 0, 0, 0);
    if (stars) upload();
    if (lines) { gl.bindBuffer(gl.ARRAY_BUFFER, bufs.lines); gl.bufferData(gl.ARRAY_BUFFER, lines, gl.DYNAMIC_DRAW); }
    if (focus) { gl.bindBuffer(gl.ARRAY_BUFFER, bufs.focus); gl.bufferData(gl.ARRAY_BUFFER, focus, gl.DYNAMIC_DRAW); }
  }
  function upload() {
    const put = (k, a) => { gl.bindBuffer(gl.ARRAY_BUFFER, bufs[k]); gl.bufferData(gl.ARRAY_BUFFER, a, gl.DYNAMIC_DRAW); };
    put("xyz", stars.xyz); put("col", stars.col); put("misc", stars.misc);
    count = stars.xyz.length / 3;
  }
  init();

  const api = {
    setStars(s) {
      const same = stars && stars.xyz === s.xyz;
      stars = s;
      if (gl.isContextLost()) return;
      if (same) {                                        // only the colours and the glow changed: not the places
        for (const k of ["col", "misc"]) { gl.bindBuffer(gl.ARRAY_BUFFER, bufs[k]); gl.bufferSubData(gl.ARRAY_BUFFER, 0, stars[k]); }
      } else upload();
    },
    setLines(a) {
      lines = a; lineVerts = a.length / 7;
      if (gl.isContextLost()) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.lines); gl.bufferData(gl.ARRAY_BUFFER, a, gl.DYNAMIC_DRAW);
    },
    setFocus(a) {
      focus = a; focusVerts = a.length / 7;
      if (gl.isContextLost()) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.focus); gl.bufferData(gl.ARRAY_BUFFER, a, gl.DYNAMIC_DRAW);
    },
    resize(w, h) {
      dpr = Math.min(window.devicePixelRatio || 1, 2);                 // never more than 2: a phone's 3 would be nine times the pixels for nothing
      W = Math.max(1, Math.round(w * dpr)); H = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      return dpr;
    },
    lost: () => gl.isContextLost(),
    restore() { init(); },
    draw(vp, { dist = 200, time = 0, dim = 0.4, boost = 1 } = {}) {
      if (gl.isContextLost() || !stars) return;
      gl.viewport(0, 0, W, H);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const attrib = (prog, name, buf, size, stride, offset) => {
        const loc = prog.at[name];
        if (loc == null) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
      };
      gl.useProgram(lns.p);
      gl.uniformMatrix4fv(lns.un.u_vp, false, vp);
      gl.uniform1f(lns.un.u_dist, dist);
      if (lineVerts) {
        gl.uniform1f(lns.un.u_boost, boost);
        attrib(lns, "a_pos", bufs.lines, 3, 28, 0); attrib(lns, "a_col", bufs.lines, 4, 28, 12);
        gl.drawArrays(gl.LINES, 0, lineVerts);
      }
      if (focusVerts) {
        gl.uniform1f(lns.un.u_boost, 1);
        attrib(lns, "a_pos", bufs.focus, 3, 28, 0); attrib(lns, "a_col", bufs.focus, 4, 28, 12);
        gl.drawArrays(gl.LINES, 0, focusVerts);
      }
      gl.disableVertexAttribArray(lns.at.a_pos); gl.disableVertexAttribArray(lns.at.a_col);
      gl.useProgram(pts.p);
      gl.uniformMatrix4fv(pts.un.u_vp, false, vp);
      gl.uniform1f(pts.un.u_dpr, dpr); gl.uniform1f(pts.un.u_dist, dist); gl.uniform1f(pts.un.u_time, time);
      gl.uniform1f(pts.un.u_dim, dim); gl.uniform1f(pts.un.u_max, MAX_POINT); gl.uniform1f(pts.un.u_ref, 150);
      attrib(pts, "a_pos", bufs.xyz, 3, 12, 0); attrib(pts, "a_col", bufs.col, 3, 12, 0); attrib(pts, "a_misc", bufs.misc, 4, 16, 0);
      gl.drawArrays(gl.POINTS, 0, count);
      for (const k of ["a_pos", "a_col", "a_misc"]) gl.disableVertexAttribArray(pts.at[k]);
    },
    destroy() { try { gl.getExtension("WEBGL_lose_context")?.loseContext(); } catch { /* already gone */ } },
  };
  return api;
}
