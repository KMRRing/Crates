// The plate on the Navigation page: a mariner's astrolabe in brass, its ring ticked in degrees, the alidade on a star, and a few stars
// round it. Drawn here, in the page's own classes (navigation.css), so it follows the theme and the night.
import { polar, elev, starShape, line } from "./navigation-ui.js";

export function plate() {
  const cx = 150, cy = 118, R = 84, out = [];
  out.push(`<circle cx="${cx}" cy="${cy - R - 12}" r="11" class="nv-brass" fill="none"/><circle cx="${cx}" cy="${cy - R - 12}" r="5" class="nv-brass" fill="none"/>`);
  out.push(`<circle cx="${cx}" cy="${cy}" r="${R}" class="nv-disc"/><circle cx="${cx}" cy="${cy}" r="${R - 13}" class="nv-inner"/><circle cx="${cx}" cy="${cy}" r="${R - 20}" class="nv-inner thin"/>`);
  for (let a = 0; a < 360; a += 5) {
    const [x1, y1] = polar(cx, cy, R, a), [x2, y2] = polar(cx, cy, R - (a % 30 === 0 ? 11 : a % 10 === 0 ? 8 : 5), a);
    out.push(line(x1, y1, x2, y2, "nv-tick"));
  }
  // the rete: an eccentric ring (the ecliptic) and a bar across, ending in star pointers
  out.push(`<circle cx="${cx}" cy="${cy + 10}" r="${R - 34}" class="nv-inner thin"/>`);
  out.push(line(cx - R + 20, cy, cx + R - 20, cy, "nv-grat"), line(cx, cy - R + 20, cx, cy + R - 20, "nv-grat"));
  for (const [a, r] of [[38, 44], [152, 40], [236, 46], [310, 30]]) { const [x, y] = polar(cx, cy, r, a); out.push(starShape(x, y, 5.5, "nv-star dim")); }
  // the alidade, lined on a star well beyond the ring
  const a = 33, [bx, by] = elev(cx, cy, R + 16, a + 180), [fx, fy] = elev(cx, cy, R + 8, a), [sx, sy] = elev(cx, cy, 134, a);
  out.push(line(bx, by, fx, fy, "nv-alidade"), line(fx, fy, sx, sy, "nv-sight"), starShape(sx, sy, 9));
  out.push(`<circle cx="${cx}" cy="${cy}" r="5" class="nv-pivot"/>`);
  // a few more stars and the horizon
  for (const [x, y, r] of [[256, 40, 4], [276, 88, 3], [38, 54, 3.4], [52, 180, 3], [248, 190, 3.6]]) out.push(starShape(x, y, r, "nv-star dim"));
  return out.join("");
}
