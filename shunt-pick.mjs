// Picks Shunt's campaign and Endless and writes shunt-campaign-data.js: `node shunt-pick.mjs` (the campaign and Endless),
// `node shunt-pick.mjs campaign` or `endless` (one, the other kept as it is in the file).
// The campaign follows the Campaign pattern (campaign.js): chapters that each bring one thing (one pitch, more pitches, shear and
// jam, the hold, idlers, jewels, bridges, studs, then the workshop where they meet), each in slots of a role: an introduction, the
// familiar, a quirk, mastery, the capstone. A slot is a recipe (the plate's makings and its goal) and how hard it should be, which is
// how far a greedy player (always the best-scoring shove) falls short of the goal: an introduction a greedy player wins, a capstone
// one it misses well. Many plates are made for a slot; the beam search (shunt-bots.js) finds each one's best line, the goal is a part
// of that best, and the plate nearest the slot's mark is kept, with its line (`sol`) to prove the goal can be met. The twelve levels
// from before keep their places and ids (the slots marked `keep`). A level's id is its identity: stars are kept by it.
// Endless is one sequence after the campaign: each level needs a chapter (its capstone beaten), leans on that chapter's thing for a
// while after its gate and then mixes it with what came before, asks a little more as it goes and levels off, a milestone every 25th.
import fs from "fs";
const here = new URL("./", import.meta.url);
const { fresh, play, judge, goalCheck, N, STUD, EMPTY } = await import(new URL("shunt-engine.js", here));
const { rng, search, playGreedy } = await import(new URL("shunt-bots.js", here));
const { LEGACY } = await import(new URL("shunt-levels.js", here));

const WIDTH = 40;
const ASK = { intro: 0.62, fam: 0.7, quirk: 0.74, mas: 0.8, cap: 0.86 };
// how far below the goal a greedy player should end, by role (its score over the goal, minus one): an introduction it wins
const MARK = { intro: 0.06, fam: 0, quirk: -0.04, mas: -0.07, cap: -0.12 };

// p: pitches; i: idlers; b: bridges; s: studs; j: jewels; t: gears already on the plate; d: the deck's length ("fill": every free cell);
// goal flags: nojam, jewels, trains [k, m]; hold: the hold must be worth this share of the best (the beam without it scores less)
const R = (role, name, rec = {}) => ({ role, name, ...rec });
const K = (role, id) => ({ role, keep: id });
const CHAPTERS = [
  { name: "Shove", rule: "Shove the next gear in from a lever at the rim: gears of one pitch that touch mesh, and three or more in a chain make a train that scores.",
    // (one pitch: every gear meshes with every other, a triangle anywhere jams, and past ten gears there is no room to keep them
    // apart. Alone a train of seven is the most there is, which a greedy player finds; gears already on the plate make room for a
    // second train, kept apart from the first, and that takes a plan)
    slots: [K("intro", "l1"), R("fam", "First train", { p: 1, d: 6, t: 1 }), R("fam", "Long chain", { p: 1, d: 7, t: 2 }), R("quirk", "Crowded rim", { p: 1, d: 6, t: 4 }),
      R("mas", "Push through", { p: 1, d: 7, t: 4 }), R("mas", "Clear the line", { p: 1, d: 8, t: 4 }), R("cap", "Full mesh", { p: 1, d: 9, t: 5 })] },
  { name: "Pitches", rule: "Gears of different pitches (tooth sizes) never mesh: grow a chain of each.",
    slots: [K("intro", "l2"), R("fam", "Two trains", { p: 2, d: 10 }), R("fam", "Side by side", { p: 2, d: 12, t: 2 }), R("quirk", "Third pitch", { p: 3, d: 12 }),
      R("mas", "Three colours", { p: 3, d: 14 }), R("mas", "Sorting", { p: 3, d: 15, t: 2 }), R("cap", "Pitch perfect", { p: 3, d: "fill" })] },
  { name: "Shear and jam", rule: "A shove moves a whole line and can pull a train apart; three gears of one pitch in a triangle jam and score nothing.",
    slots: [K("intro", "l3"), K("fam", "l4"), R("fam", "Odd ring", { p: 2, d: 13, nojam: true }), R("quirk", "Loose ends", { p: 3, d: 12, t: 3, nojam: true }),
      R("mas", "Clean lines", { p: 3, d: 15, nojam: true }), R("mas", "Tight fit", { p: 3, d: 16, t: 2, nojam: true }), K("cap", "l9")] },
  { name: "The hold", rule: "Swap sets the next gear aside or brings the held one back, once a turn: the order is yours to plan.",
    slots: [K("intro", "l5"), R("fam", "Wait your turn", { p: 3, d: 12, hold: 0.05 }), R("fam", "Swap back", { p: 3, d: 13, nojam: true, hold: 0.05 }),
      R("quirk", "Out of order", { p: 3, d: 14, hold: 0.1 }), R("mas", "Saved for last", { p: 3, d: 15, nojam: true, hold: 0.06 }),
      R("mas", "Queue jumping", { p: 3, d: 16, nojam: true, hold: 0.06 }), R("cap", "The long game", { p: 3, d: "fill", nojam: true, hold: 0.08 })] },
  { name: "Idlers", rule: "The black idler meshes every pitch: it joins chains of different pitches, and it can close a ring and jam.",
    slots: [K("intro", "l6"), R("fam", "Go-between", { p: 3, i: 1, d: 12 }), R("fam", "Black gear", { p: 3, i: 2, d: 13 }), R("quirk", "Unlucky ring", { p: 3, i: 2, d: 13, nojam: true }),
      R("mas", "Junction", { p: 3, i: 2, d: 15, nojam: true }), R("mas", "Two by idler", { p: 3, i: 3, d: 16, nojam: true }), R("cap", "Idle hands", { p: 3, i: 2, t: 1, d: 16, nojam: true })] },
  { name: "Jewels", rule: "A turning train over a jewel is worth half as much again: cover every jewel.",
    slots: [K("intro", "l7"), R("fam", "Ruby", { p: 3, j: 1, d: 12, jewels: true }), R("fam", "Setting", { p: 3, j: 2, d: 13, jewels: true }),
      R("quirk", "Bezel", { p: 3, j: 2, t: 2, d: 12, jewels: true, nojam: true }), R("mas", "Three stones", { p: 3, j: 3, d: 15, jewels: true }),
      R("mas", "Pavé", { p: 3, j: 3, i: 1, d: 16, jewels: true }), K("cap", "l10")] },
  { name: "Bridges", rule: "A bridge shows two pitches and meshes both, so it fuses their trains into one: keep the trains you need apart.",
    slots: [K("intro", "l8"), R("fam", "Fusion risk", { p: 3, b: 1, d: 12, trains: [2, 3] }), R("fam", "Keep apart", { p: 3, b: 2, d: 13, trains: [2, 3] }),
      R("quirk", "Twin pitches", { p: 3, b: 2, d: 14, trains: [2, 4] }), R("mas", "Separate ways", { p: 3, b: 3, d: 15, trains: [3, 3] }),
      R("mas", "Crossing", { p: 3, b: 3, j: 2, d: 16, trains: [2, 4], jewels: true }), K("cap", "l11")] },
  { name: "Studs", rule: "A stud (a rivet) never moves and ends a line: a shove stops short of it.",
    slots: [R("intro", "Rivet", { p: 2, s: 1, d: 10 }), R("fam", "Short line", { p: 3, s: 1, d: 12 }), R("fam", "Blocked", { p: 3, s: 2, d: 13 }),
      R("quirk", "Around the stud", { p: 3, s: 3, d: 12, nojam: true }), R("mas", "Rivet row", { p: 3, s: 2, j: 2, d: 14, jewels: true }),
      R("mas", "Fixed points", { p: 3, s: 2, b: 2, d: 14, trains: [2, 4] }), R("cap", "Riveted", { p: 3, s: 3, i: 1, j: 2, d: "fill", jewels: true, nojam: true })] },
  { name: "The workshop", rule: "Everything together: pitches, the hold, idlers, jewels, bridges and studs on one plate.",
    slots: [R("fam", "Bench", { p: 3, s: 1, j: 2, i: 1, d: 13, jewels: true }), R("fam", "Apprentice", { p: 3, b: 2, s: 1, d: 13, trains: [2, 4] }),
      R("quirk", "Journeyman", { p: 3, t: 4, s: 2, d: 11, nojam: true }), R("mas", "Commission", { p: 3, j: 3, b: 2, d: 15, jewels: true, trains: [2, 3] }),
      R("mas", "Repeater", { p: 3, i: 2, s: 2, j: 2, d: 14, nojam: true, jewels: true }), R("mas", "Complication", { p: 3, b: 3, s: 1, d: 16, trains: [3, 4], hold: 0.04 }),
      R("mas", "Masterpiece", { p: 3, i: 1, b: 2, s: 1, j: 2, d: "fill", jewels: true }), K("cap", "l12")] },
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
  if (rec.trains) goal.trains = { k: rec.trains[0], m: rec.trains[1] };
  return { stud, jewels: jewels.sort((a, b) => a - b), start, deal, goal };
}
const run = (L, noHold = false) => { const sr = search(fresh(L), WIDTH, noHold); sr.step(Infinity); return sr.result(); };
const movesOf = path => path.flatMap(([sw, e]) => (sw ? [-1, e] : [e]));
/** A plate rated: its best line, its goal and stars at an ask, how a greedy player does against it; null if the beam misses the goal's parts. */
function rate(plate, ask, rec) {
  const best = run(plate);
  if (!best.ok || best.score < 12) return null;
  if (rec.hold) { const without = run(plate, true).score; if (best.score - without < rec.hold * best.score) return null; }
  const t3 = Math.floor(best.score * 0.97), goalScore = Math.min(t3 - 1, Math.max(10, Math.round(best.score * ask))), t2 = Math.max(goalScore, Math.floor((goalScore + t3) / 2));
  const L = { ...plate, goal: { ...plate.goal, score: goalScore }, stars: [t2, Math.max(t3, t2)], best: best.score, sol: movesOf(best.path) };
  const end = play(L, L.sol);
  if (!end || judge(end).score !== best.score || !goalCheck(end).ok) return null;            // the line kept must win, to its best
  let g = 0, gw = 0;
  for (let k = 1; k <= 3; k++) { const p = playGreedy(L, k); g += p.score / 3; gw += p.ok ? 1 / 3 : 0; }
  return { L, greedy: g / goalScore - 1, greedyWins: gw };
}
/** The plate nearest a slot's mark, of `tries` seeds from `base`. */
function pick(rec, role, base, tries, ask = ASK[role]) {
  let best = null;
  for (let k = 0; k < tries; k++) {
    const got = rate(plateFor(base + k * 7919, rec), ask, rec);
    if (!got) continue;
    if (role === "intro" && got.greedyWins < 1) continue;            // an introduction a greedy player wins
    const off = Math.abs(got.greedy - MARK[role]);
    if (!best || off < best.off) best = { ...got, off, seed: base + k * 7919 };
  }
  return best;
}
const slim = L => ({ stud: L.stud, jewels: L.jewels, start: L.start, deal: L.deal, goal: L.goal, stars: L.stars, best: L.best, sol: L.sol });

// ---------- the campaign ----------
function campaign() {
  const out = [];
  let made = 0;
  CHAPTERS.forEach((ch, c) => ch.slots.forEach((slot, k) => {
    if (slot.keep) {
      const L = LEGACY.find(l => l.id === slot.keep);
      out.push({ id: L.id, chapter: c, role: slot.role, name: L.name, ...slim(L) });
      return;
    }
    const got = pick(slot, slot.role, 1000 * (c + 1) + 37 * k, 48);
    if (!got) throw new Error(`no plate for ${ch.name} / ${slot.name}`);
    out.push({ id: `c${c + 1}-${k + 1}`, chapter: c, role: slot.role, name: slot.name, ...slim(got.L) });
    made++;
    process.stdout.write(`${ch.name} · ${slot.name}: best ${got.L.best}, goal ${got.L.goal.score}, greedy ${(got.greedy * 100).toFixed(0)}%\n`);
  }));
  return { levels: out, made };
}

// ---------- Endless ----------
// how many levels each gate opens, by the chapter it waits for: more as there is more to mix
const SEGMENT = [20, 25, 30, 30, 35, 35, 40, 40, 45];
const LEAN = 15;
function endless() {
  const out = [], recipes = CHAPTERS.map(ch => ch.slots.filter(s => !s.keep && s.role !== "intro"));
  const R0 = rng(20261110);
  SEGMENT.forEach((count, c) => {
    for (let k = 0; k < count; k++) {
      const n = out.length, milestone = n % 25 === 24;
      const from = k < LEAN ? c : Math.floor(R0() * (c + 1)), list = recipes[from].length ? recipes[from] : recipes[c];
      const slot = list[Math.floor(R0() * list.length)];
      const ask = milestone ? 0.88 : Math.min(0.84, 0.72 + n * 0.0006);         // up a little as it goes, then level
      const role = milestone ? "cap" : n < 60 ? "fam" : "mas";
      const got = pick(slot, role, 500000 + n * 101, 8, ask);
      if (!got) { console.log(`endless ${n + 1}: no plate, another recipe`); k--; continue; }
      out.push({ needs: c, ...(milestone ? { milestone: true } : {}), ...slim(got.L) });
      if (n % 25 === 0) process.stdout.write(`endless ${n + 1} (chapter ${c + 1})\n`);
    }
  });
  return out;
}

// ---------- the file ----------
const what = process.argv[2] || "both";
const file = new URL("shunt-campaign-data.js", here);
const was = fs.existsSync(file) ? await import(file.href + "?" + Date.now()) : {};
const t0 = Date.now();
const C = what === "endless" && was.LEVELS ? { levels: was.LEVELS } : campaign();
const E = what === "campaign" && was.ENDLESS ? was.ENDLESS : endless();
const chapters = CHAPTERS.map(({ name, rule }) => ({ name, rule }));
const text = `// Shunt's campaign and Endless: made by shunt-pick.mjs, never by hand (tests/shunt.mjs plays every level's line to its best; the
// rules of a campaign are campaign.js's). A level is { id, chapter, role, name, stud, jewels, start, deal, goal, stars, best, sol };
// an Endless level { needs (the chapter whose last level opens it), milestone?, … the same without id and name }.
export const CHAPTERS = ${JSON.stringify(chapters, null, 1)};
export const LEVELS = [
${C.levels.map(l => JSON.stringify(l)).join(",\n")},
];
export const ENDLESS = [
${E.map(l => JSON.stringify(l)).join(",\n")},
];
`;
fs.writeFileSync(file, text);
console.log(`written: ${C.levels.length} levels, ${E.length} Endless, ${Math.round((Date.now() - t0) / 1000)} s`);
