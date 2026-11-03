// The Navigation course's instruments of the sea (navigation-sky.js has the sky's), each an object the stage drives; the contract is at
// the head of navigation-sky.js.
//   chart    – a chart with its graticule: mark a latitude and longitude; routes on a Mercator chart, rhumb line and great circle
//   rose     – the compass card: 32 points, a needle to turn, the variation
//   plot     – a plot for dead reckoning: legs of course, speed and time, and a current setting the ship
//   log      – the log line and the sand glass: knots run out in 28 seconds
//   clock    – the chronometer and the longitude strip: longitude is the time's difference
//   clockerr – a clock's error, in miles, by latitude
//   tide     – the moon's age, its phase and the range of the tide
import { RAD, norm360 } from "./landfall-sky.js";
import { mercatorY, greatCircle, greatCirclePoints, rhumb, pointName, POINT_DEG, magneticOf, deadReckon, bearingTo, step as dstep, knotSpacingFt, longitudeAtNoon,
  clockErrorMiles, secondsToDeg, moonAge, litFraction, phaseName, rangeFactor, nearSprings, tideHeight, TIDE_HOURS, SYNODIC, latText, lonText, hhmm, altText } from "./navigation-math.js";
import { W, H, f1, clamp, text, line, polar, starShape, slider, sliderHit, sliderValue, chip, inBox } from "./navigation-ui.js";

const sin = d => Math.sin(d * RAD), cos = d => Math.cos(d * RAD);
const hull = (x, y, s = 1, cls = "nv-hull") => `<path class="${cls}" d="M${f1(x - 13 * s)} ${f1(y)}L${f1(x + 14 * s)} ${f1(y)}L${f1(x + 9 * s)} ${f1(y + 7 * s)}L${f1(x - 9 * s)} ${f1(y + 7 * s)}Z"/><path class="nv-mast" d="M${f1(x)} ${f1(y)}V${f1(y - 17 * s)}M${f1(x)} ${f1(y - 15 * s)}L${f1(x + 9 * s)} ${f1(y - 3 * s)}H${f1(x)}Z"/>`;
const pad2 = n => String(n).padStart(2, "0");

// ---------- the chart ----------
const BOX = { x: 36, y: 12, w: 310, h: 246 };
const yOf = lat => mercatorY(lat) / RAD;                                    // Mercator's northing in degrees of chart
const latOfY = y => (2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2) / RAD;
/** A chart's map between (lat, lon) and the box: the window fitted and centred, plate (a plane chart, cos(lat) squeezing the longitude) or Mercator. */
export function chartMap(step) {
  const { la0, la1, lo0, lo1 } = step.win, merc = step.proj === "merc", mid = (la0 + la1) / 2;
  const height = merc ? yOf(la1) - yOf(la0) : la1 - la0, width = (lo1 - lo0) * (merc ? 1 : cos(mid));
  const room = step.route ? BOX.h - 26 : BOX.h, k = Math.min(room / height, BOX.w / width), pw = width * k, ph = height * k;
  const ox = BOX.x + (BOX.w - pw) / 2, oy = BOX.y + (room - ph) / 2, cx = merc ? 1 : cos(mid);
  return {
    ox, oy, pw, ph,
    xy: (lat, lon) => [ox + (lon - lo0) * cx * k, oy + (merc ? yOf(la1) - yOf(lat) : la1 - lat) * k],
    ll: (x, y) => ({ lat: merc ? latOfY(yOf(la1) - (y - oy) / k) : la1 - (y - oy) / k, lon: lo0 + (x - ox) / (cx * k) }),
  };
}
export const chart = {
  init: step => ({ pin: null, show: { rhumb: true, gc: false }, drag: false, reveal: false }),
  chips(step, v = null) {
    const { a, b } = step.route, rh = rhumb(a.lat, a.lon, b.lat, b.lon), gc = greatCircle(a.lat, a.lon, b.lat, b.lon), n = x => `${Math.round(x).toLocaleString("en")} nm`;
    return [{ id: "rhumb", text: `Rhumb line${v?.show.rhumb ? `   ${n(rh.nm)}` : ""}`, x: 36, y: 259, w: 190, h: 19 }, { id: "gc", text: `Great circle${v?.show.gc ? `   ${n(gc.nm)}` : ""}`, x: 36, y: 281, w: 190, h: 19 }];
  },
  draw(step, v) {
    const m = chartMap(step), { la0, la1, lo0, lo1 } = step.win, g = step.grid || 2, out = [];
    out.push(`<rect x="${f1(m.ox)}" y="${f1(m.oy)}" width="${f1(m.pw)}" height="${f1(m.ph)}" class="nv-paper"/>`);
    for (let la = Math.ceil(la0 / g) * g; la <= la1 + 1e-9; la += g) {
      const [x1, y] = m.xy(la, lo0), [x2] = m.xy(la, lo1);
      out.push(line(x1, y, x2, y, "nv-grat"), text(x1 - 4, y + 3.5, `${Math.abs(la)}°${la < 0 ? "S" : "N"}`, "nv-num", "end"));
    }
    const gl = step.gridLon || g;
    for (let lo = Math.ceil(lo0 / gl) * gl; lo <= lo1 + 1e-9; lo += gl) {
      const [x, y1] = m.xy(la1, lo), [, y2] = m.xy(la0, lo);
      out.push(line(x, y1, x, y2, "nv-grat"), text(x, y2 + 13, `${Math.abs(lo)}°${lo < 0 ? "W" : "E"}`, "nv-num", "middle"));
    }
    out.push(`<rect x="${f1(m.ox)}" y="${f1(m.oy)}" width="${f1(m.pw)}" height="${f1(m.ph)}" class="nv-frame2"/>`);
    if (step.showMarks || v.reveal) for (const k of step.marks || []) { const [x, y] = m.xy(k.lat, k.lon); out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="3.4" class="nv-port"/>${k.left ? text(x - 6, y + 12, k.name, "nv-name", "end") : text(x + 6, y - 5, k.name, "nv-name")}`); }
    if (step.route) {
      const { a, b } = step.route, [ax, ay] = m.xy(a.lat, a.lon), [bx, by] = m.xy(b.lat, b.lon), rh = rhumb(a.lat, a.lon, b.lat, b.lon), gc = greatCircle(a.lat, a.lon, b.lat, b.lon);
      if (v.show.gc) out.push(`<path d="M${greatCirclePoints(a.lat, a.lon, b.lat, b.lon).map(p => m.xy(p.lat, p.lon).map(f1).join(" ")).join("L")}" class="nv-gc" fill="none"/>`);
      if (v.show.rhumb) out.push(line(ax, ay, bx, by, "nv-rhumb"));
      out.push(`<circle cx="${f1(ax)}" cy="${f1(ay)}" r="3.6" class="nv-port"/><circle cx="${f1(bx)}" cy="${f1(by)}" r="3.6" class="nv-port"/>`, text(ax - 6, ay + 14, a.name, "nv-name", "end"), text(bx + 6, by + 4, b.name, "nv-name"));
      for (const c of this.chips(step, v)) out.push(chip({ ...c, on: v.show[c.id] }));
    }
    if (v.pin) {
      const [x, y] = m.xy(v.pin.lat, v.pin.lon);
      out.push(`<path d="M${f1(x - 9)} ${f1(y)}H${f1(x + 9)}M${f1(x)} ${f1(y - 9)}V${f1(y + 9)}" class="nv-cross"/><circle cx="${f1(x)}" cy="${f1(y)}" r="5" class="nv-ring"/>`);
      out.push(text(m.ox + 8, m.oy + 18, `${latText(v.pin.lat)}`, "nv-read sm"), text(m.ox + 8, m.oy + 34, `${lonText(v.pin.lon)}`, "nv-read sm"));
    } else if (step.goal) out.push(text(m.ox + 8, m.oy + 18, "Tap the chart", "nv-cap"));
    if (v.reveal && step.goal) { const [x, y] = m.xy(step.goal.lat, step.goal.lon); out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="14" class="nv-ring hint"/>`); }
    return out.join("");
  },
  place(step, p) {
    const m = chartMap(step), { la0, la1, lo0, lo1 } = step.win, q = m.ll(clamp(p.x, m.ox, m.ox + m.pw), clamp(p.y, m.oy, m.oy + m.ph));
    return { lat: clamp(q.lat, la0, la1), lon: clamp(q.lon, lo0, lo1) };
  },
  down(step, v, p) {
    if (step.route) {
      for (const c of this.chips(step)) if (inBox(c, p)) { v.show[c.id] = !v.show[c.id]; return true; }
      return false;
    }
    if (!step.goal) return false;
    const m = chartMap(step);
    if (p.x < m.ox - 4 || p.x > m.ox + m.pw + 4 || p.y < m.oy - 4 || p.y > m.oy + m.ph + 4) return false;
    v.drag = true;
    v.pin = this.place(step, p);
    return true;
  },
  move(step, v, p) { if (!v.drag) return false; v.pin = this.place(step, p); return true; },
  up(step, v) { v.drag = false; return null; },
  ready: (step, v) => !!v.pin,
  judge(step, v) {
    const g = step.goal, dl = v.pin.lat - g.lat, dn = v.pin.lon - g.lon;
    if (Math.abs(dl) <= g.tolLat && Math.abs(dn) <= g.tolLon) return { ok: true, msg: g.msg || "Right." };
    const parts = [];
    if (Math.abs(dl) > g.tolLat) parts.push(dl > 0 ? "too far north" : "too far south");
    if (Math.abs(dn) > g.tolLon) parts.push(dn > 0 ? "too far east" : "too far west");
    return { ok: false, why: `Not there: ${parts.join(" and ")}.` };
  },
  reveal(step, v) { v.pin = { lat: step.goal.lat, lon: step.goal.lon }; v.reveal = true; },
};

// ---------- the compass card ----------
const RC = { x: 180, y: 152, R: 104 };
export const rose = {
  init: step => ({ deg: step.start ?? 0, drag: false, reveal: false }),
  draw(step, v) {
    const { x: cx, y: cy, R } = RC, out = [];
    out.push(`<circle cx="${cx}" cy="${cy}" r="${R + 10}" class="nv-disc"/><circle cx="${cx}" cy="${cy}" r="${R - 26}" class="nv-inner"/>`);
    for (let i = 0; i < 32; i++) {
      const d = i * POINT_DEG, len = i % 8 === 0 ? 16 : i % 4 === 0 ? 11 : i % 2 === 0 ? 7 : 4, [x1, y1] = polar(cx, cy, R, d), [x2, y2] = polar(cx, cy, R - len, d);
      out.push(line(x1, y1, x2, y2, i % 4 === 0 ? "nv-tick big" : "nv-tick"));
    }
    for (const [d, ch] of [[0, "N"], [45, "NE"], [90, "E"], [135, "SE"], [180, "S"], [225, "SW"], [270, "W"], [315, "NW"]]) {
      const [x, y] = polar(cx, cy, R - 40 + (d % 90 ? 4 : 0), d);
      out.push(text(x, y + (d % 90 ? 3.5 : 5), ch, d % 90 ? "nv-num" : "nv-compass", "middle"));
    }
    for (let d = 0; d < 360; d += 30) { const [x, y] = polar(cx, cy, R + 21, d); out.push(text(x, y + 3.5, String(d).padStart(3, "0"), "nv-num dim", "middle")); }
    if (step.variation != null) {
      const [x1, y1] = polar(cx, cy, R + 10, step.variation), [x2, y2] = polar(cx, cy, R + 2, step.variation), [tx, ty] = polar(cx, cy, R + 35, step.variation);
      out.push(line(x1, y1, x2, y2, "nv-magn"), `<circle cx="${f1(x1)}" cy="${f1(y1)}" r="3.4" class="nv-magn-dot"/>`, text(tx, ty + 3.5, "mag N", "nv-name hot", "middle"));
    }
    const [nx, ny] = polar(cx, cy, R - 6, v.deg), [bx, by] = polar(cx, cy, 18, v.deg + 180);
    out.push(line(bx, by, nx, ny, "nv-needle"), `<circle cx="${cx}" cy="${cy}" r="5" class="nv-pivot"/>`);
    if (v.reveal && step.goal) { const [x, y] = polar(cx, cy, R - 6, step.goal.deg); out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="9" class="nv-ring hint"/>`); }
    out.push(text(12, 22, pointName(v.deg), "nv-read sm"), text(12, 42, `${String(Math.round(v.deg) % 360).padStart(3, "0")}° true`, "nv-cap"));
    if (step.variation != null) out.push(text(W - 12, 22, `Variation ${Math.abs(step.variation)}° ${step.variation < 0 ? "W" : "E"}`, "nv-cap", "end"), text(W - 12, 42, `${String(Math.round(magneticOf(v.deg, step.variation))).padStart(3, "0")}° magnetic`, "nv-cap", "end"));
    return out.join("");
  },
  at(step, p) {
    let d = norm360(Math.atan2(p.x - RC.x, RC.y - p.y) / RAD);
    d = step.snapPoints ? Math.round(d / POINT_DEG) * POINT_DEG : Math.round(d);
    return norm360(d);
  },
  down(step, v, p) { v.drag = true; v.deg = this.at(step, p); return true; },
  move(step, v, p) { if (!v.drag) return false; v.deg = this.at(step, p); return true; },
  up(step, v) { v.drag = false; return null; },
  ready: () => true,
  judge(step, v) {
    const g = step.goal, off = Math.abs(((v.deg - g.deg + 540) % 360) - 180);
    return off <= (g.tol ?? 3) ? { ok: true, msg: g.msg || "Right." } : { ok: false, why: off < 30 ? "Close: a little further round." : "Not there." };
  },
  reveal(step, v) { v.deg = step.goal.deg; v.reveal = true; },
};

// ---------- the plot ----------
const PB = { x: 24, y: 18, w: 312, h: 250 };
/** A plot's window: the nm at its middle and the nm to the left of it (half the width). */
export function plotView(step) {
  const start = step.start || [0, 0], pts = [start];
  let p = start;
  for (const l of step.legs || []) { p = dstep(p, l.c, l.k, l.h); pts.push(p); }
  if (step.cur) pts.push(deadReckon(start, step.legs, step.cur));
  if (step.play) pts.push(dstep(start, 0, step.play.k, step.play.h), dstep(start, 180, step.play.k, step.play.h), dstep(start, 90, step.play.k, step.play.h), dstep(start, 270, step.play.k, step.play.h));
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
  const half = Math.max((Math.max(...xs) - Math.min(...xs)) / 2 * 1.35, (Math.max(...ys) - Math.min(...ys)) / 2 * 1.35 * PB.w / PB.h, step.minHalf || 8);
  const half5 = Math.ceil(half / 2) * 2, s = PB.w / 2 / half5;
  return { mx, my, half: half5, s, xy: ([x, y]) => [PB.x + PB.w / 2 + (x - mx) * s, PB.y + PB.h / 2 - (y - my) * s], nm: (px, py) => [mx + (px - PB.x - PB.w / 2) / s, my - (py - PB.y - PB.h / 2) / s] };
}
export const plot = {
  init: step => ({ pin: null, course: step.play?.start ?? 90, drag: false, reveal: false }),
  truth: step => deadReckon(step.start || [0, 0], step.legs || [], step.cur || null),
  draw(step, v) {
    const vw = plotView(step), out = [], start = step.start || [0, 0];
    const gs = [1, 2, 5, 10, 20, 50].find(g => g * vw.s >= 26);
    out.push(`<rect x="${PB.x}" y="${PB.y}" width="${PB.w}" height="${PB.h}" class="nv-paper"/><g>`);
    for (let x = Math.ceil((vw.mx - vw.half) / gs) * gs; x <= vw.mx + vw.half; x += gs) { const [px] = vw.xy([x, 0]); out.push(line(px, PB.y, px, PB.y + PB.h, "nv-grat")); }
    for (let y = Math.ceil((vw.my - PB.h / 2 / vw.s) / gs) * gs; y <= vw.my + PB.h / 2 / vw.s; y += gs) { const [, py] = vw.xy([0, y]); out.push(line(PB.x, py, PB.x + PB.w, py, "nv-grat")); }
    out.push(`</g><rect x="${PB.x}" y="${PB.y}" width="${PB.w}" height="${PB.h}" class="nv-frame2"/>`);
    // scale bar and north
    const bar = gs * vw.s;
    out.push(line(PB.x + 10, PB.y + PB.h - 12, PB.x + 10 + bar, PB.y + PB.h - 12, "nv-bar"), text(PB.x + 10 + bar / 2, PB.y + PB.h - 17, `${gs} nm`, "nv-num", "middle"));
    out.push(line(PB.x + PB.w - 16, PB.y + 34, PB.x + PB.w - 16, PB.y + 12, "nv-bar"), text(PB.x + PB.w - 16, PB.y + 46, "N", "nv-num", "middle"));
    let p = start;
    const [sx, sy] = vw.xy(start);
    (step.legs || []).forEach((l, i) => {
      const q = dstep(p, l.c, l.k, l.h), [x1, y1] = vw.xy(p), [x2, y2] = vw.xy(q), [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
      out.push(line(x1, y1, x2, y2, "nv-leg"), `<circle cx="${f1(x2)}" cy="${f1(y2)}" r="3" class="nv-fixp"/>`);
      const side = sin(l.c) > 0 ? -1 : 1, [lx, ly] = [mx + side * 0, my + (cos(l.c) >= 0 ? 15 : -8) * 1];
      out.push(text(clamp(mx, PB.x + 60, PB.x + PB.w - 60), clamp(ly, PB.y + 12, PB.y + PB.h - 6), `${String(l.c).padStart(3, "0")}° · ${l.k} kn · ${l.h} h`, "nv-name leg", "middle"));
      p = q;
    });
    if (step.cur && (v.reveal || v.done || step.showCur)) {
      const dr = deadReckon(start, step.legs, null), tr = this.truth(step), [x1, y1] = vw.xy(dr), [x2, y2] = vw.xy(tr);
      out.push(`<circle cx="${f1(x1)}" cy="${f1(y1)}" r="5" class="nv-dr"/>`, line(x1, y1, x2, y2, "nv-cur"), `<circle cx="${f1(x2)}" cy="${f1(y2)}" r="5" class="nv-true"/>`);
    }
    if (step.play) {
      const q = dstep(start, v.course, step.play.k, step.play.h), [qx, qy] = vw.xy(q), nm = step.play.k * step.play.h;
      out.push(line(sx, sy, qx, qy, "nv-leg"), `<circle cx="${f1(qx)}" cy="${f1(qy)}" r="4" class="nv-fixp"/>`);
      out.push(text(12, H - 16, `Course ${String(v.course).padStart(3, "0")}°  ·  ${step.play.k} kn × ${step.play.h} h = ${nm} nm`, "nv-cap"));
      out.push(text(12, H - 2, `North ${(nm * cos(v.course)).toFixed(1)} nm  ·  ${v.course <= 180 ? "East" : "West"} ${Math.abs(nm * sin(v.course)).toFixed(1)} nm`, "nv-cap"));
    }
    out.push(hull(sx, sy - 2, 0.9), text(sx + 6, sy + 16, step.startName || "A", "nv-name"));
    if (v.pin) { const [x, y] = vw.xy(v.pin); out.push(`<path d="M${f1(x - 8)} ${f1(y)}H${f1(x + 8)}M${f1(x)} ${f1(y - 8)}V${f1(y + 8)}" class="nv-cross"/><circle cx="${f1(x)}" cy="${f1(y)}" r="5" class="nv-ring"/>`); }
    if (v.reveal && step.goal) { const [x, y] = vw.xy(this.truth(step)); out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.max(12, step.goal.tol * vw.s))}" class="nv-ring hint"/>`); }
    if (step.goal && !v.pin) out.push(text(12, H - 6, "Tap where she is", "nv-cap"));
    return out.join("");
  },
  down(step, v, p) {
    const vw = plotView(step);
    if (step.play) { v.drag = true; v.course = this.course(step, p); return true; }
    if (!step.goal || p.x < PB.x || p.x > PB.x + PB.w || p.y < PB.y || p.y > PB.y + PB.h) return false;
    v.drag = true;
    v.pin = vw.nm(p.x, p.y);
    return true;
  },
  course(step, p) {
    const [sx, sy] = plotView(step).xy(step.start || [0, 0]);
    return Math.round(norm360(Math.atan2(p.x - sx, sy - p.y) / RAD) / 5) * 5 % 360;
  },
  move(step, v, p) {
    if (!v.drag) return false;
    if (step.play) v.course = this.course(step, p); else v.pin = plotView(step).nm(clamp(p.x, PB.x, PB.x + PB.w), clamp(p.y, PB.y, PB.y + PB.h));
    return true;
  },
  up(step, v) { v.drag = false; return null; },
  ready: (step, v) => !!v.pin,
  judge(step, v) {
    const g = step.goal, t = this.truth(step), off = Math.hypot(v.pin[0] - t[0], v.pin[1] - t[1]);
    v.done = off <= g.tol;
    if (v.done) return { ok: true, msg: g.msg || `Right: ${f1(t[1])} nm ${t[1] >= 0 ? "north" : "south"}, ${f1(Math.abs(t[0]))} nm ${t[0] >= 0 ? "east" : "west"} of where she started.` };
    return { ok: false, why: step.cur && Math.hypot(v.pin[0] - deadReckon(step.start || [0, 0], step.legs, null)[0], v.pin[1] - deadReckon(step.start || [0, 0], step.legs, null)[1]) <= g.tol ? "That is where her own course and speed take her. The current has moved her too." : `${Math.round(off)} nm out: ${off > 2 * g.tol ? "check the course and the distance" : "close: look at the course and the distance again"}.` };
  },
  reveal(step, v) { v.pin = this.truth(step); v.reveal = true; v.done = true; },
};

// ---------- the log ----------
export const log = {
  init: step => ({ kn: step.speed ?? 6, drag: false }),
  SL: { x1: 44, x2: 316, y: 266, min: 0, max: 12, step: 0.5 },
  draw(step, v) {
    const out = [], run = Math.round(v.kn), L = 20, sternX = 292, y = 120, ft = knotSpacingFt(28);
    out.push(`<rect x="0" y="${y + 8}" width="${W}" height="${H - y - 8}" class="nv-sea"/>`);
    out.push(`<path d="M${sternX - 6} ${y + 8}q-30 6-100 0q-70-6-150 2" class="nv-wake" fill="none"/>`);
    out.push(hull(sternX + 30, y + 2, 2));
    // the glass
    out.push(`<path d="M30 28h28M30 74h28M34 28q0 22 11 23q-11 1-11 23M54 28q0 22-11 23q11 1 11 23" class="nv-brass" fill="none"/>`, text(70, 56, "28 s", "nv-read sm"));
    // the line: a stray line astern, then a knot every 47 ft 3 in
    const stray = 22, endX = sternX - stray - run * L;
    out.push(line(sternX, y + 6, Math.max(endX, 24), y + 6, "nv-rope"));
    for (let i = 1; i <= 12; i++) {
      const x = sternX - stray - i * L;
      if (x < 22) break;
      out.push(line(x, y - 3, x, y + 15, i <= run ? "nv-knot on" : "nv-knot"), text(x, y + 30, String(i), `nv-num${i <= run ? "" : " dim"}`, "middle"));
    }
    out.push(`<path d="M${endX} ${y + 6}l-2 -13a14 14 0 0 0 0 26z" class="nv-chip-board"/>`);
    out.push(text(sternX - stray / 2, y - 12, "stray line", "nv-cap", "middle"));
    out.push(text(W - 12, 24, `${run} knot${run === 1 ? "" : "s"} run out`, "nv-read", "end"), text(W - 12, 44, `= ${run} nautical mile${run === 1 ? "" : "s"} an hour`, "nv-cap", "end"));
    out.push(text(W / 2, 214, `knots ${Math.floor(ft)} ft ${Math.round((ft % 1) * 12)} in apart`, "nv-cap", "middle"));
    out.push(slider({ ...this.SL, value: v.kn, label: "The ship's speed", show: `${f1(v.kn)} kn` }));
    return out.join("");
  },
  down(step, v, p) { const x = sliderHit(this.SL, p); if (x == null) return false; v.drag = true; v.kn = x; return true; },
  move(step, v, p) { if (!v.drag) return false; v.kn = sliderValue(this.SL, p.x); return true; },
  up(step, v) { v.drag = false; return null; },
};

// ---------- the chronometer ----------
const ST = { x1: 30, x2: 330, y: 92 }, GS = { x1: 40, x2: 320, y: 286, min: 0, max: 24, step: 1 / 60 };
export const clock = {
  init: step => ({ g: step.g ?? 12, pin: null, drag: null, reveal: false }),
  lonOf: (step, x) => { const [a, b] = step.range; return a + (x - ST.x1) / (ST.x2 - ST.x1) * (b - a); },
  xOf: (step, lon) => { const [a, b] = step.range; return ST.x1 + (lon - a) / (b - a) * (ST.x2 - ST.x1); },
  draw(step, v) {
    const out = [], [a, b] = step.range, lon = longitudeAtNoon(v.g), fixed = !!step.goal;
    // the strip of longitudes
    out.push(`<rect x="${ST.x1}" y="${ST.y - 36}" width="${ST.x2 - ST.x1}" height="58" class="nv-paper"/>`);
    for (let l = Math.ceil(a / 10) * 10; l <= b; l += 10) {
      const x = this.xOf(step, l);
      out.push(line(x, ST.y - 36, x, ST.y + 22, l === 0 ? "nv-tick big" : "nv-grat"), text(x, ST.y + 36, `${Math.abs(l)}°${l < 0 ? "W" : l > 0 ? "E" : ""}`, "nv-num", "middle"));
      if (l === 0) out.push(text(x, ST.y - 42, "Greenwich", "nv-cap", "middle"));
    }
    const shown = fixed ? v.pin ?? (v.reveal ? step.goal.lon : null) : lon;
    if (shown != null && shown >= a && shown <= b) out.push(hull(this.xOf(step, shown), ST.y - 6, 1.1), `<path d="M${this.xOf(step, shown)} ${ST.y + 8}v14" class="nv-cross"/>`);
    // the dial: Greenwich time
    const cx = 84, cy = 184, r = 50, hr = Math.floor(v.g) % 12 + (v.g % 1) * 1, mn = (v.g % 1) * 60;
    out.push(`<circle cx="${cx}" cy="${cy}" r="${r + 6}" class="nv-disc"/><circle cx="${cx}" cy="${cy}" r="${r}" class="nv-inner"/>`);
    for (let i = 0; i < 12; i++) { const [x1, y1] = polar(cx, cy, r, i * 30), [x2, y2] = polar(cx, cy, r - (i % 3 ? 5 : 9), i * 30); out.push(line(x1, y1, x2, y2, "nv-tick")); }
    const [hx, hy] = polar(cx, cy, r - 24, hr * 30), [mx, my] = polar(cx, cy, r - 7, mn * 6);
    out.push(line(cx, cy, hx, hy, "nv-hand h"), line(cx, cy, mx, my, "nv-hand m"), `<circle cx="${cx}" cy="${cy}" r="3.4" class="nv-pivot"/>`);
    out.push(text(cx, cy + r + 22, "Greenwich time", "nv-cap", "middle"));
    // the sum
    const diff = 12 - v.g, dh = Math.abs(diff), hrs = Math.floor(dh), mins = Math.round((dh - hrs) * 60);
    const row = (y, a, b) => out.push(text(150, y, a, "nv-cap"), text(334, y, b, "nv-read sm", "end"));
    row(160, "Chronometer", hhmm(v.g));
    row(184, "Sun on meridian", "12:00");
    row(208, "Difference", `${hrs} h ${pad2(mins)} min`);
    row(232, "× 15° an hour", fixed && !v.reveal ? "?" : lonText(lon));
    if (!fixed) out.push(slider({ ...GS, value: v.g, label: "Chronometer reads", show: hhmm(v.g) }));
    else out.push(text(W / 2, 284, "Tap the strip where the ship is", "nv-cap", "middle"));
    return out.join("");
  },
  down(step, v, p) {
    if (!step.goal) { const x = sliderHit(GS, p); if (x == null) return false; v.drag = "g"; v.g = x; return true; }
    if (p.y > ST.y + 26 || p.y < ST.y - 40 || p.x < ST.x1 - 6 || p.x > ST.x2 + 6) return false;
    v.drag = "pin";
    v.pin = clamp(this.lonOf(step, p.x), step.range[0], step.range[1]);
    return true;
  },
  move(step, v, p) {
    if (v.drag === "g") v.g = sliderValue(GS, p.x); else if (v.drag === "pin") v.pin = clamp(this.lonOf(step, p.x), step.range[0], step.range[1]); else return false;
    return true;
  },
  up(step, v) { v.drag = null; return null; },
  ready: (step, v) => v.pin != null,
  judge(step, v) {
    const off = v.pin - step.goal.lon;
    if (Math.abs(off) <= step.goal.tol) { v.reveal = true; return { ok: true, msg: step.goal.msg }; }
    return { ok: false, why: off > 0 ? "Too far east." : "Too far west." };
  },
  reveal(step, v) { v.pin = step.goal.lon; v.reveal = true; },
};

// ---------- a clock's error in miles ----------
const ES = { x1: 40, x2: 320, y: 232, min: 0, max: 300, step: 5 }, LS = { x1: 40, x2: 320, y: 280, min: 0, max: 70, step: 5 };
const minSec = s => `${Math.floor(s / 60)} min ${pad2(Math.round(s % 60))} s`;
export const clockerr = {
  init: step => ({ err: step.err ?? 60, lat: step.lat ?? 0, drag: null }),
  draw(step, v) {
    const out = [], nm = clockErrorMiles(v.err, v.lat), scale = 3, tx = 70, bx = tx + nm * scale, y = 62, deg = secondsToDeg(v.err);
    out.push(`<rect x="0" y="${y + 8}" width="${W}" height="30" class="nv-sea"/>`);
    out.push(hull(tx, y, 1.2), hull(Math.min(bx, W - 24), y, 1.2, "nv-hull ghost"), text(tx, y - 26, "true place", "nv-cap", "middle"), text(Math.min(bx, W - 24), y + 46, "by the clock", "nv-cap", "middle"));
    out.push(line(tx, y + 20, Math.min(bx, W - 24), y + 20, "nv-bar"));
    out.push(text(W / 2, 140, minSec(v.err), "nv-read", "middle"), text(W / 2, 162, `= ${altText(deg)} of longitude`, "nv-cap", "middle"));
    out.push(text(W / 2, 192, `${nm.toFixed(1)} nautical miles out in longitude at ${v.lat}°`, "nv-read sm", "middle"));
    out.push(text(W / 2, 212, `(${(clockErrorMiles(v.err, 0)).toFixed(1)} at the equator)`, "nv-cap", "middle"));
    out.push(slider({ ...ES, value: v.err, label: "The clock's error", show: minSec(v.err) }));
    const mx = ES.x1 + 120 / 300 * (ES.x2 - ES.x1);
    out.push(line(mx, ES.y - 7, mx, ES.y + 7, "nv-cross"), text(mx, ES.y + 22, "2 min", "nv-num", "middle"));
    out.push(slider({ ...LS, value: v.lat, label: "Latitude", show: `${v.lat}°` }));
    return out.join("");
  },
  down(step, v, p) {
    const a = sliderHit(ES, p), b = sliderHit(LS, p);
    if (a != null) { v.drag = "e"; v.err = a; return true; }
    if (b != null) { v.drag = "l"; v.lat = b; return true; }
    return false;
  },
  move(step, v, p) { if (v.drag === "e") v.err = sliderValue(ES, p.x); else if (v.drag === "l") v.lat = sliderValue(LS, p.x); else return false; return true; },
  up(step, v) { v.drag = null; return null; },
};

// ---------- the moon and the tide ----------
const AS = { x1: 40, x2: 320, y: 278, min: 0, max: 29.5, step: 0.5 };
/** The moon's lit part as a path on a disc of radius r at (cx, cy): waxing lights the right edge (seen from the north). */
export function moonPath(age, cx, cy, r) {
  const f = age / SYNODIC, th = 2 * Math.PI * f, k = Math.cos(th);
  if (f < 0.015 || f > 0.985) return "";
  if (f > 0.485 && f < 0.515) return `M${cx} ${cy - r}A${r} ${r} 0 1 1 ${cx} ${cy + r}A${r} ${r} 0 1 1 ${cx} ${cy - r}Z`;
  const rx = Math.abs(k) * r, waxing = f < 0.5, edge = waxing ? 1 : 0, crescent = waxing ? f < 0.25 : f > 0.75;
  // the lit limb from top to bottom, on the right (waxing) or the left; then the terminator back up, bulging into the lit side in a crescent and out
  // of it in a gibbous moon (sweep 1 goes clockwise on the screen)
  return `M${cx} ${cy - r}A${r} ${r} 0 0 ${edge} ${cx} ${cy + r}A${f1(rx)} ${r} 0 0 ${crescent ? 1 - edge : edge} ${cx} ${cy - r}Z`;
}
export const tide = {
  init: step => ({ age: step.age ?? 3, drag: false, reveal: false }),
  draw(step, v) {
    const out = [], fac = rangeFactor(v.age), cx = 62, cy = 66, r = 38, bx = 136, bw = 204, mid = 112;
    out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" class="nv-moon-dark"/>`, `<path d="${moonPath(v.age, cx, cy, r)}" class="nv-moon"/>`, `<circle cx="${cx}" cy="${cy}" r="${r}" class="nv-rim"/>`);
    out.push(text(cx, cy + r + 18, phaseName(v.age), "nv-cap", "middle"), text(cx, cy + r + 36, `${f1(v.age)} days old`, "nv-num", "middle"));
    // two tides in a lunar day
    out.push(line(bx, mid, bx + bw, mid, "nv-grat"), `<rect x="${bx}" y="22" width="${bw}" height="${180 - 22}" class="nv-frame2"/>`);
    const curve = (a, cls) => {
      const pts = [];
      for (let i = 0; i <= 60; i++) { const h = i / 60 * 2 * TIDE_HOURS; pts.push(`${f1(bx + h / (2 * TIDE_HOURS) * bw)} ${f1(mid - tideHeight(h, 2) * a * 30)}`); }
      return `<path d="M${pts.join("L")}" class="${cls}" fill="none"/>`;
    };
    out.push(curve(1, "nv-mean"), curve(fac, "nv-tide"));
    out.push(text(bx + 6, 38, "high water", "nv-cap"), text(bx + bw / 2, 196, "two tides in a lunar day, 24 h 50 min", "nv-cap", "middle"));
    const label = fac >= 1.3 ? "spring tides" : fac <= 0.7 ? "neap tides" : "between";
    out.push(text(W - 12, 222, `${label}`, "nv-read", "end"), text(12, 222, `range × ${fac.toFixed(2)} of the average`, "nv-cap"));
    out.push(slider({ ...AS, value: v.age, label: "Moon's age", show: `${f1(v.age)} d` }));
    if (v.reveal && step.goal) for (const d of [0, SYNODIC / 2]) out.push(line(AS.x1 + d / 29.5 * (AS.x2 - AS.x1), AS.y - 10, AS.x1 + d / 29.5 * (AS.x2 - AS.x1), AS.y + 10, "nv-cross"));
    return out.join("");
  },
  down(step, v, p) { const x = sliderHit(AS, p); if (x == null) return false; v.drag = true; v.age = x; return true; },
  move(step, v, p) { if (!v.drag) return false; v.age = sliderValue(AS, p.x); return true; },
  up(step, v) { v.drag = false; return null; },
  ready: () => true,
  judge(step, v) {
    const quarter = Math.abs(v.age - SYNODIC / 4) <= 2 || Math.abs(v.age - 3 * SYNODIC / 4) <= 2, ok = step.goal.springs ? nearSprings(v.age, 2) : quarter;
    return ok ? { ok: true, msg: step.goal.msg } : { ok: false, why: step.goal.springs ? "The tide is not at its biggest here: the moon is neither new nor full." : "Not at a quarter: neaps come when the moon is half lit." };
  },
  reveal(step, v) { v.age = step.goal.springs ? SYNODIC / 2 : SYNODIC / 4; v.reveal = true; },
};
