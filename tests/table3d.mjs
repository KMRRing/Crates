// The card games' shared 3D table (table3d.js, table3d.css): where the plates stand for two to six seats and that a seat's slot
// and the seat in a slot are each other's inverse, the fan, the pile and the row of cards as numbers, where a flown card
// starts and lands, the arch of a hand, the markup of a plate and a pile, and that the stylesheet has a rule for every class the
// script emits. The parts that touch the page (the cloth, the flights) are looked at in a browser, not here.
import { readFileSync } from "node:fs";
import * as T from "../table3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const css = readFileSync(new URL("../table3d.css", import.meta.url), "utf8");
const js = readFileSync(new URL("../table3d.js", import.meta.url), "utf8");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const mirror = s => ({ x: 100 - s.x, y: s.y, side: s.side === "l" ? "r" : s.side === "r" ? "l" : s.side });

// ---------- the seats ----------
for (let n = 2; n <= 6; n++) {
  const a = T.seatSpots(n), b = T.seatSpots(n, { clockwise: false });
  check(a.length === n && same(a[0], { x: 50, y: 99, side: "b" }), `${n} seats: yours is the foot's, in the middle`);
  check(a.every(s => s.x >= 0 && s.x <= 100 && s.y >= 0 && s.y <= 100), `${n} seats: all on the cloth`);
  check(a.every(s => a.some(t => same(t, mirror(s)))), `${n} seats: the table is the same seen in a mirror (a left for each right)`);
  check(a.every((s, i) => same(b[i], mirror(s))), `${n} seats: the other way round is the mirror, seat for seat`);
  let apart = true;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.abs(a[i].x - a[j].x) < 18 && Math.abs(a[i].y - a[j].y) < 12) apart = false;
  check(apart, `${n} seats: no two plates on the same spot`);
  if (n >= 3) check(a[1].x < 50 && b[1].x > 50, `${n} seats: the next seat is on your left clockwise, on your right the other way`);
}
check(T.seatSpots(1).length === 2 && T.seatSpots(9).length === 6 && T.seatSpots(NaN).length === 2, "a table is two to six seats whatever is asked");
{
  let ok = true;
  for (let n = 2; n <= 6; n++) for (let me = 0; me < n; me++) {
    if (T.slotOf(me, me, n) !== 0) ok = false;
    for (let seat = 0; seat < n; seat++) { const k = T.slotOf(seat, me, n); if (k < 0 || k >= n || T.seatAt(k, me, n) !== seat) ok = false; }
  }
  check(ok, "a seat's slot from where you sit and the seat in a slot are each other's inverse, you in slot 0");
}

// ---------- fan, pile, row ----------
check(same(T.fanTurns(0), []) && same(T.fanTurns(1), [0]) && same(T.fanTurns(3), [-1, 0, 1]) && T.fanTurns(9).length === 5 && T.fanTurns(9).reduce((s, x) => s + x, 0) === 0, "a fan of backs leans evenly about the middle, five at most");
{
  const want = { 0: 0, 1: 1, 2: 2, 3: 2, 4: 3, 7: 3, 8: 4, 15: 4, 16: 5, 31: 5, 32: 6, 52: 6, 1000: 6 };
  check(Object.entries(want).every(([n, l]) => T.pileLayers(+n) === l), "a pile is one layer for one card, six from thirty-two");
  let mono = true;
  for (let n = 1; n < 200; n++) if (T.pileLayers(n + 1) < T.pileLayers(n)) mono = false;
  check(mono, "a bigger pile is never thinner");
}
{
  const w = T.rowFit({ w: 300, h: 100 }, 5);
  check(Math.abs(w - 300 / (5 + 4 * 0.08)) < 1e-9, "five cards across 300 wide take the width (the room is tall enough)");
  check(Math.abs(T.rowFit({ w: 300, h: 50 }, 5) - 50 / T.ASPECT) < 1e-9, "…and the height when the room is short");
  check(T.rowFit({ w: 300, h: 100 }, 1, { max: 40 }) === 40 && T.rowFit({ w: 300, h: 100 }, 0) === 0 && T.rowFit({ w: 0, h: 100 }, 3) === 0, "a cap, no cards and no room");
  let fits = true;
  for (let n = 1; n <= 13; n++) { const cw = T.rowFit({ w: 321, h: 500 }, n, { gap: 0.3 }); if (n * cw + (n - 1) * 0.3 * cw > 321 + 1e-9) fits = false; }
  check(fits, "n cards and their gaps never run past the room");
}

// ---------- a flight ----------
{
  const f = T.flightBox({ x: 100, y: 600, w: 40, h: 56 }, { x: 200, y: 300, w: 80, h: 200 });
  check(f.w === 80 && Math.abs(f.h - 112) < 1e-9 && f.left === 160 && Math.abs(f.top - 244) < 1e-9, "a flown card is drawn as large as its landing takes, in its aspect, centred there");
  check(f.dx === -100 && f.dy === 300 && Math.abs(f.s0 - 0.5) < 1e-9, "…and starts translated back to where it was, at the size it was");
  check(T.flightBox({ x: 0, y: 0, w: 2, h: 3 }, { x: 5, y: 5, w: 50, h: 70 }).s0 === 0.2, "…no smaller than a fifth");
}
{
  const a = T.archOf(7, { tilt: 6, drop: 10 });
  check(a.length === 7 && a[3].rot === 0 && a[3].ly === 0 && a[0].rot === -6 && a[6].rot === 6 && a[0].ly === 10 && a[6].ly === 10, "a hand in an arch: the middle upright, the ends turned out and dropped");
  check(a.every((c, i) => c.rot === -a[6 - i].rot && c.ly === a[6 - i].ly) && same(T.archOf(1), [{ rot: 0, ly: 0 }]) && T.archOf(0).length === 0, "…evenly, the same both sides; a single card stands straight");
}

// ---------- the markup ----------
{
  const p = T.plateHtml({ name: "<b>mei</b>", meta: "Score 12", tally: '<span class="tk-n">9</span>', fan: 3, crown: true, mark: "D" });
  check(p.includes("&lt;b&gt;mei&lt;/b&gt;") && !p.includes("<b>mei"), "a name is text: markup in it is escaped");
  const m = T.plateHtml({ name: "mei", mark: "D" });
  check(m.includes('<b>M</b><i class="tk-mark">D</i>'), "the medallion carries the initial and the mark");
  check(p.includes("tk-crown") && (p.match(/tk-fb/g) || []).length === 3 && p.includes("Score 12") && p.includes('<span class="tk-n">9</span>'), "a crown, the fan, the meta and the tally");
  check(!T.plateHtml({ name: "Ah" }).includes("tk-crown") && !T.plateHtml({ name: "Ah" }).includes("tk-fan") && !T.plateHtml({ name: "Ah" }).includes("tk-mark"), "and none of them unasked");
  check(T.plateHtml({ name: "ah lan" }).includes("<b>A</b>") && T.plateHtml({ name: "" }).includes("<b>?</b>"), "the initial is capitalised; no name is a ?");
}
{
  check(T.pileHtml({ n: 0 }).includes("empty") && !T.pileHtml({ n: 0 }).includes("tk-pn"), "an empty pile is an outline");
  const count = h => (h.match(/tk-pl"/g) || []).length;
  check(count(T.pileHtml({ n: 1 })) === 0 && count(T.pileHtml({ n: 52 })) === 5 && T.pileHtml({ n: 52 }).includes(">52<"), "a pile's layers and its count");
  const top = T.pileHtml({ n: 5, top: T.card({ rank: "9", suit: 1 }) }), blank = T.pileHtml({ n: 5, count: false });
  check(top.includes("9 of clubs") && blank.includes("back") && !blank.includes("tk-pn"), "its top is the card given, or a back; the count can go");
  check(same(T.fanHtml(0), "") && (T.fanHtml(12).match(/tk-fb/g) || []).length === 5, "a fan of none is nothing, of twelve is five backs");
  const c = T.card({ rank: "A", suit: 2 }, { cls: "sel" });
  check(c.includes("tk-c") && c.includes("red") && c.includes("sel") && T.card({ joker: "big" }).includes("joker") && T.back().includes("tk-c") && T.back().includes("back"), "cards are the suite's own, with the kit's class");
}

// ---------- the stylesheet and the script agree ----------
{
  const names = [...new Set(js.match(/tk-[a-z0-9]+/g))], missing = names.filter(n => !css.includes(n));
  check(!missing.length, `every class the script makes has a rule in table3d.css (${names.length})${missing.length ? ` — missing: ${missing.join(", ")}` : ""}`);
  check(css.includes(`--tk-tilt: ${T.TILT}deg`), "the stylesheet's tilt is the script's");
  check(["at-b", "at-t", "at-l", "at-r"].every(c => css.includes(`.${c}`)) && T.seatSpots(6).every(s => css.includes(`.at-${s.side}`)), "every side a plate can stand on is styled");
  const patterns = [1, 2, 3, 4, 5].every(i => css.includes(`.tk-s${i} .tk-med::after`));
  check(patterns && [0, 1, 2, 3, 4, 5].every(i => css.includes(`.tk-s${i} {`)), "every seat colour has its own pattern (a colour is never all that tells players apart)");
}

console.log(bad ? `\n${bad} FAILED` : "\n3D card table: seats, fan, pile, row, flight, arch and markup");
process.exit(bad ? 1 : 0);
