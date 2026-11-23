// Settle: the book of levels, made from this plan (23 November 2026, the redesign; Korbi chose three chapters first). A row is a
// level: its moulds (settle-alloys.js's ids; "Cu3" is a copper ingot of three measures), its crucibles' sizes, the par it should have,
// and its tip. For each row this finds, from its seed on, a filling the solver passes (settle-levels.js's makeLevel) and writes the
// levels to settle-book.js.
//
// Usage: node settle-plan.mjs check     the levels the plan gives, with par and how many first moves keep it
//        node settle-plan.mjs write     writes settle-book.js
import fs from "fs";
import { makeLevel, gradeOf } from "./settle-levels.js";

// Chapters one and two keep every crucible one size (three or four measures; tighter makes harder puzzles); three mixes them. The par
// ranges make the curve; within its range a row takes the hardest of 600 fillings.
const C = (n, cap = 4) => Array(n).fill(cap);
export const PLAN = [
  // 1 Settling: pure metals and the 50/50 solder; only the top pours
  { ch: 1, name: "First pour", moulds: ["Sn2", "Pb2"], caps: C(3), par: [2, 2], strict: false, tip: "Tip a crucible into another: its top metal pours across. Two tin, or two lead, cast the moulds." },
  { ch: 1, name: "Tin floats", moulds: ["Sn2", "Cu2"], caps: C(3), par: [2, 3], strict: false, tip: "Tin is the lightest: it lies on top, and pours first." },
  { ch: 1, name: "Under the tin", moulds: ["Cu2", "Sn3"], caps: C(3, 3), par: [3, 4], strict: "best", tip: "Copper under tin is held until the tin is gone." },
  { ch: 1, name: "Pig lead", moulds: ["Pb3", "Sn2"], caps: C(3, 3), par: [3, 4], strict: "best", tip: "Lead poured onto tin slips under it: it sinks to the foot wherever it lands." },
  { ch: 1, name: "Three metals", moulds: ["Pb2", "Cu2", "Sn2"], caps: C(3, 3), par: [4, 5], tip: "Lead, copper, tin: heaviest at the foot, lightest on top." },
  { ch: 1, name: "Little room", moulds: ["Pb2", "Cu2", "Sn3"], caps: C(3, 3), par: [5, 6], tip: "Two measures spare in the whole row: every pour has to count." },
  { ch: 1, name: "Solder", moulds: ["plumber", "plumber", "Cu2"], caps: C(3), par: [6, 7], tip: "Plumber's solder is one tin on one lead: pour tin onto a lone lead." },
  { ch: 1, name: "Clear the hearth", moulds: ["plumber", "Pb2", "Cu2", "Sn2"], caps: C(3), par: [7, 8], tip: "A crucible casts the moment it holds a recipe exactly: mind what you leave behind." },
  // 2 Alloys: mixes built from the foot up
  { ch: 2, name: "Pewter", moulds: ["pewter", "Cu2"], caps: C(3), par: [3, 4], tip: "Pewter is three tin on one lead: the lead poured last slips under the tin." },
  { ch: 2, name: "Bell metal", moulds: ["bell", "Pb2"], caps: C(3), par: [4, 5], tip: "Three copper to one tin: copper sinks under the tin it is poured onto." },
  { ch: 2, name: "Hard metal", moulds: ["hard", "fine"], caps: C(3), par: [5, 6], tip: "Two tin on one copper, and two tin on one lead: the tin is shared out." },
  { ch: 2, name: "Fine solder", moulds: ["fine", "fine", "Cu2"], caps: C(3, 3), par: [6, 8], tip: "Two tin to one lead, twice over, in crucibles of three." },
  { ch: 2, name: "Speculum", moulds: ["speculum", "plumber", "Sn2"], caps: C(3), par: [6, 7], tip: "The mirror metal: two copper, one tin." },
  { ch: 2, name: "Mirror and bell", moulds: ["speculum", "bell", "plumber"], caps: C(3), par: [7, 8], tip: "Copper for two moulds, tin for three." },
  { ch: 2, name: "Two solders", moulds: ["plumber", "fine", "pewter"], caps: C(4), par: [8, 9], tip: "One lead under each: one, two and three tin on top." },
  { ch: 2, name: "The pewterer", moulds: ["pewter", "hard", "fine", "plumber"], caps: C(4), par: [9, 10], tip: "Everything so far: build each from the foot up." },
  // 3 Measures: crucibles of two to five; a pour stops at the rim
  { ch: 3, name: "The small crucible", moulds: ["plumber", "Cu3"], caps: [2, 3, 4], par: [3, 4], tip: "A pour stops at the rim; the rest stays behind." },
  { ch: 3, name: "Measuring", moulds: ["fine", "Cu2"], caps: [5, 5, 2], par: [4, 5], tip: "A crucible of two measures out two." },
  { ch: 3, name: "The big pot", moulds: ["pewter", "bell"], caps: [5, 5, 2], par: [6, 8], tip: "A crucible of five takes a whole recipe, and one more measure to spoil it." },
  { ch: 3, name: "Short measure", moulds: ["speculum", "fine", "Pb1"], caps: [2, 4, 4], par: [7, 8], tip: "What doesn't fit stays where it was." },
  { ch: 3, name: "Spill", moulds: ["bell", "fine", "plumber"], caps: [5, 3, 3], par: [8, 10], tip: "Three measures out three, and five holds what's left." },
  { ch: 3, name: "Odd sizes", moulds: ["pewter", "speculum", "fine"], caps: [2, 2, 4, 5], par: [9, 10], tip: "Every crucible its own size." },
  { ch: 3, name: "Tight", moulds: ["fine", "bell", "pewter"], caps: [5, 4, 3, 2], par: [9, 10], tip: "Little room to spare." },
  { ch: 3, name: "Master founder", moulds: ["pewter", "hard", "fine", "plumber"], caps: [5, 4, 4], par: [10, 12], tip: "Everything at once." },
];

/** The rows' levels, in order. */
export function book() {
  const counts = {};
  return PLAN.map((row, i) => {
    const L = makeLevel(row, (i + 1) * 1000, 600, true);
    if (!L) throw new Error(`no level for ${row.name}`);
    counts[row.ch] = (counts[row.ch] || 0) + 1;
    return { id: `${row.ch}-${counts[row.ch]}`, ch: row.ch, name: row.name, tip: row.tip, caps: L.caps, fill: L.fill, moulds: L.moulds, par: L.par, seed: L.seed };
  });
}

const [mode] = process.argv[1]?.endsWith("settle-plan.mjs") ? process.argv.slice(2) : [];
if (mode === "check" || mode === "write") {
  const levels = book();
  for (const L of levels) {
    const g = gradeOf(L);
    console.log(`${L.id.padEnd(5)} ${L.name.padEnd(20)} par ${L.par}  best ${g.best}/${g.of}  greedy ${g.greedy}/20  states ${g.states}  | ${L.caps.join(",")} | ${L.fill.map(f => f.join("") || "-").join(" / ")} | ${L.moulds.join(" ")}`);
  }
  if (mode === "write") {
    fs.writeFileSync(new URL("./settle-book.js", import.meta.url), "// Settle: the book of levels, made by settle-plan.mjs (node settle-plan.mjs write) from its plan, never by hand. fill: each crucible foot to top.\n" +
      `export const BOOK = [\n${levels.map(l => "  " + JSON.stringify(l)).join(",\n")}\n];\n`);
    console.log(`${levels.length} levels written`);
  }
}
