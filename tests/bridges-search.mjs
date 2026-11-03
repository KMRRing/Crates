// The rules of Bridges (bridges-engine.js) against a plain search: a number that is only a bound, two realms each its own
// network, a hill whose bridge goes over the lowland's, a road that holds one bridge or three, a strait with its number, a
// board with no loops, each checked one at a time; then the solver's count of answers and the layout's links against a search
// of every way to build bridges on small boards, which uses nothing of the solver's (the links found from the grid, a cell
// holding one low bridge and one high at most, the straits counted from the cells, a ring found by joining). Apart from
// tests/bridges-levels.mjs and tests/bridges-puzzles.mjs, which check the levels and the puzzles made, to keep each under five seconds.
import { layoutOf, count, randomBoard, rngOf, flagsOf, twistOn, TWISTS } from "../bridges-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

/** The links of a board, found from the grid alone: a bridge goes right or down to the next island if there is water between and it is of the same realm. */
function linksOf(size, grid, realms, hills) {
  const isl = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] !== ".") isl.push({ i, r: Math.floor(i / size), c: i % size, n: parseInt(grid[i], 16), realm: realms[i] || "0", hill: hills[i] === "1" });
  const links = [];
  isl.forEach((a, x) => {
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      let r = a.r + dr, c = a.c + dc, cells = [];
      while (r < size && c < size && grid[r * size + c] === ".") { cells.push(r * size + c); r += dr; c += dc; }
      if (r >= size || c >= size || !cells.length) continue;
      const y = isl.findIndex(b => b.r === r && b.c === c);
      if (y < 0 || isl[y].realm !== a.realm) continue;
      links.push({ a: x, b: y, cells, high: a.hill && isl[y].hill, vertical: dr === 1 });
    }
  });
  return { isl, links };
}

/**
 * Every way to build the bridges of a board with the twists, by a plain search that uses nothing of the solver's. `roads` is a
 * digit a link in the order the links come (the most bridges it holds, two where there is none), `straits` the string of
 * the engine's doc (a gap between rows, `size - 1` of them, then a gap between columns; "." for none).
 */
function everyAnswer(size, grid, kinds, realms, hills = "", roads = "", straits = "", tree = false) {
  const { isl, links } = linksOf(size, grid, realms, hills);
  isl.forEach((a, x) => { a.kind = kinds[a.i] || "="; });
  links.forEach((l, k) => { l.cap = +(roads[k] || 2); });
  const out = [], cur = new Array(links.length).fill(0), sums = isl.map(() => 0), most = isl.map(a => (a.kind === "+" ? 99 : a.n));
  const ok = () => {
    const taken = new Set();                                  // a cell holds one low bridge and one high at most (key: cell and height)
    for (let k = 0; k < links.length; k++) if (cur[k]) for (const c of links[k].cells) { const key = c + (links[k].high ? "h" : "l"); if (taken.has(key)) return false; taken.add(key); }
    for (let x = 0; x < isl.length; x++) {
      const s = sums[x], a = isl[x];
      if (a.kind === "=" ? s !== a.n : a.kind === "+" ? s < a.n : s > a.n || s < 1) return false;     // "at most" is not none: the network needs a bridge on every island
    }
    for (let g = 0; g < straits.length; g++) {
      if (straits[g] === ".") continue;
      const gap = g < size - 1 ? g : g - (size - 1);
      let n = 0;
      links.forEach((l, k) => { const a = isl[l.a], b = isl[l.b]; if (cur[k] && (g < size - 1 ? l.vertical && a.r <= gap && gap < b.r : !l.vertical && a.c <= gap && gap < b.c)) n += cur[k]; });
      if (n !== +straits[g]) return false;
    }
    for (const realm of ["0", "1"]) {
      const mine = isl.map((a, x) => (a.realm === realm ? x : -1)).filter(x => x >= 0);
      if (!mine.length) continue;
      const seen = new Set([mine[0]]), todo = [mine[0]];
      while (todo.length) { const x = todo.pop(); links.forEach((l, k) => { if (!cur[k]) return; const y = l.a === x ? l.b : l.b === x ? l.a : -1; if (y >= 0 && !seen.has(y)) { seen.add(y); todo.push(y); } }); }
      if (seen.size !== mine.length) return false;
    }
    if (tree) {                                               // no ring: joining the bridges' ends one by one never meets an island already joined to the other
      const par = isl.map((_, x) => x), root = x => (par[x] === x ? x : (par[x] = root(par[x])));
      for (let k = 0; k < links.length; k++) if (cur[k]) { const p = root(links[k].a), q = root(links[k].b); if (p === q) return false; par[p] = q; }
    }
    return true;
  };
  (function go(k) {
    if (k === links.length) { if (ok()) out.push(cur.join("")); return; }
    const { a, b, cap } = links[k];
    for (let v = 0; v <= cap; v++) {
      cur[k] = v; sums[a] += v; sums[b] += v;
      if (sums[a] <= most[a] && sums[b] <= most[b]) go(k + 1);
      sums[a] -= v; sums[b] -= v;
    }
    cur[k] = 0;
  })(0);
  return { out, links };
}

const water = n => ".".repeat(n);
const blank = size => water(size * size);
/** A 5×5 chart from its rows (shorter rows are padded with water, missing rows are all water). */
const chart = (...rows) => Array.from({ length: 5 }, (_, r) => (rows[r] || "").padEnd(5, ".")).join("");

// ---------- the rules, one at a time ----------
{
  const blocked = layoutOf(5, chart("1.2.1"), "", "0" + "." + "1" + "." + "0");
  check(blocked.links.length === 0 && blocked.realmSize[0] === 2 && blocked.realmSize[1] === 1, "an island of the other realm between two stops the link as any island does");
  const apart = layoutOf(5, chart("1...1", "", "", "", "1...1"), "", chart("0...1", "", "", "", "0...1"));
  check(apart.links.length === 2 && apart.links.every(l => apart.isl[l.a].realm === apart.isl[l.b].realm), "a link joins two islands of one realm only");
  const rng = layoutOf(5, chart("2.3.1"), "+.-.=", "");      // kinds and realms are written cell by cell, like the grid
  check(rng.isl[0].mn === 2 && rng.isl[0].mx === 12 && rng.isl[1].mn === 0 && rng.isl[1].mx === 3 && rng.isl[2].mn === 1 && rng.isl[2].mx === 1, "an island may be exact, at least or at most its number");
  // two islands, "at least 1" and "at most 3" side by side in a row: they can be joined by one bridge or two, so there are two answers
  check(count(layoutOf(5, chart("1.3.."), "+.-..", ""), 5) === 2, "a number that is only a bound allows every number within it (an answer for each)");
  check(count(layoutOf(5, chart("1.3.."), "", ""), 5) === 0 && count(layoutOf(5, chart("1.1.."), "", ""), 5) === 1, "…where an exact number allows only its own");
  // two realms side by side in the same columns: islands of the other colour face each other but are not linked, and each realm is joined on its own
  const two = layoutOf(5, chart("1.1..", "", "1.1.."), "", chart("0.0..", "", "1.1.."));
  check(two.links.length === 2 && two.realmSize[0] === 2 && two.realmSize[1] === 2 && count(two, 3) === 1, "islands of the two realms facing each other are not linked, and each realm is joined of itself");
  const mixed = layoutOf(5, chart("1.1..", "", "1.1.."), "", "");
  check(mixed.links.length === 4 && count(mixed, 3) === 0, "…which one realm could not do (four links, and no bridge pattern makes every island a 1 and all one network)");
  // an island alone in its realm has no one to bridge to, so it can't have the bridge its network asks for
  check(count(layoutOf(5, chart("1.1.."), "", "0.1.."), 3) === 0, "an island alone in its realm has no answer");
}
{
  // roads: a narrow road holds one bridge, a wide one three (written a digit a link, in the order the links come)
  const two = chart("2.2.."), three = chart("3.3.."), square = chart("3.3..", "", "3.3..");
  check(count(layoutOf(5, two, "", "", "", ""), 5) === 1 && count(layoutOf(5, two, "", "", "", "1"), 5) === 0 && count(layoutOf(5, two, "", "", "", "3"), 5) === 1, "a narrow road cannot be doubled, so two 2s joined by one have no answer on it; a wide road, which holds more, still allows a double");
  check(count(layoutOf(5, three, "", "", "", ""), 5) === 0 && count(layoutOf(5, three, "", "", "", "3"), 5) === 1 && count(layoutOf(5, three, "", "", "", "2"), 5) === 0, "two 3s need a road of three bridges, and have no answer on a road that holds two");
  check(layoutOf(5, three, "", "", "", "3").links[0].cap === 3 && layoutOf(5, two, "", "", "", "1").links[0].cap === 1 && layoutOf(5, two, "", "", "", "").links[0].cap === 2, "a link's cap is what its road says, two where it says nothing");
  check(count(layoutOf(5, square, "", "", "", ""), 5) === 2 && count(layoutOf(5, square, "", "", "", "1"), 5) === 1 && count(layoutOf(5, square, "", "", "", "3"), 5) === 2, "a square of 3s has two answers (doubles top and bottom, or doubles at the sides); a narrow road at the top leaves one, and a wide one there lets in no third: three at the top would leave the sides bare and the chart in two");
  check(layoutOf(5, chart("c.c.."), "", "", "", "3").isl[0].n === 12 && layoutOf(5, chart("c.c.."), "", "", "", "3").isl[0].mx === 12, "an island's number goes to twelve (a to c in the grid), for roads that hold three");
}
{
  // straits: the bridges across a line add up to its number (a double counts twice); the string is size - 1 gaps between rows, then size - 1 between columns
  const row = chart("1.1.."), strait = s => layoutOf(5, row, "", "", "", "", { straits: s });
  check(count(strait("....1..."), 5) === 1 && count(strait("....2..."), 5) === 0 && count(strait("....0..."), 5) === 0 && count(strait("........"), 5) === 1, "a strait across the only bridge says how many it holds: one, not two nor none");
  check(count(strait(".....1.."), 5) === 1 && count(strait("......1."), 5) === 0 && count(strait("1......."), 5) === 0, "a gap the bridge does not cross (further along the row, or between rows) counts none of it");
  const square = chart("3.3..", "", "3.3.."), s = x => layoutOf(5, square, "", "", "", "", { straits: x });
  check(count(s("........"), 5) === 2 && count(s("....4..."), 5) === 1 && count(s("....2..."), 5) === 1 && count(s("....3..."), 5) === 0, "the top and bottom bridges of a square cross a column gap together: 4 is the answer with doubles there, 2 the one with singles, 3 none");
  check(count(s(".4......"), 5) === 1 && count(s(".2......"), 5) === 1 && count(s(".3......"), 5) === 0 && count(s("..0....."), 5) === 2 && count(s("..2....."), 5) === 0, "a gap between rows is crossed by the sides alone (4 is the doubled sides, 2 the single ones), and a gap past the bottom row by none");
  const lay = strait("....1...");
  check(lay.groups.length === 1 && lay.groups[0].ls.length === 1 && lay.groups[0].across && lay.cons.length === lay.isl.length + 1, "a strait is a sum the layout keeps with the islands' sums, over the links that cross its gap");
}
{
  // no loops: the bridges never close a ring (a double bridge is no ring)
  const ring = chart("2.2..", "", "2.2.."), tree = (l, t) => count(layoutOf(5, l, "", "", "", "", { tree: t }), 5);
  check(tree(ring, false) === 1 && tree(ring, true) === 0, "a square of 2s can only be built as a ring, so with no loops allowed it has no answer");
  check(tree(chart("1.2.1"), true) === 1 && tree(chart("2.2.."), true) === 1, "a double bridge is not a ring");
  const four = chart("2.3.2", "", "2.3.2");
  check(tree(four, false) > tree(four, true), "forbidding loops takes answers away from a board that could close one");
}
{
  const f = flagsOf("narrow+tree+straits");
  check(f.narrow && f.tree && f.straits && !f.wide && !f.hills && twistOn("tree+wide+ranges") === "ranges+wide+tree" && twistOn("straits+narrow") === "narrow+straits", "the twist names come out canonical, in the order of the menu");
  check(twistOn("reefs") === "none" && twistOn("lanes") === "none" && twistOn("reefs+lanes") === "none" && twistOn("hills+lanes") === "hills" && !flagsOf("lanes").hills, "the old reefs and fairways are no twist now: a saved name holding them means what is left of it");
  check(Object.keys(TWISTS).join() === "none,ranges,realms,hills,narrow,wide,straits,tree", "the twists a player chooses among, in the order of the menu");
}

// ---------- viaducts ----------
{
  const cross = "..2.." + "....." + "2...2" + "....." + "..2..";
  const hillsAt = (...cells) => Array.from({ length: 25 }, (_, i) => (cells.includes(i) ? "1" : ".")).join("");
  const crossOf = h => { const lay = layoutOf(5, cross, "", "", h); return { lay, n: lay.cross.reduce((t, l) => t + l.length, 0) }; };
  check(crossOf("").n === 2 && crossOf(hillsAt(2, 22)).n === 0 && crossOf(hillsAt(10, 14)).n === 0, "a viaduct (two hills side by side) goes over a low bridge: the two no longer hinder each other, whichever way round");
  check(crossOf(hillsAt(2, 22, 10, 14)).n === 2 && crossOf(hillsAt(2, 10)).n === 2 && crossOf(hillsAt(2, 22)).lay.links.filter(l => l.high).length === 1, "…but two viaducts still cross, and a hill joined to lowland is a low bridge");
}

// ---------- the solver, against every way ----------
{
  const rng = rngOf(2718), seen = { cases: 0, withAnswers: 0, many: 0, linkDiffs: 0, skipped: 0 }, wrong = [], bite = { hills: 0, roads: 0, straits: 0, tree: 0 }, has = { hills: 0, roads: 0, straits: 0, tree: 0 };
  for (let t = 0; t < 900; t++) {
    const size = 5 + (t % 3), flip = p => rng() < p, use = { ranges: flip(0.35), realms: flip(0.3), hills: flip(0.3), roads: flip(0.5), straits: flip(0.4), tree: flip(0.3) }, off = flip(0.3);
    let board = null;
    for (let tries = 0; tries < (use.hills ? 6 : 1) && !board; tries++) board = randomBoard(size, rng, 5 + Math.floor(rng() * 5), (use.tree && flip(0.5)) ? 0 : rng() * 0.8, use.realms, use.hills);
    if (!board) continue;
    const chars = [...board.grid], kinds = Array.from(chars, c => (c === "." ? "." : "="));
    chars.forEach((c, i) => {
      if (c === ".") return;
      if (use.ranges && rng() < 0.4) kinds[i] = rng() < 0.5 ? "+" : "-";
      if (off && rng() < 0.2) chars[i] = String(Math.max(1, Math.min(8, +c + (rng() < 0.5 ? 1 : -1))));      // a number off by one, usually leaving no answer
    });
    const g = chars.join(""), k = kinds.join(""), hills = use.hills ? board.hills : "";
    const { links } = linksOf(size, g, board.realms, hills);
    if (links.length > 11 || links.length < 2) { seen.skipped++; continue; }
    // roads mostly hold what the board's own answer needs, now and then not; straits are the answer's counts, now and then one off
    const sol = [...board.sol].map(Number);
    let roads = "";
    if (use.roads) { roads = links.map((_, i) => { const want = Math.max(sol[i] || 1, 1 + Math.floor(rng() * 3)); return String(rng() < 0.75 ? Math.min(3, want) : 1 + Math.floor(rng() * 3)); }).join(""); }
    let straits = "";
    if (use.straits) {
      const chs = Array.from({ length: 2 * (size - 1) }, (_, gx) => {
        if (rng() < 0.55) return ".";
        const gap = gx < size - 1 ? gx : gx - (size - 1), from = linksOf(size, board.grid, board.realms, "");
        let n = 0;
        from.links.forEach((l, i) => { const a = from.isl[l.a], b = from.isl[l.b]; if (gx < size - 1 ? l.vertical && a.r <= gap && gap < b.r : !l.vertical && a.c <= gap && gap < b.c) n += sol[i] || 0; });
        return String(Math.max(0, Math.min(9, n + (rng() < 0.25 ? (rng() < 0.5 ? 1 : -1) : 0))));
      });
      straits = chs.join("");
    }
    if (use.roads && roads.split("").reduce((p, c) => p * (+c + 1), 1) > 30000) { seen.skipped++; continue; }
    const lay = layoutOf(size, g, k, board.realms, hills, roads, { straits, tree: use.tree }), got = count(lay, 100000);
    const { out, links: theirs } = everyAnswer(size, g, k, board.realms, hills, roads, straits || ".".repeat(2 * (size - 1)), use.tree);
    const pairs = ls => ls.map((l, i) => `${Math.min(l.a, l.b)}:${Math.max(l.a, l.b)}:${l.high ? "h" : "l"}:${l.cap ?? +(roads[i] || 2)}`).sort().join();
    if (pairs(theirs) !== pairs(lay.links)) seen.linkDiffs++;
    seen.cases++;
    if (out.length) seen.withAnswers++;
    if (out.length > 1) seen.many++;
    if (got !== out.length) wrong.push(`${size}:${g}:${k}:${board.realms}:${hills}:${roads}:${straits}:${use.tree} (${got} for ${out.length})`);
    // the rule changes the answers: read without it, another number of them
    const without = {
      roads: use.roads && roads && layoutOf(size, g, k, board.realms, hills, "", { straits, tree: use.tree }),
      straits: use.straits && layoutOf(size, g, k, board.realms, hills, roads, { tree: use.tree }),
      tree: use.tree && layoutOf(size, g, k, board.realms, hills, roads, { straits }),
      hills: use.hills && layoutOf(size, g, k, board.realms, "", roads, { straits, tree: use.tree }),
    };
    for (const [name, other] of Object.entries(without)) if (other) { has[name]++; if (count(other, 100000) !== out.length) bite[name]++; }
  }
  check(seen.linkDiffs === 0, `the links of ${seen.cases} boards with the twists (and their caps and heights) are the ones found from the grid`);
  check(!wrong.length && seen.cases >= 400, `the solver counts exactly as many answers as a plain search, on ${seen.cases} small boards with bounds, realms, viaducts, roads, straits and no loops (${seen.withAnswers} with an answer, ${seen.many} with several)${wrong.length ? `: ${wrong.slice(0, 3).join("; ")}` : ""}`);
  check(Object.entries(bite).every(([name, n]) => n >= 8 && has[name] > 30), `…and each rule changes the answers: ${Object.entries(bite).map(([n, v]) => `${n} ${v} of ${has[n]}`).join(", ")} of those boards have another number of answers without it`);
}

console.log(bad ? `\n${bad} FAILED` : "\nbridges search: the rules one at a time, and the solver against every way to build bridges");
process.exit(bad ? 1 : 0);
