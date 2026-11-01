// A level's rock in miniature (survey.js's list of levels): the cubes there are, drawn isometrically from the corner
// nearest the viewer, three faces to a cube, a face left out where another cube hides it. SVG only: the colours are the
// stylesheet's (.t the top, .l the left face, .r the right).
const COS = Math.sqrt(3) / 2;
/** The svg (as a string) of a rock of n cubes each way, `present` its cubes (1 where there is one), in the engine's order x + n(y + nz). */
export function miniature(present, n) {
  const at = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < n && y < n && z < n && !!present[x + n * (y + n * z)];
  const cubes = [];
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (at(x, y, z)) cubes.push([x, y, z]);
  cubes.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));                    // far ones first, so near ones paint over them
  const pt = (x, y, z) => [(x - z) * COS, (x + z) * 0.5 - y];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const polys = [];
  const face = (cls, corners) => {
    const ps = corners.map(c => pt(...c));
    for (const [px, py] of ps) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    polys.push(`<polygon class="${cls}" points="${ps.map(p => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(" ")}"/>`);
  };
  for (const [x, y, z] of cubes) {
    if (!at(x, y + 1, z)) face("t", [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]);
    if (!at(x + 1, y, z)) face("r", [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]]);
    if (!at(x, y, z + 1)) face("l", [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]);
  }
  const pad = 0.15;
  return `<svg viewBox="${(x0 - pad).toFixed(2)} ${(y0 - pad).toFixed(2)} ${(x1 - x0 + 2 * pad).toFixed(2)} ${(y1 - y0 + 2 * pad).toFixed(2)}" aria-hidden="true">${polys.join("")}</svg>`;
}
