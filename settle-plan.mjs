// Settle: the book of levels, made from this plan (23 November 2026, the redesign; Korbi chose three chapters first). A row is a
// level: its moulds (settle-alloys.js's ids; "Cu3" is a copper ingot of three measures), its crucibles' sizes, how hard it should be,
// and its tip. For each row this finds, from its seed on, a filling the solver passes (settle-levels.js's makeLevel) and writes the
// levels to settle-book.js.
//
// Usage: node settle-plan.mjs check [id …]   the levels: the book's, and those not in it yet made (or the ids named, made again)
//        node settle-plan.mjs write [id …]   writes settle-book.js with the new levels (or the ids named, made again)
import fs from "fs";
import { fork } from "node:child_process";
import { makeLevel, gradeOf, hardness } from "./settle-levels.js";
import { BOOK } from "./settle-book.js";

// Chapters one and two keep every crucible one size (three or four measures; tighter makes harder puzzles); three mixes them. A row's
// aim (its hardness, settle-levels.js) makes the curve: of 600 fillings it takes the one nearest; a row with a par range instead (a
// chapter's first levels) takes the hardest in it. From its third row on a chapter runs in order of hardness, and each chapter ends
// harder than the one before (tests/settle-levels.mjs).
const C = (n, cap = 4) => Array(n).fill(cap);
const SLAG = n => [...Array(n - 1).fill(""), "slag"];                  // the last crucible a slag pot
export const PLAN = [
  // 1 Settling: pure metals and the 50/50 solder; only the top pours
  { ch: 1, name: "First pour", moulds: ["Sn2", "Pb2"], caps: C(3), par: [2, 2], strict: false, tip: "Tip a crucible into another: its top metal pours across. Two tin, or two lead, cast the moulds." },
  { ch: 1, name: "Tin floats", moulds: ["Sn2", "Cu2"], caps: C(3), par: [2, 3], strict: false, tip: "Tin is the lightest: it lies on top, and pours first." },
  { ch: 1, name: "Under the tin", moulds: ["Cu2", "Sn3"], caps: C(3, 3), par: [3, 4], strict: "best", tip: "Copper under tin is held until the tin is gone." },
  { ch: 1, name: "Pig lead", moulds: ["Pb3", "Sn2"], caps: C(3, 3), par: [3, 4], strict: "best", tip: "Lead poured onto tin slips under it: it sinks to the foot wherever it lands." },
  { ch: 1, name: "Three metals", moulds: ["Pb2", "Cu2", "Sn2"], caps: C(3, 3), par: [4, 5], tip: "Lead, copper, tin: heaviest at the foot, lightest on top." },
  { ch: 1, name: "Little room", moulds: ["Pb2", "Cu2", "Sn3"], caps: C(3, 3), par: [5, 6], tip: "Two measures spare in the whole row: every pour has to count." },
  { ch: 1, name: "Solder", moulds: ["plumber", "plumber", "Cu2"], caps: C(3), par: [6, 7], tip: "Plumber's solder is one tin on one lead: pour tin onto a lone lead." },
  { ch: 1, name: "Clear the hearth", aim: 3.5, moulds: ["plumber", "Pb2", "Cu2", "Sn2"], caps: C(3), tip: "A crucible casts the moment it holds a recipe exactly: mind what you leave behind." },
  // 2 Alloys: mixes built from the foot up
  { ch: 2, name: "Pewter", moulds: ["pewter", "Cu2"], caps: C(3), par: [3, 4], tip: "Pewter is three tin on one lead: the lead poured last slips under the tin." },
  { ch: 2, name: "Bell metal", aim: 2.2, moulds: ["bell", "plumber"], caps: C(3), tip: "Three copper to one tin: copper sinks under the tin it is poured onto." },
  { ch: 2, name: "Hard metal", moulds: ["hard", "fine"], caps: C(3), par: [5, 6], tip: "Two tin on one copper, and two tin on one lead: the tin is shared out." },
  { ch: 2, name: "Fine solder", aim: 3.2, moulds: ["fine", "fine", "Cu2"], caps: C(4, 3), tip: "Two tin to one lead, twice over, in crucibles of three." },
  { ch: 2, name: "Speculum", aim: 3.8, moulds: ["speculum", "fine", "Sn2"], caps: C(3), tip: "The mirror metal: two copper, one tin." },
  { ch: 2, name: "Mirror and bell", aim: 3.8, moulds: ["speculum", "bell", "plumber"], caps: C(4), tip: "Copper for two moulds, tin for three." },
  { ch: 2, name: "Two solders", aim: 4.6, moulds: ["plumber", "fine", "pewter"], caps: C(4), tip: "One lead under each: one, two and three tin on top." },
  { ch: 2, name: "The pewterer", aim: 5.3, moulds: ["pewter", "hard", "fine", "plumber"], caps: C(4), tip: "Everything so far: build each from the foot up." },
  // 3 Measures: crucibles of two to five; a pour stops at the rim
  { ch: 3, name: "The small crucible", moulds: ["plumber", "Cu3"], caps: [2, 3, 4], par: [3, 4], tip: "A pour stops at the rim; the rest stays behind." },
  { ch: 3, name: "Measuring", aim: 2.4, moulds: ["fine", "speculum"], caps: [5, 4, 2], tip: "A crucible of two measures out two." },
  { ch: 3, name: "The big pot", moulds: ["pewter", "bell"], caps: [5, 5, 2], par: [6, 8], tip: "A crucible of five takes a whole recipe, and one more measure to spoil it." },
  { ch: 3, name: "Short measure", aim: 4.4, moulds: ["speculum", "fine", "Pb1"], caps: [2, 4, 4], tip: "What doesn't fit stays where it was." },
  { ch: 3, name: "Spill", aim: 5.0, moulds: ["bell", "fine", "plumber"], caps: [5, 3, 3, 2], tip: "Three measures out three, and five holds what's left." },
  { ch: 3, name: "Odd sizes", aim: 5.0, moulds: ["pewter", "speculum", "fine"], caps: [2, 2, 4, 5], tip: "Every crucible its own size." },
  { ch: 3, name: "Tight", aim: 5.4, moulds: ["fine", "bell", "pewter", "plumber"], caps: [5, 4, 3, 3], tip: "Little room to spare." },
  { ch: 3, name: "Master founder", aim: 7.0, moulds: ["pewter", "hard", "fine", "plumber"], caps: [5, 4, 4], tip: "Everything at once." },
  // 23 November 2026 (Korbi: "work on a lot more levels. think of twists as well", after the Gears plan: each chapter one idea, the
  // chapters longer as they go, each level the chapter's idea with a changing mix of the ones before). From here the measures (odd
  // sizes) and the spares come back in every chapter, dross and the slag pot from chapter 5, the teapot ladle from chapter 6.
  // 4 Spare metal: more than the moulds take; what is left over stays where it can do no harm
  { ch: 4, name: "Leftovers", moulds: ["Pb2", "Sn2"], extra: ["Cu"], caps: C(3, 3), strict: "best", tip: "One measure too many: no mould wants the copper. Leave it where it is in nobody's way." },
  { ch: 4, name: "Odd one out", moulds: ["plumber", "Cu2"], extra: ["Sn"], caps: C(3, 3), strict: "best", tip: "A spare tin on the solder would spoil it: a crucible casts only its exact recipe." },
  { ch: 4, name: "Short of room", aim: 4.0, moulds: ["fine", "bell"], extra: ["Cu"], caps: [4, 4, 3, 2], tip: "The spare takes room you will want later." },
  { ch: 4, name: "Spare measures", moulds: ["hard", "pewter"], extra: ["Pb", "Cu"], caps: [5, 3, 3, 2], tip: "A small crucible is a good place for a spare." },
  { ch: 4, name: "Overstock", aim: 5.6, moulds: ["bell", "fine", "Pb2"], extra: ["Sn", "Cu"], caps: [4, 4, 4, 3], tip: "Three moulds and two spares." },
  { ch: 4, name: "Surplus tin", aim: 6.0, moulds: ["pewter", "Cu2", "plumber"], extra: ["Sn", "Pb"], caps: [4, 4, 4, 3], tip: "Two spares and three moulds: park the spares where no recipe wants them." },
  { ch: 4, name: "Which to leave", aim: 6.5, moulds: ["speculum", "plumber", "fine"], extra: ["Sn", "Cu"], caps: [4, 4, 4, 3], tip: "Every metal has a spare: which measure stays behind is yours to choose." },
  { ch: 4, name: "The surplus", aim: 5.92, moulds: ["pewter", "hard", "fine", "plumber"], extra: ["Cu"], caps: [5, 4, 4, 4], tip: "Four moulds, and a copper no mould wants." },
  // 5 Dross: a scum lighter than all metal, which no mould takes; it clings to the metal under it, so wherever it is poured the measure
  // under it goes too; the slag pot takes anything and gives nothing back. Every level has a spare to feed each crust of dross, and the
  // pot is never bigger than it needs (a player who skims the moment they can misses the par: settle-levels' gradeOf)
  { ch: 5, name: "Scum", moulds: ["Sn2", "Cu2"], extra: ["X", "Sn"], caps: [3, 3, 3, 2], kinds: SLAG(4), strict: "best", tip: "Dross spoils a cast, and clings: poured anywhere, it takes the measure under it along. Skim it into the slag pot off a spare." },
  { ch: 5, name: "Skimming", aim: 2.2, moulds: ["plumber", "Cu2"], extra: ["X", "Cu"], caps: [3, 3, 3, 2], kinds: SLAG(4), strict: "best", tip: "Metal poured onto dross sinks under it: feed the dross your spare, then skim." },
  { ch: 5, name: "Feed the dross", aim: 3.4, moulds: ["pewter", "speculum"], extra: ["X", "Sn"], caps: [4, 4, 3, 2], kinds: SLAG(4), tip: "Whatever lies under the dross goes with it: make it the spare." },
  { ch: 5, name: "Slag heap", aim: 5.6, moulds: ["bell", "speculum", "fine"], extra: ["X", "Sn"], caps: [5, 4, 4, 3], kinds: SLAG(4), tip: "Three moulds, a crust, a spare, and a slag pot with room to waste." },
  { ch: 5, name: "The slag pot", aim: 4.2, moulds: ["hard", "pewter", "plumber"], extra: ["X", "X", "Cu", "Sn"], caps: [5, 5, 4, 4], kinds: SLAG(4), tip: "Two crusts of dross, two spares, three moulds, and a pot that holds exactly the waste." },
  { ch: 5, name: "Under the dross", aim: 5.0, moulds: ["fine", "bell", "plumber"], extra: ["X", "X", "Sn", "Cu"], caps: [5, 4, 4, 4], kinds: SLAG(4), tip: "Two spares, two crusts: each spare under its own dross." },
  { ch: 5, name: "Foul melt", aim: 6.2, moulds: ["bell", "speculum", "plumber"], extra: ["X", "X", "Sn", "Cu"], caps: [5, 4, 4, 4], kinds: SLAG(4), tip: "Dross poured onto dross makes one crust, and takes its measure along." },
  { ch: 5, name: "Clean metal", aim: 6.6, moulds: ["pewter", "speculum", "plumber"], extra: ["X", "X", "Sn", "Cu"], caps: [5, 5, 5, 4], kinds: SLAG(4), tip: "Every metal, and two crusts of dross." },
  { ch: 5, name: "Dross and measure", aim: 7.2, moulds: ["pewter", "speculum", "plumber"], extra: ["X", "X", "Sn", "Cu"], caps: [5, 5, 5, 4], kinds: SLAG(4), tip: "Big crucibles, two crusts of dross and two spares: room enough to go wrong." },
  // 6 The teapot ladle: it pours from its foot, its heaviest metal, from under the rest (and under any dross)
  { ch: 6, name: "From the foot", moulds: ["Pb2", "Sn2"], caps: C(3, 3), kinds: ["teapot", "", ""], strict: "best", tip: "The teapot ladle, with the spout up its side, pours from its foot: its heaviest metal comes out, from under the rest." },
  { ch: 6, name: "Lead first", moulds: ["plumber", "Cu3"], caps: [4, 3, 3], kinds: ["", "teapot", ""], strict: "best", tip: "Lead out of the foot, tin off the top: two ways out of one crucible." },
  { ch: 6, name: "Under the tin", moulds: ["bell", "Pb2"], caps: [4, 4, 3], kinds: ["", "", "teapot"], tip: "Copper held under tin is no prisoner in the teapot." },
  { ch: 6, name: "Clean pour", aim: 3.6, moulds: ["fine", "speculum"], extra: ["X"], caps: [4, 3, 3, 1], kinds: ["teapot", "", "", "slag"], tip: "A teapot ladle pours clean metal from under the dross and leaves it on its own: dross alone takes nothing with it." },
  { ch: 6, name: "Two ladles", aim: 5.8, moulds: ["pewter", "speculum", "fine"], caps: [4, 4, 3, 3], kinds: ["teapot", "", "", "teapot"], tip: "Two teapots." },
  { ch: 6, name: "Two ways out", aim: 4.4, moulds: ["speculum", "pewter", "plumber"], caps: [4, 4, 3, 3], kinds: ["", "teapot", "", ""], tip: "Lead poured in sinks to the foot, and comes straight back out of it." },
  { ch: 6, name: "Ladle and measure", aim: 5.2, moulds: ["hard", "plumber", "bell"], extra: ["Cu"], caps: [5, 3, 2, 4], kinds: ["", "", "", "teapot"], tip: "Measures and the teapot." },
  { ch: 6, name: "Bottom and top", aim: 6.4, moulds: ["bell", "fine", "plumber"], extra: ["X", "Sn"], caps: [4, 4, 4, 2], kinds: ["", "teapot", "", "slag"], tip: "Dross off the top, metal from the foot." },
  { ch: 6, name: "The ladler", aim: 7.2, moulds: ["bell", "pewter", "fine", "plumber"], extra: ["X", "Cu"], caps: [5, 5, 5, 2], kinds: ["", "", "teapot", "slag"], tip: "The chapter's last: everything so far." },
  // 7 Zinc and charcoal: zinc left without charcoal burns away when the pour is done; charcoal floats on everything and never pours.
  // Its charcoal takes a place in a crucible, so a recipe cast under it needs one more than the recipe's measures (caps here allow for it)
  { ch: 7, name: "Spelter", moulds: ["Zn2", "Cu2"], cover: [0, 1], caps: [4, 4, 3], strict: "best", tip: "Zinc burns away in the open air of a crucible: it is safe only under charcoal, which floats on everything and never pours." },
  { ch: 7, name: "Brass", aim: 1.6, moulds: ["brass", "Sn2"], cover: [0, 1], caps: [4, 4, 3], strict: "best", tip: "Brass is two copper to one zinc. A crucible casts with its charcoal still in it." },
  { ch: 7, name: "Into the brass", aim: 2.6, moulds: ["brass", "Cu2", "Sn2"], cover: [0, 1], caps: [4, 3, 3, 2], tip: "Zinc poured into the open burns, unless it finishes a recipe there: then it casts first." },
  { ch: 7, name: "Zinc in the teapot", aim: 3.4, moulds: ["prince", "speculum", "Sn1"], cover: [0, 1], caps: [5, 4, 3, 3], kinds: ["", "", "teapot", ""], tip: "Prince's metal is three copper to one zinc, as Prince Rupert had it made; the teapot pours copper from under zinc and charcoal." },
  { ch: 7, name: "Pinchbeck", aim: 4.2, moulds: ["pinchbeck", "plumber", "Sn1"], cover: [0], caps: [6, 5, 3, 3], tip: "Four copper to one zinc: the watchmakers' gold-like brass." },
  { ch: 7, name: "Burn it off", aim: 5.0, moulds: ["prince", "Sn2"], extra: ["Zn"], cover: [0, 1], caps: [5, 4, 4, 3], tip: "A zinc too many: let it burn." },
  { ch: 7, name: "Brass and bell", aim: 5.6, moulds: ["brass", "bell", "fine"], extra: ["Sn"], cover: [0, 1], caps: [4, 4, 4, 3], tip: "Two copper alloys from one copper stock." },
  { ch: 7, name: "The brass founder", aim: 7.4, moulds: ["brass", "prince", "fine", "plumber"], cover: [0, 1], caps: [5, 5, 4, 4], tip: "Brass and Prince's metal from one copper stock, beside the two solders." },
  { ch: 7, name: "Prince's metal", aim: 6.2, moulds: ["prince", "bell", "fine", "plumber"], cover: [0, 1], caps: [5, 5, 4, 3], tip: "Two copper alloys and two lead ones, and only two crucibles under charcoal." },
  { ch: 7, name: "Covered", aim: 6.8, moulds: ["brass", "bell", "fine", "plumber"], cover: [0, 1], caps: [5, 5, 4, 4], kinds: ["", "", "teapot", ""], tip: "The chapter's last: zinc under charcoal, and a teapot ladle that pours from beneath it." },
  // 8 Liquation (the Saigerprozess of the Hanse's silver trade): lead meeting black copper draws its silver, a measure for a measure:
  // the lead turns rich (work lead, for the cupel) and the copper is left plain
  { ch: 8, name: "Black copper", moulds: ["Pr2", "Cu2"], raw: ["Pb", "Pb", "Bk", "Bk"], caps: C(3, 3), strict: "best", tip: "Black copper holds silver. Pour lead onto it: the lead draws the silver and turns rich, and the copper is left plain." },
  { ch: 8, name: "Lead left over", moulds: ["Pr2", "plumber", "Cu2"], raw: ["Pb", "Pb", "Pb", "Bk", "Bk", "Sn"], caps: [4, 3, 3, 2], tip: "Lead takes only as much silver as there is: what is left stays plain." },
  { ch: 8, name: "The Saiger hut", aim: 4.0, moulds: ["Pr2", "speculum", "Cu1"], raw: ["Pb", "Pb", "Bk", "Bk", "Sn", "Cu"], caps: [4, 3, 3, 3], tip: "Copper from the mine and copper from the liquation are the same." },
  { ch: 8, name: "Through the tin", aim: 5.4, moulds: ["Pr2", "hard", "plumber", "Cu1"], raw: ["Pb", "Pb", "Pb", "Bk", "Bk", "Sn", "Sn", "Sn"], caps: [4, 4, 3, 3], tip: "Lead sinks through tin on its way to the black copper." },
  { ch: 8, name: "The silver ladle", aim: 4.8, moulds: ["Pr2", "Cu2", "fine", "plumber"], raw: ["Pb", "Pb", "Pb", "Pb", "Bk", "Bk", "Sn", "Sn", "Sn"], caps: [4, 4, 4, 3], kinds: ["", "", "teapot", ""], tip: "The teapot pours the lead from under." },
  { ch: 8, name: "Rich and plain", aim: 6.0, moulds: ["Pr3", "plumber", "Cu3"], raw: ["Pb", "Pb", "Pb", "Pb", "Bk", "Bk", "Bk", "Sn"], caps: [5, 4, 3, 3], tip: "Plain lead for the solder, rich lead for the cupel." },
  { ch: 8, name: "Saigerprozess", aim: 7.8, tries: 300, most: 120000, moulds: ["Pr3", "bell", "fine", "plumber"], raw: ["Pb", "Pb", "Pb", "Pb", "Pb", "Bk", "Bk", "Bk", "Sn", "Sn", "Sn", "Sn"], extra: ["X", "Sn"], caps: [5, 5, 5, 4], kinds: SLAG(4), tip: "The liquation for four moulds, under dross, with a tin to spare." },
  { ch: 8, name: "Work lead", aim: 6.6, moulds: ["Pr2", "bell", "fine", "Cu1"], raw: ["Pb", "Pb", "Pb", "Bk", "Bk", "Cu", "Cu", "Sn", "Sn", "Sn"], caps: [4, 4, 3, 3], tip: "Rich lead lies a hair above plain lead, and plain copper under black." },
  { ch: 8, name: "Dross in the hut", aim: 7.4, moulds: ["Pr3", "bell", "plumber"], raw: ["Pb", "Pb", "Pb", "Pb", "Bk", "Bk", "Bk", "Sn", "Sn"], extra: ["X", "Sn"], caps: [5, 4, 4, 2], kinds: SLAG(4), tip: "Dross over the black copper." },
  { ch: 8, name: "Silver drawn", aim: 7.0, moulds: ["Pr3", "bell", "plumber"], raw: ["Pb", "Pb", "Pb", "Pb", "Bk", "Bk", "Bk", "Sn", "Sn"], caps: [5, 4, 4, 3], tip: "The plain copper the liquation leaves is the bell's; plain lead is the solder's." },
];

/** The rows' levels, in order: a level already in the book is kept as it is (a level once written is never dealt again: its stars
 *  stay true); `only` (ids) makes just those, in two processes. */
export async function book(only = null) {
  const kept = new Map(BOOK.map(L => [`${L.ch} ${L.name}`, L])), counts = {}, keyOf = row => `${row.ch} ${row.name}`;
  const rows = PLAN.map((row, i) => { counts[row.ch] = (counts[row.ch] || 0) + 1; return { row, i, id: `${row.ch}-${counts[row.ch]}` }; });
  const todo = rows.filter(({ row, id }) => (only ? only.includes(id) : !kept.has(keyOf(row))));
  const made = new Map();
  await Promise.all([0, 1].map(half => new Promise((ok, fail) => {
    const mine = todo.filter((_, k) => k % 2 === half).map(t => t.id);
    if (!mine.length) return ok();
    const kid = fork(new URL(import.meta.url).pathname, ["rows", ...mine]);
    kid.on("message", L => { if (L.none) return console.error(`NONE ${L.id} ${L.name}: no fill passed; the row needs changing`); made.set(L.id, L); console.error(`made ${L.id} ${L.name} par ${L.par}`); });
    kid.on("exit", code => (code ? fail(new Error("a maker failed")) : ok()));
  })));
  // a kept level is found by its chapter and name and takes its place and words from the plan, so rows can be put in a better
  // order (and their tips reworded) without being dealt again
  const keep = ({ row, id }) => { const L = kept.get(keyOf(row)); return L && { ...L, id, name: row.name, tip: row.tip }; };
  return rows.map(r => made.get(r.id) || keep(r)).filter(Boolean);
}
/** One row's level, as the book keeps it. */
function levelFor({ row, i, id }) {
  const L = makeLevel(row, (i + 1) * 1000, 600, true);
  if (!L) return { id, name: row.name, none: true };            // reported and left out, so one bad row does not lose the others
  return { id, ch: row.ch, name: row.name, tip: row.tip, caps: L.caps, fill: L.fill, moulds: L.moulds, ...(L.kinds ? { kinds: L.kinds } : {}), par: L.par, seed: L.seed, hard: L.hard ?? +hardness(L).hard.toFixed(2) };
}

const [mode, ...args] = process.argv[1]?.endsWith("settle-plan.mjs") ? process.argv.slice(2) : [];
if (mode === "rows") {
  const counts = {};
  const rows = PLAN.map((row, i) => { counts[row.ch] = (counts[row.ch] || 0) + 1; return { row, i, id: `${row.ch}-${counts[row.ch]}` }; });
  for (const id of args) process.send(levelFor(rows.find(r => r.id === id)));
  process.exit(0);
}
if (mode === "check" || mode === "write") {
  const levels = await book(args.length ? args : null);
  for (const L of levels) {
    const g = gradeOf(L);
    console.log(`${L.id.padEnd(5)} ${L.name.padEnd(20)} par ${L.par}  hard ${L.hard ?? "-"}  best ${g.best}/${g.of}  greedy ${g.greedy}/20  states ${g.states}  | ${L.caps.join(",")}${L.kinds ? " " + L.kinds.map(k => k[0] || "-").join("") : ""} | ${L.fill.map(f => f.join("") || "-").join(" / ")} | ${L.moulds.join(" ")}`);
  }
  if (mode === "write") {
    fs.writeFileSync(new URL("./settle-book.js", import.meta.url), "// Settle: the book of levels, made by settle-plan.mjs (node settle-plan.mjs write) from its plan, never by hand. fill: each crucible foot to top.\n" +
      `export const BOOK = [\n${levels.map(l => "  " + JSON.stringify(l)).join(",\n")}\n];\n`);
    console.log(`${levels.length} levels written`);
  }
}
