// Contract's puzzle rush bank (contract-puzzles.js): decisions late in deals the computer players bid by SAYC and play
// at Medium, where one card makes the contract (or beats it) clearly more often than any other, over many deals of the
// cards its player can't see, each solved with every card seen (DDS). From the seventh trick on, each decision with a
// choice is weighed over 16 deals of the unseen cards, as its player could know them (each hand's size, the suits shown
// out of, what the auction showed); one whose best card is 25 points of the deals ahead of the next is weighed again over
// 160 fresh deals and kept if it still is, at least four standard errors clear. Cards that did as well in every deal
// (touching cards, small cards alike) are all as good. Its rating: whether Easy's rule of thumb and Medium (12 deals)
// would have found it, how close the call, how many cards to choose from and to hold; the bank is cut into ten ratings.
//   node tools/contract-puzzles.mjs <first deal> <deals> <out.jsonl>     find puzzles, a line each
//   node tools/contract-puzzles.mjs merge <in.jsonl>…                     rate them and write contract-puzzles.js
import fs from "fs";
import { rules } from "../contract-rules.js";
import { chooseCard, playByRules, dealsFor, goalOf as sideGoal } from "../contract-play.js";
import { loadSolver } from "../contract-dds.js";
import { legalCards, handText, cardText } from "../contract-core.js";
import { stateOf, motifsOf } from "../contract-rush.js";

const ROOT = new URL("../", import.meta.url);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const FIRST = { deals: 16, margin: 0.25 }, CONFIRM = { deals: 160, margin: 0.25, z: 4, least: 0.3 };
const PLAY = { deals: 8, ms: 1e9 };                               // the computer players' own play: Medium, by count not time

if (process.argv[2] === "merge") merge(process.argv.slice(3));
else await find(Number(process.argv[2] || 1), Number(process.argv[3] || 50), process.argv[4] || "contract-puzzles.jsonl");

/** Every legal card weighed over n deals of what the seat to move can't see: { legal, hits: per card, a 0/1 a deal, n }. */
function weigh(dds, s, seat, n, r) {
  const legal = legalCards(s.hands[s.turn], s.trick), g = sideGoal(s, s.turn);
  const hands = dealsFor(s, seat, r, n), hits = legal.map(() => []);
  for (const h of hands) {
    const res = dds.solve(h, s.trick, s.contract.strain, s.turn);
    legal.forEach((c, i) => hits[i].push(g.won + res.get(c) >= g.need ? 1 : 0));
  }
  return { legal, hits, n: hands.length };
}
/** The best card and those as good (alike in every deal, or within a point of it), the best of the rest, and how clear. */
function verdictOf(w) {
  const mean = h => h.reduce((a, b) => a + b, 0) / Math.max(1, h.length);
  const order = w.legal.map((c, i) => i).sort((a, b) => mean(w.hits[b]) - mean(w.hits[a]));
  const b = order[0], same = (i, j) => w.hits[i].every((x, k) => x === w.hits[j][k]);
  const ok = order.filter(i => same(i, b) || mean(w.hits[b]) - mean(w.hits[i]) < 0.01);
  const rest = order.filter(i => !ok.includes(i));
  if (!rest.length) return null;
  const nx = rest[0], d = w.hits[b].map((x, k) => x - w.hits[nx][k]), m = mean(d);
  const sd = Math.sqrt(d.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, d.length - 1)), z = sd ? m / (sd / Math.sqrt(d.length)) : m > 0 ? 99 : 0;
  return { best: w.legal[b], ok: ok.map(i => w.legal[i]), legal: w.legal, means: w.hits.map(mean), make: mean(w.hits[b]), margin: m, z, groups: 1 + new Set(rest.map(i => w.hits[i].join(""))).size };
}

/** Plays deals and writes each puzzle found as a line of JSON. */
async function find(first, count, out) {
  const dds = await loadSolver(fs.readFileSync(new URL("vendor/dds/dds.wasm", ROOT)));
  const t0 = Date.now();
  let found = 0, weighed = 0;
  for (let k = first; k < first + count; k++) {
    const r = rng(k * 7919), pr = rng(k * 104729 + 1);
    let s = rules.deal({ options: { dealer: k % 4 }, rng: r });
    while (s.step === "bid") s = rules.act(s, rules.toMove(s), rules.bot(s, rules.toMove(s), { level: "medium", rng: r }), { rng: r, now: 0 });
    if (s.step !== "play") continue;
    const play = [];
    for (let i = 0; i < 60 && s.step !== "scored"; i++) {
      if (s.step === "trick") { s = rules.wake(s, { rng: r, now: 1e15 }); continue; }
      const seat = rules.toMove(s);
      if (s.tricks.length >= 6 && legalCards(s.hands[s.turn], s.trick).length >= 2) {
        weighed++;
        const quick = verdictOf(weigh(dds, s, seat, FIRST.deals, pr));
        if (quick && quick.margin >= FIRST.margin) {
          const v = verdictOf(weigh(dds, s, seat, CONFIRM.deals, pr));
          if (v && v.margin >= CONFIRM.margin && v.z >= CONFIRM.z && v.make >= CONFIRM.least) {
            const easy = playByRules(s, rng(k)), medium = chooseCard(s, seat, dds, { deals: 12, ms: 1e9, rng: rng(k + 1) }).card;
            const p = record(s, seat, play, v, { id: `${k}-${play.length}`, easyMiss: !v.ok.includes(easy), mediumMiss: !v.ok.includes(medium) });
            fs.appendFileSync(out, `${JSON.stringify(p)}\n`);
            found++;
          }
        }
      }
      const card = chooseCard(s, seat, dds, { ...PLAY, rng: pr }).card;
      play.push(card);
      s = rules.act(s, seat, { t: "card", card }, { rng: r, now: 0 });
    }
    if ((k - first + 1) % 10 === 0) console.log(`${k - first + 1} deals: ${found} puzzles of ${weighed} decisions weighed, ${((Date.now() - t0) / 1000 / (k - first + 1)).toFixed(1)} s a deal`);
  }
  console.log(`${count} deals: ${found} puzzles`);
}

/** A puzzle as kept: the seats turned so that its player (declarer for dummy's card) is South, and what was weighed. */
function record(s, seat, play, v, extra) {
  const turn = (seat + 4) % 4, to = x => (x - turn + 4) % 4;      // seat → South
  const dealt = [0, 1, 2, 3].map(i => handText(s.dealt[(i + turn) % 4]));
  const p = {
    id: extra.id, dealer: to(s.dealer), auction: s.auction.map(a => a.call).join(" "), dealt, play: play.map(cardText).join(" "),
    opts: v.legal.map(cardText), make: v.means.map(x => Math.round(x * 100)), best: cardText(v.best), ok: v.ok.map(cardText),
    margin: v.margin, z: v.z, groups: v.groups, easyMiss: extra.easyMiss, mediumMiss: extra.mediumMiss,
  };
  // the cards it may play and what each made, from the position put back together the way the page will
  const back = stateOf({ ...p, r: 0 });
  if (back.turn !== (s.turn - turn + 4) % 4 || handText(back.hands[back.turn]) !== handText(s.hands[s.turn])) throw new Error(`${p.id}: the position didn't come back`);
  p.why = motifsOf(back, v.best);
  p.cards = s.hands[s.turn].length;
  return p;
}

/** Rates every puzzle found and writes the bank: the kept fields, each rating a tenth of the bank. */
function merge(files) {
  const all = files.flatMap(f => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)));
  // harder: missed by the rule of thumb, missed by Medium, a closer call, more to choose from and to hold
  const hard = p => 2 * p.easyMiss + 2 * p.mediumMiss + 3 * (0.6 - Math.min(p.margin, 0.6)) + 0.2 * p.groups + 0.1 * p.cards;
  // two at most from a deal, a trick or more apart, the harder first and a defender's beside a declarer's where there's
  // one (one deal's decisions are much alike, and declarer has the most of them); three cards or more to choose among
  const byDeal = new Map();
  for (const p of all.filter(q => q.cards >= 3)) { const d = p.id.split("-")[0]; if (!byDeal.has(d)) byDeal.set(d, []); byDeal.get(d).push(p); }
  const uniq = [], at = p => p.play.split(" ").length, declares = p => stateOf(p).contract.declarer === 0;
  for (const list of byDeal.values()) {
    const sorted = list.sort((a, b) => hard(b) - hard(a)), first = sorted[0];
    const apart = sorted.filter(p => Math.abs(at(p) - at(first)) >= 4), other = apart.find(p => declares(p) !== declares(first)) || apart[0];
    uniq.push(first, ...(other ? [other] : []));
  }
  uniq.sort((a, b) => hard(a) - hard(b) || (a.id < b.id ? -1 : 1));
  const out = uniq.map((p, i) => ({ id: p.id, r: 1 + Math.floor((i * 10) / uniq.length), dealer: p.dealer, auction: p.auction, dealt: p.dealt, play: p.play,
    n: CONFIRM.deals, opts: p.opts, make: p.make, best: p.best, ok: p.ok, why: p.why }));
  const text = `// Contract's puzzle rush (contract-rush.js): ${out.length} decisions late in deals the computer players bid and played,\n` +
    `// where one card makes or beats the contract clearly more often than the rest. Written by tools/contract-puzzles.mjs merge.\n` +
    `export const PUZZLES = [\n${out.map(p => `  ${JSON.stringify(p)},`).join("\n")}\n];\n`;
  fs.writeFileSync(new URL("contract-puzzles.js", ROOT), text);
  const by = Array.from({ length: 10 }, (_, r) => out.filter(p => p.r === r + 1).length);
  console.log(`${out.length} puzzles, by rating ${by.join(" ")}; declaring ${out.filter(p => stateOf(p).contract.declarer === 0).length}`);
}
