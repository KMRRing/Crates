// The coach's words for a move (attaque-coach.js): plain cases said plainly (a shown piece taken, the Spy on the Marshal, a Miner
// on a Bomb, an attack on an unknown piece weighed in shares that add up, a piece taken out of reach, a piece covered, the
// network's odds and read of the game), and never a word that depends on a hidden kind of the other side's.
import { SIZE, ARMY, COUNT, KCH } from "../attaque-board.js";
import { think } from "../attaque-ai.js";
import { explain } from "../attaque-coach.js";
import { rules, viewOf } from "../attaque-rules.js";
import { newRecord, applyMove, seeded, botMove } from "../seats.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const sq = name => (SIZE - Number(name.slice(1))) * SIZE + "abcdefghij".indexOf(name[0]);
const code = (a, b) => sq(a) * 100 + sq(b);
const pad = v => String(v).padStart(2, "0");
/** A game in play from the pieces on the board: [side, kind (a character), square, flags ("s" shown, "m" moved)]; every other
 *  piece of each army was taken. */
function build(list, t = 0) {
  const pk = Array(2 * ARMY).fill(""), at = Array(2 * ARMY).fill("--"), sn = Array(2 * ARMY).fill("1"), mv = Array(2 * ARMY).fill("1");
  const left = [COUNT.slice(), COUNT.slice()], next = [0, ARMY];
  for (const [side, ch, name, fl = ""] of list) {
    const id = next[side]++;
    pk[id] = ch; left[side][KCH.indexOf(ch)]--; at[id] = pad(sq(name)); sn[id] = fl.includes("s") ? "1" : "0"; mv[id] = fl.includes("m") ? "1" : "0";
  }
  for (const side of [0, 1]) for (let k = 0; k < COUNT.length; k++) for (; left[side][k] > 0; left[side][k]--) pk[next[side]++] = KCH[k];
  return { seats: 2, red: 0, phase: "play", rdy: "11", pk: pk.join(""), at: at.join(""), sn: sn.join(""), mv: mv.join(""), t, moves: [], quiet: 0 };
}
const say = (s, a, b, extra = {}) => explain(viewOf(s, s.t), code(a, b), { rng: seeded(1), ...extra });
const base = [[0, "F", "a1"], [1, "F", "j10"], [1, "B", "i10", "s"], [1, "B", "j9", "s"]];

let w = say(build([...base, [0, "7", "e4"], [1, "4", "e5", "sm"]]), "e4", "e5");
check(/^Major e4 to e5: takes their Sergeant, which your Major beats\.$/.test(w), `a shown piece taken: "${w}"`);
w = say(build([...base, [0, "S", "e4"], [1, "T", "e5", "sm"]]), "e4", "e5");
check(/the Spy wins when it attacks/.test(w), `the Spy on the Marshal: "${w}"`);
w = say(build([...base, [0, "3", "h9", "m"], [1, "4", "a8", "sm"]]), "h9", "i9");
check(/goes after|heads for|closes in|brings|pulls|waiting|lane|new piece/.test(w), `a quiet move has a reason: "${w}"`);
w = say(build([...base, [0, "3", "i9", "m"], [1, "4", "a8", "sm"]]), "i9", "i10");
check(/^Miner i9 to i10: clears their Bomb: only a Miner can\.$/.test(w), `a Miner on a Bomb: "${w}"`);
// an unknown piece that has moved: its shares add up, and it's no Bomb
const hidden = build([...base, [0, "8", "e4", "m"], [1, "5", "e5", "m"], [1, "9", "c8", "m"], [1, "2", "g7", "m"]]);
w = say(hidden, "e4", "e5");
const shares = [...w.matchAll(/(\d+)%/g)].map(m => Number(m[1]));
check(/attacks an unknown piece/.test(w) && /no Bomb/.test(w) && Math.abs(shares.reduce((a, b) => a + b, 0) - 100) <= 2, `an unknown piece weighed in shares that add up: "${w}"`);
w = say(build([...base, [0, "7", "e4", "s"], [1, "9", "e5", "sm"]]), "e4", "d4");
check(/takes it out of reach of their General/.test(w), `out of reach: "${w}"`);
w = say(build([...base, [0, "9", "e4", "m"], [0, "5", "d5", "s"], [1, "7", "d6", "sm"]]), "e4", "e5");
check(/covers your Lieutenant: if their Major takes it, your General takes it back/.test(w), `a piece covered: "${w}"`);
w = say(build([...base, [0, "7", "e4"], [1, "4", "e5", "sm"]]), "e4", "e5", { odds: 0.82, value: [0.2, 0.15, 0.65] });
check(/The coach's clear first choice \(82%\); it gives you 65% to win, 15% to draw\.$/.test(w), `the network's odds and read: "${w}"`);

// the words never depend on the other side's hidden kinds: shuffle them and nothing changes
let blind = true, n = 0;
let G = newRecord(rules, { seats: 2, seed: 21, options: {} });
for (const seat of [0, 1]) G = applyMove(rules, G, seat, botMove(rules, G, seat, "medium")).G;
const rng = seeded(7);
for (let ply = 0; ply < 200 && !G.state.over; ply++) {
  const s = G.state, m = think(viewOf(s, s.t), "easy", { rng }).code;
  if (ply % 9 === 0) {
    const them = 1 - s.t, pk = [...s.pk], free = [];
    for (let i = them * ARMY; i < them * ARMY + ARMY; i++) if (s.sn[i] === "0" && s.at.slice(2 * i, 2 * i + 2) !== "--") free.push(i);
    const kinds = free.map(i => pk[i]).reverse();
    free.forEach((i, j) => { pk[i] = kinds[j]; });
    const a = explain(viewOf(s, s.t), m, { rng: seeded(ply) }), b = explain(viewOf({ ...s, pk: pk.join("") }, s.t), m, { rng: seeded(ply) });
    if (a !== b) blind = false;
    n++;
  }
  G = applyMove(rules, G, rules.toMove(s), m).G;
}
check(blind && n > 10, `the words are the same whatever the other side's hidden pieces are (${n} positions)`);

if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log("\nall passed");
