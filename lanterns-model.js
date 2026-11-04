// The sea's geometry, with no WebGL in it, so Node can test it (tests/lanterns.mjs): which cell a point of the water is over,
// where a cell's middle is, how far a lantern's beams run, and the camera's fit. lanterns-3d.js draws with it.
const DEG = Math.PI / 180;

/** The cell under a point on the ground, for a board of N×N cells one unit each and centred on the origin: row·N + column, or −1 off the board. */
export function cellAtGround(N, x, z) {
  const c = Math.floor(x + N / 2), r = Math.floor(z + N / 2);
  return c < 0 || r < 0 || c >= N || r >= N ? -1 : r * N + c;
}
/** A cell's middle on the ground. */
export const cellXZ = (N, x) => [(x % N) - (N - 1) / 2, Math.floor(x / N) - (N - 1) / 2];
/** The beams of a lantern: for each way, how many cells the light runs (up, down, left, right) before a rock or the edge. */
export function runsFrom(N, black, x) {
  const out = [], r = Math.floor(x / N), c = x % N;
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    let n = 0, rr = r + dr, cc = c + dc;
    while (rr >= 0 && cc >= 0 && rr < N && cc < N && !black[rr * N + cc]) { n++; rr += dr; cc += dc; }
    out.push(n);
  }
  return out;
}
/** How far back the camera stands for the whole board to fill the view: the largest, over the points, of what it takes to keep each inside the frustum. */
export function fitDistance(pts, az, el, look, tx, ty, mx = 0, my = 0) {
  const cosE = Math.cos(el), sinE = Math.sin(el);
  const rx = Math.cos(az), rz = -Math.sin(az);
  const fx = -Math.sin(az) * cosE, fy = -sinE, fz = -Math.cos(az) * cosE;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const kx = (1 - mx) * tx, ky = (1 - my) * ty;
  let d = 0;
  for (let i = 0; i < pts.length; i += 3) {
    const vx = pts[i] - look[0], vy = pts[i + 1] - look[1], vz = pts[i + 2] - look[2];
    const w = vx * fx + vy * fy + vz * fz;
    d = Math.max(d, Math.abs(vx * rx + vz * rz) / kx - w, Math.abs(vx * ux + vy * uy + vz * uz) / ky - w);
  }
  return d;
}
/** The first view's elevation for a card `aspect` wide to tall: the taller the card, the more it is looked down on. */
export const homeElevation = aspect => {
  const lo = Math.sin(40 * DEG), hi = Math.sin(62 * DEG);
  return Math.asin(Math.max(lo, Math.min(hi, 1 / Math.max(0.2, aspect))));
};

