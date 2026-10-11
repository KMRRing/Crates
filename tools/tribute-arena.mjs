// Tribute's arena: two kinds of player as partnerships over the same deals, each deal played twice with the sides
// swapped, so the cards even out and only the play shows; every second deal starts from tribute at a random level, so
// the wilds, the levels and the return come into it. A hand scores its level swing (+3/+2/+1 to the side that went out
// first, the same against the other). Run:
//   node tools/tribute-arena.mjs [deals] [other]
// other: greedy (each leads its lowest card or pair, beats whatever it can with the least, never yields to its
// partner and never bombs), medium or hard (the bot at that strength), or a path to another version of the bot.
// ARENA_SKILL: the bot's own strength (hard). ARENA_SEARCH: how many sampled deals the bot looks ahead in (0: none;
// the game uses 32, in under half a second). ARENA_SEED moves the deals (70000).
import * as E from "../tribute-engine.js";
import * as B from "../tribute-bot.js";

const deals = Number(process.argv[2] || 100), arg = process.argv[3] || "greedy", seed0 = Number(process.env.ARENA_SEED || 70000);
const skill = process.env.ARENA_SKILL || "hard", search = Number(process.env.ARENA_SEARCH || 0);
const other = arg.endsWith(".js") ? await import(new URL(arg, `file://${process.cwd()}/`).href) : null;
function greedy(st, seat) {
  if (E.asked(st, seat) === "return") { const ok = E.returnable(st.hands[seat], st.level); return { t: "return", card: ok[0] }; }
  const hand = st.hands[seat], level = st.level;
  if (!st.top) {
    // lead: the lowest pair if any, else the lowest single
    const byRank = {};
    for (const id of hand) { const v = E.valueOf(id, level); (byRank[v] ||= []).push(id); }
    const vs = Object.keys(byRank).map(Number).sort((a, b) => a - b);
    const pair = vs.find(v => byRank[v].length >= 2 && v < 16);
    return { t: "play", cards: pair !== undefined ? byRank[pair].slice(0, 2) : [byRank[vs[0]][0]] };
  }
  const c = B.candidates(hand, level, st.top.reading).filter(x => !x.reading.bomb).sort((a, b) => a.reading.key - b.reading.key)[0];
  return c ? { t: "play", cards: c.cards } : { t: "pass" };
}
const players = {
  bot: (st, s, d) => B.decide(st, s, { skill, search, seed: s + 1 + d * 4 }).action,
  other: other ? (st, s, d) => other.decide(st, s, { seed: s + 1 + d * 4 }).action
    : arg === "medium" || arg === "hard" ? (st, s, d) => B.decide(st, s, { skill: arg, seed: s + 1 + d * 4 }).action : greedy,
};
let swing = 0, sq = 0, hands = 0, wins = 0, doubles = 0;
const t0 = Date.now();
for (let d = 0; d < deals; d++) {
  // the deal's setting, the same for both halves: the first hand of a match, or a later one at a random level
  const r = E.rng(seed0 + d * 13 + 5);
  let game = { v: 1, opts: E.DEFAULTS, levels: [2, 2], declarer: -1, handNo: 0, lastOrder: null, results: [] };
  if (d % 2) {
    const order = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const lvl = 2 + Math.floor(r() * 13), behind = 2 + Math.floor(r() * 13), decl = E.teamOf(order[0]);
    game = { ...game, levels: decl === 0 ? [lvl, behind] : [behind, lvl], declarer: decl, handNo: 1, lastOrder: order };
  }
  let pair = 0;
  for (const botTeam of [0, 1]) {
    const st = E.deal(game, seed0 + d);
    for (let g = 0; g < 5000 && st.phase !== "over"; g++) {
      const seat = E.waitingOn(st)[0];
      E.act(st, seat, players[E.teamOf(seat) === botTeam ? "bot" : "other"](st, seat, d));
    }
    const res = st.result, mine = res.team === botTeam;
    pair += mine ? res.gain : -res.gain; hands++;
    if (mine) { wins++; if (res.gain === 3) doubles++; }
  }
  swing += pair; sq += pair * pair;
  process.stdout.write(`deal ${d + 1}/${deals}  ${((Date.now() - t0) / 1000).toFixed(0)} s\r`);
}
const mean = swing / deals, se = Math.sqrt(Math.max(0, sq / deals - mean * mean) / deals);
console.log(`\nthe bot (${skill}${search ? `, looking ahead in ${search} deals` : ""}): ${(mean / 2).toFixed(2)} ± ${(se / 2).toFixed(2)} levels a hand, first out in ${(100 * wins / hands).toFixed(1)}% (${(100 * doubles / hands).toFixed(1)}% one-two), ${hands} hands against ${other ? arg : arg === "medium" || arg === "hard" ? `the bot at ${arg}` : "greedy players"}`);
