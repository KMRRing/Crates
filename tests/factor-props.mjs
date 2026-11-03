// The props on Factor's tiles (factor-props.js): as many as the number's pips, and a settled place for each count that keeps
// them off the token, inside the tile and apart, for every land.
import { propsOf, spots, DUNE_MOUNDS } from "../factor-props.js";
import { makeBoard, pips } from "../factor-board.js";
import { fresh } from "../factor-rules.js";
import { boardSvg } from "../factor-draw.js";
import { seeded } from "../seats.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the count ----------
const want = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
check(Object.entries(want).every(([n, p]) => [0, 1, 2, 3, 4].every(kind => propsOf(kind, Number(n)) === p)), "every number of the game has the props of its pips, on every land: 6 and 8 five, 5 and 9 four, 4 and 10 three, 3 and 11 two, 2 and 12 one");
check(propsOf(5, 0) === DUNE_MOUNDS && DUNE_MOUNDS === 3, "the dunes, with no number, keep their three mounds");
check([2, 3, 4, 5, 6, 8, 9, 10, 11, 12].every(n => propsOf(0, n) === pips(n)), "…the count is the token's pips, the same helper the token's dots use");
{
  let all = true, total = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const b = makeBoard(seeded(seed));
    b.kind.forEach((k, i) => { const p = propsOf(k, b.num[i]); if (!(p >= 1 && p <= 5)) all = false; total += p; });
  }
  check(all, "on 300 dealt islands every tile has one to five props");
  check(total / 300 > 60 && total / 300 < 66, `…the island carries 63 or so props in all (${(total / 300).toFixed(1)}), fewer than the 100-odd it was drawn with`);
}
check(propsOf(0, 6) === propsOf(1, 8) && propsOf(2, 2) === propsOf(3, 12), "the same number has the same count whatever the land");

// ---------- the places ----------
// in units of the hex's circumradius; the biggest each land's prop reaches from its own spot (pine, brick stack, sheep, sheaf, rock)
const FOOT = [0.16, 0.2, 0.2, 0.11, 0.21], TOKEN = 0.31, APOTHEM = Math.sqrt(3) / 2, EDGE = 0.035;
const sides = [0, 60, 120, 180, 240, 300].map(d => [Math.cos(d * Math.PI / 180), Math.sin(d * Math.PI / 180)]);
for (let n = 1; n <= 5; n++) {
  const s = spots(n);
  check(s.length === n, `${n}: ${n} place${n > 1 ? "s" : ""}`);
  let clear = true, inside = true, apart = true;
  for (const f of FOOT) {
    for (const p of s) {
      if (Math.hypot(p.x, p.z) - f < TOKEN + 0.03) clear = false;
      if (sides.some(([cx, cz]) => p.x * cx + p.z * cz + f > APOTHEM - EDGE)) inside = false;
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.hypot(s[i].x - s[j].x, s[i].z - s[j].z) < 1.7 * f) apart = false;
  }
  check(clear, `${n}: every prop of every land is clear of the token`);
  check(inside, `${n}: …and inside the tile's edge`);
  check(apart, `${n}: …and apart from the others`);
}
check(JSON.stringify(spots(5)) === JSON.stringify(spots(5)) && spots(3)[0].a !== spots(3)[1].a, "a count always has the same places (nothing is dealt)");
{
  const a = spots(5).map(p => p.a), gaps = a.map((x, i) => ((a[(i + 1) % 5] - x + 2 * Math.PI) % (2 * Math.PI)));
  check(gaps.every(g => Math.abs(g - 2 * Math.PI / 5) < 1e-9), "five are spread evenly round the token");
}

// ---------- the flat island draws the same counts ----------
{
  const s = fresh({ seats: 3, options: {}, rng: seeded(7) });
  const hexes = boardSvg(s, {}).split('<g class="fc-hex').slice(1);
  const marks = h => (h.match(/class="fc-mark-ic r\d"/g) || []).length;
  check(hexes.length === 19 && hexes.every((h, i) => s.kind[i] === 5 || marks(h) === propsOf(s.kind[i], s.num[i])), "the flat island draws each tile's mark as often as the tile has props");
  check(hexes.every((h, i) => s.kind[i] === 5 || marks(h) === pips(s.num[i])), "…which, off the dunes, is the number's pips");
  check(hexes.every((h, i) => s.kind[i] !== 5 || marks(h) === 1), "…and the dunes keep their one wave");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
