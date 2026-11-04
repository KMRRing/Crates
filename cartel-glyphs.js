// The six role faces of Cartel's gold dice, engraved: a face is a number and a role (1 Envoy, 2 Mintmaster, 3 Privateer,
// 4 Clerk, 5 Syndic, 6 Alderman), so the picture is the role and a row of notches under it counts the face, the way a pip
// would. Each is drawn twice by dice3d.js, once for the colour (dark ink cut into gold, lighter where it stands proud) and
// once for the bump map (black where cut, lighter where raised), so the engraving catches the light. Pure drawing on a
// canvas context at the cell's corner, in a 100-unit box centred on the cell: the glyph in -40..36, the notches below.
import { shade } from "./dice3d.js";

const TAU = Math.PI * 2;
/** What to draw with: dark is cut away, light stands proud (gold's own colour, brighter), by layer. */
const tools = (ctx, layer, st) => ({
  dark: () => { ctx.fillStyle = ctx.strokeStyle = layer === "bump" ? "#000" : st.ink; },
  light: () => { ctx.fillStyle = ctx.strokeStyle = layer === "bump" ? "#b8b8b8" : shade(st.base, 1.18); },
});
const disc = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
const ring = (ctx, x, y, r, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); };
const line = (ctx, x0, y0, x1, y1, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); };

/** Envoy: the town's seal, a scalloped wax seal with a rosette, and the ribbon it hangs by. */
function seal(ctx, t) {
  t.dark();
  poly(ctx, [[-14, 14], [-24, 36], [-16, 31], [-11, 38], [-2, 16]]);
  poly(ctx, [[14, 14], [24, 36], [16, 31], [11, 38], [2, 16]]);
  ctx.beginPath();
  for (let i = 0; i <= 96; i++) { const a = (i / 96) * TAU, r = 30 + 2.6 * Math.cos(a * 14); ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r, -8 + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  t.light();
  ring(ctx, 0, -8, 23, 2.4);
  for (let k = 0; k < 6; k++) { ctx.save(); ctx.translate(0, -8); ctx.rotate(k * TAU / 6); ctx.beginPath(); ctx.ellipse(0, -10.5, 4.6, 9.5, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  t.dark(); disc(ctx, 0, -8, 4.2);
}
/** Mintmaster: a coin struck with a cross inside a ring of beads, and a second coin behind it. */
function coins(ctx, t) {
  t.dark();
  ring(ctx, 14, -14, 20, 2.6);
  ctx.save(); ctx.translate(-5, 0);
  disc(ctx, 0, 0, 29);
  t.light();
  for (let i = 0; i < 20; i++) { const a = i * TAU / 20; disc(ctx, Math.cos(a) * 24, Math.sin(a) * 24, 1.9); }
  ring(ctx, 0, 0, 19, 1.8);
  // a cross pattée: four arms flaring at the ends
  for (let k = 0; k < 4; k++) { ctx.save(); ctx.rotate(k * TAU / 4); poly(ctx, [[-2.6, -3], [2.6, -3], [2.6, -13], [6.4, -17], [-6.4, -17], [-2.6, -13]]); ctx.restore(); }
  t.dark(); disc(ctx, 0, 0, 2.6);
  ctx.restore();
}
/** Privateer: a cog (the Hanseatic ship) under black sails, with a pale cross and bones on the mainsail. */
function cog(ctx, t) {
  t.dark();
  line(ctx, 0, -40, 0, 22, 2.8);
  // the mainsail, bellied, and the topsail over it
  ctx.beginPath(); ctx.moveTo(-26, -30); ctx.quadraticCurveTo(0, -24, 26, -30); ctx.lineTo(24, 2); ctx.quadraticCurveTo(0, 9, -24, 2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-15, -41); ctx.quadraticCurveTo(0, -37, 15, -41); ctx.lineTo(14, -32); ctx.quadraticCurveTo(0, -29, -14, -32); ctx.closePath(); ctx.fill();
  // the hull, a high stern castle at one end
  ctx.beginPath(); ctx.moveTo(-34, 12); ctx.lineTo(34, 12); ctx.lineTo(30, 18); ctx.lineTo(34, 18); ctx.lineTo(24, 30); ctx.lineTo(-22, 30); ctx.quadraticCurveTo(-32, 26, -34, 12); ctx.closePath(); ctx.fill();
  poly(ctx, [[22, 12], [34, 12], [34, 3], [22, 3]]);
  t.light();
  line(ctx, -7, -20, 7, -6, 2.4); line(ctx, 7, -20, -7, -6, 2.4);
  ring(ctx, 0, -23, 4.4, 2);
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-36, 35); for (let i = 0; i < 6; i++) ctx.quadraticCurveTo(-36 + i * 12 + 3, 28, -36 + i * 12 + 6, 35); ctx.stroke();
}
/** Clerk: a quill with its barbs, and an inkpot. */
function quill(ctx, t) {
  t.dark();
  // the vane, a long leaf from the tip to the shaft's end
  ctx.beginPath(); ctx.moveTo(34, -40); ctx.bezierCurveTo(36, -14, 14, 6, -14, 20); ctx.bezierCurveTo(-2, 6, 4, -20, 34, -40); ctx.fill();
  poly(ctx, [[-14, 20], [-20, 20], [-24, 10], [-12, 16]]);
  line(ctx, -22, 30, -12, 18, 2.2);
  t.light();
  line(ctx, 32, -36, -13, 19, 2);
  for (let i = 0; i < 6; i++) { const f = 0.1 + i * 0.14, x = 32 - f * 45, y = -36 + f * 55; line(ctx, x, y, x + 10 - i * 1.2, y - 6 + i * 0.4, 1.5); }
  t.dark();
  // the pot
  ctx.beginPath(); ctx.moveTo(-34, 12); ctx.lineTo(-18, 12); ctx.lineTo(-14, 34); ctx.lineTo(-38, 34); ctx.closePath(); ctx.fill();
  poly(ctx, [[-36, 8], [-16, 8], [-17, 13], [-35, 13]]);
}
/** Syndic: the scales of justice on a pillar, a pan hanging from each end of the beam. */
function scales(ctx, t) {
  t.dark();
  line(ctx, 0, -34, 0, 28, 3.4);
  poly(ctx, [[-14, 36], [14, 36], [9, 28], [-9, 28]]);
  disc(ctx, 0, -37, 4.2);
  line(ctx, -32, -26, 32, -26, 3.2);
  for (const s of [-1, 1]) {
    const x = s * 30;
    line(ctx, x, -26, x - 11, 4, 1.6); line(ctx, x, -26, x + 11, 4, 1.6);
    ctx.beginPath(); ctx.moveTo(x - 15, 4); ctx.quadraticCurveTo(x, 16, x + 15, 4); ctx.closePath(); ctx.fill();
  }
  t.light(); disc(ctx, 0, -26, 2.2);
}
/** Alderman: a chain of office, links hung from the shoulders to a medallion with a tower. */
function chain(ctx, t) {
  t.dark();
  const n = 15, hang = k => { const u = k / (n - 1) * 2 - 1; return [u * 33, -34 + (1 - u * u) * 34 + 0]; };
  for (let k = 0; k < n; k++) {
    const [x, y] = hang(k), [x2, y2] = hang(Math.min(n - 1, k + 1)), a = Math.atan2(y2 - y, x2 - x);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 0, k % 2 ? 3.1 : 5.4, k % 2 ? 1.7 : 3.1, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  line(ctx, 0, 0, 0, 6, 3);
  disc(ctx, 0, 20, 16);
  t.light();
  ring(ctx, 0, 20, 12.2, 1.6);
  poly(ctx, [[-6, 28], [6, 28], [6, 14], [8, 14], [8, 10], [5, 10], [5, 12], [2, 12], [2, 10], [-2, 10], [-2, 12], [-5, 12], [-5, 10], [-8, 10], [-8, 14], [-6, 14]]);
}
const GLYPH = { 1: seal, 2: coins, 3: cog, 4: quill, 5: scales, 6: chain };

/** dice3d's face painter for the gold dice: the role's picture, and v notches under it. */
export function roleArt(ctx, v, s, layer, st) {
  const t = tools(ctx, layer, st), k = s / 100;
  ctx.save();
  ctx.translate(s / 2, s * 0.47);
  ctx.scale(k * 0.92, k * 0.92);
  ctx.lineCap = ctx.lineJoin = "round";
  t.dark();
  GLYPH[v](ctx, t);
  // the face's number as notches along the foot (the Envoy's 1 is the seal's one: still marked)
  t.dark();
  const gap = 7.4, x0 = -(v - 1) * gap / 2;
  for (let i = 0; i < v; i++) disc(ctx, x0 + i * gap, 44, 2.5);
  ctx.restore();
}
/** The gold die's look with the role faces: pass as a die's `style` to dice3d. */
export const ROLE_GOLD = { name: "role-gold", base: "#E2B34A", edge: "#C58E2A", ink: "#3A2208", one: "#3A2208", rough: 0.3, metal: 0.4, glow: "#F7DF98", art: roleArt };
