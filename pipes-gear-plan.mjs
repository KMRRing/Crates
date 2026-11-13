// Gears: the new levels, each drawn by hand as its answer (the campaign as re-planned on 12 November 2026, the game plan's "The 100 levels"
// tab). Korbi: "do your best to create clever, complex, sometimes beautiful maps, each one should ideally have an 'aha' moment", and then,
// the same day: "it should not be possible, in 90% of cases, to solve the problem by using fewer gears than given ... it's ok if in 10% of
// levels you are left with 2-4 gears ... but it shouldn't be the first level and it shouldn't be so many levels in general." So a drawing
// is checked twice: the whole hand has one answer, and no train of only some of the hand reaches the dial (a `loose` level is let off the
// second check, and at most one level in ten may be). The level test checks the same again.
//
// A drawing is the face with its answer laid, one token a square:
//   .  an empty square      #  a pillar      _  off the face
//   P  the motor or barrel, then the side its gear meshes on (PN, PE, PS, PW); *  the movement's arbor, meshing all four sides
//   G  the dial (on a mechanical level, the escape wheel), then the side it meshes on
//   o  a single; a b c d  a duo turning the corner N–E, E–S, S–W, W–N; - |  a straight duo, across or down
//   A B C D, = !  the same for trios
// The hand is the drawn pieces; the dial's turn is the one the drawn answer gives it.
//
// Usage: node pipes-gear-plan.mjs check [n]     checks the drawings (or level n's), drawing any second answer
//        node pipes-gear-plan.mjs write         writes pipes-gear-designs.js
//        node pipes-gear-plan.mjs sketch <rows> <pieces> [besides] [Q|M|A] [tries] [from-seed]
//              forge candidates to start a drawing from: rows of the face with commas ("....,....,...."), the answer's length, the
//              pieces besides singles ("D T"), the power; each candidate has no shorter train
import fs from "fs";
import { forgeLevel } from "./pipes-gear-forge.js";
import { mix as mixSeed } from "./pipes-pieces.js";
import { solve } from "./pipes-gear-solve.js";
import { parseLevel, emptyLaid, check } from "./pipes-gear-engine.js";

const POWER = { Q: "quartz", M: "mech", A: "arbor" };
const PIECE = { o: "S5.1@0", a: "D5.1:5>5e@0", b: "D5.1:5>5e@1", c: "D5.1:5>5e@2", d: "D5.1:5>5e@3", "-": "D5.1:6+6@0", "|": "D5.1:6+6@1",
  A: "T5.1:4-5-4e@0", B: "T5.1:4-5-4e@1", C: "T5.1:4-5-4e@2", D: "T5.1:4-5-4e@3", "=": "T5.1:5-4-5@0", "!": "T5.1:5-4-5@1" };
const TOKEN = Object.fromEntries(Object.entries(PIECE).map(([t, p]) => [p, t]));

export const CHAPTERS = [
  { key: "na", book: "N", name: "Gears", from: 1, rule: "Mesh gears from the motor to the dial: each mesh turns the next wheel the other way." },
  { key: "nb", book: "N", name: "Duos and trios", from: 2, rule: "Duos and trios mesh only at their ends. A duo turns the next wheel the way a single would not; a trio turns it as a single does." },
  // Korbi, 12 Nov 2026: quartz turns smoothly; then "mechanical early levels: it's an arbor coming from the other side ... discrete 1 per second",
  // then "mechanical late: mainspring must be connected to the escapement before wound, otherwise it just unwinds"; "late chapter 1 should
  // introduce the escapement" (read as: the escapement comes at the end of this first set of chapters)
  { key: "nc", book: "N", name: "The arbor", from: 8, rule: "The arbor turns from the other side of the movement, a step a second: it meshes every wheel beside it." },
  { key: "nd", book: "N", name: "Mechanical", from: 12, rule: "Wind it to try it: no wheel shows its turn until it runs, and the spring runs straight down unless the train reaches the escape wheel, which lets it tick." },
];
// the new levels are their own book while Korbi plays them ahead of Book I (12 Nov 2026: "put them in front of all the levels")
export const BOOKS = [{ key: "N", name: "The new bench", rule: "Gears, duos and trios, and the three powers." }];
export const chapterOf = n => [...CHAPTERS].reverse().find(c => n >= c.from).key;

// { n, name, power, themes, draw, aha, loose, sym }: sym marks a mirror-symmetric face, whose pillars count in mirror pairs
export const PLAN = [
  { n: 1, name: "First mesh", power: "Q", themes: [], draw: [
    ".  o  o",
    "GS PN o",
    "o  o  o"],
    aha: "The dial sits beside the motor, but they face away from each other: the train goes the whole way round." },
  // 13 Nov 2026, Korbi's ratings: Staircase (2/5), Spiral (1/5) and the first Trio (2/5) had no short way that turns the dial backwards
  // and leaned on pillars, so the route was forced; they go. The duo comes second, and the rest of the chapter is drawn with the sketch's
  // TRICK (a trap and a blind side) and at most two pillars.
  { n: 2, name: "Duo", power: "Q", themes: ["Duos"], draw: [
    ".  b  o  o",
    "PE o  .  o",
    ".  .  #  o",
    "GE o  o  o"],
    aha: "Three singles reach the dial straight down, but turn it backwards. The duo turns it the other way, and it turns only an east-to-south corner, the top one: so the train goes the long way round." },
  { n: 3, name: "Blind side", power: "Q", themes: ["Duos"], draw: [
    "o  o  o  o",
    "o  PE -  o",
    "o  o  o  #",
    ".  .  GN ."],
    aha: "Two singles from the motor reach the dial, but turn it backwards. Only the straight duo, on the motor's own wheel, puts it right: the train turns back over the top and goes the long way round the motor, past its three blind sides, to come down onto the dial." },
  { n: 4, name: "Trio", power: "Q", themes: ["Duos", "Trios"], draw: [
    "o  o  o  o  GS",
    "|  PE C  o  o",
    "o  o  o  .  #"],
    aha: "Three singles from the motor reach the dial, backwards. The duo puts it right, but it fits only on the motor's far side: the trio takes the motor's wheel and turns the train down, under the motor and up through the duo, back across the top. The trio turns the next wheel as a single would; what it adds is its blind sides." },
  { n: 5, name: "Pair and three", power: "Q", themes: ["Duos", "Trios"], draw: [
    "o  o  o  GW",
    "o  #  B  PW",
    "o  #  o  .",
    "o  o  d  ."],
    aha: "The dial is right above the motor's first wheel, but that way turns it backwards. The duo puts it right and turns only the bottom corner, so the train goes all the way round, and comes home beside the first wheel: only a trio can sit there, meshing just at its ends." },
  { n: 6, name: "Back to back", power: "Q", themes: ["Duos", "Trios"], draw: [
    "o  o  c  .  .",
    "o  #  o  .  .",
    "o  #  A  GW PS",
    "o  o  o  o  o"],
    aha: "Motor and dial stand back to back, so the train goes all the way round: four singles get there, backwards. The duo puts it right in the top corner, and the last wheel must be the trio, turning the corner into the dial while the train passes under it on its blind side." },
  { n: 7, name: "Bench", power: "Q", themes: ["Duos", "Trios"], draw: [
    "_  GE o  #  _",
    "o  PW o  -  o",
    "!  #  .  #  !",
    "o  o  #  o  o",
    "_  o  -  o  _"],
    aha: "Every duo and trio in the hand is straight, and the ring round the diamond has one straight run on each side for them. The two duos undo each other's turn." },
  { n: 8, name: "Cannon pinion", power: "A", themes: ["Arbor", "Duos"], draw: [
    "o  o  o",
    "o  #  o",
    "o  *  |",
    ".  GE o"],
    aha: "Two singles from the arbor's right reach the dial, but turn it backwards. The straight duo puts it right, and it works only beside the arbor, which it doesn't mesh: so the train leaves on the left, goes all the way round, and comes down through the duo." },
  { n: 9, name: "Centre wheel", power: "A", themes: ["Arbor", "Duos", "Trios"], draw: [
    ".  GS .  .",
    "o  D  *  o",
    "o  o  c  o",
    ".  #  o  o"],
    aha: "The arbor turns every wheel beside it, so the train winds once round it, out on the right and back in from the left: under it and beside it only a duo and a trio can sit, each meshing away from it, and the duo is the one the dial's turn needs." },
  { n: 10, name: "Hour wheel", power: "A", themes: ["Arbor", "Duos", "Trios"], draw: [
    "_  o  o  o  _",
    "o  o  #  o  .",
    "o  #  *  o  .",
    "a  o  C  .  .",
    "_  .  GN .  _"],
    aha: "The dial is one wheel below the arbor, but that wheel turns it backwards. The duo puts it right and turns only the bottom-left corner, so the train goes all the way round, and comes home beside the arbor: only the trio can sit there, meshing the train and the dial but not the arbor." },
  { n: 11, name: "Motion works", power: "A", themes: ["Arbor", "Duos", "Trios"], draw: [
    ".  o  o  o  c",
    ".  o  #  #  o",
    ".  o  *  #  o",
    "GS .  .  o  D",
    "o  o  o  D  ."],
    aha: "Four singles from under the arbor reach the dial, but turn it backwards. The duo that puts it right turns only the top-right corner, so the train leaves the arbor on the left and goes the long way round, the two trios stepping it round the bottom-right corner and under the arbor to the dial." },
  // 13 Nov 2026: Mainspring (1/5), Escapement (3/5) and Barrel in the middle (2/5) redrawn to the rules the ratings gave (a trap,
  // blind sides, at most two pillars, no forced spiral)
  { n: 12, name: "Mainspring", power: "M", themes: ["Mechanical", "Duos"], draw: [
    "GS o  o  o",
    "o  o  b  o",
    ".  PS o  #",
    ".  o  o  ."],
    aha: "Four singles straight up the left reach the escape wheel, and wound they'd run it backwards. The duo sets it right, but it turns only an east-to-south corner: so the train goes down and right, up into the duo from below, out over the top, and back down past the barrel's blind side to the escape wheel." },
  { n: 13, name: "Escape wheel", power: "M", themes: ["Mechanical", "Duos"], draw: [
    "_  .  o  o  _",
    "o  o  |  o  o",
    "GN o  o  PE o",
    "_  .  .  .  _"],
    aha: "Singles alone run the escape wheel backwards. The straight duo sets it right, and it goes in the middle: the train climbs the right, crosses the top and comes down through it, the wheels either side passing its blind sides." },
  { n: 14, name: "Click", power: "M", themes: ["Mechanical", "Duos"], draw: [
    ".  .  o  PW",
    ".  .  o  #",
    "o  o  a  o",
    "GN o  o  o"],
    aha: "Singles alone run the escape wheel backwards. The duo sets it right, and it must be the hub the train winds round: down into it from the barrel, out to the right, then back round under it and past its left to the escape wheel." },
  { n: 15, name: "Ratchet", power: "M", themes: ["Mechanical", "Duos", "Trios"], draw: [
    "b  o  o  .",
    "o  PS o  .",
    "o  !  o  GW",
    "o  o  #  ."],
    aha: "Two wheels run the escape wheel backwards. The duo sets it right but turns only the top-left corner, so the train goes down, round and up the left; the barrel's first wheel must be the straight trio, which the train passes on both sides." },
  { n: 16, name: "Escapement", power: "M", themes: ["Mechanical", "Duos", "Trios"], draw: [
    "_  o  PW .  _",
    "o  o  #  .  .",
    "o  -  o  o  .",
    "B  o  #  o  .",
    "GN o  o  o  ."],
    aha: "The escape wheel's last wheel must be the trio, turning the corner from above; five singles get there backwards. The straight duo sets it right, but it meshes only across: the train comes down the left, crosses through the duo, and loops round the right and back along the bottom, passing the duo's and the trio's blind sides, to come into the trio from its right." },
  { n: 17, name: "Going train", power: "M", themes: ["Mechanical", "Duos", "Trios"], draw: [
    "_  o  o  o  _",
    ".  o  #  o  #",
    ".  o  .  a  o",
    ".  o  PE o  !",
    ".  o  o  o  GN"],
    aha: "The barrel's wheel and the straight trio reach the escape wheel at once, and wound they'd run it backwards. The duo's corner sets it right, but it sits just above the barrel's wheel and doesn't mesh it: the train leaves the other way, along the bottom, up the left and over the top, down into the duo, and through the trio past the barrel's wheel to the escape wheel." },
];

/** A drawn level as level data. */
export function level(row) {
  const { n, name, power, themes = [], draw, aha = "", sym } = row, cells = draw.map(r => r.trim().split(/\s+/));
  const rows = cells.length, cols = cells[0].length, sol = {};
  if (cells.some(r => r.length !== cols)) throw new Error(`level ${n} ${name}: rows of different lengths`);
  let barrel = null, sink = null;
  const map = cells.map((r, y) => r.map((t, x) => {
    const c = y * cols + x;
    if (t === "*") barrel = { c, arbor: true, m: 5, l: 1 };
    else if (/^P[NESW]$/.test(t)) barrel = { c, side: t[1], m: 5, l: 1, n: 9 };
    else if (/^G[NESW]$/.test(t)) sink = { c, side: t[1], m: 5, l: 1, n: 9, goal: { type: power === "M" ? "escape" : "dial", dir: "cw" } };
    else if (PIECE[t]) sol[c] = PIECE[t];
    else if (![".", "#", "_"].includes(t)) throw new Error(`level ${n} ${name}: no such token ${t}`);
    return t === "_" ? " " : t === "#" ? "#" : ".";
  }).join(""));
  if (!barrel || !sink) throw new Error(`level ${n} ${name}: no ${barrel ? "dial" : "motor"}`);
  const count = {};
  for (const p of Object.values(sol)) count[p] = (count[p] || 0) + 1;
  const spec = { id: `g-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name, chapter: chapterOf(n), cols, rows, rotate: false, v: 1, power: POWER[power], map,
    hand: Object.entries(count).map(([p, k]) => `${p}:${k}`).join(" "), sols: [sol], pins: [], clicks: [], trains: [{ id: "A", barrel, sink }], themes, aha, ...(sym ? { sym: true } : {}) };
  const runs = () => { const L = parseLevel(spec), laid = emptyLaid(L); for (const [c, p] of Object.entries(sol)) laid[c] = p; return check(L, laid).solved; };
  if (!runs()) { sink.goal.dir = "ccw"; if (!runs()) throw new Error(`level ${n} ${name}: the drawn answer does not run`); }
  return spec;
}

/** A level drawn with an answer laid (the drawing's own tokens). */
export function picture(spec, laid = spec.sols[0]) {
  const t = spec.trains[0];
  return spec.map.map((r, y) => [...r].map((ch, x) => {
    const c = y * spec.cols + x;
    if (ch === " ") return "_";
    if (c === t.barrel.c) return t.barrel.arbor ? "*" : "P" + t.barrel.side;
    if (c === t.sink.c) return "G" + t.sink.side;
    return ch === "#" ? "#" : laid[c] ? TOKEN[laid[c]] || "?" : ".";
  }).map(s => s.padEnd(2)).join(" "));
}

const answers = (spec, spare) => {
  const s = solve(parseLevel(spare ? { ...spec, spare: true } : spec), 3, 4e6);
  return { aborted: s.aborted, nodes: s.nodes, sols: s.sols.map(x => Object.fromEntries(x.laid.map((p, c) => [c, p]).filter(([, p]) => p))) };
};
/** What is wrong with a drawn level: a second answer, a shorter train, a pillar that changes nothing. */
export function faults(spec, loose) {
  const out = [], whole = answers(spec, false), part = loose ? null : answers(spec, true);
  if (whole.aborted || (part && part.aborted)) return { out: ["the solver gave up"], nodes: whole.nodes };
  const mine = JSON.stringify(spec.sols[0]), other = s => JSON.stringify(s) !== mine;
  for (const s of whole.sols.filter(other)) out.push(["a second answer:", ...picture(spec, s)].join("\n   "));
  const seen = new Set(whole.sols.map(s => JSON.stringify(s)));
  for (const s of (part ? part.sols : []).filter(s => !seen.has(JSON.stringify(s)))) out.push([`a shorter train (${Object.keys(s).length} pieces):`, ...picture(spec, s)].join("\n   "));
  if (!out.length) {
    spec.map.forEach((r, y) => [...r].forEach((ch, x) => {
      const mx = spec.cols - 1 - x, pair = spec.sym && spec.map[y][mx] === "#";
      if (ch !== "#" || (pair && mx < x)) return;
      const t = { ...spec, map: spec.map.map((q, k) => (k !== y ? q : [...q].map((v, i) => (i === x || (pair && i === mx) ? "." : v)).join(""))) };
      const w = answers(t, false), p = loose ? null : answers(t, true);
      if (!w.aborted && w.sols.length === 1 && (!p || (!p.aborted && p.sols.length === 1))) out.push(`the pillar at ${x},${y}${pair && mx !== x ? ` (and ${mx},${y})` : ""} changes nothing`);
    }));
  }
  return { out, nodes: whole.nodes };
}

/** What makes a level worth solving (Korbi's ratings, 12 Nov 2026: the levels he liked have both): `trap`, the length of the
 *  shortest train of singles that reaches the dial turning it backwards (0: none); `touch`, how often the answer runs beside
 *  itself (or beside the arbor) on a side that doesn't mesh. */
export function trickOf(spec) {
  const L = parseLevel(spec), laid = emptyLaid(L), t = spec.trains[0], cols = spec.cols;
  for (const [c, p] of Object.entries(spec.sols[0])) laid[c] = p;
  const path = check(L, laid).trains?.[0]?.path || [], at = new Map(path.map((c, i) => [c, i]));
  let touch = 0;
  for (const [c, i] of at) {
    if (c === t.sink.c || (c === t.barrel.c && !t.barrel.arbor)) continue;
    for (const n of [c + 1, c + cols]) if ((n !== c + 1 || n % cols) && at.has(n) && n !== t.sink.c && (n !== t.barrel.c || t.barrel.arbor) && Math.abs(at.get(n) - i) > 1) touch++;
  }
  const back = { ...spec, hand: "S5.1@0:30", spare: true, trains: [{ ...t, sink: { ...t.sink, goal: { ...t.sink.goal, dir: t.sink.goal.dir === "cw" ? "ccw" : "cw" } } }] };
  const s = solve(parseLevel(back), 6, 2e5);
  return { trap: s.sols.length ? Math.min(...s.sols.map(x => x.laid.filter(Boolean).length)) : 0, touch };
}

const [mode, ...args] = process.argv[1]?.endsWith("pipes-gear-plan.mjs") ? process.argv.slice(2) : [];
if (mode === "check") {
  for (const row of PLAN.filter(r => !args[0] || r.n === Number(args[0]))) {
    const spec = level(row), f = faults(spec, row.loose);
    console.log(`${row.n} ${row.name} [${spec.power}] dial ${spec.trains[0].sink.goal.dir}, ${Object.keys(spec.sols[0]).length} pieces, nodes ${f.nodes}${row.loose ? ", loose" : ""}: ${f.out.length ? "" : "ok"}`);
    for (const m of f.out) console.log("   " + m);
  }
}
if (mode === "write") {
  const levels = PLAN.map(row => { const spec = level(row), f = faults(spec, row.loose); if (f.out.length) throw new Error(`level ${row.n} ${row.name}: ${f.out[0]}`); return { ...spec, nodes: f.nodes, ...(row.loose ? { loose: true } : {}) }; });
  fs.writeFileSync(new URL("./pipes-gear-designs.js", import.meta.url), `// Gears: the levels drawn to the plan of 12 November 2026. Made by pipes-gear-plan.mjs (node pipes-gear-plan.mjs write), never by hand.\n` +
    `export const BOOKS = ${JSON.stringify(BOOKS)};\nexport const CHAPTERS = ${JSON.stringify(CHAPTERS)};\nexport const LEVELS = [\n${levels.map(l => "  " + JSON.stringify(l)).join(",\n")}\n];\n`);
  console.log(`${levels.length} levels written`);
}
if (mode === "sketch") {
  const face = args[0].split(","), pieces = Number(args[1]), mx = (args[2] || "").split(/\s+/).filter(Boolean), power = args[3] || "Q", tries = Number(args[4] || 2000);
  const recipe = { cols: face[0].length, rows: face.length, face, power: POWER[power], arbor: power === "A", spares: 0, extras: {}, lastResortPins: false, minimal: true, strict: true, touch: !!process.env.TOUCH, sym: !!process.env.SYM, at: process.env.AT ? Number(process.env.AT) : undefined, limit: 4e5,
    trains: [{ m: 5, l: 1, pieces, bends: 2, fams: { S: 1, D: mx.includes("D") ? 1 : 0, T: mx.includes("T") ? 1 : 0 }, kinds: Object.values(PIECE).map(p => p.split("@")[0]), mix: mx, barrelN: power === "A" ? 12 : undefined }] };
  const got = [];
  for (let k = Number(args[5] || 0), t0 = Date.now(); k < Number(args[5] || 0) + tries && Date.now() - t0 < 280000; k++) {
    const res = forgeLevel(mixSeed(1, k, 77), recipe);
    if (!res) continue;
    const pic = picture(res.spec), toks = pic.join(" ").split(/\s+/), g = { k, nodes: res.nodes, pic, idle: toks.filter(t => t === ".").length, pillars: toks.filter(t => t === "#").length, ...trickOf(res.spec) };
    // Korbi's ratings, 13 Nov 2026: every level he liked has a short way that turns the dial backwards, and few pillars (a route the
    // pillars force is no puzzle): TRICK keeps only those with a trap and a blind side, PILLARS caps the pillars
    if ((!process.env.TRICK || (g.trap && g.touch)) && (!process.env.PILLARS || g.pillars <= Number(process.env.PILLARS))) got.push(g);
  }
  got.sort((a, b) => (process.env.HARD ? b.nodes - a.nodes : a.idle - b.idle || b.nodes - a.nodes));   // the fewest squares left idle first, or the hardest
  console.log(`${got.length} of ${tries}`);
  const seen = new Set();
  for (const g of got) { const key = g.pic.join("|"); if (seen.has(key) || seen.size >= Number(process.env.SHOW || 6)) continue; seen.add(key); console.log(`seed ${g.k}, nodes ${g.nodes}, ${g.idle} idle${g.trap ? `, singles reach it backwards in ${g.trap}` : ""}${g.touch ? `, comes home beside itself ${g.touch}x` : ""}\n` + g.pic.map(l => "   " + l).join("\n")); }
}
