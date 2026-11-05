// Courier flat (Settings' 2D mode, battery saver; where there is no WebGL): the quay from straight above, drawn on a plain canvas.
// The hero runs up the screen along three lanes; everything is drawn from the rules' own state (the same S that reckoning-3d.js
// reads), so the game plays the same: the swipes, the questions and the hearts are the page's, this file only draws. Height is
// a shadow left on the planks with the thing lifted off it and a little larger; a deck is a lighter slab with its height written
// on it; a wall is a bar at the quay's edge. Along the quay a metre is drawn shorter than across it, so there is time to see
// what comes (the quay ahead is AHEAD metres, which at 16 m/s is under two seconds: a top view at one scale would show a
// second). It answers to the calls of reckoning-3d.js's runner that the page makes: frame, ping, retheme, resize, dispose.
import { LANE_W, WALL_X, KINDS, speed, solid, tide, bridgeUp } from "./reckoning-engine.js";

const QUAY_W = 3 * LANE_W + 0.9;
const AHEAD = 30, BEHIND = 5;                           // metres of quay shown in front of and behind the hero
const ACROSS = QUAY_W + 3.2;                            // metres across: the quay and the walls beside it
const TAU = Math.PI * 2;
const SIGNS = [24, 12];                                 // metres before a pit where its warning is painted (the 3D quay has a gantry at the first)

// ---------- where things are (pure: tests/courier-flat.mjs) ----------
/** The scales for a W by H frame: pixels a metre across (sx) and along (sz) the quay, and where the hero's feet are. */
export function scalesOf(W, H) { return { sx: W / ACROSS, sz: H / (AHEAD + BEHIND), x0: W / 2 }; }
/** The screen's point for a place on the quay (x across, z along, `hz` where the hero is, y the height lifted by). */
export function pointOf(sc, H, x, z, hz, y = 0) { return [sc.x0 + x * sc.sx, H - (z - hz + BEHIND) * sc.sz - y * sc.sx * 0.2]; }
/** The place on the quay a point of the screen is (the hero's z given): the swipes don't need it, tests do. */
export function placeOf(sc, H, px, py, hz) { return [(px - sc.x0) / sc.sx, hz - BEHIND + (H - py) / sc.sz]; }
/** What the lane of a place across is: -1, 0 or 1 (nearest lane centre). */
export const laneOf = x => Math.max(-1, Math.min(1, Math.round(x / LANE_W)));

export function createFlatRunner(host) {
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2D canvas");
  canvas.className = "rk-gl";
  host.prepend(canvas);
  let W = 1, H = 1, sc = scalesOf(1, 1), now = 0, k = look(), last = null;
  const fx = [];                                         // rings from events: { x, z, born, life, r, color }
  const dead = new Map();                                // foe id -> { f, at }: a foe cut down fades out where it stood

  function look() {
    const root = document.documentElement, css = getComputedStyle(root);
    const night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
    const c = (name, or) => (css.getPropertyValue(name) || "").trim() || or;
    return {
      night, ink: c("--ink", night ? "#E8E1CF" : "#1C2A34"), brass: c("--brass", "#B98A2E"), sheet: c("--sheet", night ? "#1B262E" : "#F7F1E3"),
      enamel: [c("--c0", "#D49A22"), c("--c1", "#3D7A66"), c("--c2", "#2C5B8A"), c("--c3", "#8F3328")], bad: c("--rk-bad", "#A8382B"),
      water: night ? "#12293A" : "#7FA3B3", plank: night ? "#4B4538" : "#CBB48A", seam: night ? "rgba(0,0,0,.35)" : "rgba(70,50,20,.25)",
      stone: night ? "#5A5F66" : "#9C9486", shadow: night ? "rgba(0,0,0,.45)" : "rgba(40,30,15,.28)",
    };
  }
  function resize() {
    const r = host.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sc = scalesOf(W, H);
    if (last) paint();
  }
  const sizeWatch = new ResizeObserver(resize);
  sizeWatch.observe(host);
  const skinWatch = new MutationObserver(() => { k = look(); if (last) paint(); });
  skinWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });

  const at = (x, z, hz, y = 0) => pointOf(sc, H, x, z, hz, y);
  /** A slab between two z, across between two x (metres): its screen rectangle. */
  function slab(x0, x1, z0, z1, hz, y = 0) {
    const [ax, ay] = at(x0, z0, hz, y), [bx, by] = at(x1, z1, hz, y);
    return [Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)];
  }
  const rim = (r, w = 1.5, color = k.ink) => { ctx.lineWidth = w; ctx.strokeStyle = color; ctx.strokeRect(...r); };
  const text = (s, x, y, size, color = k.ink) => { ctx.font = `800 ${size}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = color; ctx.fillText(s, x, y); };
  const disc = (x, y, r, fill, stroke = null) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); } };
  const unit = () => Math.min(sc.sx * 0.3, 40);          // the size of a body on the screen
  const shadow = (x, z, hz, y, r) => { const [sx, sy] = at(x, z, hz); ctx.beginPath(); ctx.ellipse(sx, sy, r * (1 - Math.min(0.5, y * 0.1)), r * 0.55 * (1 - Math.min(0.5, y * 0.1)), 0, 0, TAU); ctx.fillStyle = k.shadow; ctx.fill(); };

  // ---------- the drawing ----------
  function paint() {
    const { S, hz, hx } = last, Wd = S.world, U = unit();
    ctx.fillStyle = k.water; ctx.fillRect(0, 0, W, H);
    const z0 = hz - BEHIND - 1, z1 = hz + AHEAD + 1;
    // the planks: one slab, gaps cut out of it by the pits, seams across every metre so the quay is seen to move
    const pits = Wd.pits.filter(p => p.z1 > z0 && p.z0 < z1).sort((a, b) => a.z0 - b.z0), spans = [];
    let from = z0;
    for (const p of pits) { if (p.z0 > from) spans.push([from, p.z0]); from = Math.max(from, p.z1); }
    if (from < z1) spans.push([from, z1]);
    for (const [a, b] of spans) {
      ctx.fillStyle = k.plank; ctx.fillRect(...slab(-QUAY_W / 2, QUAY_W / 2, a, b, hz));
      ctx.strokeStyle = k.seam; ctx.lineWidth = 1; ctx.beginPath();
      for (let z = Math.ceil(a); z < b; z++) { const [x0, y] = at(-QUAY_W / 2, z, hz), [x1] = at(QUAY_W / 2, z, hz); ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
      ctx.stroke();
    }
    ctx.strokeStyle = k.seam; ctx.setLineDash([6, 8]); ctx.lineWidth = 1.5; ctx.beginPath();     // the lanes
    for (const l of [-0.5, 0.5]) { const [x, y0] = at(l * LANE_W, z0, hz), [, y1] = at(l * LANE_W, z1, hz); ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    ctx.stroke(); ctx.setLineDash([]);
    // pits announce themselves: chalk and oxblood on both lips, and a painted warning before the first
    for (const p of pits) {
      const lip = (z, dz) => { const r = slab(-QUAY_W / 2, QUAY_W / 2, z, z + dz, hz); for (let i = 0; i < 6; i++) { ctx.fillStyle = i & 1 ? "#F4EEDC" : k.bad; ctx.fillRect(r[0] + (r[2] / 6) * i, r[1], r[2] / 6 + 0.5, r[3]); } };
      lip(p.z0 - 0.6, 0.6); lip(p.z1, 0.6);
      for (const d of SIGNS) { const [x, y] = at(0, p.z0 - d, hz); if (y > -20 && y < H + 20) { ctx.globalAlpha = 0.85; text("▲ GAP", x, y, Math.max(11, U * 0.7), k.bad); ctx.globalAlpha = 1; } }
    }
    // walls to run along: a bar at each edge, its height written at the start; decks and their ramps
    for (const w of Wd.walls) {
      if (w.z1 < z0 || w.z0 > z1) continue;
      const top = w.top ?? 3.2, r = slab(w.side * WALL_X, w.side * (WALL_X + 1), w.z0, w.z1, hz);
      ctx.fillStyle = k.stone; ctx.fillRect(...r); rim(r, 1.5);
      if (r[1] + r[3] > 0 && r[1] < H) text(`${top.toFixed(top % 1 ? 1 : 0)}m`, r[0] + r[2] / 2, Math.min(H - 8, Math.max(r[1] + 10, r[1] + r[3] - 10)), Math.max(10, U * 0.55));
    }
    for (const d of Wd.decks) {
      if (d.z1 < z0 || d.z0 > z1) continue;
      const x0 = (d.l0 - 0.5) * LANE_W, x1 = (d.l1 + 0.5) * LANE_W, r = slab(x0, x1, d.z0, d.z1, hz), f0 = d.z0 + d.ramp, f1 = d.z1 - d.down;
      ctx.fillStyle = k.night ? "#6B6354" : "#E5D3A8"; ctx.fillRect(...r);
      if (d.ramp > 0) { const q = slab(x0, x1, d.z0, f0, hz); const g = ctx.createLinearGradient(0, q[1] + q[3], 0, q[1]); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, k.shadow); ctx.fillStyle = g; ctx.fillRect(...q); }
      if (d.down > 0) { const q = slab(x0, x1, f1, d.z1, hz); const g = ctx.createLinearGradient(0, q[1], 0, q[1] + q[3]); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, k.shadow); ctx.fillStyle = g; ctx.fillRect(...q); }
      rim(r, 2, k.brass);
      const [cx, cy] = at((x0 + x1) / 2, (f0 + f1) / 2, hz);
      if (cy > 0 && cy < H) text(`+${d.y.toFixed(d.y % 1 ? 1 : 0)}m`, cx, Math.min(H - 10, Math.max(10, cy)), Math.max(11, U * 0.7));
    }
    for (const p of Wd.pads) {                                                         // a spring pad: a ring with an arrow up
      if (p.z < z0 || p.z > z1) continue;
      const [x, y] = at(p.lane * LANE_W, p.z, hz, p.y);
      disc(x, y, U * (0.95 + 0.08 * Math.sin(now * 7)), k.enamel[1], k.ink); text("↑", x, y, U * 1.1, k.sheet);
    }
    // things in the way
    for (const o of Wd.obs) {
      if (o.z < hz - 3 || o.z > z1) continue;
      const x = o.lane * LANE_W, r = slab(x - 0.7, x + 0.7, o.z - o.len / 2, o.z + o.len / 2, hz), mid = [r[0] + r[2] / 2, r[1] + r[3] / 2];
      let fill = k.stone, label = "", hang = false;
      if (o.kind === "toll") { const open = !solid(last.S, o); fill = open ? k.enamel[1] : k.enamel[3]; label = String(o.mark ?? ""); }
      else if (o.kind === "bridge") { const up = bridgeUp(last.S, o); fill = up ? k.enamel[3] : k.enamel[1]; label = up ? "UP" : "DOWN"; }
      else if (o.kind === "tide") { const t = tide(last.S, o), flash = Math.sin(now * 22) > 0; fill = t.state === "open" ? k.enamel[1] : t.state === "shut" ? k.enamel[3] : flash ? k.enamel[0] : k.enamel[3]; label = t.state === "open" ? "OPEN" : t.state === "shut" ? "SHUT" : "!"; }
      else if (o.y0 > 0.5) { fill = k.enamel[0]; label = "↓"; hang = true; }                   // a beam hangs: roll under it
      else { fill = k.enamel[3]; label = "✕"; }                                   // a cart: go round it
      ctx.fillStyle = fill; ctx.globalAlpha = hang ? 0.8 : 1; ctx.fillRect(...r); ctx.globalAlpha = 1;
      if (hang) { ctx.save(); ctx.beginPath(); ctx.rect(...r); ctx.clip(); ctx.strokeStyle = k.ink; ctx.lineWidth = 3; ctx.beginPath(); for (let i = -r[3]; i < r[2]; i += 10) { ctx.moveTo(r[0] + i, r[1] + r[3]); ctx.lineTo(r[0] + i + r[3], r[1]); } ctx.stroke(); ctx.restore(); }
      rim(r, 2);
      if (label) text(label, mid[0], mid[1], Math.max(11, Math.min(U * 0.8, r[3] * 0.8)), k.sheet);
    }
    // what is picked up
    for (const p of Wd.pick) {
      if (p.taken || p.z < hz - 1.6 || p.z > z1) continue;
      const bob = Math.sin(now * 3 + p.id) * 0.06, [x, y] = at(p.lane * LANE_W, p.z, hz, p.y + bob);
      if (p.y > 1) shadow(p.lane * LANE_W, p.z, hz, p.y, U * 0.5);
      if (p.kind === "coin") disc(x, y, U * 0.38, "#F2C230", k.ink);
      else if (p.kind === "gem" || p.kind === "amber") { ctx.beginPath(); ctx.moveTo(x, y - U * 0.6); ctx.lineTo(x + U * 0.45, y); ctx.lineTo(x, y + U * 0.6); ctx.lineTo(x - U * 0.45, y); ctx.closePath(); ctx.fillStyle = k.enamel[0]; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = k.ink; ctx.stroke(); }
      else if (p.kind === "lever") { disc(x, y, U * 0.7, k.sheet, k.ink); text("L", x, y, U * 0.9); }
      else if (p.kind === "token") { disc(x, y, U * 0.6, k.enamel[2], k.ink); text(String(p.mark ?? ""), x, y, U * 0.8, k.sheet); }
      else { disc(x, y, U * 0.55, k.sheet, k.ink); text(String(p.kind || "?")[0].toUpperCase(), x, y, U * 0.7); }
    }
    // foes
    for (const f of Wd.foes) {
      if (f.z < hz - BEHIND - 2 || f.z > z1) continue;
      if (!f.alive) { if (!dead.has(f.id)) dead.set(f.id, { f: { ...f }, at: now }); continue; }
      foe(f, hz);
    }
    for (const [id, d] of dead) { if (now - d.at > 0.45) { dead.delete(id); continue; } ctx.globalAlpha = 1 - (now - d.at) / 0.45; foe(d.f, hz, true); ctx.globalAlpha = 1; }
    // the finish of a section
    if (S.sec > 0 && Wd.finish > z0 && Wd.finish < z1) {
      const r = slab(-QUAY_W / 2, QUAY_W / 2, Wd.finish, Wd.finish + 0.8, hz);
      for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) & 1 ? "#F4EEDC" : "#222"; ctx.fillRect(r[0] + (r[2] / 12) * i, r[1] + (r[3] / 2) * j, r[2] / 12 + 0.5, r[3] / 2 + 0.5); }
    }
    // rings from what has happened
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i], t = (now - e.born) / e.life;
      if (t >= 1) { fx.splice(i, 1); continue; }
      const [x, y] = at(e.x, e.z, hz);
      ctx.globalAlpha = 1 - t; ctx.lineWidth = 3; ctx.strokeStyle = e.color; ctx.beginPath(); ctx.arc(x, y, e.r * sc.sx * t + 4, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
    hero(S, hx, hz);
  }
  /** One foe: a crab a red shell with claws, a gull a pale pair of wings, a barrel a ringed cask, a balloon a bulb on a string; a mark when it has seen me. */
  function foe(f, hz, ghost = false) {
    const U = unit() * (f.heavy ? 1.35 : 1), [x, y] = at(f.x, f.z, hz, f.y - (f.gy || 0)), air = KINDS[f.kind]?.air;
    if (f.y - (f.gy || 0) > 0.3) shadow(f.x, f.z, hz, f.y - (f.gy || 0), U * 0.8);
    const ph = ghost ? 0 : f.ph || 0;
    if (f.kind === "crab" || f.kind === "bruiser") {
      disc(x, y, U * 0.85, k.night ? "#C4573F" : "#B8412F", k.ink);
      disc(x - U * 0.95, y - U * 0.4, U * 0.38, "#D9694C", k.ink); disc(x + U * 0.95, y - U * 0.4, U * 0.38, "#D9694C", k.ink);
    } else if (f.kind === "gull") {
      ctx.beginPath(); ctx.moveTo(x, y - U * 0.5); ctx.lineTo(x + U * 1.3, y + U * 0.25); ctx.lineTo(x, y); ctx.lineTo(x - U * 1.3, y + U * 0.25); ctx.closePath();
      ctx.fillStyle = k.night ? "#E8E4DA" : "#F8F5EC"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = k.ink; ctx.stroke();
      if (f.gate) { ctx.fillStyle = k.enamel[0]; ctx.fillRect(x - U * 0.6, y + U * 0.45, U * 1.2, U * 0.5); rim([x - U * 0.6, y + U * 0.45, U * 1.2, U * 0.5], 1); }   // a question's gull carries a banner
    } else if (f.kind === "barrel") {
      disc(x, y, U * 0.7, "#8A5A2E", k.ink); disc(x, y, U * 0.42, "rgba(0,0,0,0)", k.brass);
    } else if (f.kind === "balloon") {
      ctx.beginPath(); ctx.moveTo(x, y + U * 0.7); ctx.lineTo(x, y + U * 1.5); ctx.strokeStyle = k.ink; ctx.lineWidth = 1; ctx.stroke();
      disc(x, y, U * 0.75, k.enamel[(f.id || 0) % 4], k.ink);
    } else { disc(x, y, U * 0.7, k.enamel[(f.id || 0) % 4], k.ink); text(String(f.kind || "?")[0].toUpperCase(), x, y, U * 0.8, k.sheet); }
    if (ph === 1 || ph === 2) {                                                         // it has seen me / it is winding up
      const beat = ph === 2 ? 1 + 0.15 * Math.sin(now * 26) : 1;
      disc(x, y - U * (air ? 1.5 : 1.45), U * 0.42 * beat, ph === 2 ? k.bad : k.enamel[0], k.ink); text("!", x, y - U * (air ? 1.5 : 1.45), U * 0.6, k.sheet);
    }
    if (f.spent && f.alive) { ctx.strokeStyle = k.bad; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, U * 1.1, 0, TAU); ctx.stroke(); }
  }
  function hero(S, hx, hz) {
    const h = S.hero, U = unit(), up = Math.max(0, h.y - (h.gy || 0)), under = h.y < -0.5;
    const x = h.mode === "wall" ? hx + h.wall * 0.5 : hx, rolling = h.roll > 0;
    shadow(x, hz, hz, up, U * 0.9);
    const [px, py] = at(x, hz, hz, h.mode === "wall" ? Math.max(0, h.y) * 0.4 : up);
    const r = U * (1 + 0.1 * up) * (under ? 0.7 : 1), blink = h.hurt > 0 && Math.sin(now * 40) > 0;
    ctx.globalAlpha = blink ? 0.35 : 1;
    if (rolling) { ctx.beginPath(); ctx.ellipse(px, py, r * 1.15, r * 0.7, 0, 0, TAU); ctx.fillStyle = k.night ? "#5478B6" : "#24427C"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = k.ink; ctx.stroke(); }
    else {
      disc(px, py, r, under ? k.enamel[2] : k.night ? "#5478B6" : "#24427C", k.ink);
      ctx.beginPath(); ctx.moveTo(px, py - r * 1.5); ctx.lineTo(px + r * 0.55, py - r * 0.7); ctx.lineTo(px - r * 0.55, py - r * 0.7); ctx.closePath(); ctx.fillStyle = k.night ? "#E8806F" : "#C8382F"; ctx.fill();   // the scarf points the way
      if (h.slam) { ctx.beginPath(); ctx.moveTo(px, py + r * 1.6); ctx.lineTo(px + r * 0.6, py + r * 0.8); ctx.lineTo(px - r * 0.6, py + r * 0.8); ctx.closePath(); ctx.fillStyle = k.ink; ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    if (h.mode === "wall") text("║", px, py, r * 1.4, k.sheet);
  }

  /** One frame: where the rules have the hero, carried on by the time they have not yet run. */
  function frame(S, dt, o = {}) {
    now += dt;
    const h = S.hero, lead = Math.min(o.lead || 0, 1 / 60);
    last = { S, hz: h.z + speed(S) * lead, hx: h.x + (h.vx || 0) * lead };
    if (o.draw !== false) paint();
  }
  /** What has happened, as a ring where it happened (the jump, the land, a kill, a hurt). */
  function ping(ev, S) {
    const h = S.hero, ring = (x, z, r, color, life = 0.4) => fx.push({ x, z, born: now, life, r, color });
    switch (ev.type) {
      case "kill": ring(ev.x ?? h.x, ev.z ?? h.z, 0.9, k.brass); break;
      case "land": ring(h.x, h.z, ev.slam ? 2 : 0.9, k.ink, 0.35); break;
      case "hurt": ring(h.x, h.z, 1.6, k.bad, 0.5); break;
      case "shockwave": ring(h.x, h.z, 3.5, k.brass, 0.5); break;
      case "jump": if (ev.air) ring(h.x, h.z, 0.8, k.ink, 0.3); break;
      case "fall": ring(h.x, h.z, 1.4, k.enamel[2], 0.5); break;
      default: break;
    }
  }
  resize();
  return {
    canvas, frame, ping, resize, retheme() { k = look(); if (last) paint(); },
    dispose() { sizeWatch.disconnect(); skinWatch.disconnect(); canvas.remove(); },
    flat: true,
  };
}
