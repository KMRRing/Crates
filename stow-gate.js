// The gate that shuts over a hold once it is stowed (Korbi, 7 Nov 2026: "a beautiful, extremely detailed, art deco gate"
// instead of two plain hatch covers). Two leaves slide in from the sides and meet at a seam; together they make one
// design: a sunburst medallion on the seam, a diamond lattice behind it, a ziggurat of steps above and below, fluted
// pilasters at the outer edges, a chevron band top and bottom, and a double chamfered frame with rivets and corner fans.
// Everything is drawn in the hold's own units, from the leaf's distance to the seam, so the left leaf is the right one
// mirrored; the colours and strokes are in stow.css (.gate). The plaque and the word "Stowed" belong to the seam, not a leaf.
let ids = 0;
const f3 = n => +n.toFixed(3);

/** One leaf: `side` "l" or "r"; the leaf covers x..x+w/2 of the box [x, y, w, h]. Returns SVG markup for a `<g class="cover">`. */
function leaf([x, y, w, h], side) {
  const a = w / 2, sx = x + a, u = Math.min(w, h), cy = y + h / 2, id = `gd${++ids}`;
  const X = dx => (side === "l" ? sx - dx : sx + dx);
  const pt = (dx, py) => `${f3(X(dx))} ${f3(py)}`;
  const poly = (pts, close) => `M${pts.map(([dx, py]) => pt(dx, py)).join("L")}${close ? "Z" : ""}`;
  const i1 = u * 0.03, i2 = i1 * 2.1, c = u * 0.06;                          // frame insets, chamfer
  const out = [];
  const add = (cls, d, extra = "") => out.push(`<path class="${cls}" d="${d}"${extra}/>`);

  // the leaf's ground, and the clip that keeps the lattice inside the frame
  out.push(`<rect class="gd-ground" x="${f3(side === "l" ? x : sx)}" y="${f3(y)}" width="${f3(a)}" height="${f3(h)}"/>`);
  const inner = [[0, y + i2], [a - i2 - c, y + i2], [a - i2, y + i2 + c], [a - i2, y + h - i2 - c], [a - i2 - c, y + h - i2], [0, y + h - i2]];
  out.push(`<clipPath id="${id}"><path d="${poly(inner, true)}"/></clipPath>`);

  // a diamond lattice behind everything, at the pitch of the leaf's width
  const pitch = Math.max(u * 0.09, a / 9), lat = [];
  for (let k = -Math.ceil(h / pitch); k <= Math.ceil((a + h) / pitch); k++) {
    const dx0 = k * pitch;
    lat.push(`M${pt(dx0, y)}L${pt(dx0 + h, y + h)}`, `M${pt(dx0, y + h)}L${pt(dx0 + h, y)}`);
  }
  add("gd-lattice", lat.join(""), ` clip-path="url(#${id})"`);

  // the frames: an outer brass one and, inside, a thinner one, both chamfered at the outer corners and open at the seam
  add("gd-frame", poly([[0, y + i1], [a - i1 - c, y + i1], [a - i1, y + i1 + c], [a - i1, y + h - i1 - c], [a - i1 - c, y + h - i1], [0, y + h - i1]]));
  add("gd-hair", poly(inner));

  // chevron bands under the top frame and over the bottom one
  const bandH = u * 0.045, teeth = Math.max(4, Math.round(a / (u * 0.07))), step = (a - i2 - c) / teeth;
  for (const [y0, dir] of [[y + i2 + u * 0.035, 1], [y + h - i2 - u * 0.035, -1]]) {
    const pts = [];
    for (let k = 0; k <= teeth; k++) pts.push([k * step, y0 + (k % 2 ? bandH * dir : 0)]);
    add("gd-line", poly(pts));
  }

  // a ziggurat above and below the medallion: four steps narrowing toward it, in solid brass
  const R = Math.min(a * 0.9, h * 0.27), zh = h * 0.026;
  for (const dir of [1, -1]) {
    const base = dir > 0 ? y + i2 + u * 0.1 : y + h - i2 - u * 0.1;
    for (let s = 0; s < 4; s++) {
      const half = a * (0.62 - s * 0.14), y0 = base + dir * s * zh, y1 = y0 + dir * zh * 0.8;
      add("gd-step", poly([[0, y0], [half, y0], [half, y1], [0, y1]], true));
    }
  }

  // fluted pilasters at the outer edge: a column of three vertical flutes between two caps
  const pw = Math.min(a * 0.2, u * 0.12), pxo = a - i2 - u * 0.03, py0 = y + h * 0.2, py1 = y + h * 0.8;
  add("gd-pilaster", poly([[pxo - pw, py0], [pxo, py0], [pxo, py1], [pxo - pw, py1]], true));
  const flutes = [];
  for (let k = 1; k <= 3; k++) flutes.push(`M${pt(pxo - pw * k / 4, py0 + u * 0.03)}L${pt(pxo - pw * k / 4, py1 - u * 0.03)}`);
  add("gd-line", flutes.join(""));
  for (const py of [py0, py1]) add("gd-cap", poly([[pxo - pw - u * 0.015, py - u * 0.012], [pxo + u * 0.015, py - u * 0.012], [pxo + u * 0.015, py + u * 0.012], [pxo - pw - u * 0.015, py + u * 0.012]], true));

  // corner fans: five rays from each outer corner into the frame
  const fr = u * 0.17;
  for (const [cx0, cy0, sgn] of [[a - i2, y + i2, 1], [a - i2, y + h - i2, -1]]) {
    const rays = [];
    for (let k = 0; k <= 5; k++) { const th = (k / 5) * Math.PI / 2; rays.push(`M${pt(cx0, cy0)}L${pt(cx0 - Math.cos(th) * fr, cy0 + sgn * Math.sin(th) * fr)}`); }
    add("gd-line", rays.join(""));
    add("gd-line", `M${pt(cx0 - fr, cy0)}A${f3(fr)} ${f3(fr)} 0 0 ${(side === "l") === (sgn > 0) ? 0 : 1} ${pt(cx0, cy0 + sgn * fr)}`);
  }

  // the medallion on the seam: half a disc in this leaf, its rings and a sunburst of rays between two of them
  out.push(`<path class="gd-disc" d="M${pt(0, cy - R)}A${f3(R)} ${f3(R)} 0 0 ${side === "l" ? 0 : 1} ${pt(0, cy + R)}Z"/>`);
  const arc = (r, cls) => add(cls, `M${pt(0, cy - r)}A${f3(r)} ${f3(r)} 0 0 ${side === "l" ? 0 : 1} ${pt(0, cy + r)}`);
  arc(R, "gd-frame"); arc(R * 0.86, "gd-hair"); arc(R * 0.5, "gd-line"); arc(R * 0.3, "gd-frame");
  const rays = [], N = 11;
  for (let k = 0; k <= N; k++) {
    const th = -Math.PI / 2 + (k / N) * Math.PI, cos = Math.cos(th), sin = Math.sin(th);
    rays.push(`M${pt(cos * R * 0.5, cy + sin * R * 0.5)}L${pt(cos * R * 0.86, cy + sin * R * 0.86)}`);
  }
  add("gd-line", rays.join(""));
  // between the rays, small gilt beads on the outer ring
  for (let k = 0; k < N; k++) {
    const th = -Math.PI / 2 + ((k + 0.5) / N) * Math.PI;
    out.push(`<circle class="gd-bead" cx="${f3(X(Math.cos(th) * R * 0.93))}" cy="${f3(cy + Math.sin(th) * R * 0.93)}" r="${f3(u * 0.009)}"/>`);
  }

  // rivets along the frame's corners
  for (const [dx, py] of [[a - i1 * 1.5, y + i1 * 1.5 + c], [a - i1 * 1.5, y + h - i1 * 1.5 - c], [i1 * 2, y + i2 + u * 0.1], [i1 * 2, y + h - i2 - u * 0.1]]) {
    out.push(`<circle class="gd-bead" cx="${f3(X(dx))}" cy="${f3(py)}" r="${f3(u * 0.011)}"/>`);
  }
  return `<g class="cover ${side}">${out.join("")}</g>`;
}

/** The whole gate over the box [x, y, w, h]: two leaves, the seam, and a plaque with the word on it. */
export function gateMarkup(box, { closing = false, clip = true } = {}) {
  const [x, y, w, h] = box, u = Math.min(w, h), sx = x + w / 2, cy = y + h / 2, pw = u * 0.3, ph = u * 0.095, k = ph * 0.45;
  const plaque = `M${f3(sx - pw)} ${f3(cy)}l${f3(k)} ${f3(-ph)}h${f3(2 * pw - 2 * k)}l${f3(k)} ${f3(ph)}l${f3(-k)} ${f3(ph)}h${f3(-(2 * pw - 2 * k))}Z`;
  return `<g class="hatch gate${closing ? " closing" : ""}"${clip ? ' clip-path="url(#sw-clip)"' : ""}>${leaf(box, "l")}${leaf(box, "r")}`
    + `<path class="seam" d="M${f3(sx)} ${f3(y)}v${f3(h)}"/><path class="plaque" d="${plaque}"/>`
    + `<text class="stamp" x="${f3(sx)}" y="${f3(cy)}" style="font-size:${f3(u * 0.085)}px">Stowed</text></g>`;
}
