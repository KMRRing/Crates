// Tribute's arena: two kinds of player as partnerships over the same deals, each deal played twice with the teams
// swapped, so the cards even out and only the play shows. A hand scores its level swing (+3/+2/+1 to the side that
// went out first, the same against the other). Run: node tools/tribute-arena.mjs [deals] [other-bot.js | greedy]
// (the bot as it is against another version of itself, or against greedy players: each leads its lowest card or
// pair, beats whatever it can with the least, never yields to its partner and never bombs).
import * as E from "../tribute-engine.js";
import * as B from "../tribute-bot.js";

const deals = Number(process.argv[2] || 100), arg = process.argv[3] || "greedy", seed0 = Number(process.env.ARENA_SEED || 70000);
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
// ARENA_SEARCH: how many sampled deals the bot (not the other) looks ahead in, where it looks ahead at all
const search = Number(process.env.ARENA_SEARCH || 0);
const players = { bot: (st, s) => B.decide(st, s, { search, seed: s + 1 }).action, other: other ? (st, s) => other.decide(st, s).action : greedy };
let swing = 0, hands = 0, wins = 0, doubles = 0;
const t0 = Date.now();
for (let d = 0; d < deals; d++) {
  for (const botTeam of [0, 1]) {
    const st = E.deal({ v: 1, opts: E.DEFAULTS, levels: [2, 2], declarer: -1, handNo: 0, lastOrder: null, results: [] }, seed0 + d);
    for (let g = 0; g < 5000 && st.phase !== "over"; g++) {
      const seat = E.waitingOn(st)[0];
      E.act(st, seat, players[E.teamOf(seat) === botTeam ? "bot" : "other"](st, seat));
    }
    const r = st.result, mine = r.team === botTeam;
    swing += mine ? r.gain : -r.gain; hands++;
    if (mine) { wins++; if (r.gain === 3) doubles++; }
  }
  process.stdout.write(`deal ${d + 1}/${deals}  ${((Date.now() - t0) / 1000).toFixed(0)} s\r`);
}
console.log(`\nthe bot: ${(swing / hands).toFixed(2)} levels a hand, first out in ${(100 * wins / hands).toFixed(1)}% (${(100 * doubles / hands).toFixed(1)}% one-two), ${hands} hands against ${other ? arg : "greedy players"}`);
