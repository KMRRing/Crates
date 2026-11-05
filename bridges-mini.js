// A level's chart in miniature, for the menu's list of levels (bridges.js): not the level's puzzle (that is made when it
// is played, and takes a moment) but a board of its size and twists made the way puzzles start, islands grown and joined,
// from the level's own number, so each level always shows the same chart. A loosened number is a ring instead of a disc,
// the second realm is the second colour, a hill has contour rings, a wide road lies on a bed with three lanes, a narrow one
// is pinched by a wedge each side, a strait is a dashed line with a dot at its end, and a chart with no loops has no extra bridges (a
// cartoon of each: none is the level's puzzle). SVG only: the colours are the stylesheet's.
import { randomBoard, rngOf, flagsOf } from "./bridges-engine.js";
import { xyOf, boxOf, pointsOf, straitLine, radiusOf, H } from "./bridges-lattice.js";

/** The svg (as a string) of a chart `size` cells across with the twists a level has, the same for the same `seed`; `shape` "hex" draws the hex board (a hexagon of lattice points, bridges along its three axes). */
export function miniature(size, twist, seed, shape = "square") {
  const T = flagsOf(twist), rng = rngOf(seed), hex = shape === "hex";
  let board = null;
  for (let k = 0; k < 20 && !board; k++) board = randomBoard(size, rng, Math.round(pointsOf(size, hex) * (hex ? 0.36 : 0.27)), T.tree ? 0 : 0.35, T.realms, false, null, hex);
  if (!board) return "";
  const at = i => xyOf(size, hex, Math.floor(i / size), i % size), out = [], under = [];
  const colour = i => (board.realms[i] === "1" ? " r1" : "");
  board.bridges.forEach(([r1, c1, r2, c2, k], n) => {
    const [x1, y1] = xyOf(size, hex, r1, c1), [x2, y2] = xyOf(size, hex, r2, c2), cls = `b${colour(r1 * size + c1)}`, len = Math.hypot(x2 - x1, y2 - y1), tx = (x2 - x1) / len, ty = (y2 - y1) / len;
    const wide = T.wide && n % 3 === 0, narrow = T.narrow && n % 3 === 1 && k === 1;
    const line = (d, c) => { const dx = -ty * d, dy = tx * d; out.push(`<line class="${c}" x1="${+(x1 + dx).toFixed(4)}" y1="${+(y1 + dy).toFixed(4)}" x2="${+(x2 + dx).toFixed(4)}" y2="${+(y2 + dy).toFixed(4)}"/>`); };
    if (wide) { under.push(`<line class="bed" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`); for (const d of [-0.22, 0, 0.22]) line(d, cls); }
    else if (k === 2) for (const s of [-1, 1]) line(s * 0.17, cls);
    else line(0, cls);
    if (narrow) {                                                           // a wedge from each side points at the middle of the road
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, pt = (u, v) => `${+(mx + tx * u - ty * v).toFixed(4)},${+(my + ty * u + tx * v).toFixed(4)}`;
      for (const s of [-1, 1]) out.push(`<polygon class="post" points="${[pt(-0.32, s * 0.6), pt(0.32, s * 0.6), pt(0, s * 0.12)].join(" ")}"/>`);
    }
  });
  if (T.straits && !hex) {                                                  // two straits, one each way
    const g1 = 1 + Math.floor(rng() * (size - 2)), g2 = 1 + Math.floor(rng() * (size - 2));
    under.push(`<line class="sline" x1="0.5" y1="${g1}" x2="${size}" y2="${g1}"/><circle class="sdot" cx="0.3" cy="${g1}" r="0.28"/>`);
    under.push(`<line class="sline" x1="${g2}" y1="0.5" x2="${g2}" y2="${size}"/><circle class="sdot" cx="${g2}" cy="0.3" r="0.28"/>`);
  } else if (T.straits) {                                                   // on the hex board two straits too, of two of its three families
    for (const fam of [0, 2]) {
      const gap = 1 + Math.floor(rng() * (size - 3)), [[ax, ay], [bx, by]] = straitLine(size, true, fam, gap, 0.2), len = Math.hypot(bx - ax, by - ay);
      under.push(`<line class="sline" x1="${ax.toFixed(3)}" y1="${ay.toFixed(3)}" x2="${bx.toFixed(3)}" y2="${by.toFixed(3)}"/><circle class="sdot" cx="${(ax - ((bx - ax) / len) * 0.3).toFixed(3)}" cy="${(ay - ((by - ay) / len) * 0.3).toFixed(3)}" r="0.28"/>`);
    }
  }
  for (let i = 0; i < size * size; i++) {
    if (board.grid[i] === ".") continue;
    const [x, y] = at(i), ring = T.ranges && ((i * 2654435761) >>> 0) % 100 < 35, hill = T.hills && ((i * 2246822519) >>> 0) % 100 < 45;
    if (hill) out.push(`<circle class="hill" cx="${x}" cy="${y}" r="0.62"/>`);
    out.push(`<circle class="i${colour(i)}${ring ? " range" : ""}" cx="${x}" cy="${y}" r="0.42"/>`);
  }
  if (hex) {                                                                // the sea is a hexagon, on a box as wide as it is tall so the card keeps its shape
    const R = radiusOf(size), [w, h] = boxOf(size, true), rho = R + 0.75, cx = w / 2, cy = h / 2;
    const corners = Array.from({ length: 6 }, (_, k) => `${(cx + rho * Math.cos((Math.PI / 3) * k)).toFixed(3)},${(cy + rho * Math.sin((Math.PI / 3) * k)).toFixed(3)}`).join(" ");
    return `<svg viewBox="${cx - rho - 0.1} ${cy - rho * H - 0.1} ${2 * rho + 0.2} ${2 * rho * H + 0.2}" aria-hidden="true"><polygon class="sea" points="${corners}"/>${under.join("")}${out.join("")}</svg>`;
  }
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><rect class="sea" x="0" y="0" width="${size}" height="${size}"/>${under.join("")}${out.join("")}</svg>`;
}
