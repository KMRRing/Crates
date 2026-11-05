// The waterworks of Atoll's 3D view, decided from the sea alone (plain arithmetic, no three.js, tested in Node): which channels join
// the network, where the water comes in and goes out, how it flows, and where the few engineering details stand (the weir at the
// intake, a sluice at the outlet, pound locks on long straight runs, sluices at junctions, arch bridges, norias, and the route of
// the grain barges). Everything is read off the current sea, so a half-shaded board gets its works too, and it never puts one
// where a number is: a detail stands only on a sea cell whose four neighbours hold no number.
import { SEA } from "./nurikabe-engine.js";

const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];          // north, east, south, west (row 0 is the far side)
export const ARMS = ["N", "E", "S", "W"];

/** The neighbours of cell x as [cell or -1] in the order of ARMS. */
function around(N, x) {
  const r = Math.floor(x / N), c = x % N;
  return [r > 0 ? x - N : -1, c < N - 1 ? x + 1 : -1, r < N - 1 ? x + N : -1, c > 0 ? x - 1 : -1];
}

/** The islands that are whole: for each such island's cells the number's cell, else -1 (a piece of land with its one number and exactly that many cells). */
export function plotsOf(N, clue, marks) {
  const n = N * N, owner = new Int16Array(n).fill(-1), seen = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    if (seen[s] || marks[s] === SEA) continue;
    const comp = [s], at = [s];
    seen[s] = 1;
    let numbers = 0, number = -1;
    for (let i = 0; i < comp.length; i++) {
      const x = comp[i];
      if (clue[x]) { numbers++; number = x; }
      for (const y of around(N, x)) if (y >= 0 && !seen[y] && marks[y] !== SEA) { seen[y] = 1; comp.push(y); }
    }
    void at;
    if (numbers === 1 && comp.length === clue[number]) for (const x of comp) owner[x] = number;
  }
  return owner;
}

/** Which board edge a cell is on, as the outward direction [dx, dz] (the first of north, east, south, west), or null inside the board. */
export function outward(N, x) {
  const r = Math.floor(x / N), c = x % N;
  if (r === 0) return [0, -1];
  if (c === N - 1) return [1, 0];
  if (r === N - 1) return [0, 1];
  if (c === 0) return [-1, 0];
  return null;
}

/**
 * The works for a board: `marks` is the run's text, `clue` each cell's number (0 for none).
 * Returns { sea, comp, source, outlet, dist, flow, wet, path, locks, sluices, bridges, norias, barges }.
 */
export function works(N, clue, marks) {
  const n = N * N, sea = new Uint8Array(n);
  for (let x = 0; x < n; x++) if (marks[x] === SEA) sea[x] = 1;
  const nb = Array.from({ length: n }, (_, x) => around(N, x));
  const seaNb = x => nb[x].map(y => (y >= 0 && sea[y] ? y : -1));
  const nearNumber = x => clue[x] > 0 || nb[x].some(y => y >= 0 && clue[y] > 0);

  // the pieces of water, and the biggest one (the earliest, on a tie): the network the others are not part of yet
  const comp = new Int16Array(n).fill(-1), sizes = [];
  for (let s = 0; s < n; s++) {
    if (!sea[s] || comp[s] >= 0) continue;
    const id = sizes.length, todo = [s];
    comp[s] = id;
    let size = 0;
    while (todo.length) {
      const x = todo.pop();
      size++;
      for (const y of seaNb(x)) if (y >= 0 && comp[y] < 0) { comp[y] = id; todo.push(y); }
    }
    sizes.push(size);
  }
  const out = { sea, comp, source: -1, outlet: -1, dist: new Int16Array(n).fill(-1), flow: new Float32Array(n * 2), wet: new Uint8Array(n), path: [], locks: [], sluices: [], bridges: [], norias: [], barges: 0 };
  if (!sizes.length) return out;
  let main = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[main]) main = i;

  // the intake: the first cell of the network on the board's edge, else the cell nearest the edge (water seeps in through a culvert)
  const edgeDepth = x => { const r = Math.floor(x / N), c = x % N; return Math.min(r, c, N - 1 - r, N - 1 - c); };
  let source = -1;
  for (let x = 0; x < n && source < 0; x++) if (sea[x] && comp[x] === main && edgeDepth(x) === 0) source = x;
  if (source < 0) for (let x = 0; x < n; x++) if (sea[x] && comp[x] === main && (source < 0 || edgeDepth(x) < edgeDepth(source))) source = x;
  out.source = source;

  // the water's way out from the intake: a breadth-first walk, whose far end is the outlet (a border cell if there is one)
  const parent = new Int16Array(n).fill(-1), dist = out.dist, order = [source];
  dist[source] = 0;
  for (let i = 0; i < order.length; i++) {
    const x = order[i];
    for (const y of seaNb(x)) if (y >= 0 && dist[y] < 0) { dist[y] = dist[x] + 1; parent[y] = x; order.push(y); }
  }
  let outlet = -1;
  for (const x of order) if (x !== source && edgeDepth(x) === 0 && (outlet < 0 || dist[x] > dist[outlet])) outlet = x;
  out.outlet = outlet;
  if (outlet >= 0) for (let x = outlet; x >= 0; x = parent[x]) out.path.unshift(x);

  // the current: toward the cells farther from the intake (and from the cells nearer to it); a dead end stands still
  for (const x of order) {
    const r = Math.floor(x / N), c = x % N;
    let fx = 0, fz = 0, down = 0;
    for (let a = 0; a < 4; a++) {
      const y = nb[x][a];
      if (y < 0 || !sea[y] || dist[y] < 0) continue;
      if (dist[y] > dist[x]) { fx += DX[a]; fz += DZ[a]; down++; } else if (dist[y] < dist[x]) { fx -= DX[a]; fz -= DZ[a]; }
    }
    if (x === outlet) { const o = outward(N, x); if (o) { fx += o[0]; fz += o[1]; } }
    if (x === source && !down) { const o = outward(N, x); if (o) { fx -= o[0]; fz -= o[1]; } }
    const l = Math.hypot(fx, fz);
    if (l > 1e-6) { out.flow[x * 2] = fx / l; out.flow[x * 2 + 1] = fz / l; }
    out.wet[x] = 1;
    void r; void c;
  }

  // details stand on cells at least `gap` apart (Manhattan), none beside a number
  const placed = [];
  const free = (x, gap) => !nearNumber(x) && placed.every(p => Math.abs(Math.floor(p / N) - Math.floor(x / N)) + Math.abs((p % N) - (x % N)) >= gap);
  const take = x => { placed.push(x); return x; };
  const wide = N >= 10 ? 2 : 1;
  // a straight channel cell: water on two opposite sides only, land (or the board's edge) on the others; its axis is the way the water runs
  const straight = x => {
    const s = seaNb(x), ns = s[0] >= 0 && s[2] >= 0 && s[1] < 0 && s[3] < 0, ew = s[1] >= 0 && s[3] >= 0 && s[0] < 0 && s[2] < 0;
    return ns ? "z" : ew ? "x" : null;
  };

  // the weir at the intake and the sluice at the outlet are fixed first, so nothing else crowds them
  if (source >= 0) take(source);
  if (outlet >= 0) take(outlet);

  // pound locks: the longest straight runs of three or more, a gate at each end
  const runs = [];
  const seenRun = new Uint8Array(n);
  for (let x = 0; x < n; x++) {
    if (!sea[x] || seenRun[x] || comp[x] !== main) continue;
    const ax = straight(x);
    if (!ax) continue;
    const step = ax === "x" ? 1 : N, cells = [x];
    seenRun[x] = 1;
    for (let y = x + step; y < n && sea[y] && straight(y) === ax && (ax === "z" || Math.floor(y / N) === Math.floor(x / N)); y += step) { cells.push(y); seenRun[y] = 1; }
    if (cells.length >= 3 && cells.every(y => !nearNumber(y))) runs.push({ axis: ax, cells });
  }
  runs.sort((a, b) => b.cells.length - a.cells.length || a.cells[0] - b.cells[0]);
  for (const run of runs) {
    if (out.locks.length >= wide) break;
    const gates = [run.cells[0], run.cells[run.cells.length - 1]];
    if (!gates.every(g => free(g, 2))) continue;
    gates.forEach(take);
    out.locks.push({ axis: run.axis, cells: run.cells, gates });
  }

  // sluices where three or more channels meet: a gate across the straight cell of the arm that leads away from the intake (a gate
  // stands in a channel with banks on both sides, centred, never in the junction itself where one side is open water)
  for (let x = 0; x < n && out.sluices.length < wide; x++) {
    if (!sea[x] || comp[x] !== main || !free(x, 3)) continue;
    const s = seaNb(x);
    if (s.filter(y => y >= 0).length < 3) continue;
    const arms = [0, 1, 2, 3].filter(a => s[a] >= 0 && dist[s[a]] > dist[x]).sort((a, b) => dist[s[b]] - dist[s[a]]);
    const arm = arms.find(a => straight(s[a]) === (a % 2 ? "x" : "z") && !nearNumber(s[a]) && free(s[a], 2));
    if (arm === undefined) continue;
    out.sluices.push({ cell: take(s[arm]), junction: x, axis: straight(s[arm]), arm });
  }

  // arch bridges over a straight channel with a field on each bank
  const land = y => y >= 0 && !sea[y];
  for (let x = 0; x < n && out.bridges.length < wide; x++) {
    if (!sea[x] || !free(x, 4)) continue;
    const ax = straight(x);
    if (!ax) continue;
    const s = nb[x], across = ax === "x" ? [s[0], s[2]] : [s[1], s[3]];
    if (across.every(land)) out.bridges.push({ cell: take(x), axis: ax });
  }

  // norias where a channel runs past a field: the wheel on the field's side
  for (let x = 0; x < n && out.norias.length < wide; x++) {
    if (!sea[x] || !free(x, 3)) continue;
    const ax = straight(x);
    if (!ax) continue;
    const s = nb[x], across = ax === "x" ? [s[0], s[2]] : [s[1], s[3]], side = land(across[0]) ? -1 : land(across[1]) ? 1 : 0;
    if (side) out.norias.push({ cell: take(x), axis: ax, side });
  }

  // grain barges ride the route from the intake to the outlet once the sea is the answer
  if (out.path.length >= 4) out.barges = Math.min(3, Math.max(1, Math.floor(out.path.length / 5)));
  return out;
}
