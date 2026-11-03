// Almanac's way about (almanac-nav.js): the address says which view and which entry, the trail through the entries read in the
// sky's popup goes on and back, and the arrow keys walk the results of a search.
import { parseHash, formatHash, createTrail, stepHit, hitFor } from "../almanac-nav.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- the address ----------
check(same(parseHash(""), { list: false, e: null }) && same(parseHash("#"), { list: false, e: null }) && same(parseHash(undefined), { list: false, e: null }),
  "no address is the star chart with nothing open");
check(same(parseHash("#sky"), { list: false, e: null }), "an old #sky address is still the star chart");
check(same(parseHash("#e=copper"), { list: false, e: "copper" }), "#e=<id> is the star chart with that entry's popup");
check(same(parseHash("#list"), { list: true, e: null }) && same(parseHash("#list&e=copper"), { list: true, e: "copper" }), "#list is the list view, with or without an entry");
check(same(parseHash("#e="), { list: false, e: null }) && same(parseHash("#e=a%20b%26c"), { list: false, e: "a b&c" }), "an empty id is none, and an id with odd characters comes back whole");
for (const v of [{ list: false, e: null }, { list: false, e: "copper" }, { list: true, e: null }, { list: true, e: "guernica-picasso" }, { list: false, e: "a b&c=d#e" }]) {
  check(same(parseHash(formatHash(v)), v), `the address for ${JSON.stringify(v)} reads back the same (${formatHash(v) || "empty"})`);
}
check(formatHash() === "" && formatHash({}) === "", "the chart with nothing open has no address at all");

// ---------- the trail through entries ----------
{
  const t = createTrail();
  check(t.current === null && !t.canBack && t.back() === null && t.depth === 0, "a trail with nothing in it has nowhere to go back to");
  t.start("copper");
  check(t.current === "copper" && !t.canBack && t.back() === "copper", "a trail starts at one entry, and Back does not leave it");
  t.go("escondida"); t.go("chile"); t.go("chile");
  check(same(t.list(), ["copper", "escondida", "chile"]) && t.canBack && t.previous === "escondida", "following links goes on; the entry already showing is not a step");
  check(t.back() === "escondida" && t.back() === "copper" && t.back() === "copper" && !t.canBack, "Back goes back along the links, one at a time, and stops at the first");
  t.go("zinc"); t.go("copper");
  check(same(t.list(), ["copper", "zinc", "copper"]) && t.back() === "zinc", "coming back to an entry already read is a step like any other");
  t.start("gold");
  check(same(t.list(), ["gold"]), "a fresh start (a tap on a star, a search) is a new trail");
  t.go(""); t.go(null);
  check(t.depth === 1, "nothing is not an entry");
  t.start(null);
  check(t.depth === 0 && t.current === null, "starting with nothing empties it (the popup closed)");
  const short = createTrail(3);
  for (const id of ["a", "b", "c", "d", "e"]) short.go(id);
  check(same(short.list(), ["c", "d", "e"]), "a trail keeps only the last few entries");
}

// ---------- the arrow keys through the results ----------
check(stepHit(-1, "ArrowDown", 5) === 0 && stepHit(0, "ArrowDown", 5) === 1 && stepHit(4, "ArrowDown", 5) === 4, "ArrowDown walks down the results and stops at the last");
check(stepHit(3, "ArrowUp", 5) === 2 && stepHit(0, "ArrowUp", 5) === 0 && stepHit(-1, "ArrowUp", 5) === 0, "ArrowUp walks up and stops at the first");
check(stepHit(2, "a", 5) === 2 && stepHit(0, "ArrowDown", 0) === -1 && stepHit(3, "ArrowUp", 0) === -1, "other keys leave it, and no results highlight nothing");
check(hitFor(2, 5) === 2 && hitFor(-1, 5) === 0 && hitFor(9, 5) === 0 && hitFor(0, 0) === -1, "Enter takes the highlighted result, else the first, else nothing");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("almanac nav: the address, the trail through entries and the keys through results are right");
