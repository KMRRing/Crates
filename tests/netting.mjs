// Netting's rules (netting-engine.js) and levels (netting-levels.js): the deal from a seed, currencies (a booking direct
// where houses share one, else through a middle house adding both legs), a loop netted out (the loop cancelling most
// first, never one left standing), the points, a default by net debt and what it does to the creditors, lines, interest,
// each kind of charter, a game saved and opened again, every level valid, and bots clearing the early levels.
import { INTEREST, LINE_COST, FLOOR, PACE, largest, newGame, net, owed, recv, routes, reach, moves, settle, worth, book, wipe, goal, stars, validate } from "../netting-engine.js";
import { SECTIONS, LEVELS, ENDLESS, CURRENCIES, levelById } from "../netting-levels.js";
import { play } from "./netting-bots.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
/** A level for a test: houses by their currencies. */
const level = (cur, extra = {}) => ({ id: "t", name: "t", houses: cur.map((c, i) => ({ n: "HQ" + i, cur: c })), limit: 10, hands: 6, par: 6, charter: { type: "gross", n: 999 }, ...extra });
/** A game of it with what's owed drawn by hand ({ "i>j": amount }) and the obligations in hand. */
function game(lvl, map, hand, extra = {}) {
  const s = newGame(lvl, 1), N = lvl.houses.length;
  for (const [k, a] of Object.entries(map)) { const [i, j] = k.split(">").map(Number); s.owes[i * N + j] = a; }
  s.hand = hand;
  return Object.assign(s, extra);
}
const one = n => level(Array.from({ length: n }, () => [0]));
const pad = (...h) => [...h, null, null].slice(0, 3);
/** Whether any loop stands among the obligations. */
function looped(o, N) {
  const state = new Array(N).fill(0), visit = i => {
    state[i] = 1;
    for (let j = 0; j < N; j++) if (o[i * N + j] > 0 && (state[j] === 1 || (state[j] === 0 && visit(j)))) return true;
    state[i] = 2;
    return false;
  };
  return [...Array(N).keys()].some(i => state[i] === 0 && visit(i));
}

// ---------- the deal ----------
{
  const lvl = levelById("1-1"), a = newGame(lvl, 7), b = newGame(lvl, 7), hands = new Set([...Array(10).keys()].map(k => JSON.stringify(newGame(lvl, k).hand)));
  check(JSON.stringify(a) === JSON.stringify(b) && hands.size > 5, "the same seed deals the same game, another seed another");
  check(a.hand.length === 3 && a.hand.every(h => h.from >= 0 && h.from < 4 && h.amount >= 1 && h.amount <= 3) && a.lives === 1 && a.status === "play" && a.owes[0 * 4 + 1] === 2, "three obligations in hand, the level's debts to begin with, its lives");
  const heavy = SECTIONS[0].levels[0], loads = [];
  for (let sd = 0; sd < 40; sd++) { const g = newGame(heavy, sd); for (let i = 0; i < 4; i++) loads.push(g.hand.filter(h => h.from === i).reduce((x, h) => x + h.amount, 0)); }
  check(Math.max(...loads) <= heavy.limit - 3, "one hand never loads one house past its limit less three");
}

// ---------- currencies ----------
{
  const lvl = level([[0], [0, 1], [1], [2, 1]]), s = game(lvl, {}, pad({ from: 0, amount: 2 }));
  check(routes(s, 0, 1).join() === "" && routes(s, 1, 2).join() === "" && reach(s, 0)[1].join() === "" , "houses sharing a currency book direct: no middle house");
  check(routes(s, 0, 2).join() === "1" && routes(s, 0, 3).join() === "1", "with none in common, through a house that shares one with each");
  const direct = book(lvl, s, { slot: 0, to: 1, via: null }), through = book(lvl, s, { slot: 0, to: 2, via: 1 });
  check(direct.state.owes[0 * 4 + 1] === 2 && direct.edges.length === 1, "a direct booking adds the amount to one obligation");
  check(through.state.owes[0 * 4 + 1] === 2 && through.state.owes[1 * 4 + 2] === 2 && through.edges.length === 2, "through a middle house, the amount is added to both legs");
  let threw = 0;
  try { book(lvl, s, { slot: 0, to: 1, via: 2 }); } catch { threw++; }
  try { book(lvl, s, { slot: 0, to: 2, via: null }); } catch { threw++; }
  try { book(lvl, s, { slot: 1, to: 1, via: null }); } catch { threw++; }
  check(threw === 3 && s.owes.every(x => x === 0), "no middle house where a direct booking exists, none where it can't carry, not from an empty place; the game booked from is left as it was");
  const wide = game(level([[0], [0, 1], [1], [0, 2], [2]]), {}, pad({ from: 0, amount: 1 }));
  check(reach(wide, 0)[2].join() === "1" && reach(wide, 0)[4].join() === "3" && moves(level([[0], [0, 1], [1], [0, 2], [2]]), wide).length === 4, "moves lists every booking with its route");
  const closed = level([[0], [1], [2]]);
  check(validate(closed).some(m => m.includes("cannot be owed")), "a level with two houses that cannot reach each other is invalid");
}

// ---------- loops ----------
{
  const owes = (N, map) => { const o = new Array(N * N).fill(0); for (const [k, a] of Object.entries(map)) { const [i, j] = k.split(">").map(Number); o[i * N + j] = a; } return o; };
  const two = owes(3, { "0>1": 3, "1>0": 2 }), r2 = settle(two, 3);
  check(r2.gross === 4 && two[0 * 3 + 1] === 1 && two[1 * 3 + 0] === 0 && r2.loops.length === 1, "owing each other: both pay down by the smaller, which goes; four cancelled");
  const lvl = one(3), s = game(lvl, { "0>1": 2, "1>2": 3 }, pad({ from: 2, amount: 2 })), r = book(lvl, s, { slot: 0, to: 0, via: null });
  check(r.gross === 6 && r.gain === worth(6) && r.state.score === 360 && r.state.owes[0 * 3 + 1] === 0 && r.state.owes[1 * 3 + 2] === 1 && r.state.owes[2 * 3 + 0] === 0, "a loop of three each pay down by 2: six cancelled, 360");
  check(r.loops[0].houses.length === 3 && r.state.gross === 6 && r.state.loops === 1 && r.state.span === 3, "the loop, its houses; gross, loops netted and the longest loop are counted");
  const first = owes(4, { "1>0": 2, "1>2": 2, "2>0": 2, "0>1": 2 }), f = settle(first, 4);
  check(f.loops[0].houses.length === 3 && f.gross === 6 && f.loops.length === 1 && first[1 * 4 + 0] === 2, "of two loops, the one cancelling most goes first: three legs before two");
  const through = level([[0], [0, 1], [1]]), t = game(through, { "2>1": 2, "1>0": 2 }, pad({ from: 0, amount: 2 }));
  check(book(through, t, { slot: 0, to: 2, via: 1 }).gross === 8, "a routed booking can close a loop through its middle house");
  let z = 5, ok = true;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let g = newGame(levelById("2-1"), 9);
  for (let k = 0; k < 120 && g.status === "play"; k++) { const all = moves(levelById("2-1"), g), m = all[Math.floor(rnd() * all.length)]; g = book(levelById("2-1"), g, m).state; if (looped(g.owes, 6)) ok = false; }
  check(ok, "after every booking no loop is left standing");
  check(worth(4) === 160 && worth(10) === 1000 && worth(18) === 3240, "ten times the square of what's cancelled: a long loop scores most");
}

// ---------- a default ----------
{
  const lvl = one(5);
  // net debt: HQ0 owes 9 and is owed nothing; 2 more tips it past 10
  const s = game(lvl, { "0>1": 9 }, pad({ from: 0, amount: 2 }, { from: 2, amount: 1 })), r = book(lvl, s, { slot: 0, to: 2, via: null });
  check(r.defaulted.join() === "0" && r.state.lives === 0 && r.state.status === "lost" && owed(r.state, 0) === 0 && r.state.why === "A house defaulted.", "a house whose net debt passes its limit defaults: its debts written off, a life; with one life, the game is lost");
  const held = book(lvl, game(lvl, { "0>1": 9 }, pad({ from: 0, amount: 1 })), { slot: 0, to: 2, via: null });
  check(held.defaulted.length === 0 && net(held.state, 0) === 10, "owing exactly the limit is within it");
  const owedBack = book(lvl, game(lvl, { "0>1": 9, "3>0": 5 }, pad({ from: 0, amount: 4 })), { slot: 0, to: 2, via: null });
  check(owedBack.defaulted.length === 0 && owed(owedBack.state, 0) === 13 && net(owedBack.state, 0) === 8, "net debt counts what a house is owed: owing 13 and owed 5 is 8");
  // netting changes nobody's net debt: the same as if the booking had been laid and the loop left standing
  const loopy = game(lvl, { "0>1": 3, "1>2": 3 }, pad({ from: 2, amount: 3 })), laid = { ...loopy, owes: loopy.owes.slice() };
  laid.owes[2 * 5 + 0] += 3;
  const after = book(lvl, loopy, { slot: 0, to: 0, via: null }).state;
  check(after.owes.every(x => x === 0) && [0, 1, 2].every(i => net(after, i) === net(laid, i)), "a loop nets out debts but changes no one's net debt: only who is owed moves it");
  // contagion with no rule of its own: HQ0 defaults, HQ1 loses the 8 it was owed and now carries 11
  const cascade = book(lvl, game(lvl, { "0>1": 8, "1>2": 11, "3>4": 1 }, pad({ from: 0, amount: 3 }, { from: 3, amount: 1 })), { slot: 0, to: 3, via: null });
  check(cascade.defaulted.join() === "0,1" && cascade.state.lives === 0, "a default writes off what it owed, so its creditors lose those receivables, and one carrying more than its limit goes too");
  const wiped = wipe(game(lvl, { "0>1": 4, "0>2": 3, "1>2": 1 }, []), 0);
  check(wiped.owes[0 * 5 + 1] === 0 && wiped.owes[0 * 5 + 2] === 0 && wiped.owes[1 * 5 + 2] === 1, "wipe takes one house's debts and leaves the rest");
  const lives = book(level([[0], [0], [0]], { lives: 3 }), game(level([[0], [0], [0]], { lives: 3 }), { "0>1": 9 }, pad({ from: 0, amount: 2 })), { slot: 0, to: 2, via: null });
  check(lives.state.lives === 2 && lives.state.status === "play", "a default costs one life of several");
}

// ---------- lines ----------
{
  const lvl = level([[0], [1], [0, 1]], { features: { lines: true } }), s = game(lvl, {}, pad({ from: 0, amount: 1 }));
  const open = moves(lvl, s).filter(m => m.line);
  check(open.length === 2 && open.every(m => (m.house === 0 && m.cur === 1) || (m.house === 1 && m.cur === 0)), "a line is a currency a house lacks");
  const r = book(lvl, s, { line: true, house: 0, cur: 1 });
  check(r.state.cur[0].join() === "0,1" && r.state.cap[0] === 10 - LINE_COST && r.state.hand[0] && r.state.hands === s.hands && routes(r.state, 0, 1).join() === "", "opening one costs two of the limit, uses no obligation, and makes the pair neighbours");
  check(!moves(level([[0], [1], [0, 1]]), s).some(m => m.line), "no lines in a level without them");
  const tight = game(lvl, { "0>2": 9 }, pad({ from: 1, amount: 1 }));
  check(!moves(lvl, tight).some(m => m.line && m.house === 0), "a house carrying more than its limit would allow can't open one");
  const low = game(lvl, {}, pad({ from: 0, amount: 1 }), { cap: [FLOOR + 1, 10, 10] });
  check(!moves(lvl, low).some(m => m.line && m.house === 0), `a limit never falls below ${FLOOR}`);
  let threw = false;
  try { book(lvl, s, { line: true, house: 0, cur: 0 }); } catch { threw = true; }
  check(threw, "a currency it already has isn't a line");
}

// ---------- interest ----------
{
  const lvl = level([[0], [0], [0], [0], [0]], { features: { interest: true }, hands: 20 });
  const others = () => pad({ from: 2, amount: 1 }, { from: 3, amount: 1 }, { from: 4, amount: 1 });
  const hand = (s, to) => { for (let k = 0; k < 3; k++) s = book(lvl, s, { slot: k, to, via: null }).state; return s; };
  let s = game(lvl, { "0>1": 2 }, others());
  for (let k = 1; k < INTEREST; k++) s = Object.assign(hand(s, 0 === 0 ? 1 : 0), { hand: others() });
  check(s.owes[0 * 5 + 1] === 2 && s.age[0 * 5 + 1] === INTEREST - 1, `an obligation left standing ages a hand at a time (${INTEREST - 1} hands)`);
  s = book(lvl, book(lvl, s, { slot: 0, to: 1, via: null }).state, { slot: 1, to: 1, via: null }).state;
  const r = book(lvl, s, { slot: 2, to: 1, via: null });
  check(r.dealt.interest.includes(0 * 5 + 1) && r.state.owes[0 * 5 + 1] === 3 && r.state.age[0 * 5 + 1] === 0, `left for ${INTEREST} hands, it grows by one, and its clock starts again`);
  const plain = book(level([[0], [0], [0]], { hands: 20 }), game(level([[0], [0], [0]], { hands: 20 }), { "0>1": 2 }, pad({ from: 2, amount: 1 }), { age: [0, INTEREST - 1, 0, 0, 0, 0, 0, 0, 0] }), { slot: 0, to: 1, via: null });
  check(plain.dealt.interest.length === 0 && plain.state.owes[1] === 2, "no interest in a level without it");
  const old = game(lvl, { "0>1": 3, "1>2": 2 }, pad({ from: 2, amount: 1 }, { from: 4, amount: 1 }), { age: Object.assign(new Array(25).fill(0), { 1: 3, 7: 3 }) });
  const paid = book(lvl, old, { slot: 0, to: 0, via: null }).state;
  check(paid.owes[1] === 2 && paid.age[1] === 0 && paid.owes[7] === 1 && paid.age[7] === 0, "netting an obligation down starts its clock again");
  const tipped = book(lvl, game(lvl, { "0>1": 10 }, pad({ from: 2, amount: 1 }), { age: Object.assign(new Array(25).fill(0), { 1: INTEREST - 1 }) }), { slot: 0, to: 3, via: null });
  check(tipped.dealt.defaulted.join() === "0" && tipped.state.lives === 0 && tipped.table.owes[1] === 10, "interest can tip a house past its limit as the new hand comes");
}

// ---------- charters ----------
{
  const sample = (type, n, extra = {}) => level([[0], [0], [0], [0]], { charter: { type, n }, ...extra });
  const ring = (lvl, owes) => game(lvl, owes, pad({ from: 2, amount: 2 }));
  const loopOf = lvl => book(lvl, ring(lvl, { "0>1": 2, "1>2": 2 }), { slot: 0, to: 0, via: null });
  check(loopOf(sample("gross", 6)).state.status === "won" && loopOf(sample("gross", 7)).state.status === "play", "gross: won the moment enough is cancelled");
  check(loopOf(sample("loops", 1)).state.status === "won" && loopOf(sample("loops", 2)).state.status === "play", "loops: won on the number netted");
  check(loopOf(sample("span", 3)).state.status === "won" && loopOf(sample("span", 4)).state.status === "play", "span: won on a loop through enough houses");
  const clear = sample("clear"), c = book(clear, ring(clear, { "0>1": 2, "1>2": 2 }), { slot: 0, to: 0, via: null });
  check(c.state.status === "won" && stars(clear, c.state) >= 1, "clear: won when nothing is owed");
  const hold = sample("hold", 6, { hands: 1 }), h = game(hold, { "0>1": 2, "1>2": 2 }, pad({ from: 2, amount: 2 }), { hands: 1 });
  check(book(hold, h, { slot: 0, to: 0, via: null }).state.status === "won", "hold: won at the last hand with enough cancelled");
  const short = book(hold, game(hold, {}, pad({ from: 2, amount: 2 }), { hands: 1 }), { slot: 0, to: 0, via: null }).state;
  check(short.status === "lost" && short.why.includes("0 of 6"), "hold: survived but short is lost");
  const out = sample("loops", 9, { hands: 1 }), o = book(out, game(out, {}, pad({ from: 2, amount: 2 }), { hands: 1 }), { slot: 0, to: 0, via: null }).state;
  check(o.status === "lost" && o.why.includes("hands"), "out of hands before the charter is met is lost");
  check(goal(sample("gross", 10), { gross: 4, loops: 0, span: 0, owes: [] }).frac === 0.4 && goal(ENDLESS, newGame(ENDLESS, 1)).frac === 0, "how far along the charter is");
  const par = sample("gross", 6, { par: 1 }), p = book(par, ring(par, { "0>1": 2, "1>2": 2 }), { slot: 0, to: 0, via: null }).state;
  check(stars(par, p) === 3 && stars(par, { ...p, booked: 3 }) === 2 && stars(par, { ...p, booked: 9 }) === 1 && stars(par, { ...p, status: "lost" }) === 0, "stars: par for three, a little over for two");
}

// ---------- saved and opened again ----------
{
  const lvl = levelById("3-1");
  let s = newGame(lvl, 42);
  for (let k = 0; k < 8; k++) { const all = moves(lvl, s), m = all[(k * 7) % all.length]; s = book(lvl, s, m).state; }
  const again = JSON.parse(JSON.stringify(s)), m = moves(lvl, s)[0];
  check(JSON.stringify(book(lvl, s, m)) === JSON.stringify(book(lvl, again, m)), "a game saved and opened again goes on as it would have");
  check(largest(0) === 2 && largest(10) === 3 && largest(30) === 4 && largest(50) === 5 && largest(100) === 6 && PACE.length === 5, "the endless game's obligations grow as it goes on");
}

// ---------- the levels ----------
{
  const all = [...LEVELS, ENDLESS], ids = new Set(all.map(l => l.id));
  check(ids.size === all.length && all.every(l => validate(l).length === 0), `${LEVELS.length} levels and the endless game, all valid: ${all.flatMap(validate).join("; ")}`);
  check(SECTIONS.length === 4 && LEVELS.every(l => l.seeds.length >= 20) && CURRENCIES.length === 3, "four sections, each level with games a bot was shown to win");
  check(SECTIONS[0].levels.every(l => l.houses.every(h => h.cur.join() === "0")) && SECTIONS[1].levels.every(l => !l.features) && SECTIONS[2].levels.every(l => l.features.lines && !l.features.interest) && SECTIONS[3].levels.every(l => l.features.interest), "each section adds one thing: currencies, then lines, then interest");
}

// ---------- bots ----------
{
  const early = ["1-1", "1-2", "1-3", "2-1"].map(levelById);
  let won = 0, tried = 0;
  for (const lvl of early) for (const sd of lvl.seeds.slice(0, 3)) { tried++; if (play(lvl, sd, "lookahead").status === "won") won++; }
  check(won === tried, `a player looking one move ahead clears the early levels on the games dealt (${won} of ${tried})`);
  const rest = LEVELS.filter(l => !early.includes(l));
  let more = 0;
  for (const lvl of rest) if (play(lvl, lvl.seeds[0], "lookahead").status === "won") more++;
  check(more === rest.length, `and the first game dealt of each other level (${more} of ${rest.length})`);
  const r1 = levelById("1-3");
  let rand = 0;
  for (let sd = 1; sd <= 10; sd++) if (play(r1, sd, "random").status === "won") rand++;
  check(rand <= 3, `booking anywhere seldom clears 1-3 (${rand} of 10)`);
  const lasts = bot => { const out = []; for (let sd = 1; sd <= 4; sd++) out.push(play(ENDLESS, sd, bot, null, 300).booked); return out.sort((a, b) => a - b)[2]; };
  const careless = lasts("random"), careful = lasts("balance");
  check(careful > 2 * careless && careless < 90, `endless: booking anywhere ends it in about ${careless} bookings, spreading net debt lasts ${careful}`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("netting: the deal, currencies, loops, a default, lines, interest, charters, saving, levels, bots");
