// Hong's arena: computer players against each other over the same deals, every player in every seat (each deal played
// four times, the seats rotated), so luck evens out and only play shows. Prints each player's average points a hand,
// its win and deal-in rates. Run: node tools/hong-arena.mjs [deals] [unused] ['{"danger":1.5}' | other-bot.js]: with a
// tuning, the bot as it is plays that variant of itself, two seats each; with a path, it plays that other version of
// the bot; without either, three plain efficiency players. ARENA_SEED moves the deals (9000 by default).
import * as E from "../hong-engine.js";
import * as B from "../hong-bot.js";

const deals = Number(process.argv[2] || 12), seed0 = Number(process.env.ARENA_SEED || 9000);
const opts = { flowers: true, minFan: 3 };

// the plain efficiency player: the tile that leaves the fewest tiles from ready (most live tiles to fix it), wins when
// it can, calls only a value honour's pung, never defends
function plain(state, seat) {
  const l = E.legal(state, seat);
  const win = l.find(a => a.t === "win" || a.t === "flowers");
  if (win) return win;
  if (state.phase !== "act") {
    const v = B.view(state, seat);
    const p = l.find(a => a.t === "pung" && (E.isDragon(a.k) || a.k - 27 === v.wind || a.k - 27 === v.round));
    return p || { t: "pass" };
  }
  const v = B.view(state, seat), c = E.counts(v.hand);
  let best = null;
  for (const k of new Set(v.hand)) {
    c[k]--;
    const sh = B.shanten(c, v.melds.length);
    let uk = 0;
    for (let x = 0; x < 34; x++) { if (!v.unseen[x]) continue; c[x]++; if (B.shanten(c, v.melds.length) < sh) uk += v.unseen[x]; c[x]--; }
    c[k]++;
    const score = -sh * 100 + uk - (E.isHonour(k) ? -0.5 : 0);
    if (!best || score > best.score) best = { k, score };
  }
  return { t: "discard", k: best.k };
}
const smart = (bot, tune) => (state, seat) => bot.decide(state, seat, { tune: { ...bot.TUNE, ...tune } }).action;
// the lineup: two players' names and their tunings, two seats each (or the bot against three plain players)
const arg = process.argv[4] || "";
const other = arg.endsWith(".js") ? await import(new URL(arg, `file://${process.cwd()}/`).href) : null;
const variant = other ? {} : arg ? JSON.parse(arg) : null;
const players = variant ? { base: smart(B, {}), variant: smart(other || B, variant) } : { smart: smart(B, {}), plain };
const lineup = variant ? ["base", "variant", "base", "variant"] : ["smart", "plain", "plain", "plain"];
const tally = Object.fromEntries(Object.keys(players).map(p => [p, { points: 0, hands: 0, wins: 0, dealIns: 0 }]));
const t0 = Date.now();
for (let d = 0; d < deals; d++) {
  for (let rot = 0; rot < 4; rot++) {
    const who = [0, 1, 2, 3].map(s => lineup[(s + rot) % 4]);
    const st = E.deal({ seed: seed0 + d, dealer: d % 4, opts });
    for (let guard = 0; guard < 3000 && st.phase !== "over"; guard++) {
      const seat = E.waitingOn(st)[0];
      const a = players[who[seat]](st, seat);
      E.act(st, seat, a);
    }
    for (let s = 0; s < 4; s++) {
      const t = tally[who[s]];
      t.points += st.result.pay[s]; t.hands++;
      if (st.result.kind === "win" && st.result.seat === s) t.wins++;
      if (st.result.kind === "win" && st.result.from === s) t.dealIns++;
    }
  }
  process.stdout.write(`deal ${d + 1}/${deals}  ${((Date.now() - t0) / 1000).toFixed(0)} s\r`);
}
console.log();
for (const [p, t] of Object.entries(tally)) console.log(`${p.padEnd(6)} ${(t.points / t.hands).toFixed(1).padStart(7)} points a hand, wins ${(100 * t.wins / t.hands).toFixed(1)}%, deals in ${(100 * t.dealIns / t.hands).toFixed(1)}% (${t.hands} hands)`);
