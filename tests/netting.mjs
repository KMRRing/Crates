// Netting's rules (netting-engine.js): the deal from a seed, a booking (to another house, the game booked from left as
// it was), a loop netted out (both ways between two houses, round three, the loop cancelling most first), never a loop
// left standing, the points, a default (its debts written off, a life), a new hand after three, obligations growing,
// interest on what's left standing, contagion (a default cutting its creditors' limits, and tipping them over), the end
// at the third default, a game saved and opened again, and whole games played out to their end.
import { HOUSES, N, HAND, LIMIT, LIVES, PACE, INTEREST, FLOOR, largest, newGame, upgrade, owed, net, worth, book, moves } from "../netting-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const e = (i, j) => i * N + j;
/** What's owed, drawn by hand: { "i>j": amount }. */
const owes = map => { const o = new Array(N * N).fill(0); for (const [k, a] of Object.entries(map)) { const [i, j] = k.split(">").map(Number); o[e(i, j)] = a; } return o; };
const game = (map, hand, extra = {}) => Object.assign(newGame(1), { owes: owes(map), hand }, extra);
/** Whether any loop stands among the obligations. */
function looped(o) {
  const state = new Array(N).fill(0), visit = i => {
    state[i] = 1;
    for (let j = 0; j < N; j++) if (o[e(i, j)] > 0 && (state[j] === 1 || (state[j] === 0 && visit(j)))) return true;
    state[i] = 2;
    return false;
  };
  return [...Array(N).keys()].some(i => state[i] === 0 && visit(i));
}

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), hands = new Set([...Array(10).keys()].map(k => JSON.stringify(newGame(k).hand)));
  check(JSON.stringify(a) === JSON.stringify(b) && hands.size > 5, "the same seed deals the same game, another seed another");
  check(a.owes.every(x => x === 0) && a.hand.length === HAND && a.hand.every(h => h.from >= 0 && h.from < N && h.amount >= 1 && h.amount <= largest(0)) && a.lives === LIVES && HOUSES.length === 6, "six houses owing nothing, three obligations in hand, three lives");
}

// ---------- a booking ----------
{
  const s = game({}, [{ from: 0, amount: 3 }, { from: 2, amount: 1 }, { from: 4, amount: 2 }]), r = book(s, 0, 1);
  check(r.state.owes[e(0, 1)] === 3 && owed(r.state.owes, 0) === 3 && r.gain === 0 && r.state.hand[0] === null && r.state.booked === 1, "an obligation booked to a house: the debtor owes it that much");
  check(s.owes[e(0, 1)] === 0 && s.hand[0] !== null, "the game booked from is left as it was");
  let threw = 0;
  try { book(s, 0, 0); } catch { threw++; }
  try { book(r.state, 0, 2); } catch { threw++; }
  check(threw === 2 && moves(s).length === HAND * (N - 1), "not to its own debtor, nor from an empty place in the hand: five houses for each of three");
  check(book(game({ "0>1": 2 }, [{ from: 0, amount: 1 }, null, null]), 0, 1).state.owes[e(0, 1)] === 3, "more owed to the same house adds up");
}

// ---------- loops ----------
{
  const two = net(owes({ "0>1": 3, "1>0": 2 }), 1, 0);
  check(two.gross === 4 && two.owes[e(0, 1)] === 1 && two.owes[e(1, 0)] === 0 && two.loops.length === 1, "owing each other: both pay down by the smaller, which goes; four cancelled");
  const s = game({ "0>1": 2, "1>2": 3 }, [{ from: 2, amount: 2 }, null, null]), r = book(s, 0, 0);
  check(r.gross === 6 && r.gain === worth(6) && r.state.score === 360 && r.state.owes[e(0, 1)] === 0 && r.state.owes[e(1, 2)] === 1 && r.state.owes[e(2, 0)] === 0, "GVA owes LON owes SIN owes GVA: each leg pays down by 2, six cancelled, 360");
  check(r.loops[0].houses.join() === "2,0,1,2", "the loop, from the debtor round to it again");
  const first = net(owes({ "1>0": 2, "1>2": 2, "2>0": 2, "0>1": 2 }), 0, 1);
  check(first.loops[0].houses.length === 4 && first.gross === 6 && first.owes[e(1, 0)] === 2, "of two loops, the one cancelling most goes first: three legs before two");
  let z = 5, ok = true;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let t = newGame(9);
  for (let k = 0; k < 300 && !t.over; k++) { const all = moves(t), m = all[Math.floor(rnd() * all.length)]; t = book(t, m.slot, m.to).state; if (looped(t.owes)) ok = false; }
  check(ok, "after every booking no loop is left standing");
  check(worth(4) === 160 && worth(10) === 1000 && worth(18) === 3240, "ten times the square of what's cancelled: a long loop scores most");
}

// ---------- a default ----------
{
  const s = game({ "3>4": 9, "3>1": 1 }, [{ from: 3, amount: 2 }, null, { from: 0, amount: 1 }]), r = book(s, 0, 5);
  check(r.defaulted.join() === "3" && r.state.lives === LIVES - 1 && owed(r.state.owes, 3) === 0, `a house owing more than ${LIMIT} defaults: its debts written off, a life`);
  const saved = book(game({ "3>4": 9, "4>5": 4 }, [{ from: 5, amount: 1 }, null, { from: 0, amount: 1 }]), 0, 3);
  check(saved.defaulted.length === 0 && saved.state.lives === LIVES, "netting first can keep a house within its limit");
  check(book(game({ "3>4": 9 }, [{ from: 3, amount: 1 }, null, { from: 0, amount: 1 }]), 0, 4).defaulted.length === 0, `owing exactly ${LIMIT} is within it`);
}

// ---------- contagion ----------
{
  // HOU owes LON 4 and RTM 5, LON owes SIN 7: HOU books 2 more to SHA and defaults, LON's limit falls to 6, under what
  // it owes
  const s = game({ "3>1": 4, "3>4": 5, "1>2": 7 }, [{ from: 3, amount: 2 }, null, { from: 0, amount: 1 }]), r = book(s, 0, 5);
  check(r.defaulted.join() === "3,1" && r.state.lives === LIVES - 2 && owed(r.state.owes, 1) === 0, "a default cuts each creditor's limit by what it was owed, and can tip one into default too");
  check(r.state.limits.join() === `${LIMIT},${LIMIT},${FLOOR},${LIMIT},${FLOOR},${LIMIT - 2}`, `a defaulter's limit is whole again; every creditor's is cut, the one just booked to as well, none below ${FLOOR}`);
  const held = book(game({ "3>1": 4, "3>4": 5, "1>2": 6 }, [{ from: 3, amount: 2 }, null, { from: 0, amount: 1 }]), 0, 5);
  check(held.defaulted.join() === "3" && held.state.limits[1] === 6 && owed(held.state.owes, 1) === 6, "owing exactly its cut limit, a creditor holds");
  const next = book(Object.assign(structuredClone(held.state), { hand: [null, null, { from: 0, amount: 1 }] }), 2, 5);
  check(next.dealt && next.state.limits[1] === 7 && next.state.limits[4] === FLOOR + 1, "limits recover by one with each new hand");
}

// ---------- interest ----------
{
  // a hand of three that never touches GVA's debt to LON
  const others = () => [{ from: 2, amount: 1 }, { from: 3, amount: 1 }, { from: 4, amount: 1 }];
  const hand = s => { for (let k = 0; k < HAND; k++) s = book(s, k, 5).state; return s; };
  let s = game({ "0>1": 2 }, others()), r = null;
  for (let k = 1; k < INTEREST; k++) s = Object.assign(hand(s), { hand: others() });
  check(s.owes[e(0, 1)] === 2 && s.age[e(0, 1)] === INTEREST - 1, `an obligation left standing ages a hand at a time (${INTEREST - 1} hands)`);
  s = book(book(s, 0, 5).state, 1, 5).state;
  r = book(s, 2, 5);
  check(r.dealt.interest.includes(e(0, 1)) && r.state.owes[e(0, 1)] === 3 && r.state.age[e(0, 1)] === 0, `left for ${INTEREST} hands, it grows by one, and its clock starts again`);
  check(!r.dealt.interest.includes(e(2, 5)) && r.state.age[e(2, 5)] === 1, "what was added to this hand isn't charged");
  const old = game({ "0>1": 3, "1>2": 2 }, [{ from: 2, amount: 1 }, null, { from: 4, amount: 1 }], { age: Object.assign(new Array(N * N).fill(0), { [e(0, 1)]: 3, [e(1, 2)]: 3 }) });
  const paid = book(old, 0, 0).state;
  check(paid.owes[e(0, 1)] === 2 && paid.age[e(0, 1)] === 0 && paid.owes[e(1, 2)] === 1 && paid.age[e(1, 2)] === 0, "netting an obligation down starts its clock again");
  const tipped = book(game({ "0>1": 10 }, [{ from: 2, amount: 1 }, null, null], { age: Object.assign(new Array(N * N).fill(0), { [e(0, 1)]: INTEREST - 1 }) }), 0, 3);
  check(tipped.dealt.defaulted.join() === "0" && tipped.state.lives === LIVES - 1 && tipped.table.owes[e(0, 1)] === 10, "interest can tip a house past its limit as the new hand comes");
  const was = newGame(3);
  delete was.age; delete was.limits;
  const up = upgrade(was);
  check(up.age.length === N * N && up.limits.every(l => l === LIMIT) && !("age" in was) && upgrade(up) === up, "a game saved before interest and contagion is given them");
}

// ---------- hands and pace ----------
{
  let s = game({}, [{ from: 0, amount: 1 }, { from: 1, amount: 1 }, { from: 2, amount: 1 }], { hands: 1 });
  s = book(s, 0, 3).state;
  s = book(s, 1, 3).state;
  const r = book(s, 2, 3);
  check(r.dealt && r.state.hand.every(Boolean) && r.state.hands === 2, "the third booked, three more come");
  check(largest(0) === 2 && largest(10) === 3 && largest(30) === 4 && largest(50) === 5 && largest(100) === 6 && PACE.length === 5, "obligations of one or two at first, up to six as the game goes on");
}

// ---------- the end ----------
{
  const r = book(game({ "3>4": 9, "3>1": 1 }, [{ from: 3, amount: 2 }, null, null], { lives: 1 }), 0, 5);
  check(r.over && r.state.over && r.state.lives === 0 && !r.dealt, "the third default ends the game, with no new hand");
  let threw = false;
  try { book(r.state, 1, 2); } catch { threw = true; }
  check(threw, "nothing is booked once it's over");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 8; k++) { const m = moves(s)[(k * 7) % moves(s).length]; s = book(s, m.slot, m.to).state; }
  const again = JSON.parse(JSON.stringify(s)), m = moves(s)[0];
  check(JSON.stringify(book(s, m.slot, m.to)) === JSON.stringify(book(again, m.slot, m.to)), "a game saved and opened again goes on as it would have");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  let z = 3;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const strain = s => [...Array(N).keys()].reduce((a, i) => a + (owed(s.owes, i) / s.limits[i]) ** 2, 0);
  // how many bookings would close a loop: pairs of houses with a way from one back to the other
  const potential = o => { let n = 0; for (let j = 0; j < N; j++) { const seen = new Set([j]), st = [j]; while (st.length) { const a = st.pop(); for (let b = 0; b < N; b++) if (o[e(a, b)] > 0 && !seen.has(b)) { seen.add(b); st.push(b); } } n += seen.size - 1; } return n; };
  const random = [], thoughtful = [];
  for (let g = 0; g < 12; g++) {
    let s = newGame(100 + g);
    while (!s.over && s.booked < 3000) { const all = moves(s), m = all[Math.floor(rnd() * all.length)]; s = book(s, m.slot, m.to).state; }
    random.push(s.booked);
    let t = newGame(100 + g);
    while (!t.over && t.booked < 3000) {
      let best = null, bv = -Infinity;
      for (const m of moves(t)) { const o = book(t, m.slot, m.to), v = o.gain / 10 - 30 * strain(o.state) + 3 * potential(o.state.owes) - 400 * (o.defaulted.length + (o.dealt?.defaulted.length || 0)); if (v > bv) { bv = v; best = o; } }
      t = best.state;
    }
    thoughtful.push(t.booked);
  }
  check(median(random) < 90, `booking anywhere: three defaults in about ${median(random)} bookings`);
  check(median(thoughtful) > 2.5 * median(random) && Math.max(...thoughtful) < 3000, `booking to build loops and net them: about ${median(thoughtful)} bookings, and the obligations growing still end it`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("netting: the deal, a booking, loops, a default, contagion, interest, hands, the end, saving, whole games");
