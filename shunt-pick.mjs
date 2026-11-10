// Picks Shunt's campaign and Endless and writes shunt-campaign-data.js: `node shunt-pick.mjs` (the campaign and Endless),
// `node shunt-pick.mjs campaign` or `endless` (one, the other kept as it is in the file).
// The campaign follows the Campaign pattern (campaign.js): chapters that each bring one thing (one pitch, more pitches, shear and
// jam, the hold, idlers, jewels, bridges, studs, then the workshop where they meet), each in slots of a role: an introduction, the
// familiar, a quirk, mastery, the capstone. A slot is a recipe (the plate's makings, how many trains its goal asks for, its other
// conditions) and how hard it should be, which is how far short of the longest trains a greedy player (always the shove that looks best
// at once) ends: an introduction it wins outright, a capstone one where it barely makes the goal. Many plates are made for a slot; the
// beam search (shunt-bots.js `longest`) finds each one's longest trains, the goal and stars are two, one and no gears short of them
// (shunt-levels.js `tiers`), and the plate nearest the slot's mark is kept, with its line (`sol`) to prove three stars can be won. The
// twelve levels from before keep their places and ids (the slots marked `keep`). A level's id is its identity: stars are kept by it.
// Endless is one sequence after the campaign: each level needs a chapter (its capstone beaten), leans on that chapter's thing for a
// while after its gate and then mixes it with what came before, asks a little more as it goes and levels off, a milestone every 25th.
import fs from "fs";
const here = new URL("./", import.meta.url);
const { play, judge, reach, starsOf, N } = await import(new URL("shunt-engine.js", here));
const { rng, longest, playGreedy } = await import(new URL("shunt-bots.js", here));
const { LEGACY, tiers } = await import(new URL("shunt-levels.js", here));

const WIDTH = 60;
// how many gears short of the longest trains a greedy player ends, on average, by role: an introduction's goal (two short) it beats
// with every star, a capstone's it only just makes
const MARK = { intro: 0, fam: 1, quirk: 1.4, mas: 1.8, cap: 2.4 };

// k: how many trains the goal asks for; p: pitches; i: idlers; b: bridges; s: studs; j: jewels; t: gears already on the plate; d: the
// deck's length ("fill": every free cell); conditions: nojam, jewels; hold: without the hold the longest trains are shorter; swapFirst:
// the line kept begins with a swap (the coach shows the hold on the first turn); id: the level's id where its place's would be one a
// level used before (stars are kept by id); tip: the level's own line for the coach's box
const R = (role, name, rec = {}) => ({ role, name, ...rec });
const K = (role, id, rec = {}) => ({ role, keep: id, ...rec });
const CHAPTERS = [
  { name: "Shove", rule: "Shove the next gear in from a lever at the rim. Gears of one pitch that touch mesh; three or more in a chain make a train. The goal asks for trains of a length.",
    // Korbi, 10 November 2026: the first chapter taught in seven levels what takes three (the shove, a jam is bad, sometimes more
    // trains beat one long one), so it is three: one lesson a level, no level that only repeats one. One pitch throughout: every gear
    // meshes with every other, so a triangle anywhere jams, and two trains of one pitch must never touch.
    slots: [K("intro", "l1"),
      R("quirk", "Triangle", { id: "c1-jam", k: 1, p: 1, d: 8, t: 2, tip: "Three gears of one pitch in a triangle jam: the whole train locks and doesn't count. Keep the train a chain, not a clump." }),
      R("cap", "Two of a kind", { id: "c1-two", k: 2, p: 1, d: 7, t: 4, tip: "Two trains this time, not one long one. Gears of one pitch that touch join into one train: keep a gap between them." })] },
  { name: "Pitches", rule: "Gears of different pitches (tooth sizes) never mesh: grow a train of each.",
    slots: [K("intro", "l2"), R("fam", "Two trains", { k: 2, p: 2, d: 10 }), R("fam", "Side by side", { k: 2, p: 2, d: 12, t: 2 }), R("quirk", "Third pitch", { k: 3, p: 3, d: 15 }),
      R("mas", "Three colours", { k: 2, p: 3, d: 16 }), R("mas", "Sorting", { k: 3, p: 3, d: 15, t: 2 }), R("cap", "Pitch perfect", { k: 3, p: 3, d: "fill" })] },
  { name: "Shear and jam", rule: "A shove moves a whole line and can pull a train apart; three gears of one pitch in a triangle jam, and a jammed train doesn't count.",
    slots: [K("intro", "l3"), K("fam", "l4"), R("fam", "Odd ring", { k: 2, p: 2, d: 13, nojam: true }), R("quirk", "Loose ends", { k: 3, p: 3, d: 12, t: 3, nojam: true }),
      R("mas", "Clean lines", { k: 3, p: 3, d: 15, nojam: true }), R("mas", "Tight fit", { k: 3, p: 3, d: 16, t: 2, nojam: true }), K("cap", "l9")] },
  { name: "The hold", rule: "Swap sets the next gear aside or brings the held one back, once a turn: the order is yours to plan.",
    slots: [K("intro", "l5", { swapFirst: true }), R("fam", "Wait your turn", { k: 2, p: 3, d: 12, hold: true }), R("fam", "Swap back", { k: 2, p: 3, d: 13, nojam: true, hold: true }),
      R("quirk", "Out of order", { k: 3, p: 3, d: 15, hold: true }), R("mas", "Saved for last", { k: 3, p: 3, d: 15, nojam: true, hold: true }),
      R("mas", "Queue jumping", { k: 3, p: 3, d: 16, nojam: true, hold: true }), R("cap", "The long game", { k: 3, p: 3, d: "fill", nojam: true, hold: true })] },
  { name: "Idlers", rule: "The black idler meshes every pitch: it joins trains of different pitches into one, and it can close a ring and jam.",
    slots: [K("intro", "l6"), R("fam", "Go-between", { k: 1, p: 3, i: 1, d: 12 }), R("fam", "Black gear", { k: 1, p: 3, i: 2, d: 13 }), R("quirk", "Unlucky ring", { k: 2, p: 3, i: 2, d: 13, nojam: true }),
      R("mas", "Junction", { k: 2, p: 3, i: 2, d: 15, nojam: true }), R("mas", "Two by idler", { k: 2, p: 3, i: 3, d: 16, nojam: true }), R("cap", "Idle hands", { k: 2, p: 3, i: 2, t: 1, d: 16, nojam: true })] },
  { name: "Jewels", rule: "A jewel counts only under a train that turns: cover every jewel.",
    slots: [K("intro", "l7"), R("fam", "Ruby", { k: 2, p: 3, j: 1, d: 12, jewels: true }), R("fam", "Setting", { k: 2, p: 3, j: 2, d: 13, jewels: true }),
      R("quirk", "Bezel", { k: 2, p: 3, j: 2, t: 2, d: 12, jewels: true, nojam: true }), R("mas", "Three stones", { k: 3, p: 3, j: 3, d: 15, jewels: true }),
      R("mas", "Pavé", { k: 3, p: 3, j: 3, i: 1, d: 16, jewels: true }), K("cap", "l10")] },
  { name: "Bridges", rule: "A bridge shows two pitches and meshes both, so it fuses their trains into one: keep the trains you need apart.",
    slots: [K("intro", "l8"), R("fam", "Fusion risk", { k: 2, p: 3, b: 1, d: 12 }), R("fam", "Keep apart", { k: 2, p: 3, b: 2, d: 13 }),
      R("quirk", "Twin pitches", { k: 2, p: 3, b: 2, d: 14 }), R("mas", "Separate ways", { k: 3, p: 3, b: 3, d: 15 }),
      R("mas", "Crossing", { k: 2, p: 3, b: 3, j: 2, d: 16, jewels: true }), K("cap", "l11")] },
  { name: "Studs", rule: "A stud (a rivet) never moves and ends a line: a shove stops short of it.",
    slots: [R("intro", "Rivet", { k: 2, p: 2, s: 1, d: 10 }), R("fam", "Short line", { k: 2, p: 3, s: 1, d: 12 }), R("fam", "Blocked", { k: 2, p: 3, s: 2, d: 13 }),
      R("quirk", "Around the stud", { k: 2, p: 3, s: 3, d: 12, nojam: true }), R("mas", "Rivet row", { k: 2, p: 3, s: 2, j: 2, d: 14, jewels: true }),
      R("mas", "Fixed points", { k: 2, p: 3, s: 2, b: 2, d: 14 }), R("cap", "Riveted", { k: 3, p: 3, s: 3, i: 1, j: 2, d: "fill", jewels: true, nojam: true })] },
  { name: "The workshop", rule: "Everything together: pitches, the hold, idlers, jewels, bridges and studs on one plate.",
    slots: [R("fam", "Bench", { k: 2, p: 3, s: 1, j: 2, i: 1, d: 13, jewels: true }), R("fam", "Apprentice", { k: 2, p: 3, b: 2, s: 1, d: 13 }),
      R("quirk", "Journeyman", { k: 3, p: 3, t: 4, s: 2, d: 11, nojam: true }), R("mas", "Commission", { k: 3, p: 3, j: 3, b: 2, d: 15, jewels: true }),
      R("mas", "Repeater", { k: 2, p: 3, i: 2, s: 2, j: 2, d: 14, nojam: true, jewels: true }), R("mas", "Complication", { k: 3, p: 3, b: 3, s: 1, d: 16, hold: true }),
      R("mas", "Masterpiece", { k: 3, p: 3, i: 1, b: 2, s: 1, j: 2, d: "fill", jewels: true }), K("cap", "l12")] },
];

// ---------- a plate from a recipe ----------
function plateFor(seed, rec) {
  const r = rng(Math.imul(seed | 0, 0x9E3779B1) ^ 0x2545F491), used = new Set();
  const cells = n => { const out = []; let guard = 0; while (out.length < n && guard++ < 500) { const c = Math.floor(r() * N); if (!used.has(c)) { used.add(c); out.push(c); } } return out; };
  const stud = cells(rec.s || 0), jewels = cells(rec.j || 0), start = {};
  for (const c of cells(rec.t || 0)) start[c] = Math.floor(r() * (rec.p || 1));
  for (const c of jewels) used.delete(c);                       // (a gear may be shoved over a jewel; only studs and starting gears hold cells)
  const free = N - stud.length - Object.keys(start).length;
  const len = Math.min(free, rec.d === "fill" ? free : rec.d);
  const pairs = rec.p >= 3 ? [4, 5, 6] : [4];
  const deal = [];
  for (let k = 0; k < (rec.i || 0); k++) deal.push(3);
  for (let k = 0; k < (rec.b || 0); k++) deal.push(pairs[Math.floor(r() * pairs.length)]);
  while (deal.length < len) deal.push(Math.floor(r() * (rec.p || 1)));
  for (let i = deal.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [deal[i], deal[k]] = [deal[k], deal[i]]; }
  const goal = {};
  if (rec.nojam) goal.nojam = true;
  if (rec.jewels) goal.jewels = true;
  return { stud, jewels: jewels.sort((a, b) => a - b), start, deal, goal };
}
const run = (plate, k, noHold = false, swapFirst = false) => { const sr = longest(plate, k, { width: WIDTH, noHold, swapFirst }); sr.step(Infinity); return sr.result(); };
const movesOf = path => path.flatMap(([sw, e]) => (sw ? [-1, e] : [e]));
/** A plate rated for k trains: its longest trains (m) and line, its goal and stars (`tiers`), how far short of m a greedy player ends
 *  (`gap`, the mean of three), how often it still makes the goal, and (rec.hold) whether the hold makes them longer; null if the
 *  longest are under five. */
function rate(plate, k, rec = {}) {
  const best = run(plate, k, false, !!rec.swapFirst);
  if (!best || best.m < 5) return null;
  const held = !rec.hold || !(run(plate, k, true)?.m >= best.m);         // where the hold is the thing, better a plate that needs it
  const tr = tiers(k, best.m);
  const L = { ...plate, goal: { ...plate.goal, trains: tr.trains }, stars: tr.stars, best: best.m, sol: movesOf(best.line) };
  const end = play(L, L.sol);
  if (!end || reach(judge(end), k) !== best.m || starsOf(end, null, L.stars) !== 3) return null;     // the line kept wins three stars
  let gap = 0, wins = 0;
  for (let s = 1; s <= 3; s++) { const g = playGreedy(L, s, best.m); gap += (best.m - g.reach) / 3; wins += g.ok ? 1 / 3 : 0; }
  return { L, gap, wins, held };
}
const plateKey = P => JSON.stringify([P.stud, P.jewels, P.start, P.deal]);
/** The plate nearest a slot's mark, of `tries` seeds from `base` (none of those in `avoid`, by plateKey). */
function pick(rec, role, base, tries, mark = MARK[role], avoid = null) {
  let best = null;
  for (let n = 0; n < tries; n++) {
    const P = plateFor(base + n * 7919, rec);
    if (avoid?.has(plateKey(P))) continue;
    const got = rate(P, rec.k, rec);
    if (!got) continue;
    if (role === "intro" && got.wins < 1) continue;               // an introduction a greedy player wins
    const off = Math.abs(got.gap - mark) + (got.held ? 0 : 1);
    if (!best || off < best.off) best = { ...got, off, seed: base + n * 7919 };
    if (off < 0.2) break;
  }
  return best;
}
const slim = L => ({ stud: L.stud, jewels: L.jewels, start: L.start, deal: L.deal, goal: L.goal, stars: L.stars, best: L.best, sol: L.sol });

// ---------- the campaign ----------
function campaign(only) {
  const out = [];
  CHAPTERS.forEach((ch, c) => ch.slots.forEach((slot, n) => {
    if (only != null && c !== only) return;
    if (slot.keep) {
      const P = LEGACY.find(l => l.id === slot.keep), got = rate(P, P.k, slot);
      if (!got) throw new Error(`the level ${P.id} from before rates under five`);
      out.push({ id: P.id, chapter: c, role: slot.role, name: P.name, ...slim(got.L) });
      process.stdout.write(`${ch.name} · ${P.name} (kept): ${goalOf(got.L)}, greedy ${got.gap.toFixed(1)} short\n`);
      return;
    }
    const got = pick(slot, slot.role, 1000 * (c + 1) + 37 * n, 48);
    if (!got) throw new Error(`no plate for ${ch.name} / ${slot.name}`);
    out.push({ id: slot.id || `c${c + 1}-${n + 1}`, chapter: c, role: slot.role, name: slot.name, ...(slot.tip ? { tip: slot.tip } : {}), ...slim(got.L) });
    process.stdout.write(`${ch.name} · ${slot.name}: ${goalOf(got.L)}, greedy ${got.gap.toFixed(1)} short (mark ${MARK[slot.role]})\n`);
  }));
  return out;
}
const goalOf = L => `${L.goal.trains.k} of ${L.goal.trains.m}+/${L.stars.join("+/")}+`;

// ---------- Endless ----------
// how many levels each gate opens, by the chapter it waits for: more as there is more to mix
const SEGMENT = [20, 25, 30, 30, 35, 35, 40, 40, 45];
const LEAN = 15;
/** Endless's list of recipes, in order, the same every time (a seeded stream): each with its gate, its mark and its seed. */
function endlessPlan() {
  const out = [], recipes = CHAPTERS.map(ch => ch.slots.filter(s => !s.keep && s.role !== "intro"));
  const R0 = rng(20261110);
  SEGMENT.forEach((count, c) => {
    for (let k = 0; k < count; k++) {
      const n = out.length, milestone = n % 25 === 24;
      const from = k < LEAN ? c : Math.floor(R0() * (c + 1)), list = recipes[from].length ? recipes[from] : recipes[c];
      out.push({ n, c, milestone, list, slot: list[Math.floor(R0() * list.length)], mark: milestone ? MARK.cap : Math.min(MARK.mas, MARK.fam + n * 0.004) });
    }
  });
  return out;
}
function endless(lo = 0, hi = Infinity) {
  const out = [], seen = new Set();
  for (const e of endlessPlan().slice(lo, hi)) {
    let got = null, slot = e.slot;
    for (let tryN = 0; !got; tryN++) {
      got = pick(slot, "fam", 500000 + e.n * 101 + tryN * 13, 8, e.mark, seen);
      if (!got) slot = e.list[(e.list.indexOf(slot) + 1) % e.list.length];         // no plate: the chapter's next recipe
    }
    seen.add(plateKey(got.L));
    out.push({ needs: e.c, ...(e.milestone ? { milestone: true } : {}), ...slim(got.L) });
    if (e.n % 25 === 0) process.stdout.write(`endless ${e.n + 1} (chapter ${e.c + 1}): ${goalOf(got.L)}\n`);
  }
  return out;
}

// ---------- the file ----------
// The work is split between two processes (`--work campaign c` for chapter c, `--work endless lo hi`), each printing its levels as JSON
// on its last line; the parent puts them in order.
if (process.argv[2] === "--work") {
  const [, , , what, x, y] = process.argv;
  const got = what === "campaign" ? campaign(+x) : endless(+x, +y);
  process.stdout.write(`\n${JSON.stringify(got)}\n`);
  process.exit(0);
}
const { execFile } = await import("child_process");
const work = args => new Promise((res, rej) => execFile(process.execPath, [new URL(import.meta.url).pathname, "--work", ...args.map(String)], { maxBuffer: 1 << 28 }, (err, out) => {
  if (err) return rej(err);
  const lines = out.trim().split("\n");
  process.stdout.write(lines.slice(0, -1).join("\n") + "\n");
  res(JSON.parse(lines.at(-1)));
}));
/** Jobs run two at a time, results in the jobs' order. */
async function all(jobs) {
  const out = new Array(jobs.length);
  let next = 0;
  await Promise.all([0, 1].map(async () => { while (next < jobs.length) { const i = next++; out[i] = await work(jobs[i]); } }));
  return out.flat();
}
const what = process.argv[2] || "both";
const file = new URL("shunt-campaign-data.js", here);
const was = fs.existsSync(file) ? await import(file.href + "?" + Date.now()) : {};
const t0 = Date.now();
const levels = what === "endless" && was.LEVELS ? was.LEVELS : await all(CHAPTERS.map((_, c) => ["campaign", c]));
const total = SEGMENT.reduce((a, b) => a + b, 0), cut = [];
for (let lo = 0; lo < total; lo += 30) cut.push(["endless", lo, Math.min(total, lo + 30)]);
const ends = what === "campaign" && was.ENDLESS ? was.ENDLESS : await all(cut);
const chapters = CHAPTERS.map(({ name, rule }) => ({ name, rule }));
const text = `// Shunt's campaign and Endless: made by shunt-pick.mjs, never by hand (tests/shunt.mjs plays every level's line to three stars; the
// rules of a campaign are campaign.js's). A level is { id, chapter, role, name, stud, jewels, start, deal, goal, stars, best, sol }:
// goal { trains: { k, m }, jewels?, nojam? }, stars the two longer sizes of the same k trains, best the longest found; an Endless level
// { needs (the chapter whose last level opens it), milestone?, … the same without id and name }.
export const CHAPTERS = ${JSON.stringify(chapters, null, 1)};
export const LEVELS = [
${levels.map(l => JSON.stringify(l)).join(",\n")},
];
export const ENDLESS = [
${ends.map(l => JSON.stringify(l)).join(",\n")},
];
`;
fs.writeFileSync(file, text);
console.log(`written: ${levels.length} levels, ${ends.length} Endless, ${Math.round((Date.now() - t0) / 1000)} s`);
