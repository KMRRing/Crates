// The plate on the History of trade page: the world's land in brass-ruled outline with the great routes dashed across it and a compass rose in the
// Pacific. Drawn from the same map as the lessons (trade-map.js), so it follows the theme and needs nothing fetched.
import { mapSvg } from "./trade-map.js";
import { PLATE_ROUTES as ROUTES } from "./trade-places.js";

/** A compass rose of four long points and four short, centred where the Pacific is empty. */
const rose = (unit, box) => {
  const cx = box[0] + box[2] * 0.075, cy = box[1] + box[3] * 0.66, R = unit * 7.5, r = R * 0.34, d = R * 0.62;
  const pt = (a, k) => `${(cx + Math.sin(a) * k).toFixed(2)},${(cy - Math.cos(a) * k).toFixed(2)}`;
  const star = (n, rad, inner, rot) => Array.from({ length: n * 2 }, (_, i) => pt(rot + i * Math.PI / n, i % 2 ? inner : rad)).join(" ");
  return `<g class="td-rose"><circle cx="${cx}" cy="${cy}" r="${(R * 1.12).toFixed(2)}" class="td-ring"/><polygon class="td-star2" points="${star(4, d, r * 0.8, Math.PI / 4)}"/><polygon class="td-star" points="${star(4, R, r * 0.8, 0)}"/>`
    + `<text x="${cx}" y="${(cy - R * 1.28).toFixed(2)}" text-anchor="middle" font-size="${(unit * 2.6).toFixed(2)}" class="td-n">N</text></g>`;
};
export const plate = () => mapSvg({ view: [-170, -58, 180, 75], pts: [], routes: ROUTES, labels: false, extra: rose, cls: "plate" });
