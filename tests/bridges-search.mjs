// The twists of Bridges (bridges-engine.js) against a plain search: a reef that stops a link, a number that is only a bound,
// two realms each its own network, a hill whose bridge goes over the lowland's, a lane only a viaduct may span, each checked
// one at a time; then the solver's count of answers and the layout's links against a search of every way to build bridges
// on small boards, which uses nothing of the solver's (the links found from the grid, a cell holding one low bridge and one
// high at most). Apart from tests/bridges-levels.mjs, which checks the levels and the puzzles made, to keep each under five seconds.
import { layoutOf, count, randomBoard, rngOf, flagsOf, twistOn } from "../bridges-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

/** Every way to build the bridges of a board with the twists, by a plain search that uses nothing of the solver's: the links are found here from the grid. */
function everyAnswer(size, grid, kinds, realms, hills = "", lanes = "") {
  const isl = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] !== "." && grid[i] !== "#") isl.push({ i, r: Math.floor(i / size), c: i % size, n: +grid[i], kind: kinds[i] || "=", realm: realms[i] || "0", hill: hills[i] === "1" });
  const links = [];
  isl.forEach((a, x) => {
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      let r = a.r + dr, c = a.c + dc, cells = [];
      while (r < size && c < size && grid[r * size + c] === ".") { cells.push(r * size + c); r += dr; c += dc; }
      if (r >= size || c >= size || !cells.length) continue;
      const y = isl.findIndex(b => b.r === r && b.c === c);
      if (y < 0 || isl[y].realm !== a.realm) continue;
      const high = a.hill && isl[y].hill;
      if (cells.some(k => lanes[k] === "~") && !high) continue;           // a lane is spanned by a viaduct alone
      links.push({ a: x, b: y, cells, high });
    }
  });
  const out = [], cur = new Array(links.length).fill(0);
  const sum = x => links.reduce((t, l, k) => t + (l.a === x || l.b === x ? cur[k] : 0), 0);
  const ok = () => {
    const taken = new Set();                                  // a cell holds one low bridge and one high at most (key: cell and height)
    for (let k = 0; k < links.length; k++) if (cur[k]) for (const c of links[k].cells) { const key = c + (links[k].high ? "h" : "l"); if (taken.has(key)) return false; taken.add(key); }
    for (let x = 0; x < isl.length; x++) {
      const s = sum(x), a = isl[x];
      if (a.kind === "=" ? s !== a.n : a.kind === "+" ? s < a.n : s > a.n || s < 1) return false;     // "at most" is not none: the network needs a bridge on every island
    }
    for (const realm of ["0", "1"]) {
      const mine = isl.map((a, x) => (a.realm === realm ? x : -1)).filter(x => x >= 0);
      if (!mine.length) continue;
      const seen = new Set([mine[0]]), todo = [mine[0]];
      while (todo.length) { const x = todo.pop(); links.forEach((l, k) => { if (!cur[k]) return; const y = l.a === x ? l.b : l.b === x ? l.a : -1; if (y >= 0 && !seen.has(y)) { seen.add(y); todo.push(y); } }); }
      if (seen.size !== mine.length) return false;
    }
    return true;
  };
  (function go(k) {
    if (k === links.length) { if (ok()) out.push(cur.join("")); return; }
    for (let v = 0; v <= 2; v++) { cur[k] = v; go(k + 1); }
    cur[k] = 0;
  })(0);
  return { out, links };
}

// ---------- the twists, one at a time ----------
{
  const reef = layoutOf(5, "1.#.1" + "....." + "....." + "....." + ".....");
  const open = layoutOf(5, "1...1" + "....." + "....." + "....." + ".....");
  check(reef.links.length === 0 && open.links.length === 1 && open.isl.length === 2, "a reef in the water between two islands stops the link");
  const blocked = layoutOf(5, "1.2.1" + "....." + "....." + "....." + ".....", "", "0" + "." + "1" + "." + "0");
  check(blocked.links.length === 0 && blocked.realmSize[0] === 2 && blocked.realmSize[1] === 1, "an island of the other realm between two stops the link as any island does");
  const apart = layoutOf(5, "1...1" + "....." + "....." + "....." + "1...1", "", "0...1" + "....." + "....." + "....." + "0...1");
  check(apart.links.length === 2 && apart.links.every(l => apart.isl[l.a].realm === apart.isl[l.b].realm), "a link joins two islands of one realm only");
  const rng = layoutOf(5, "2.3.1" + "....." + "....." + "....." + ".....", "+.-.=", "");      // kinds and realms are written cell by cell, like the grid
  check(rng.isl[0].mn === 2 && rng.isl[0].mx === 8 && rng.isl[1].mn === 0 && rng.isl[1].mx === 3 && rng.isl[2].mn === 1 && rng.isl[2].mx === 1, "an island may be exact, at least or at most its number");
  // two islands, "at least 1" and "at most 3" side by side in a row: they can be joined by one bridge or two, so there are two answers
  check(count(layoutOf(5, "1.3.." + "....." + "....." + "....." + ".....", "+.-..", ""), 5) === 2, "a number that is only a bound allows every number within it (an answer for each)");
  check(count(layoutOf(5, "1.3.." + "....." + "....." + "....." + ".....", "", ""), 5) === 0 && count(layoutOf(5, "1.1.." + "....." + "....." + "....." + ".....", "", ""), 5) === 1, "…where an exact number allows only its own");
  // two realms side by side in the same columns: islands of the other colour face each other but are not linked, and each realm is joined on its own
  const two = layoutOf(5, "1.1.." + "....." + "1.1.." + "....." + ".....", "", "0.0.." + "....." + "1.1.." + "....." + ".....");
  check(two.links.length === 2 && two.realmSize[0] === 2 && two.realmSize[1] === 2 && count(two, 3) === 1, "islands of the two realms facing each other are not linked, and each realm is joined of itself");
  const mixed = layoutOf(5, "1.1.." + "....." + "1.1.." + "....." + ".....", "", "");
  check(mixed.links.length === 4 && count(mixed, 3) === 0, "…which one realm could not do (four links, and no bridge pattern makes every island a 1 and all one network)");
  // an island alone in its realm has no one to bridge to, so it can't have the bridge its network asks for
  check(count(layoutOf(5, "1.1.." + "....." + "....." + "....." + ".....", "", "0.1.."), 3) === 0, "an island alone in its realm has no answer");
}

// ---------- the solver, against every way ----------
{
  let cases = 0, withAnswers = 0, many = 0, wrong = [], linkDiffs = 0;
  const rng = rngOf(2718);
  for (let t = 0; t < 360; t++) {
    const size = 5 + (t % 3), flags = { reefs: t % 4 === 1 || t % 4 === 3, ranges: t % 4 === 2 || t % 4 === 3 || t % 7 === 0, realms: t % 5 === 1 || t % 5 === 4 };
    const board = randomBoard(size, rng, 5 + Math.floor(rng() * 5), rng() * 0.8, flags.realms);
    if (!board) continue;
    const chars = [...board.grid], kinds = Array.from(chars, c => (c === "." ? "." : "="));
    if (flags.reefs) for (let i = 0; i < chars.length; i++) if (chars[i] === "." && rng() < 0.12) chars[i] = "#";
    chars.forEach((c, i) => { if (c !== "." && c !== "#") {
      if (flags.ranges && rng() < 0.4) kinds[i] = rng() < 0.5 ? "+" : "-";
      if (t % 3 === 2 && rng() < 0.2) chars[i] = String(Math.max(1, Math.min(8, +c + (rng() < 0.5 ? 1 : -1))));      // a number off by one, usually leaving no answer
    } });
    const g = chars.join(""), k = kinds.join(""), lay = layoutOf(size, g, k, board.realms);
    if (lay.links.length > 12 || lay.isl.length < 3) continue;
    const { out, links } = everyAnswer(size, g, k, board.realms), got = count(lay, 100000);
    // the layout's links are the ones the plain search found, the same pairs
    const pairs = ls => ls.map(l => `${Math.min(l.a, l.b)}:${Math.max(l.a, l.b)}`).sort().join();
    if (pairs(links) !== pairs(lay.links)) linkDiffs++;
    cases++;
    if (out.length) withAnswers++;
    if (out.length > 1) many++;
    if (got !== out.length) wrong.push(`${size}:${g}:${k}:${board.realms} (${got} for ${out.length})`);
  }
  check(linkDiffs === 0, `the links of ${cases} boards with reefs, bounds and realms are the ones found from the grid`);
  check(!wrong.length && cases >= 150, `the solver counts exactly as many answers as a plain search, on ${cases} small boards with the twists (${withAnswers} with an answer, ${many} with several)${wrong.length ? `: ${wrong.slice(0, 3).join("; ")}` : ""}`);
}

// ---------- viaducts and fairways ----------
{
  const cross = "..2.." + "....." + "2...2" + "....." + "..2..", none = ".....".repeat(5);
  const hillsAt = (...cells) => Array.from({ length: 25 }, (_, i) => (cells.includes(i) ? "1" : ".")).join("");
  const crossOf = h => { const lay = layoutOf(5, cross, "", "", h); return { lay, n: lay.cross.reduce((t, l) => t + l.length, 0) }; };
  check(crossOf("").n === 2 && crossOf(hillsAt(2, 22)).n === 0 && crossOf(hillsAt(10, 14)).n === 0, "a viaduct (two hills side by side) goes over a low bridge: the two no longer hinder each other, whichever way round");
  check(crossOf(hillsAt(2, 22, 10, 14)).n === 2 && crossOf(hillsAt(2, 10)).n === 2 && crossOf(hillsAt(2, 22)).lay.links.filter(l => l.high).length === 1, "…but two viaducts still cross, and a hill joined to lowland is a low bridge");
  const lane = (hills, lanes) => layoutOf(5, "2...2" + none.slice(5, 25), "", "", hills, lanes).links.length;
  check(lane("", "") === 1 && lane("", "..~..") === 0 && lane("1...1", "..~..") === 1 && lane("1....", "..~..") === 0 && lane("1...1", "") === 1, "a lane in the way stops a link between lowland, and a viaduct (hill to hill) spans it");
  check(lane("", "~....") === 1 && lane("", ".....") === 1, "a lane outside the way changes nothing");
  check(flagsOf("lanes").hills && flagsOf("hills").hills && !flagsOf("hills").lanes && !flagsOf("reefs").hills && twistOn("lanes+reefs") === "reefs+lanes" && twistOn("hills+lanes") === "lanes", "fairways bring viaducts with them, and the twist names come out canonical");
}
{
  let cases = 0, withAnswers = 0, many = 0, wrong = [], linkDiffs = 0, bite = 0, high = 0, lanesSeen = 0;
  const rng = rngOf(3141);
  for (let t = 0; t < 300; t++) {
    const size = 5 + (t % 3), realms = t % 5 === 4;
    // any board with hills thrown on at random: the oracle doesn't need the generator's own viaducts, and small boards rarely make one
    const board = randomBoard(size, rng, 5 + Math.floor(rng() * 5), rng() * 0.8, realms);
    if (!board) continue;
    const chars = [...board.grid], hills = Array.from(chars, c => (c !== "." && rng() < 0.5 ? "1" : "."));
    const lanes = Array.from(chars, c => (c === "." && t % 2 === 0 && rng() < 0.12 ? "~" : "."));
    chars.forEach((c, i) => { if (c !== "." && t % 3 === 2 && rng() < 0.2) chars[i] = String(Math.max(1, Math.min(8, +c + (rng() < 0.5 ? 1 : -1)))); });
    const g = chars.join(""), h = hills.join(""), l = lanes.join(""), lay = layoutOf(size, g, "", board.realms, h, l);
    if (lay.links.length > 9 || lay.isl.length < 3) continue;
    const { out, links } = everyAnswer(size, g, "", board.realms, h, l), got = count(lay, 100000);
    const pairs = ls => ls.map(k => `${Math.min(k.a, k.b)}:${Math.max(k.a, k.b)}:${k.high ? "h" : "l"}`).sort().join();
    if (pairs(links) !== pairs(lay.links)) linkDiffs++;
    cases++;
    if (out.length) withAnswers++;
    if (out.length > 1) many++;
    if (lay.links.some(k => k.high)) high++;
    if (l.includes("~")) lanesSeen++;
    if (count(layoutOf(size, g, "", board.realms), 100000) !== out.length) bite++;       // read as plain water, another number of answers
    if (got !== out.length) wrong.push(`${size}:${g}:${board.realms}:${h}:${l} (${got} for ${out.length})`);
  }
  check(linkDiffs === 0, `the links of ${cases} boards with hills and lanes (high or low, over a lane or not) are the ones found from the grid`);
  check(!wrong.length && cases >= 150 && high > 100 && lanesSeen > 50, `the solver counts exactly as many answers as a plain search, on ${cases} small boards with viaducts (${withAnswers} with an answer, ${many} with several, ${lanesSeen} with lanes)${wrong.length ? `: ${wrong.slice(0, 3).join("; ")}` : ""}`);
  check(bite > cases / 10, `…and the twist changes the answers: ${bite} of those boards have another number of answers read as plain water`);
}

console.log(bad ? `\n${bad} FAILED` : "\nbridges search: the twists one at a time, and the solver against every way to build bridges");
process.exit(bad ? 1 : 0);
