// Bridges' hex board (bridges-lattice.js, and the engine's `more.hex`): the lattice itself; the links and crossings the layout finds
// against ones found from the points' places on the plane (two segments that really meet, not "share a lattice point"); every twist
// on a hex board against a plain search of every way to build bridges that shares nothing with the solver; and the generator (one
// answer, every twist, every level, the same twice). Square boards are tests/bridges-search.mjs's and tests/bridges.mjs's.
import { layoutOf, count, generate, randomBoard, rngOf, gradeOf, flagsOf, moreOf, ORDER, SIZES } from "../bridges-engine.js";
import { H, AXES, onBoard, pointsOf, xyOf, boxOf, radiusOf, gapsOf, straitLine, worldXZ } from "../bridges-lattice.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const hexMore = { hex: true };

// ---------- the lattice ----------
{
  check([7, 9, 11].map(s => pointsOf(s, true)).join() === "37,61,91", "a hexagon of radius 3, 4 and 5 holds 37, 61 and 91 points");
  let all = true;
  for (const size of [7, 9, 11]) {
    const pts = []; for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (onBoard(size, true, r, c)) pts.push([r, c]);
    if (pts.length !== pointsOf(size, true)) all = false;
    for (const [r, c] of pts) {
      let near = 0;
      for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, -1], [-1, 1]]) if (onBoard(size, true, r + dr, c + dc)) { near++; const [x0, y0] = xyOf(size, true, r, c), [x1, y1] = xyOf(size, true, r + dr, c + dc); if (Math.abs(Math.hypot(x1 - x0, y1 - y0) - 1) > 1e-9) all = false; }
      if (near < 3 || near > 6) all = false;
    }
    const R = radiusOf(size), [w, h] = boxOf(size, true);
    const xs = pts.map(([r, c]) => xyOf(size, true, r, c)[0]), ys = pts.map(([r, c]) => xyOf(size, true, r, c)[1]);
    if (Math.min(...xs) !== 0.5 || Math.abs(Math.max(...xs) - (w - 0.5)) > 1e-9 || Math.min(...ys) !== 0.5 || Math.abs(Math.max(...ys) - (h - 0.5)) > 1e-9 || R * 2 + 1 !== size) all = false;
    const [cx, cz] = worldXZ(size, true, R, R);
    if (Math.abs(cx) > 1e-9 || Math.abs(cz) > 1e-9) all = false;
  }
  check(all, "every hex point is a unit from each neighbour it has (three to six), and the box fits the points with half a unit round them");
  check(AXES.length === 3 && Math.abs(H - Math.sqrt(0.75)) < 1e-12, "a link runs along one of three axes");
}

// ---------- links and crossings, from the plane ----------
const seg = (a, b, c, d) => ({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
const ccw = (ax, ay, bx, by, cx, cy) => (cy - ay) * (bx - ax) - (by - ay) * (cx - ax);
/** Whether two segments of the plane have a point in common (touching counts), by orientation tests. */
function meet(p, q) {
  const o1 = ccw(p.x1, p.y1, p.x2, p.y2, q.x1, q.y1), o2 = ccw(p.x1, p.y1, p.x2, p.y2, q.x2, q.y2), o3 = ccw(q.x1, q.y1, q.x2, q.y2, p.x1, p.y1), o4 = ccw(q.x1, q.y1, q.x2, q.y2, p.x2, p.y2);
  const e = 1e-9;
  return Math.sign(Math.abs(o1) < e ? 0 : o1) * Math.sign(Math.abs(o2) < e ? 0 : o2) <= 0 && Math.sign(Math.abs(o3) < e ? 0 : o3) * Math.sign(Math.abs(o4) < e ? 0 : o4) <= 0
    && Math.max(Math.min(p.x1, p.x2), Math.min(q.x1, q.x2)) <= Math.min(Math.max(p.x1, p.x2), Math.max(q.x1, q.x2)) + e && Math.max(Math.min(p.y1, p.y2), Math.min(q.y1, q.y2)) <= Math.min(Math.max(p.y1, p.y2), Math.max(q.y1, q.y2)) + e;
}
/** The links of a hex board from the plane alone: two islands are linked when the segment between them is a lattice line with no island on it and a point between them. */
function planeLinks(size, grid, realms = "") {
  const isl = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] !== ".") { const r = Math.floor(i / size), c = i % size, [x, y] = xyOf(size, true, r, c); isl.push({ i, r, c, x, y, realm: realms[i] || "0" }); }
  const links = [];
  isl.forEach((a, p) => isl.forEach((b, q) => {
    if (b.i <= a.i || a.realm !== b.realm) return;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), steps = Math.round(len);
    if (steps < 2 || Math.abs(len - steps) > 1e-9) return;
    const ux = dx / len, uy = dy / len, onLattice = [[1, 0], [0.5, H], [-0.5, H], [-1, 0], [-0.5, -H], [0.5, -H]].some(([x, y]) => Math.abs(ux - x) < 1e-9 && Math.abs(uy - y) < 1e-9);
    if (!onLattice) return;
    if (isl.some((o, k) => k !== p && k !== q && Math.abs(ccw(a.x, a.y, b.x, b.y, o.x, o.y)) < 1e-9 && Math.hypot(o.x - a.x, o.y - a.y) < len && Math.hypot(o.x - b.x, o.y - b.y) < len)) return;
    links.push({ a: p, b: q, ...seg([a.x, a.y], [b.x, b.y]), key: `${a.i}:${b.i}` });
  }));
  return { isl, links };
}
{
  const rng = rngOf(17);
  let boards = 0, linkSets = 0, crossPairs = 0, ok = true, why = "";
  for (const size of [7, 9, 11]) for (let k = 0; k < 14; k++) {
    const b = randomBoard(size, rng, Math.round(pointsOf(size, true) * 0.3), 0.5, k % 2 === 1, false, null, true);
    if (!b) continue;
    boards++;
    const lay = layoutOf(size, b.grid, "", b.realms, "", "", hexMore), ref = planeLinks(size, b.grid, b.realms);
    const mine = lay.links.map(l => `${lay.isl[l.a].r * size + lay.isl[l.a].c}:${lay.isl[l.b].r * size + lay.isl[l.b].c}`).sort().join(), theirs = ref.links.map(l => l.key).sort().join();
    if (mine !== theirs) { ok = false; why = `links differ on size ${size} board ${k}`; continue; }
    linkSets++;
    // crossings: two links with no island in common that meet on the plane
    const byKey = new Map(ref.links.map(l => [l.key, l]));
    const keyOf = l => `${lay.isl[lay.links[l].a].r * size + lay.isl[lay.links[l].a].c}:${lay.isl[lay.links[l].b].r * size + lay.isl[lay.links[l].b].c}`;
    for (let i = 0; i < lay.links.length; i++) for (let j = i + 1; j < lay.links.length; j++) {
      const A = lay.links[i], B = lay.links[j];
      if (A.a === B.a || A.a === B.b || A.b === B.a || A.b === B.b) { if (lay.cross[i].includes(j)) { ok = false; why = "links sharing an island cross"; } continue; }
      const meets = meet(byKey.get(keyOf(i)), byKey.get(keyOf(j)));
      if (meets !== lay.cross[i].includes(j) || meets !== lay.cross[j].includes(i)) { ok = false; why = `crossing differs (size ${size} board ${k})`; }
      if (meets) crossPairs++;
    }
  }
  check(ok && linkSets === boards && boards >= 30 && crossPairs > 20, `the layout's links and crossings are the plane's, on ${boards} generated hex boards (${crossPairs} crossing pairs)${why ? `: ${why}` : ""}`);
  // a row of three islands on the middle row: two links, none from the first to the last
  const mid = Array.from({ length: 49 }, () => ".");
  mid[3 * 7 + 0] = "1"; mid[3 * 7 + 2] = "2"; mid[3 * 7 + 4] = "1";
  const row = layoutOf(7, mid.join(""), "", "", "", "", hexMore);
  check(row.links.length === 2 && row.links.every(l => l.dir === 0), "an island in the way stops a link: three in a row make two links");
  // the same on a slant, and an island next to another has no link
  const sl = Array.from({ length: 49 }, () => ".");
  sl[0 * 7 + 3] = "1"; sl[2 * 7 + 1] = "1"; sl[4 * 7 + 4] = "1"; sl[4 * 7 + 5] = "1";
  const slant = layoutOf(7, sl.join(""), "", "", "", "", hexMore);
  check(slant.links.length === 1 && slant.links[0].dir === 2 && slant.links[0].cap === 2, "a link may run down and to the left, and neighbours are not linked");
}

// ---------- the rules, against a plain search ----------
/** Every way to build the bridges of a hex board with the twists, by a plain search that uses the plane's own geometry and nothing of the solver's. */
function everyAnswer(size, grid, kinds, realms, hills, roads, straits, tree, limit = 6) {
  const { isl, links } = planeLinks(size, grid, realms);
  isl.forEach((a, x) => { a.n = parseInt(grid[a.i], 16); a.kind = kinds[a.i] || "="; a.hill = hills[a.i] === "1"; });
  // the layout's order is the engine's (links are numbered from the islands in reading order, each island's along the row, down-right, down-left), so roads follow it: sort the same way
  const dirRank = l => { const dx = l.x2 - l.x1, dy = l.y2 - l.y1; return dy === 0 ? 0 : dx > 0 ? 1 : 2; };
  links.sort((p, q) => isl[p.a].i - isl[q.a].i || dirRank(p) - dirRank(q));
  links.forEach((l, k) => { l.cap = +(roads[k] || 2); l.high = isl[l.a].hill && isl[l.b].hill; });
  const cross = links.map((p, i) => links.map((q, j) => (j !== i && p.a !== q.a && p.a !== q.b && p.b !== q.a && p.b !== q.b && p.high === q.high && meet(p, q) ? j : -1)).filter(j => j >= 0));
  // each strait is a line of the plane; a link crosses it when the two meet
  const lines = [];
  for (let g = 0; g < straits.length; g++) if (straits[g] !== ".") { const fam = Math.floor(g / (size - 1)), gap = g % (size - 1), [[x0, y0], [x1, y1]] = straitLine(size, true, fam, gap, 2); lines.push({ n: +straits[g], ...seg([x0, y0], [x1, y1]) }); }
  const out = [], cur = new Array(links.length).fill(0), sums = isl.map(() => 0), most = isl.map(a => (a.kind === "+" ? 99 : a.n));
  const ok = () => {
    for (let x = 0; x < isl.length; x++) { const s = sums[x], a = isl[x]; if (a.kind === "=" ? s !== a.n : a.kind === "+" ? s < a.n : s > a.n || s < 1) return false; }
    for (let i = 0; i < links.length; i++) if (cur[i]) for (const j of cross[i]) if (cur[j]) return false;
    for (const ln of lines) { let n = 0; links.forEach((l, k) => { if (cur[k] && meet(l, ln)) n += cur[k]; }); if (n !== ln.n) return false; }
    for (const realm of ["0", "1"]) {
      const mine = isl.map((a, x) => (a.realm === realm ? x : -1)).filter(x => x >= 0);
      if (!mine.length) continue;
      const seen = new Set([mine[0]]), todo = [mine[0]];
      while (todo.length) { const x = todo.pop(); links.forEach((l, k) => { if (!cur[k]) return; const y = l.a === x ? l.b : l.b === x ? l.a : -1; if (y >= 0 && !seen.has(y)) { seen.add(y); todo.push(y); } }); }
      if (seen.size !== mine.length) return false;
    }
    if (tree) { const par = isl.map((_, x) => x), root = x => (par[x] === x ? x : (par[x] = root(par[x]))); for (let k = 0; k < links.length; k++) if (cur[k]) { const p = root(links[k].a), q = root(links[k].b); if (p === q) return false; par[p] = q; } }
    return true;
  };
  (function go(k) {
    if (out.length >= limit) return;
    if (k === links.length) { if (ok()) out.push(cur.join("")); return; }
    const { a, b, cap } = links[k];
    for (let v = 0; v <= cap; v++) { cur[k] = v; sums[a] += v; sums[b] += v; if (sums[a] <= most[a] && sums[b] <= most[b]) go(k + 1); sums[a] -= v; sums[b] -= v; }
    cur[k] = 0;
  })(0);
  return { out, links };
}
{
  const rng = rngOf(2026);
  let boards = 0, agree = 0, withAnswer = 0, several = 0, ok = true, why = "";
  const per = { ranges: 0, realms: 0, hills: 0, roads: 0, straits: 0, tree: 0 };
  for (let k = 0; k < 90 && boards < 48; k++) {
    const T = { realms: k % 6 === 1 || k % 6 === 5, hills: k % 6 === 2 || k % 6 === 5, wide: k % 6 === 3, narrow: k % 6 === 3 || k % 6 === 4 };
    const b = randomBoard(7, rng, 6 + (k % 3), 0.6, T.realms, T.hills, T.narrow || T.wide ? T : null, true);
    if (!b) continue;
    const lay0 = layoutOf(7, b.grid, "", b.realms, b.hills, b.roads, hexMore);
    if (lay0.links.length > 13) continue;
    boards++;
    // twists on top: bounds on some islands, a strait or two on gaps the answer crosses (and one it doesn't), no loops
    let kinds = "", straits = "", tree = false;
    if (k % 6 === 0 || k % 6 === 4) { kinds = Array.from(b.grid, (ch, i) => (ch === "." ? "." : rng() < 0.3 ? (rng() < 0.5 && parseInt(ch, 16) < 8 ? "+" : "-") : "=")).join(""); per.ranges++; }
    if (k % 6 === 0 || k % 6 === 3) { const sArr = Array.from({ length: gapsOf(7, true) }, () => "."); for (let t = 0; t < 2; t++) sArr[Math.floor(rng() * sArr.length)] = String(Math.floor(rng() * 4)); straits = sArr.join(""); per.straits++; }
    if (k % 6 === 5 || k % 6 === 1) { tree = true; per.tree++; }
    if (T.realms) per.realms++;
    if (b.hills) per.hills++;
    if (b.roads) per.roads++;
    const more = { straits, tree, hex: true }, lay = layoutOf(7, b.grid, kinds, b.realms, b.hills, b.roads, more);
    const plain = everyAnswer(7, b.grid, kinds, b.realms, b.hills, b.roads, straits, tree), mine = count(lay, 6);
    if (plain.links.length !== lay.links.length) { ok = false; why = `link count differs on board ${k}`; continue; }
    if (mine === plain.out.length) agree++; else { ok = false; why = `board ${k} (${k % 6}): solver ${mine}, search ${plain.out.length}`; }
    if (plain.out.length) withAnswer++;
    if (plain.out.length > 1) several++;
  }
  check(ok && agree === boards && boards >= 40, `the solver counts as many answers as a plain search on ${boards} small hex boards with bounds, realms, viaducts, roads, straits and no loops (${withAnswer} with an answer, ${several} with several)${why ? `: ${why}` : ""}`);
  check(Object.values(per).every(n => n >= 3), `…each twist was on at least three of them (${Object.entries(per).map(([k, n]) => `${k} ${n}`).join(", ")})`);
}

// ---------- the generator ----------
{
  let ok = true, why = "", made = 0, hit = 0;
  const fail = m => { if (ok) why = m; ok = false; };
  const kinds = ["none", "ranges", "realms", "hills", "narrow", "wide", "straits", "tree", "ranges+realms", "hills+narrow", "wide+tree", "ranges+straits+tree"];
  kinds.forEach((twist, ti) => [7, 9].forEach(size => ORDER.forEach((level, li) => {
    if (size === 9 && ti % 3) return;
    const seed = 40 + ti * 7 + li, p = generate(seed, size, level, twist, "hex"), tag = `${twist} hex ${size} ${level} #${seed}`;
    if (!p) return fail(`${tag}: no puzzle`);
    made++; if (p.level === level) hit++;
    if (p.shape !== "hex" || p.size !== size) return fail(`${tag}: not a hex board of its size`);
    const lay = layoutOf(size, p.grid, p.kinds || "", p.realms || "", p.hills || "", p.roads || "", moreOf(p));
    if (count(lay, 2) !== 1) fail(`${tag}: not one answer`);
    if (gradeOf(lay) !== ORDER.indexOf(p.level)) fail(`${tag}: graded differently than it says`);
    if (p.sol.length !== lay.links.length) fail(`${tag}: answer is not a bridge count a link`);
    if ([...p.grid].some((ch, i) => ch !== "." && !onBoard(size, true, Math.floor(i / size), i % size))) fail(`${tag}: an island off the board`);
    if (lay.isl.some(x => x.n > 12)) fail(`${tag}: an island over twelve`);
    const T = flagsOf(twist);
    if (T.ranges !== /[+-]/.test(p.kinds || "")) fail(`${tag}: bounds`);
    if (T.hills !== !!p.hills || T.straits !== !!p.straits || T.realms !== (lay.realmSize[0] > 0 && lay.realmSize[1] > 0)) fail(`${tag}: a twist missing or extra`);
    if (p.straits && p.straits.length !== gapsOf(size, true)) fail(`${tag}: straits string of the wrong length`);
    if (JSON.stringify(generate(seed, size, level, twist, "hex")) !== JSON.stringify(p)) fail(`${tag}: not the same twice`);
  })));
  check(ok, `hex puzzles of every twist, size and level have one answer, are graded as they say, carry their strings and are the same twice (${made} made, ${hit} at the level asked)${why ? `: ${why}` : ""}`);
  check(JSON.stringify(generate(7, 9, "medium", "none", "square")) === JSON.stringify(generate(7, 9, "medium")) && !("shape" in generate(7, 9, "medium")), "a square puzzle carries no shape, and asking for square is the plain call");
}

console.log(bad ? `\n${bad} FAILED` : "\nbridges hex: the lattice, links and crossings, every twist against a plain search, the generator");
process.exit(bad ? 1 : 0);
