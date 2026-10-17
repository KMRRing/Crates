// Orrery's rules (orrery-engine.js): the deal from a seed (no conjunction standing, the first planets foretold), what a
// conjunction is (three or more of a colour on a spoke, in neighbouring rings), a ring turned a place either way, a
// turn's conjunctions and their points, where the foretold land (their place, or the next empty one on), a landing
// making a conjunction, more foretold as the game goes on, syzygies (doubling) and comets (sweeping a spoke), the end
// when there's no room, a game saved and opened again, and whole games played out to their end.
import { RINGS, PLACES, START, COMET_EVERY, at, foretold, newGame, upgrade, conjunctions, syzygies, turned, turn, landing, worth, moves, filled } from "../orrery-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
/** An orrery drawn by hand: { "ring,place": colour }, everything else empty, and what's foretold. */
function sky(planets, coming = [], extra = {}) {
  const s = newGame(1);
  s.places = new Array(RINGS * PLACES).fill(-1);
  for (const [k, c] of Object.entries(planets)) { const [r, p] = k.split(",").map(Number); s.places[at(r, p)] = c; }
  return Object.assign(s, { coming }, extra);
}

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.places) !== JSON.stringify(c.places), "the same seed deals the same orrery, another seed another");
  check(filled(a) === START && conjunctions(a.places).length === 0 && [...Array(40).keys()].every(k => conjunctions(newGame(k).places).length === 0), `${START} planets, no deal with a conjunction standing`);
  check(a.coming.length === foretold(0) && a.coming.every(f => a.places[at(f.ring, f.place)] === -1), "the first planet foretold, on an empty place");
  check([...Array(40).keys()].every(k => { const s = newGame(k), t = s.places.slice(); for (const f of s.coming) t[at(f.ring, f.place)] = f.colour; return conjunctions(t).length === 0; }), "what's foretold makes no conjunction as things stand: a turn has to bring one about");
}

// ---------- conjunctions ----------
{
  check(conjunctions(sky({ "0,3": 2, "1,3": 2, "2,3": 2 }).places).join() === [at(0, 3), at(1, 3), at(2, 3)].join(), "three of a colour on a spoke, from the sun out");
  check(conjunctions(sky({ "1,5": 0, "2,5": 0, "3,5": 0 }).places).length === 3 && conjunctions(sky({ "0,5": 0, "1,5": 0, "2,5": 0, "3,5": 0 }).places).length === 4, "or further out, or all four");
  check(conjunctions(sky({ "0,1": 1, "1,1": 1, "3,1": 1 }).places).length === 0 && conjunctions(sky({ "0,1": 1, "1,1": 3, "2,1": 1 }).places).length === 0, "the rings must be neighbours, and alike all the way");
  check(conjunctions(sky({ "0,0": 1, "1,0": 1, "1,1": 1 }).places).length === 0, "a ring's own neighbours don't count: only spokes");
}

// ---------- a turn ----------
{
  const s = sky({ "2,11": 3, "2,4": 1, "1,4": 0 });
  const cw = turned(s.places, 2, 1), back = turned(s.places, 2, -1);
  check(cw[at(2, 0)] === 3 && cw[at(2, 5)] === 1 && cw[at(1, 4)] === 0 && back[at(2, 10)] === 3 && back[at(2, 3)] === 1, "a ring turned a place clockwise or back, round past twelve o'clock; the others stay");
  let threw = 0;
  for (const m of [{ ring: 0, by: 2 }, { ring: 0, by: 0 }, { ring: 4, by: 1 }]) try { turn(s, m); } catch { threw++; }
  check(threw === 3 && moves().length === RINGS * 2, "a ring turns one place a move, either way: eight moves");
  const c = sky({ "0,3": 3, "1,3": 3, "2,2": 3, "3,3": 3, "1,7": 1 }), r = turn(c, { ring: 2, by: 1 });
  check(r.first.length === 4 && r.gain === worth(4) && r.state.score === 160 && [0, 1, 2, 3].every(k => r.state.places[at(k, 3)] === -1) && r.state.places[at(1, 7)] === 1, "turning the third ring lines up four: they clear, 160");
  check(c.places[at(2, 2)] === 3 && c.turns === 0 && r.state.turns === 1, "the game turned from is left as it was");
  check(worth(3) === 90 && worth(6) === 360 && worth(12) === 1440, "ten times the square of all a turn clears");
}

// ---------- the foretold ----------
{
  const places = sky({ "1,4": 0, "1,5": 2 }).places;
  check(landing(places, 1, 3) === at(1, 3) && landing(places, 1, 4) === at(1, 6), "a foretold planet lands on its place, or the next empty place clockwise");
  const full = sky(Object.fromEntries([...Array(PLACES).keys()].map(p => [`3,${p}`, p % 4]))).places;
  check(landing(full, 3, 5) === at(0, 0), "a full ring passes it on to the next ring out (round to the sun's)");
  const s = sky({ "0,6": 1, "1,6": 1 }, [{ ring: 2, place: 6, colour: 1 }]), r = turn(s, { ring: 3, by: 1 });
  check(r.landed.length === 1 && r.landed[0].at === at(2, 6) && r.then.length === 3 && r.gain === worth(3), "a landing can make a conjunction: it clears too");
  const moved = turn(sky({ "2,5": 2 }, [{ ring: 2, place: 6, colour: 0 }]), { ring: 2, by: 1 });
  check(moved.landed[0].at === at(2, 7) && moved.state.places[at(2, 6)] === 2, "a turn that puts a planet on a foretold place sends the newcomer on a place");
  check(turn(newGame(3), moves()[0]).state.coming.length === foretold(1), "and the next are foretold");
  check(foretold(0) === 1 && foretold(50) === 2 && foretold(100) === 3 && foretold(1000) === 4, "one a turn at first, then two, three, four");
}

// ---------- syzygies and comets ----------
{
  check(syzygies([at(0, 3), at(1, 9)]).join() === "3" && syzygies([at(0, 3), at(1, 4)]).length === 0, "conjunctions on both ends of a diameter are a syzygy, a line through the sun");
  // reds lined up by one turn of the third ring at three o'clock and at nine
  const s = sky({ "0,3": 3, "1,3": 3, "2,2": 3, "0,9": 3, "1,9": 3, "2,8": 3 }), r = turn(s, { ring: 2, by: 1 });
  check(r.first.length === 6 && r.syzygy.join() === "3" && r.gain === 2 * worth(6), "a turn that makes one doubles its score: 720 for six");
  check(turn(sky({ "0,3": 3, "1,3": 3, "2,2": 3 }), { ring: 2, by: 1 }).gain === worth(3), "one conjunction alone isn't doubled");
  const c = sky({ "0,5": 0, "1,5": 1, "2,5": 2, "3,4": 3 }, [], { comet: { spoke: 5, in: 1 } }), swept = turn(c, { ring: 3, by: 1 });
  check(swept.swept.join() === [at(0, 5), at(1, 5), at(2, 5), at(3, 5)].join() && swept.gain === 0 && swept.state.places.filter(x => x >= 0).length === 0, "the comet comes down its spoke and sweeps it clear, the planet just turned onto it too, unscored");
  check(swept.state.comet.in === COMET_EVERY && swept.state.comet.spoke >= 0 && swept.state.comet.spoke < PLACES, `then the next is foretold, ${COMET_EVERY} turns off`);
  const later = turn(sky({ "1,5": 1 }, [], { comet: { spoke: 5, in: 3 } }), { ring: 0, by: 1 });
  check(later.swept.length === 0 && later.state.comet.in === 2 && later.state.places[at(1, 5)] === 1, "until it comes it only counts down");
  check(newGame(4).comet.in === COMET_EVERY && upgrade({ ...newGame(4), comet: undefined }).comet.in === COMET_EVERY, "every game has one coming, a game saved before comets is given one");
}

// ---------- the end ----------
{
  const nearly = Object.fromEntries([...Array(RINGS * PLACES).keys()].filter(i => i !== at(0, 0)).map(i => [`${Math.floor(i / PLACES)},${i % PLACES}`, (Math.floor(i / PLACES) + (i % PLACES) * 2) % 4]));
  const s = sky(nearly, [{ ring: 0, place: 0, colour: 3 }]);
  check(conjunctions(s.places).length === 0, "(a nearly full orrery with no conjunction)");
  const r = turn(s, { ring: 3, by: 1 });
  check(r.over && r.state.over && r.gain === 0 && r.state.places.every(c => c >= 0), "no room left after the foretold land: the game is over");
  check(turn(Object.assign(structuredClone(s), { over: true }), { ring: 0, by: 1 }).landed.length === 0, "nothing turns once it's over");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 9; k++) s = turn(s, moves()[k % 8]).state;
  const again = JSON.parse(JSON.stringify(s));
  check(JSON.stringify(turn(s, { ring: 1, by: -1 })) === JSON.stringify(turn(again, { ring: 1, by: -1 })), "a game saved and opened again goes on as it would have");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  let z = 3;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const random = [], greedy = [];
  for (let g = 0; g < 12; g++) {
    let s = newGame(100 + g);
    while (!s.over && s.turns < 3000) s = turn(s, moves()[Math.floor(rnd() * 8)]).state;
    random.push(s.turns);
    let t = newGame(100 + g);
    while (!t.over && t.turns < 3000) t = moves().map(m => turn(t, m)).sort((a, b) => (b.gain - 6 * filled(b.state)) - (a.gain - 6 * filled(a.state)))[0].state;
    greedy.push(t.turns);
  }
  check(median(random) < 60, `turning rings at random: the orrery full in about ${median(random)} turns`);
  check(median(greedy) > 1.5 * median(random) && Math.max(...greedy) < 3000, `turning for conjunctions: about ${median(greedy)} turns, and the planets coming faster still end it`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("orrery: the deal, conjunctions, a turn, the foretold, syzygies and comets, the end, saving, whole games");
