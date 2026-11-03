// The window onto the sky (landfall-skyview.js): the stereographic projection and its inverse, the horizon as the circle it is, the
// field of view, picking a star under a finger, and the colours of the twilight.
import { makeView, project, unproject, degPx, pick, skyColours, starRadius } from "../landfall-skyview.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

{
  const v = makeView(20, 45, 80, 390, 500), c = project(v, 20, 45);
  check(Math.abs(c.x - 195) < 1e-9 && Math.abs(c.y - 250) < 1e-9, "the centre of the view is the centre of the canvas");
  const top = project(v, 20, 45 + 40), bottom = project(v, 20, 45 - 40);
  check(Math.abs(top.y) < 1e-6 && Math.abs(bottom.y - 500) < 1e-6, "the field of view is the angle from the top of the canvas to the bottom");
  check(project(v, 200, -45) === null, "the point opposite the view's centre cannot be drawn");
  let worst = 0;
  for (let az = 0; az < 360; az += 17) for (let alt = -10; alt <= 85; alt += 9) {
    const p = project(v, az, alt);
    if (!p) continue;
    const q = unproject(v, p.x, p.y), r = Math.PI / 180;
    const ang = Math.acos(Math.min(1, Math.sin(alt * r) * Math.sin(q.alt * r) + Math.cos(alt * r) * Math.cos(q.alt * r) * Math.cos((az - q.az) * r))) / r;
    worst = Math.max(worst, ang);
  }
  check(worst < 1e-6, `a place on the sky comes back from the canvas point it was drawn at (worst ${worst.toExponential(1)}°)`);
}
{
  // the horizon is a circle on a stereographic projection: the fourth of four points lies on the circle through three
  const v = makeView(10, 30, 90, 390, 500), pts = [-50, -10, 25, 60].map(d => project(v, 10 + d, 0));
  const [a, b, c, d] = pts, D = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const ux = ((a.x ** 2 + a.y ** 2) * (b.y - c.y) + (b.x ** 2 + b.y ** 2) * (c.y - a.y) + (c.x ** 2 + c.y ** 2) * (a.y - b.y)) / D;
  const uy = ((a.x ** 2 + a.y ** 2) * (c.x - b.x) + (b.x ** 2 + b.y ** 2) * (a.x - c.x) + (c.x ** 2 + c.y ** 2) * (b.x - a.x)) / D;
  const r = Math.hypot(a.x - ux, a.y - uy), off = Math.abs(Math.hypot(d.x - ux, d.y - uy) - r);
  check(off < 1e-6 && ux > 0 && ux < 390, `the horizon is a circle of radius ${r.toFixed(0)} px (the fourth point is ${off.toExponential(1)} px off it)`);
  check(project(v, 10, 0).y > project(v, 70, 0).y, "...bowed so that the horizon is lowest straight ahead and rises toward the sides");
}
{
  // conformal: a small circle on the sky stays round, so a degree is as long across as up
  const v = makeView(0, 40, 90, 390, 500), p = project(v, 30, 50), e = project(v, 30 + 0.01 / Math.cos(50 * Math.PI / 180), 50), n = project(v, 30, 50.01);
  const across = Math.hypot(e.x - p.x, e.y - p.y), up = Math.hypot(n.x - p.x, n.y - p.y);
  check(Math.abs(across / up - 1) < 1e-3 && Math.abs(degPx(v, p.x, p.y) - up / 0.01) < 0.5, `angles are kept: a degree is ${degPx(v, p.x, p.y).toFixed(1)} px there, as long across as up`);
}
{
  const v = makeView(0, 50, 70, 390, 500);
  const stars = [{ hr: 1, az: 0, alt: 50, mag: 3 }, { hr: 2, az: 1, alt: 50.5, mag: 1 }, { hr: 3, az: 40, alt: 30, mag: 0 }];
  const near = project(v, 0, 50);
  check(pick(v, stars, near.x + 2, near.y + 2, 20).hr === 2, "a tap between two stars takes the brighter one when they are close");
  check(pick(v, stars, near.x + 150, near.y - 200, 20) === null, "a tap on empty sky takes nothing");
}
{
  const dusk = skyColours(-3), dark = skyColours(-15), day = skyColours(3);
  const lum = c => c.reduce((t, x) => t + x, 0);
  check(lum(day.top) > lum(dusk.top) && lum(dusk.top) > lum(dark.top) && lum(dusk.hor) > lum(dark.hor), "the sky darkens as the sun goes down");
  check(dusk.hor[0] > dusk.hor[2] && dark.top[2] >= dark.top[0], "...warm at the horizon in the dusk, blue-black overhead after");
  check(starRadius(-1.4) > starRadius(2) && starRadius(2) > starRadius(4) && starRadius(4) >= 0.7, "brighter stars are bigger discs, down to a minimum");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("landfall-skyview: the projection, the horizon, picking and the twilight colours");
