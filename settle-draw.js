// Settle's foundry in 2D (redesign of 23 November 2026): the crucibles drawn in section, as the woodcuts of Agricola's De Re Metallica
// show a furnace cut open, standing in the glow of the hearth. Each measure of metal is a band of molten colour with a bright line
// where two metals meet, a slow shimmer and the metal's alchemical sign (so colour is never the only clue). The page hands over a
// scene each frame (settle.js); this draws it and answers which crucible is under a finger. One canvas, no WebGL.
//
// scene: { caps, cups: [{ bands: [{ m, y (the slot it lies at, from the foot; fractional while it moves), h (0..1, a measure
// draining or filling), a (alpha), hot (0..1, white heat of a cast) }], lift (0..1), go: { to, k (0..1) } (carried over the
// crucible it pours into and tipped, k of the way), picked, target (a pour may go here) }], stream: { from, to, m, t0..t1 (the
// stream's head and tail, 0..1) } | null, hint: { from, to } | null, kinds: each crucible "", "slag" (an iron slag pot) or "teapot"
// (a ladle that pours from its foot, its spout up its side) }
import { METALS } from "./settle-alloys.js";

const GLYPH = Object.fromEntries(Object.entries(METALS).map(([k, m]) => [k, new Path2D(m.glyph)]));
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const mixHex = (hex, to, t) => { const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16); const c = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return `rgb(${c(16)},${c(8)},${c(0)})`; };

export function createFlat(host) {
  const canvas = document.createElement("canvas");
  canvas.className = "st-canvas";
  canvas.setAttribute("role", "img");
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  let W = 1, H = 1, dpr = 1, g = null, caps = [];
  const embers = Array.from({ length: 26 }, (_, i) => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random(), p: i * 1.7 }));
  let bursts = [], smokes = [], kinds = [];

  function resize() {
    W = host.clientWidth || 1; H = host.clientHeight || 1; dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    measure();
  }
  /** Where things stand: each crucible's middle x, its inner width and a measure's height, the hearth line. */
  function measure() {
    if (!caps.length) return;
    const n = caps.length, top = Math.max(...caps), side = Math.min(W * 0.04, 18), gap = Math.min(W / n * 0.22, 34);
    const cw = Math.min((W - 2 * side - gap * (n - 1)) / n, 150);
    const floor = H - Math.max(26, H * 0.09), room = floor - Math.max(70, H * 0.2);       // room above for the pour's arc
    const mh = Math.min(room / (top + 0.7), cw * 0.8);
    const x0 = (W - (n * cw + (n - 1) * gap)) / 2;
    g = { cw, mh, floor, wall: Math.max(5, cw * 0.09), xs: caps.map((_, i) => x0 + i * (cw + gap) + cw / 2) };
  }
  const outerOf = i => { const iw = g.cw * 0.82, ih = caps[i] * g.mh; return { iw, ih, ow: iw + 2 * g.wall, oh: ih + g.wall * 1.2 }; };

  // the crucible's outline, its foot at (0,0): a little wider at the mouth, a rounded foot
  function cruciblePath(w, h, flare) {
    const p = new Path2D(), r = Math.min(w * 0.22, h * 0.3);
    p.moveTo(-w / 2 - flare, -h);
    p.lineTo(-w / 2, -r);
    p.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0);
    p.lineTo(w / 2 - r, 0);
    p.quadraticCurveTo(w / 2, 0, w / 2, -r);
    p.lineTo(w / 2 + flare, -h);
    p.closePath();
    return p;
  }
  function drawBackdrop(now) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0f0b09"); bg.addColorStop(0.6, "#1d130d"); bg.addColorStop(1, "#2a170c");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // the hearth's glow behind the crucibles, breathing slowly
    const breathe = 0.85 + 0.15 * Math.sin(now / 1900);
    const glow = ctx.createRadialGradient(W / 2, H * 1.05, H * 0.05, W / 2, H * 1.05, Math.max(W, H) * 0.85);
    glow.addColorStop(0, `rgba(255,140,50,${0.42 * breathe})`); glow.addColorStop(0.35, `rgba(200,80,25,${0.18 * breathe})`); glow.addColorStop(1, "rgba(60,20,5,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    // the hearth stone and its bed of coals
    const floor = g ? g.floor : H * 0.9;
    const stone = ctx.createLinearGradient(0, floor, 0, H);
    stone.addColorStop(0, "#3a2416"); stone.addColorStop(1, "#140c08");
    ctx.fillStyle = stone; ctx.fillRect(0, floor, W, H - floor);
    for (let k = 0; k < 14; k++) {
      const x = ((k * 97.13) % 1) * W + (k % 3) * 9, y = floor + 6 + (k % 4) * (H - floor) * 0.18, r = 10 + (k % 5) * 5;
      const flick = 0.55 + 0.45 * Math.sin(now / (500 + k * 37) + k);
      const c = ctx.createRadialGradient(x, y, 0, x, y, r);
      c.addColorStop(0, `rgba(255,${150 + (k % 4) * 20},60,${0.55 * flick})`); c.addColorStop(1, "rgba(255,90,20,0)");
      ctx.fillStyle = c; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    ctx.fillStyle = "rgba(255,190,120,.25)"; ctx.fillRect(0, floor, W, 1);
    // embers drifting up
    for (const e of embers) {
      const t = (now / 9000 * e.s + e.y) % 1, x = (e.x * W + Math.sin(now / 1300 + e.p) * 14) % W, y = H - t * H * 0.95;
      ctx.fillStyle = `rgba(255,${170 + 60 * (1 - t)},90,${0.65 * (1 - t) * (0.5 + 0.5 * Math.sin(now / 200 + e.p))})`;
      ctx.fillRect(x, y, 1.6 * e.s, 1.6 * e.s);
    }
  }
  /** A band of molten metal, (x, y) its foot's left, w by h. */
  function band(x, y, w, h, m, now, { a = 1, hot = 0, surface = false, k = 0 } = {}) {
    if (h <= 0.5 || a <= 0.01) return;
    const M = METALS[m];
    ctx.globalAlpha = a;
    const body = ctx.createLinearGradient(0, y - h, 0, y);
    body.addColorStop(0, M.hi); body.addColorStop(0.18, M.base); body.addColorStop(1, mixHex(M.base, "#000000", 0.35));
    ctx.fillStyle = body; ctx.fillRect(x, y - h, w, h);
    // molten: a warm glow from below, more for the duller metals
    const warm = ctx.createLinearGradient(0, y - h, 0, y);
    warm.addColorStop(0, "rgba(255,120,40,0)"); warm.addColorStop(1, `rgba(255,110,30,${0.16 + 0.12 * (1 - M.shine)})`);
    ctx.fillStyle = warm; ctx.fillRect(x, y - h, w, h);
    // the shimmer: a soft light sliding across the band
    const sx = x + ((now / 2600 + k * 0.37) % 1.4 - 0.2) * w;
    const sh = ctx.createLinearGradient(sx - w * 0.25, 0, sx + w * 0.25, 0);
    sh.addColorStop(0, "rgba(255,255,255,0)"); sh.addColorStop(0.5, `rgba(255,255,255,${0.12 + 0.18 * M.shine})`); sh.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sh; ctx.fillRect(x, y - h, w, h);
    // the bright line where it meets the metal above (or the air)
    ctx.fillStyle = surface ? "rgba(255,240,200,.9)" : hexA(M.hi, 0.85);
    ctx.fillRect(x, y - h, w, Math.max(1, surface ? 2 : 1.2));
    // its sign
    if (h > 14) {
      const s = Math.min(h * 0.62, w * 0.36) / 24;
      ctx.save(); ctx.translate(x + w / 2 - 12 * s, y - h / 2 - 12 * s); ctx.scale(s, s);
      ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = M.shine > 0.6 ? "rgba(40,30,25,.55)" : "rgba(255,235,210,.6)"; ctx.stroke(GLYPH[m]);
      ctx.restore();
    }
    if (hot > 0) { ctx.fillStyle = `rgba(255,248,225,${0.85 * hot})`; ctx.fillRect(x, y - h, w, h); }
    ctx.globalAlpha = 1;
  }
  /**
   * Where crucible i stands: its foot's middle and its turn. Carried to pour, it is lifted over the crucible it pours into, its
   * mouth just above that one's on the near side, and tipped toward it.
   */
  function poseOf(i, cup) {
    const { oh } = outerOf(i), lift = (cup.lift || 0) * g.mh * 0.25;
    const rest = { x: g.xs[i], y: g.floor - lift, turn: 0 };
    if (!cup.go) return rest;
    const j = cup.go.to, dir = Math.sign(g.xs[j] - g.xs[i]) || 1, k = cup.go.k, turn = dir * 1.05;
    const tm = { x: g.xs[j], y: g.floor - outerOf(j).oh };
    // the mouth's middle goes to a point above and short of the target's mouth; the foot follows from the turn
    const mx = tm.x - dir * outerOf(j).ow * 0.55, my = tm.y - g.mh * 0.55;
    const fx = mx - Math.sin(turn) * oh, fy = my + Math.cos(turn) * oh;
    return { x: rest.x + (fx - rest.x) * k, y: rest.y + (fy - rest.y) * k, turn: turn * k };
  }
  function drawCup(i, cup, now) {
    const { iw, ih, ow, oh } = outerOf(i), P = poseOf(i, cup), lift = g.floor - P.y, kind = kinds[i] || "";
    ctx.save();
    ctx.translate(P.x, P.y); ctx.rotate(P.turn);
    // shadow on the hearth
    if (!cup.go) { ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(0, lift + 3, ow * 0.55, 6, 0, 0, Math.PI * 2); ctx.fill(); }
    // the clay: fired, warm on the side facing the hearth's glow (a slag pot is cast iron, dark and straight-sided)
    const outer = cruciblePath(ow, oh, kind === "slag" ? 0 : ow * 0.06);
    const clay = ctx.createLinearGradient(-ow / 2, 0, ow / 2, 0);
    const tones = kind === "slag" ? ["#26231f", "#4a4640", "#38342f", "#1c1a17"] : ["#6b3d24", "#a9673c", "#8a5030", "#4c2a18"];
    [0, 0.45, 0.7, 1].forEach((at, k) => clay.addColorStop(at, tones[k]));
    ctx.fillStyle = clay; ctx.fill(outer);
    // a teapot ladle's spout: a channel from its foot up the side it pours from, to a lip at the rim
    if (kind === "teapot") {
      const side = cup.go ? (Math.sign(g.xs[cup.go.to] - g.xs[i]) || 1) : 1, x = side * (ow / 2 + ow * 0.04);
      ctx.strokeStyle = "#8a5030"; ctx.lineWidth = Math.max(4, ow * 0.09); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(side * ow * 0.34, -g.wall); ctx.quadraticCurveTo(x + side * ow * 0.08, -oh * 0.4, x + side * ow * 0.1, -oh - 2); ctx.stroke();
      ctx.strokeStyle = "rgba(255,200,140,.35)"; ctx.lineWidth = 1.2; ctx.stroke();
    }
    const heat = ctx.createLinearGradient(0, -oh, 0, 0);
    heat.addColorStop(0, "rgba(255,150,60,0)"); heat.addColorStop(1, "rgba(255,120,40,.35)");
    ctx.fillStyle = heat; ctx.fill(outer);
    // the cut face: the inside, dark, and the metal in it
    const inner = cruciblePath(iw, ih, iw * 0.04);
    ctx.save(); ctx.translate(0, -g.wall * 0.9);
    ctx.fillStyle = "#1a0f0a"; ctx.fill(inner);
    ctx.clip(inner);
    const bands = cup.bands.slice().sort((a, b) => a.y - b.y), topY = bands.reduce((t, b) => Math.max(t, b.y + b.h), 0);
    bands.forEach((b, k) => band(-iw / 2 - iw * 0.05, -b.y * g.mh, iw * 1.1, b.h * g.mh, b.m, now, { a: b.a ?? 1, hot: b.hot || 0, surface: b.y + b.h >= topY - 0.01, k: i * 3 + k }));
    ctx.restore();
    // the rim of the cut and the lip
    ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(40,20,10,.85)"; ctx.stroke(outer);
    ctx.save(); ctx.translate(0, -g.wall * 0.9); ctx.strokeStyle = "rgba(255,200,150,.18)"; ctx.stroke(inner); ctx.restore();
    ctx.fillStyle = kind === "slag" ? "#5a554e" : "#b97a4a"; ctx.fillRect(-ow / 2 - ow * 0.06 - 2, -oh - 3, ow * 1.12 + 4, 4);
    // picked: a gilt ring at the mouth; a crucible it may pour into: a faint one
    if (cup.picked || cup.target) {
      ctx.strokeStyle = cup.picked ? "rgba(240,200,110,.95)" : "rgba(240,200,110,.4)";
      ctx.lineWidth = cup.picked ? 2.5 : 1.5;
      ctx.beginPath(); ctx.ellipse(0, -oh - 1, ow * 0.62, 5, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  /** The mouth of crucible i, where a stream starts or lands (before any tilt). */
  const mouthOf = i => { const { oh } = outerOf(i); return { x: g.xs[i], y: g.floor - oh - 2 }; };
  function drawStream(st, cups) {
    if (!st) return;
    // from the lip of the tipped crucible, the corner of its mouth on the pouring side, down into the other's mouth
    const P = poseOf(st.from, cups[st.from]), { ow, oh } = outerOf(st.from), dir = Math.sign(g.xs[st.to] - g.xs[st.from]) || 1;
    const cx = dir * ow * 0.56, cy = -oh;
    const lip = { x: P.x + cx * Math.cos(P.turn) - cy * Math.sin(P.turn), y: P.y + cx * Math.sin(P.turn) + cy * Math.cos(P.turn) }, b = mouthOf(st.to), land = { x: b.x, y: b.y + 8 };
    const ctl = { x: (lip.x + land.x) / 2, y: Math.min(lip.y, land.y) - Math.max(30, Math.abs(land.x - lip.x) * 0.28) };
    const at = t => ({ x: (1 - t) ** 2 * lip.x + 2 * (1 - t) * t * ctl.x + t * t * land.x, y: (1 - t) ** 2 * lip.y + 2 * (1 - t) * t * ctl.y + t * t * land.y });
    const M = METALS[st.m];
    ctx.save();
    ctx.lineCap = "round";
    for (const [w, col, blur] of [[10, "rgba(255,140,50,.25)", 14], [5, M.base, 6], [2, M.hi, 0]]) {
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) { const t = st.t1 + (st.t0 - st.t1) * k / 24, p = at(t); k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.shadowColor = "rgba(255,150,60,.8)"; ctx.shadowBlur = blur; ctx.stroke();
    }
    ctx.restore();
  }
  function drawHint(h, now) {
    if (!h) return;
    const a = mouthOf(h.from), b = mouthOf(h.to), up = Math.max(36, Math.abs(b.x - a.x) * 0.3);
    ctx.save();
    ctx.setLineDash([6, 6]); ctx.lineDashOffset = -now / 40;
    ctx.strokeStyle = "rgba(240,200,110,.9)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y - 8); ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - up, b.x, b.y - 10); ctx.stroke();
    ctx.setLineDash([]);
    const ang = Math.atan2(b.y - 10 - (Math.min(a.y, b.y) - up), b.x - (a.x + b.x) / 2);
    ctx.translate(b.x, b.y - 10); ctx.rotate(ang);
    ctx.fillStyle = "rgba(240,200,110,.95)"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-11, -6); ctx.lineTo(-11, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawBursts(now) {
    bursts = bursts.filter(b => now - b.t0 < 900);
    smokes = smokes.filter(s => now - s.t0 < 1400);
    for (const s of smokes) {
      const t = (now - s.t0) / 1400;
      for (const p of s.parts) {
        const x = s.x + p.vx * t * 40 + Math.sin(now / 300 + p.vx * 9) * 4, y = s.y - t * 110 * p.vy, r = 6 + 22 * t * p.vy;
        ctx.fillStyle = `rgba(225,232,236,${0.4 * (1 - t)})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const b of bursts) {
      const t = (now - b.t0) / 900;
      for (const p of b.parts) {
        const x = b.x + p.vx * t * 90, y = b.y + p.vy * t * 90 + 120 * t * t;
        ctx.fillStyle = `rgba(255,${200 + 55 * (1 - t)},${120 + 100 * (1 - t)},${1 - t})`;
        ctx.fillRect(x, y, 2.2, 2.2);
      }
    }
  }

  return {
    canvas,
    /** The crucibles' sizes (a new level). */
    layout(c, k = []) { caps = c.slice(); kinds = k.slice(); resize(); },
    resize,
    frame(scene, now) {
      if (!g || !scene) return;
      kinds = scene.kinds || [];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackdrop(now);
      // the crucible pouring is drawn last, so its stream and tipped body lie over its neighbours
      const order = scene.cups.map((_, i) => i).sort((a, b) => (scene.stream?.from === a) - (scene.stream?.from === b));
      for (const i of order) drawCup(i, scene.cups[i], now);
      drawStream(scene.stream, scene.cups);
      drawHint(scene.hint, now);
      drawBursts(now);
    },
    /** Sparks from crucible i's mouth (a cast). */
    burst(i, now) {
      if (!g) return;
      const m = mouthOf(i);
      bursts.push({ t0: now, x: m.x, y: m.y, parts: Array.from({ length: 26 }, () => { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 0.5 + Math.random(); return { vx: Math.cos(a) * v, vy: Math.sin(a) * v }; }) });
    },
    /** White smoke from crucible i's mouth (zinc burning). */
    smoke(i) {
      if (!g) return;
      const m = mouthOf(i);
      smokes.push({ t0: performance.now(), x: m.x, y: m.y, parts: Array.from({ length: 9 }, () => ({ vx: Math.random() - 0.5, vy: 0.6 + Math.random() * 0.6 })) });
    },
    /** The crucible under a point of the page (anywhere in its column), or -1. */
    cupAt(px, py) {
      if (!g) return -1;
      const r = canvas.getBoundingClientRect(), x = px - r.left, y = py - r.top;
      if (y < 0 || y > r.height) return -1;
      let best = -1, bd = Infinity;
      g.xs.forEach((cx, i) => { const d = Math.abs(cx - x); if (d < bd && d < g.cw * 0.75) { bd = d; best = i; } });
      return best;
    },
    /** Where crucible i's mouth is on the page (sparks fly from it to a mould). */
    mouthOnPage(i) { const r = canvas.getBoundingClientRect(), m = g ? mouthOf(i) : { x: 0, y: 0 }; return { x: r.left + m.x, y: r.top + m.y }; },
    destroy() { canvas.remove(); },
  };
}
