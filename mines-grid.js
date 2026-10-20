// Mines' fields as shapes: which cells touch which, and where each one is drawn. Pure (no page), so the engine, the
// renderer and the tests share one geometry. Three tilings:
//   squares: the classic field, each cell touching the eight round it;
//   hexes: pointy-topped hexagons in rows, every other row shifted half a cell to the right, each touching six;
//   triangles: rows of triangles pointing up and down in turn, each touching twelve (three along its edges, nine more
//   at its corners), as triangle Minesweeper counts them.
// A cell is a number: row * width + column. Drawing units: a square's side, a hexagon's radius and a triangle's side
// are each 1; layout() scales them to a cell size in pixels.

export const SHAPES = {
  square: { label: "Squares", most: 8 },
  hex: { label: "Hexes", most: 6 },
  tri: { label: "Triangles", most: 12 },
};

const SQ3 = Math.sqrt(3);

/** Whether a triangle points up: the top-left one does, and they alternate along a row and down a column. */
export const pointsUp = (r, c) => (r + c) % 2 === 0;

/** The cells touching each cell, in a fixed order: an array of arrays of cell numbers. */
export function neighbours(shape, w, h) {
  const out = [];
  const add = (list, r, c) => { if (r >= 0 && r < h && c >= 0 && c < w) list.push(r * w + c); };
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const list = [];
      if (shape === "square") {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) add(list, r + dr, c + dc);
      } else if (shape === "hex") {
        // odd rows sit half a cell right: their diagonal neighbours are at c and c+1, an even row's at c-1 and c
        const s = r % 2 ? 0 : -1;
        add(list, r - 1, c + s); add(list, r - 1, c + s + 1);
        add(list, r, c - 1); add(list, r, c + 1);
        add(list, r + 1, c + s); add(list, r + 1, c + s + 1);
      } else {
        // an up triangle meets three cells of the row above at its apex and five of the row below along its base and
        // at its two lower corners; a down triangle the other way round; four in its own row either way
        const up = pointsUp(r, c), wideRow = up ? r + 1 : r - 1, narrowRow = up ? r - 1 : r + 1;
        for (let dc = -1; dc <= 1; dc++) add(list, narrowRow, c + dc);
        for (const dc of [-2, -1, 1, 2]) add(list, r, c + dc);
        for (let dc = -2; dc <= 2; dc++) add(list, wideRow, c + dc);
      }
      out.push(list);
    }
  }
  return out;
}

/** The field's extent in drawing units: { w, h }. */
export function extent(shape, w, h) {
  if (shape === "square") return { w, h };
  if (shape === "hex") return { w: (w + 0.5) * SQ3, h: 1.5 * h + 0.5 };
  return { w: (w + 1) / 2, h: h * SQ3 / 2 };
}

/** A cell's outline in drawing units, as [[x, y], …], and its centre (the triangle's, a third of the way up). */
export function outline(shape, w, i) {
  const r = Math.floor(i / w), c = i % w;
  if (shape === "square") return { pts: [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]], cx: c + 0.5, cy: r + 0.5 };
  if (shape === "hex") {
    const cx = (c + 0.5 + (r % 2 ? 0.5 : 0)) * SQ3, cy = 1.5 * r + 1;
    const pts = [];
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; pts.push([cx + Math.cos(a), cy + Math.sin(a)]); }
    return { pts, cx, cy };
  }
  const t = SQ3 / 2, x0 = c / 2, y0 = r * t;
  if (pointsUp(r, c)) return { pts: [[x0, y0 + t], [x0 + 0.5, y0], [x0 + 1, y0 + t]], cx: x0 + 0.5, cy: y0 + t * 2 / 3 };
  return { pts: [[x0, y0], [x0 + 1, y0], [x0 + 0.5, y0 + t]], cx: x0 + 0.5, cy: y0 + t / 3 };
}

/** The largest circle inside a cell, in drawing units: what a number or a flag may fill. */
export const inner = shape => (shape === "square" ? 0.5 : shape === "hex" ? SQ3 / 2 : SQ3 / 6);

/** Whether point (x, y) lies inside the polygon pts. */
function inside(pts, x, y) {
  let ok = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
}

/** The cell under a point in drawing units, or -1 off the field. */
export function cellAt(shape, w, h, x, y) {
  if (shape === "square") {
    const c = Math.floor(x), r = Math.floor(y);
    return r >= 0 && r < h && c >= 0 && c < w ? r * w + c : -1;
  }
  // the few cells that could hold the point, by its row; the one whose outline holds it, else the nearest centre
  // within a cell's reach (a point on a seam belongs to one of the two either way)
  const rowH = shape === "hex" ? 1.5 : SQ3 / 2, r0 = Math.floor((shape === "hex" ? y - 0.5 : y) / rowH);
  const colW = shape === "hex" ? SQ3 : 0.5, c0 = Math.floor(x / colW);
  let best = -1, dist = Infinity;
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    if (r < 0 || r >= h) continue;
    for (let c = c0 - 2; c <= c0 + 2; c++) {
      if (c < 0 || c >= w) continue;
      const i = r * w + c, o = outline(shape, w, i);
      if (inside(o.pts, x, y)) return i;
      const d = Math.hypot(o.cx - x, o.cy - y);
      if (d < dist) { dist = d; best = i; }
    }
  }
  return dist <= (shape === "hex" ? 1 : 0.6) ? best : -1;
}

/**
 * A two-way split of the field for players who each see part of the numbers: which share (0 … n-1) a cell's number
 * belongs to. Shares are spread evenly and finely, so every number has neighbours in the others' shares: on squares a
 * chessboard for two (every cell's four edge-neighbours are the partner's), on hexes alternate rows for two (four of
 * the six), on triangles the up ones and the down ones (the three along its edges); for more players a lattice
 * pattern of the same kind.
 */
export function shareOf(shape, w, i, n) {
  if (n <= 1) return 0;
  const r = Math.floor(i / w), c = i % w;
  if (shape === "square") {
    if (n === 2) return (r + c) % 2;
    if (n === 4) return 2 * (r % 2) + (c % 2);
    return (((2 * r + c) % n) + n) % n;
  }
  if (shape === "hex") {
    if (n === 2) return r % 2;
    const q = c - Math.floor(r / 2);              // the axial column, in which a hex's six neighbours differ by ±1, ±n
    return ((((n === 3 ? q - r : q + 2 * r)) % n) + n) % n;
  }
  if (n === 2) return pointsUp(r, c) ? 0 : 1;
  return (((2 * r + c) % n) + n) % n;
}
