// The Navigation course's instruments of the sky, each an object the stage (navigation-stage.js) drives:
//   sky  – a chart of the real sky from a place and a time (Landfall's catalogue and sky maths, imported, not copied): tap a star
//   alt  – a mariner's astrolabe: turn the alidade (the sighting arm) to a star or the sun and read its altitude
//   sext – a sextant: bring the star down to the horizon and read the arc
//   corr – the sextant reading's corrections: dip and refraction, to the observed altitude
// An instrument: init(step) → state; draw(step, v) → SVG; down/move/up(step, v, p) take the pointer in the box's units (up may return
// a verdict { ok, msg | why } for an instrument that judges as you tap); ready/judge/reveal for one with a button (Check).
import { STARS } from "./landfall-stars.js";
import { FIGURES } from "./landfall-figures.js";
import { julianDate, starAltAz, RAD, norm360, observedAltitude, dip, refraction } from "./landfall-sky.js";
import { altText, hhmm } from "./navigation-math.js";
import { W, H, f1, clamp, text, line, polar, elev, starShape, slider, sliderHit, sliderValue, chip, inBox } from "./navigation-ui.js";

const sin = d => Math.sin(d * RAD), cos = d => Math.cos(d * RAD);

// ---------- the catalogue, by name or by designation ----------
const BY = new Map();
for (const s of STARS) { if (s[1] && !BY.has(s[1])) BY.set(s[1], s); if (s[2] && !BY.has(s[2])) BY.set(s[2], s); }
/** A star of the catalogue by its name ("Polaris") or its designation ("α UMi"). */
export const star = id => BY.get(id) || null;

/** The figures drawn on the charts: our own lines, by star. The Plough, the Little Bear and Cassiopeia are Landfall's. */
export const SHAPES = {
  Plough: FIGURES.UMa.lines, UMi: FIGURES.UMi.lines, Cas: FIGURES.Cas.lines,
  Ori: [["Betelgeuse", "Alnitak"], ["Bellatrix", "Mintaka"], ["Mintaka", "Alnilam", "Alnitak"], ["Alnitak", "Saiph"], ["Mintaka", "Rigel"], ["Betelgeuse", "Bellatrix"], ["Saiph", "Rigel"]],
  Cru: [["Gacrux", "Acrux"], ["Mimosa", "Imai"]],
  Cen: [["Hadar", "Rigil Kentaurus"]],
};

// ---------- the sky's projection: a stereographic chart round the direction you look ----------
const vec = (az, alt) => [sin(az) * cos(alt), cos(az) * cos(alt), sin(alt)];          // east, north, up
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const n = Math.hypot(...a); return a.map(x => x / n); };
const fromVec = d => ({ alt: Math.asin(clamp(d[2], -1, 1)) / RAD, az: norm360(Math.atan2(d[0], d[1]) / RAD) });
/** The angle in degrees between two directions. */
export const sep = (a, b) => Math.acos(clamp(dot(a, b), -1, 1)) / RAD;

/** The chart's camera: looking toward (az, alt) with a field `fov` degrees from the middle to the edge, on a disc of radius R at (cx, cy). */
export function camera(az, alt, fov, cx, cy, R) {
  const f = vec(az, alt), r = vec(az + 90, 0), u = cross(r, f), S = R / (2 * Math.tan(fov * RAD / 2));
  return {
    cx, cy, R, f, r, u, S,
    project(d) {
      const z = dot(d, f);
      if (z < -0.9) return null;
      const k = 2 / (1 + z), x = cx + dot(d, r) * k * S, y = cy - dot(d, u) * k * S;
      return { x, y, in: Math.hypot(x - cx, y - cy) <= R - 1 };
    },
    unproject(px, py) {
      const sx = (px - cx) / S, sy = (cy - py) / S, s2 = sx * sx + sy * sy, z = (4 - s2) / (4 + s2), k = 2 / (1 + z);
      return unit([0, 1, 2].map(i => r[i] * sx / k + u[i] * sy / k + f[i] * z));
    },
  };
}
export const jdOf = (step, dh = 0) => {
  const [y, m, d, h] = step.when;
  return julianDate(y, m, d) + (h - step.lon / 15 + dh) / 24;
};
/** A star's place from the step's observer: { alt, az, d (direction) }. */
export function seen(step, s, dh = 0) {
  const p = starAltAz(s, jdOf(step, dh), step.lat, step.lon);
  return { alt: p.alt, az: p.az, d: vec(p.az, p.alt) };
}
/** The points of a great circle starting at direction a, through b, going on to `times` the span a-b: for a line "from this through that, so many times on". */
export function ray(a, b, times, n = 36) {
  const th = sep(a, b) * RAD, m = unit(b.map((x, i) => x - dot(a, b) * a[i])), out = [];
  for (let i = 0; i <= n; i++) { const t = th * times * i / n; out.push(a.map((x, k) => Math.cos(t) * x + Math.sin(t) * m[k])); }
  return out;
}

const TIME = { x1: 44, x2: 316, y: 284, min: -6, max: 6, step: 0.25 };
export const sky = {
  init: () => ({ dh: 0, pick: null, reveal: false, drag: false, tap: null }),
  geom(step) {
    const t = !!step.time;
    return { cx: 180, cy: t ? 134 : 150, R: t ? 122 : 140 };
  },
  view(step, v) {
    const g = this.geom(step), cam = camera(step.az, step.alt, step.fov, g.cx, g.cy, g.R), stars = [];
    for (const s of STARS) {
      const p = seen(step, s, v.dh);
      if (p.alt < -0.5) continue;
      const q = cam.project(p.d);
      if (q?.in) stars.push({ s, p, x: q.x, y: q.y });
    }
    return { cam, stars, g };
  },
  draw(step, v) {
    const { cam, stars, g } = this.view(step, v), out = [];
    const slide = step.time ? { ...TIME, value: v.dh } : null;
    out.push(`<defs><clipPath id="nvsky"><circle cx="${g.cx}" cy="${g.cy}" r="${g.R}"/></clipPath></defs>`);
    out.push(`<circle cx="${g.cx}" cy="${g.cy}" r="${g.R}" class="nv-night"/>`);
    out.push(`<g clip-path="url(#nvsky)">`);
    // the horizon: a line round the sky, N E S W on it
    let d = "", pen = false;
    for (let az = 0; az <= 360; az += 3) {
      const q = cam.project(vec(az, 0)), near = q && Math.hypot(q.x - g.cx, q.y - g.cy) < g.R + 60;
      if (near) { d += `${pen ? "L" : "M"}${f1(q.x)} ${f1(q.y)}`; pen = true; } else pen = false;
    }
    out.push(`<path d="${d}" class="nv-horizon" fill="none"/>`);
    // figures
    const at = id => stars.find(x => x.s === star(id));
    for (const key of step.figs || []) for (const ln of SHAPES[key] || []) {
      const pts = ln.map(at);
      for (let i = 1; i < pts.length; i++) if (pts[i - 1] && pts[i]) out.push(line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, "nv-fig"));
    }
    // a line from one star through another, so many times on: the star-hopping rule
    for (const h of [].concat(step.hop || [])) {
      const a = star(h.from), b = star(h.through);
      if (!a || !b) continue;
      const pts = ray(seen(step, a, v.dh).d, seen(step, b, v.dh).d, h.times).map(x => cam.project(x)).filter(Boolean);
      out.push(`<path d="M${pts.map(q => `${f1(q.x)} ${f1(q.y)}`).join("L")}" class="nv-hop" fill="none"/>`);
    }
    for (const { s, x, y } of stars) out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(clamp(2.5 - 0.5 * s[5], 0.8, 3.8))}" class="nv-dot"/>`);
    out.push(`</g>`);
    // names, each moved down a line while it would sit on another
    const placed = [];
    const name = (x, y, txt, cls) => {
      const w = txt.length * 5.9 + 2;
      let ly = y;
      while (placed.some(r => x < r.x + r.w && r.x < x + w && Math.abs(ly - r.y) < 11) && ly < y + 44) ly += 11;
      placed.push({ x, w, y: ly });
      out.push(text(x, ly, txt, cls));
    };
    for (const n of step.names || []) { const x = at(n); if (x) name(x.x + 6, x.y - 5, n, "nv-name"); }
    if (v.pick) { const x = at(v.pick); if (x) { out.push(`<circle cx="${f1(x.x)}" cy="${f1(x.y)}" r="9" class="nv-ring"/>`); name(x.x + 11, x.y + 14, x.s[1] || x.s[2], "nv-name hot"); } }
    const goal = step.goal;
    if (v.reveal && goal) {
      const q = goal.star ? at(goal.star) : cam.project(vec(goal.point.az, goal.point.alt));
      if (q) out.push(`<circle cx="${f1(q.x)}" cy="${f1(q.y)}" r="${goal.star ? 11 : 16}" class="nv-ring hint"/>`);
    }
    if (step.mark) { const q = cam.project(vec(step.mark.az, step.mark.alt)); if (q?.in) out.push(`<path d="M${f1(q.x - 5)} ${f1(q.y)}H${f1(q.x + 5)}M${f1(q.x)} ${f1(q.y - 5)}V${f1(q.y + 5)}" class="nv-cross"/>${text(q.x + 8, q.y + 14, step.mark.label || "", "nv-name hot")}`); }
    // the rim, and the points of the compass just inside it where the horizon meets it
    out.push(`<circle cx="${g.cx}" cy="${g.cy}" r="${g.R}" class="nv-rim"/>`);
    for (const [az, ch] of [[0, "N"], [90, "E"], [180, "S"], [270, "W"]]) {
      const q = cam.project(vec(az, 0.5));
      if (q && Math.hypot(q.x - g.cx, q.y - g.cy) < g.R - 12) out.push(text(q.x, q.y - 5, ch, "nv-compass", "middle"));
    }
    out.push(text(14, 20, step.look || "", "nv-cap"));
    if (slide) out.push(slider({ ...slide, label: "Time", show: hhmm(step.when[3] + v.dh) }));
    return out.join("");
  },
  down(step, v, p) {
    if (step.time) { const x = sliderHit({ ...TIME }, p); if (x != null) { v.drag = true; v.dh = x; return true; } }
    v.tap = { x: p.x, y: p.y };
    return true;
  },
  move(step, v, p) {
    if (v.drag) { v.dh = sliderValue({ ...TIME }, p.x); return true; }
    return false;
  },
  /** A tap (no slider in it) judged: the nearest star within a thumb's reach, or the point in the sky it asks for. */
  up(step, v, p) {
    const wasDrag = v.drag;
    v.drag = false;
    const tap = v.tap;
    v.tap = null;
    if (wasDrag || !tap || Math.hypot(p.x - tap.x, p.y - tap.y) > 8) return null;
    const goal = step.goal;
    const { cam, stars } = this.view(step, v);
    if (goal?.point) {
      const d = cam.unproject(p.x, p.y), q = vec(goal.point.az, goal.point.alt);
      if (Math.hypot(p.x - cam.cx, p.y - cam.cy) > cam.R) return null;
      const off = sep(d, q);
      return off <= (goal.tol || 4) ? { ok: true, msg: goal.msg || "Right." } : { ok: false, why: off < 12 ? "Near, not there." : "Not there." };
    }
    let best = null, bd = 22;
    for (const x of stars) { if (x.s[5] > 3.6) continue; const dd = Math.hypot(x.x - p.x, x.y - p.y) - (3.6 - x.s[5]); if (dd < bd) { bd = dd; best = x; } }
    if (!best) return null;
    v.pick = best.s[1] || best.s[2];
    if (!goal) return null;
    if (best.s === star(goal.star)) return { ok: true, msg: goal.msg || `Right: ${best.s[1] || best.s[2]}.` };
    return { ok: false, why: `That is ${best.s[1] || best.s[2]}${best.s[1] && best.s[2] ? ` (${best.s[2]})` : ""}. Not the one.` };
  },
  reveal(step, v) { v.reveal = true; },
};

// ---------- the mariner's astrolabe ----------
const AC = { x: 128, y: 178, R: 86 };
export const alt = {
  init: step => ({ a: step.start ?? 12, drag: false, reveal: false }),
  draw(step, v) {
    const out = [], { x: cx, y: cy, R } = AC, tgt = step.target, sun = step.body === "sun";
    // the sea below the horizon, the plumb line, the horizon
    out.push(`<rect x="0" y="${cy}" width="${W}" height="${H - cy}" class="nv-sea"/>`);
    out.push(line(cx, cy - R - 26, cx, cy + R + 20, "nv-plumb"));
    out.push(line(cx, cy, W - 8, cy, "nv-horizon"));
    out.push(text(W - 10, cy + 14, "horizon", "nv-cap", "end"));
    // the body: far off in the direction of its altitude
    const [bx, by] = elev(cx, cy, 168, tgt);
    out.push(sun ? `<circle cx="${f1(bx)}" cy="${f1(by)}" r="10" class="nv-sun"/>` + [0, 45, 90, 135, 180, 225, 270, 315].map(a => { const [x1, y1] = polar(bx, by, 14, a), [x2, y2] = polar(bx, by, 19, a); return line(x1, y1, x2, y2, "nv-ray"); }).join("") : starShape(bx, by, 11));
    // the ring, its thumb ring and its scale
    out.push(`<circle cx="${cx}" cy="${cy - R - 13}" r="10" class="nv-brass" fill="none"/>`);
    out.push(`<circle cx="${cx}" cy="${cy}" r="${R}" class="nv-disc"/><circle cx="${cx}" cy="${cy}" r="${R - 14}" class="nv-inner"/>`);
    for (let a = 0; a <= 90; a += 5) {
      const [x1, y1] = elev(cx, cy, R, a), [x2, y2] = elev(cx, cy, R - (a % 10 ? 6 : 11), a);
      out.push(line(x1, y1, x2, y2, "nv-tick"));
      if (a % 15 === 0) { const [tx, ty] = elev(cx, cy, R - 23, a); out.push(text(tx, ty + 3.5, String(a), "nv-num", "middle")); }
    }
    // the alidade: an arm through the centre, a vane at each end, and the line of sight beyond
    const a = v.a, [fx, fy] = elev(cx, cy, R + 4, a), [bx2, by2] = elev(cx, cy, R - 8, a + 180);
    out.push(line(bx2, by2, fx, fy, "nv-alidade"));
    for (const k of [R - 10, R - 40]) { const [px, py] = elev(cx, cy, k, a), [qx, qy] = elev(px, py, 7, a + 90), [rx, ry] = elev(px, py, 7, a - 90); out.push(line(qx, qy, rx, ry, "nv-vane")); }
    const [lx, ly] = elev(cx, cy, 168, a);
    out.push(line(fx, fy, lx, ly, "nv-sight"));
    out.push(`<circle cx="${cx}" cy="${cy}" r="5" class="nv-pivot"/>`);
    if (v.reveal) out.push(`<circle cx="${f1(bx)}" cy="${f1(by)}" r="${sun ? 24 : 17}" class="nv-ring hint"/>`);
    out.push(text(W - 12, 24, "Alidade", "nv-cap", "end"), text(W - 12, 46, altText(v.a), "nv-read", "end"));
    if (step.note) out.push(text(W - 12, 64, step.note, "nv-cap", "end"));
    return out.join("");
  },
  at(p) { return clamp(Math.round(Math.atan2(AC.y - p.y, p.x - AC.x) / RAD * 2) / 2, 0, 90); },
  down(step, v, p) { v.drag = true; v.a = this.at(p); return true; },
  move(step, v, p) { if (!v.drag) return false; v.a = this.at(p); return true; },
  up(step, v) { v.drag = false; return null; },
  ready: () => true,
  judge(step, v) {
    const off = v.a - step.target, tol = step.tol ?? 1.5;
    if (Math.abs(off) <= tol) return { ok: true, msg: step.then || `Right: ${altText(v.a)}.` };
    return { ok: false, why: off > 0 ? "The arm points above it: lower the alidade." : "The arm points below it: raise the alidade." };
  },
  reveal(step, v) { v.a = step.target; v.reveal = true; },
};

// ---------- the sextant ----------
const SX = { x: 56, y: 244, R: 188 }, EYE = { x: 284, y: 84, r: 56 }, K_EYE = 18;     // the frame's apex and radius; the eyepiece; its pixels a degree
const FINE = { x1: 44, x2: 250, y: 282, min: 0, max: 0.9, step: 0.1 };
export const sext = {
  init: step => ({ deg: step.start ?? 20, fine: 0, drag: null, reveal: false }),
  reading: v => v.deg + v.fine,
  draw(step, v) {
    const out = [], { x: ax, y: ay, R } = SX, r = this.reading(v), th = r / 2;
    // the frame: a sixth of a circle (60 degrees), read doubled
    out.push(`<path d="M${ax} ${ay}L${f1(ax + R)} ${ay}A${R} ${R} 0 0 0 ${f1(ax + R * cos(60))} ${f1(ay - R * sin(60))}Z" class="nv-frame"/>`);
    out.push(`<path d="M${f1(ax + (R - 14) * cos(0))} ${ay}A${R - 14} ${R - 14} 0 0 0 ${f1(ax + (R - 14) * cos(60))} ${f1(ay - (R - 14) * sin(60))}" class="nv-inner" fill="none"/>`);
    for (let d = 0; d <= 120; d += 2) {
      const a = d / 2, big = d % 10 === 0, [x1, y1] = elev(ax, ay, R, a), [x2, y2] = elev(ax, ay, R - (big ? 12 : 6), a);
      out.push(line(x1, y1, x2, y2, "nv-tick"));
      if (big && d % 20 === 0) { const [tx, ty] = elev(ax, ay, R - 25, a); out.push(text(tx, ty + 3.5, String(d), "nv-num", "middle")); }
    }
    // the index arm and the two mirrors (the index mirror on the arm's pivot, the horizon glass fixed in front of the eye)
    const [px, py] = elev(ax, ay, R + 5, th);
    out.push(line(ax, ay, px, py, "nv-alidade"));
    out.push(`<circle cx="${f1(px)}" cy="${f1(py)}" r="6" class="nv-pivot"/>`);
    out.push(`<circle cx="${ax}" cy="${ay}" r="6" class="nv-pivot"/>`);
    out.push(`<path d="M${ax + 52} ${ay - 2}V${ay - 30}" class="nv-glass"/>`);
    // the eyepiece: what you see
    const e = EYE, off = (step.target - r), starY = e.y - off * K_EYE;
    out.push(`<defs><clipPath id="nveye"><circle cx="${e.x}" cy="${e.y}" r="${e.r}"/></clipPath></defs>`);
    out.push(`<circle cx="${e.x}" cy="${e.y}" r="${e.r}" class="nv-night"/><g clip-path="url(#nveye)"><rect x="${e.x - e.r}" y="${e.y}" width="${e.r * 2}" height="${e.r}" class="nv-sea"/>${line(e.x - e.r, e.y, e.x + e.r, e.y, "nv-horizon")}`);
    if (Math.abs(off) * K_EYE < e.r - 6) out.push(starShape(e.x, starY, 10));
    out.push(`</g><circle cx="${e.x}" cy="${e.y}" r="${e.r}" class="nv-rim"/>`);
    if (Math.abs(off) * K_EYE >= e.r - 6) out.push(text(e.x, off > 0 ? e.y - e.r + 22 : e.y + e.r - 12, off > 0 ? "star higher" : "star lower", "nv-name", "middle"));
    out.push(text(e.x, e.y + e.r + 18, "the eyepiece", "nv-cap", "middle"), text(W - 12, 204, "Arc reads", "nv-cap", "end"), text(W - 12, 228, altText(r), "nv-read", "end"));
    out.push(slider({ ...FINE, value: v.fine, label: "Drum, tenths of a degree", show: `+${f1(v.fine)}°` }));
    return out.join("");
  },
  down(step, v, p) {
    const x = sliderHit(FINE, p);
    if (x != null) { v.drag = "fine"; v.fine = x; return true; }
    v.drag = "arm";
    return this.move(step, v, p) || true;
  },
  move(step, v, p) {
    if (v.drag === "fine") { v.fine = sliderValue(FINE, p.x); return true; }
    if (v.drag !== "arm") return false;
    const a = Math.atan2(SX.y - p.y, p.x - SX.x) / RAD;
    v.deg = clamp(Math.round(a * 2), 0, 119);
    return true;
  },
  up(step, v) { v.drag = null; return null; },
  ready: () => true,
  judge(step, v) {
    const off = step.target - this.reading(v), tol = step.tol ?? 0.15;
    if (Math.abs(off) <= tol + 1e-9) return { ok: true, msg: step.then || `Right: the star sits on the horizon. The arc reads ${altText(this.reading(v))}.` };
    return { ok: false, why: Math.abs(off) > 3 ? (off > 0 ? "The star is out of sight above the horizon: swing the arm further along." : "You are past it: bring the arm back.") : off > 0 ? "The star is still above the horizon: a little further." : "The star has gone below the horizon: a little back." };
  },
  reveal(step, v) { v.deg = Math.floor(step.target); v.fine = Math.round((step.target - v.deg) * 10) / 10; v.reveal = true; },
};

// ---------- the corrections ----------
const HS = { x1: 40, x2: 320, y: 214, min: 5, max: 85, step: 0.1 }, EYEH = { x1: 40, x2: 320, y: 262, min: 1, max: 15, step: 0.5 };
export const corr = {
  init: step => ({ hs: step.hs ?? 41.2833, eye: step.eye ?? 4, drag: null }),
  /** The rows of the reduction for a reading and an eye height: arcminutes of dip and of refraction, and the observed altitude. */
  rows(hs, eye) {
    const dp = dip(eye), app = hs - dp / 60, rf = refraction(app);
    return { dip: dp, app, refr: rf, ho: observedAltitude(hs, eye) };
  },
  draw(step, v) {
    const r = this.rows(v.hs, v.eye), out = [], rows = [
      ["Sextant reading  Hs", altText(v.hs), ""], [`Dip, eye ${f1(v.eye)} m`, `− ${r.dip.toFixed(1)}′`, "sub"], ["Apparent altitude", altText(r.app), ""],
      ["Refraction", `− ${r.refr.toFixed(1)}′`, "sub"], ["Observed altitude  Ho", altText(r.ho), "total"]];
    rows.forEach((row, i) => {
      const y = 38 + i * 29;
      out.push(`<rect x="22" y="${y - 20}" width="316" height="26" class="nv-row ${row[2]}"/>`, text(32, y - 2, row[0], "nv-lab"), text(328, y - 2, row[1], `nv-read sm ${row[2]}`, "end"));
    });
    if (!step.fixed) out.push(slider({ ...HS, value: v.hs, label: "Sextant reading", show: altText(v.hs) }), slider({ ...EYEH, value: v.eye, label: "Height of eye", show: `${f1(v.eye)} m` }));
    return out.join("");
  },
  down(step, v, p) {
    if (step.fixed) return false;
    const a = sliderHit(HS, p), b = sliderHit(EYEH, p);
    if (a != null) { v.drag = "hs"; v.hs = a; return true; }
    if (b != null) { v.drag = "eye"; v.eye = b; return true; }
    return false;
  },
  move(step, v, p) {
    if (v.drag === "hs") v.hs = sliderValue(HS, p.x); else if (v.drag === "eye") v.eye = sliderValue(EYEH, p.x); else return false;
    return true;
  },
  up(step, v) { v.drag = null; return null; },
};
export { chip, inBox };
