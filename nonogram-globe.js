// Nonogram's payoff when a picture is done and named: where it is, on a little globe turned to face it, the rest of the
// land faint round it. Chart's globe does the maths (chart-globe.js); the rings are the countries' own (chart-countries.js),
// the picture's shape (nonogram-pictures.js) being what is lit.
import { camera, frame } from "./chart-globe.js";
import { COUNTRIES } from "./chart-countries.js";

/** The globe for these rings (a picture's), drawn into a canvas: sea, the land faint, the picture's rings lit. Nothing drawn for none. */
export function drawGlobe(canvas, rings, { sea, land, lit, ink }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H) return;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  if (!rings?.length) return;
  const pts = rings.flatMap(r => r.map(([lon, lat]) => ({ lon, lat })));
  const view = frame(pts, 40), cam = camera({ ...view, a: Math.max(view.a, 62) }, W, H);   // never closer than a hemisphere's worth, so it reads as a globe
  g.beginPath(); g.arc(cam.cx, cam.cy, cam.R, 0, Math.PI * 2);
  g.fillStyle = sea; g.fill();
  const faint = new Path2D(), mine = new Path2D(), coast = new Path2D();
  for (const c of COUNTRIES) for (const ring of c.rings) cam.shape(faint, ring);
  g.fillStyle = land; g.fill(faint);
  for (const ring of rings) { cam.shape(mine, ring); cam.edge(coast, ring, true); }
  g.fillStyle = lit; g.fill(mine);
  g.strokeStyle = ink; g.lineWidth = 1; g.stroke(coast);
  g.beginPath(); g.arc(cam.cx, cam.cy, cam.R, 0, Math.PI * 2); g.strokeStyle = ink; g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
}
