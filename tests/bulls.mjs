// Bulls (bulls-engine.js, bulls-lock.js, bulls-table.js): the scoring, every board's codes, the codemakers (fair and
// devious), the computer's three levels as a codebreaker (Hard is Knuth's minimax: every Classic code in five), the
// games and the duel, Lock's generator (one answer, every clue needed, the grade its level asks) and its hints, the
// clues shared out so nobody alone can open a lock, today's code, and tables of up to six played through the
// database's own round trip.
import { VARIANTS, DAILY_VARIANT, LEVELS, space, indexOf, codeAt, keyFor, score, invalid, secretOf, daySeed, fitting, fits, symbolsOf,
  deviousAnswer, breakerGuess, newBreak, guessBreak, revealed, newDuel, setDuelCode, duelGuess, duelReply, duelSecret, noteResult, rng } from "../bulls-engine.js";
import { LOCK_LEVELS, makeLock, gradeLock, answers, lockSteps, shareClues, scoreLock, lockCodes } from "../bulls-lock.js";
import { freshTable, isTable, tidy, dealGame, teamGuess, teamTry, begin, setCode, ownGuess, ownTry, ownHint, keysShown, handOf, targetOf, setterOf, allSet,
  runOf, standings, isOver, resultOf, newGameAt, lockOf } from "../bulls-table.js";
import { today } from "../days.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const S = (b, c) => `${b}/${c}`;
const sc = (g, c) => { const s = score(g, c); return S(s.b, s.c); };

// ---------- the scoring ----------
{
  check(sc([0, 0, 1, 1], [0, 1, 0, 1]) === S(2, 2) && sc([0, 0, 0, 0], [0, 1, 2, 3]) === S(1, 0) && sc([1, 2, 3, 4], [4, 3, 2, 1]) === S(0, 4)
    && sc([0, 0, 1, 1], [1, 1, 2, 2]) === S(0, 2) && sc([5, 5, 5, 5], [5, 5, 5, 5]) === S(4, 0) && sc([0, 1, 2, 3], [4, 4, 5, 5]) === S(0, 0),
    "a bull for each peg right in its place, a cow for each other of a colour the code holds, counted as often as both hold it");
  const sp = space("classic"), r = rng(1);
  let symmetric = true, total = true;
  for (let t = 0; t < 2000; t++) {
    const i = Math.floor(r() * sp.N), j = Math.floor(r() * sp.N), a = codeAt(sp, i), b = codeAt(sp, j), x = score(a, b), y = score(b, a);
    if (x.b !== y.b || x.c !== y.c || keyFor(sp, i, j) !== x.b * 6 + x.c) symmetric = false;
    if (x.b + x.c > 4) total = false;
  }
  check(symmetric && total, "a score is the same either way round, and the board's numbered scores agree with it");
  check(Object.entries({ small: 216, classic: 1296, super: 32768, digits: 5040 }).every(([id, n]) => space(id).N === n),
    "every board's codes: Small 6³ = 216, Classic 6⁴ = 1,296, Super 8⁵ = 32,768, Bulls and Cows 10·9·8·7 = 5,040");
  check(indexOf(space("digits"), [1, 1, 2, 3]) === -1 && indexOf(space("classic"), [0, 6, 0, 0]) === -1 && indexOf(space("classic"), [5, 4, 3, 2]) >= 0,
    "a code a board can't hold isn't one of its codes");
  check(invalid("classic", [0, 1, 2]) && invalid("digits", [1, 1, 2, 3]) === "Every digit different" && invalid("classic", [1, 1, 2, 2]) === null && invalid("super", [7, 7, 0, 1, 2]) === null,
    "a guess fills every peg; Bulls and Cows takes every digit different, the colour boards repeats");
}

// ---------- the codemaker ----------
{
  check(Object.keys(VARIANTS).every(id => secretOf(id, 42).join() === secretOf(id, 42).join() && indexOf(space(id), secretOf(id, 42)) >= 0),
    "a seed hides the same code on every device, one of the board's own");
  const counts = new Array(6).fill(0);
  for (let s = 1; s <= 6000; s++) for (const x of secretOf("classic", s)) counts[x]++;
  check(counts.every(n => Math.abs(n - 4000) < 300), `every colour as likely in a hidden code (${counts.join(", ")} of 24,000 pegs)`);
  const d1 = new Date(Date.UTC(2026, 9, 20, 0, 5)), d2 = new Date(Date.UTC(2026, 9, 20, 23, 55)), d3 = new Date(Date.UTC(2026, 9, 21, 0, 5));
  const code = d => secretOf(DAILY_VARIANT, daySeed(today(d))).join("");
  let differ = 0;
  for (let k = 0; k < 30; k++) if (code(new Date(Date.UTC(2026, 9, 1 + k))) !== code(new Date(Date.UTC(2026, 9, 2 + k)))) differ++;
  check(code(d1) === code(d2) && DAILY_VARIANT === "classic" && differ >= 27, `today's code is the same all day for everyone (the UTC date), and changes with the day (${differ} of 30)`);
}

// ---------- the computer as codebreaker ----------
{
  // Knuth's tree, every history worked out once: Hard's guess at each, and the codes it splits them into
  const tree = id => {
    const sp = space(id); let sum = 0, max = 0;
    const walk = (rows, fit, depth) => {
      const g = breakerGuess(id, rows, "hard", 1), gi = indexOf(sp, g), parts = new Map();
      for (const j of fit) { const k = keyFor(sp, gi, j); if (!parts.has(k)) parts.set(k, []); parts.get(k).push(j); }
      for (const [k, part] of parts) {
        if (k === sp.win) { sum += depth; max = Math.max(max, depth); continue; }
        walk([...rows, { g, b: Math.floor(k / 6), c: k % 6 }], part, depth + 1);
      }
    };
    walk([], [...Array(sp.N).keys()], 1);
    return { sum, max, avg: sum / sp.N };
  };
  const t0 = Date.now(), k = tree("classic"), small = tree("small");
  check(k.max === 5 && k.sum === 5801, `Hard is Knuth's minimax: every Classic code broken in five guesses at most, ${k.avg.toFixed(3)} on average (Knuth 1977: 5,801 guesses over 1,296 codes) (${Date.now() - t0} ms)`);
  check(small.max <= 5 && small.avg < 4.1, `and Small in five at most, ${small.avg.toFixed(2)} on average`);
  // Medium's guesses always fit; Easy's don't always; both break every code they're given within the rows, mostly
  const play = (id, level, seed, secret) => {
    const rows = [];
    let fitted = true;
    for (let k = 1; k <= 40; k++) {
      const g = breakerGuess(id, rows, level, seed);
      if (!fits(id, rows, g)) fitted = false;
      const s = score(g, secret);
      rows.push({ g, ...s });
      if (s.b === VARIANTS[id].pegs) return { k, fitted };
    }
    return { k: 41, fitted };
  };
  const r = rng(5), avg = {}, allFit = {}, within = {};
  for (const level of Object.keys(LEVELS)) {
    let sum = 0, ok = true, inRows = 0;
    for (let t = 0; t < 300; t++) {
      const res = play("classic", level, t + 1, secretOf("classic", Math.floor(r() * 1e9)));
      sum += res.k; ok &&= res.fitted; if (res.k <= 10) inRows++;
    }
    avg[level] = sum / 300; allFit[level] = ok; within[level] = inRows / 300;
  }
  check(allFit.medium && !allFit.hard && !allFit.easy,
    "Medium only ever guesses a code that could be it; Hard sometimes guesses one that can't, to split the field better (Knuth's point); Easy loses track now and then");
  check(avg.easy > avg.medium && avg.medium > avg.hard && avg.easy < 6.5 && within.easy > 0.93 && within.medium === 1,
    `the levels in order: Easy ${avg.easy.toFixed(2)}, Medium ${avg.medium.toFixed(2)}, Hard ${avg.hard.toFixed(2)} guesses a Classic code (Easy within ten rows ${Math.round(100 * within.easy)}%)`);
  // the big boards: Hard samples its search, and stays quick
  for (const [id, n] of [["digits", 8], ["super", 5]]) {
    let worst = 0, slow = 0, sum = 0;
    for (let t = 0; t < n; t++) {
      const secret = secretOf(id, 1000 + t), rows = [];
      for (let k = 1; k <= 20; k++) {
        const a = performance.now(), g = breakerGuess(id, rows, "hard", t + 1);
        slow = Math.max(slow, performance.now() - a);
        const s = score(g, secret);
        rows.push({ g, ...s });
        if (s.b === VARIANTS[id].pegs) { worst = Math.max(worst, k); sum += k; break; }
        if (k === 20) worst = 99;
      }
    }
    check(worst <= VARIANTS[id].rows - 3 && slow < 1500, `Hard on ${VARIANTS[id].label}: ${(sum / n).toFixed(2)} guesses on average, ${worst} at worst, its slowest move ${Math.round(slow)} ms`);
  }
}

// ---------- the devious codemaker ----------
{
  const g = newBreak({ variant: "classic", maker: "devious", seed: 9 });
  let consistent = true;
  while (!g.done) {
    guessBreak(g, breakerGuess("classic", g.rows, "hard", 1));
    if (!fitting("classic", g.rows).length) consistent = false;
  }
  const code = revealed(g);
  check(consistent && g.done === "broken" && g.rows.length === 5 && g.rows.every(r => { const s = score(r.g, code); return s.b === r.b && s.c === r.c; }),
    "the devious codemaker never contradicts itself, holds Knuth's Hard to the worst case (five), and the code it shows fits every answer");
  const first = deviousAnswer("classic", [], [0, 0, 1, 1], 3), sizes = new Map();
  const sp = space("classic"), gi = indexOf(sp, [0, 0, 1, 1]);
  for (let j = 0; j < sp.N; j++) { const k = keyFor(sp, gi, j); sizes.set(k, (sizes.get(k) || 0) + 1); }
  check(sizes.get(first.b * 6 + first.c) === Math.max(...sizes.values()), "it answers with the score that keeps the most codes alive (256 of them, after AABB)");
  const two = deviousAnswer("classic", [{ g: [0, 0, 0, 0], b: 3, c: 0 }, { g: [0, 0, 0, 1], b: 3, c: 0 }, { g: [0, 0, 0, 2], b: 3, c: 0 }, { g: [0, 0, 0, 3], b: 3, c: 0 }], [0, 0, 0, 4], 1);
  check(two.b === 3, "between equal answers it never hands over the win while another code still fits");
  const h = newBreak({ variant: "small", maker: "devious", seed: 2 });
  for (let t = 0; t < 8 && !h.done; t++) guessBreak(h, [0, 0, 0]);
  check(h.done === "out" && revealed(h) && fitting("small", h.rows).length > 1, "guessing badly, the rows run out, and the code it shows is one that fits");
}

// ---------- a game, a duel, the records ----------
{
  const g = newBreak({ variant: "classic", seed: 77 }), secret = secretOf("classic", 77);
  check(guessBreak(g, [0, 1, 2]).error && guessBreak(g, [0, 1, 2, 3]).row && g.rows.length === 1 && !g.done, "a guess fills the row, then it's scored");
  guessBreak(g, secret);
  check(g.done === "broken" && guessBreak(g, [0, 0, 0, 0]).error, "the full row of bulls breaks it, and the game is over");
  const back = JSON.parse(JSON.stringify(g));
  check(back.rows.length === 2 && back.done === "broken" && revealed(back).join() === secret.join(), "a game keeps as JSON, as localStorage holds it");
  const out = newBreak({ variant: "small", seed: 5 }), sec = secretOf("small", 5), wrong = [0, 1, 2].join() === sec.join() ? [1, 2, 3] : [0, 1, 2];
  for (let t = 0; t < 8; t++) guessBreak(out, wrong);
  check(out.done === "out" && out.rows.length === 8, "the last row unbroken ends it");
  const d = newDuel({ variant: "classic", seed: 11, level: "hard" });
  check(duelGuess(d, [0, 0, 1, 1]).error === "Set your code first" && setDuelCode(d, [1, 1]) && !setDuelCode(d, [5, 4, 3, 2]) && d.mine.join() === "5,4,3,2", "a duel begins with your code set");
  duelGuess(d, [0, 0, 1, 1]);
  check(duelGuess(d, [0, 0, 1, 2]).error && duelReply(d) && d.cpu.length === 1 && !duelReply(d), "turn about: your guess, then the computer's");
  while (!d.done) { duelGuess(d, d.rows.length === 2 ? duelSecret(d) : [0, 0, 1, 2]); duelReply(d); }
  check(d.rows.length === 3 && (d.done === "won" || (d.done === "draw" && d.cpu.at(-1).b === 4)), `breaking its code on your third, it gets its third to equal it (${d.done})`);
  const e = newDuel({ variant: "classic", seed: 12, level: "hard" });
  setDuelCode(e, [0, 0, 1, 1]);
  duelGuess(e, [5, 5, 5, 5]); duelReply(e);
  check(e.done === "lost" && e.cpu[0].b === 4, "Knuth opens with AABB: a code of AABB is broken at once, and you lose");
  let rec = noteResult(null, g);
  rec = noteResult(rec, out);
  check(rec.played === 2 && rec.broken === 1 && rec.guesses === 2 && rec.by[2] === 1 && rec.by[0] === 1, "a board's record: played, broken, the guesses each took");
  const sy = symbolsOf("classic", [{ g: [0, 1, 2, 3], b: 0, c: 0 }]);
  check(sy.out.join() === "0,1,2,3" && sy.left === 16, "the aid's marks: no fitting code holds a colour ruled out (and 2⁴ codes are left)");
}

// ---------- Lock ----------
{
  const famous = [{ g: [6, 8, 2], b: 1, c: 0 }, { g: [6, 1, 4], b: 0, c: 1 }, { g: [2, 0, 6], b: 0, c: 2 }, { g: [7, 3, 8], b: 0, c: 0 }, { g: [7, 8, 0], b: 0, c: 1 }];
  const fg = gradeLock(3, famous), steps = lockSteps(3, famous);
  check(answers(3, famous).map(d => d.join("")).join() === "042" && fg.step === 1 && fg.rounds === 3,
    "the famous lock (682, 614, 206, 738, 780) opens to 042, by reading one clue at a time, in three rounds");
  check(steps[0].text === "Clue 4: 3, 7 and 8 aren't in it." && steps.at(-1).at.length > 0 && steps.length === 5,
    `its hints start where a person would ("${steps[0].text}") and end with the code (${steps.map(s => s.text).join(" ")})`);
  check(scoreLock([1, 2, 3], [3, 2, 1]).join() === "1,2" && lockCodes(3).length === 720 && lockCodes(4).length === 5040, "a lock's digits are all different: 720 codes of three, 5,040 of four");
  let ok = true, hit = 0, all = 0, slow = 0;
  const problems = [];
  const SEEDS = { easy: 40, medium: 40, hard: 25, expert: 10 };   // an Expert takes about twenty tries to find: fewer of them
  for (const level of Object.keys(LOCK_LEVELS)) for (let seed = 1; seed <= SEEDS[level]; seed++) {
    const a = performance.now(), L = makeLock(level, seed);
    slow = Math.max(slow, performance.now() - a);
    all++;
    if (seed <= 3 && JSON.stringify(L) !== JSON.stringify(makeLock(level, seed))) problems.push(`not repeatable ${level} ${seed}`);
    if (answers(L.p, L.clues).length !== 1 || answers(L.p, L.clues)[0].join() !== L.secret.join()) problems.push(`not one answer ${level} ${seed}`);
    if (L.clues.some((_, i) => answers(L.p, L.clues.filter((x, k) => k !== i), 2).length < 2)) problems.push(`a clue not needed ${level} ${seed}`);
    if (L.clues.some(c => c.b === L.p)) problems.push(`a clue gives it away ${level} ${seed}`);
    const g = L.grade, want = { easy: g.digits === 3 && g.step === 1 && g.rounds <= 2, medium: g.digits === 3 && ((g.step === 1 && g.rounds >= 3) || g.step === 2), hard: g.digits === 4 && g.step === 2, expert: g.digits === 4 && g.step === 3 }[level];
    if (want) hit++;
    if (g.digits !== LOCK_LEVELS[level].digits || g.step > 3) problems.push(`grade ${level} ${seed}: ${JSON.stringify(g)}`);
    // the hints, followed, open it: the last step leaves one code
    const st = lockSteps(L.p, L.clues), known = new Map();
    for (const s of st) for (const [k, d] of s.at) known.set(k, d);
    if (L.secret.some((d, k) => known.get(k) !== d && !(known.size === L.p - 1 && !known.has(k)))) { ok = false; problems.push(`hints ${level} ${seed}`); }
  }
  check(!problems.length, problems.length ? `every lock: ${problems.slice(0, 6).join("; ")}` : `${all} locks: each one answer (counted over every code), every clue needed, none giving the code away, the same from the same seed`);
  check(hit / all > 0.97, `each graded as its level asks: ${hit} of ${all} (Easy: one clue at a time in two rounds; Medium: three rounds or two clues together; Hard: four digits, two together; Expert: three together)`);
  check(ok, "the hints, one after another, settle every digit of the code");
  check(slow < 2500, `the slowest lock took ${Math.round(slow)} ms to make (an Expert: about one in twenty tried grades so)`);
  // shared out: the parts make the whole, and nobody's part alone opens it
  let parts = true;
  for (const level of ["medium", "hard"]) for (let seed = 1; seed <= 6; seed++) for (let n = 2; n <= 6; n++) {
    const L = makeLock(level, seed, { minClues: Math.min(n, 4) }), hands = shareClues(L, n);
    const whole = new Set(hands.flat());
    if (whole.size !== L.clues.length || hands.some(h => !h.length) || hands.some(h => answers(L.p, h.map(i => L.clues[i]), 2).length < 2)) parts = false;
  }
  check(parts, "the clues shared out among two to six: every clue held by someone, everyone holds one, and nobody's alone leaves only one code");
}

// ---------- tables ----------
const people = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [`u${i}`, { name: ["Korbi", "Sarah", "Tom", "Mei", "Ana", "Jo"][i], slot: i, online: true }]));
/** A transaction, as together.js runs it: on the table as the database gives it back, and stored as it would be. */
const act = (state, change) => { const g = tidy(roundTrip(state)), out = change(g); return { g: tidy(roundTrip(g)), out }; };
{
  // Team Break: one board; your keys show to everyone else, not you
  let T = freshTable(people(2), { now: 1000, deal: { kind: "break", play: "team", variant: "classic", seed: 5 } });
  check(isTable(T) && isTable(tidy(roundTrip(T))), "a table survives the database's round trip (no empty lists kept)");
  const secret = targetOf(T.game, 0);
  let r = act(T, g => teamGuess(g, { n: 1, seen: 0, slot: 0, guess: [0, 0, 1, 1], now: 2000 }));
  T = r.g;
  const row = T.game.board.rows[0];
  check(r.out !== "taken" && row.by === 0 && !keysShown(T.game, row, 0) && keysShown(T.game, row, 1), "Team: a guess's key pegs show to the others, never to the one who made it");
  r = act(T, g => teamGuess(g, { n: 1, seen: 0, slot: 1, guess: [2, 2, 3, 3], now: 2100 }));
  check(r.out === "taken" && r.g.game.board.rows.length === 1, "two guesses made on the same board: the second is turned down, to be made again on what the first showed");
  r = act(T, g => teamGuess(g, { n: 1, seen: 1, slot: 1, guess: secret, now: 9000 }));
  T = r.g;
  check(r.out === "broken" && keysShown(T.game, T.game.board.rows[0], 0) && isOver(T.game) && runOf(T.game, 0).guesses === 2 && runOf(T.game, 0).ms === 8000,
    "broken: every key shows to everyone, the team's guesses and time are its result");
  const res = resultOf(T, 0, [0, 1]);
  check(res?.coop && res.won && res.match === "1000-1", "the pair's record gets a team result");
  // Team Lock: the clues dealt out, an answer anyone tries
  let L = freshTable(people(3), { now: 1000, deal: { kind: "lock", play: "team", level: "medium", seed: 3 } });
  L = tidy(roundTrip(L));
  const lock = lockOf(L.game), hands = [0, 1, 2].map(s => handOf(L.game, s));
  check(hands.every(h => h.length && answers(lock.p, h.map(i => lock.clues[i]), 2).length > 1) && new Set(hands.flat()).size === lock.clues.length,
    "Team Lock: each of three holds some of the clues, none enough alone, all of them together");
  r = act(L, g => teamTry(g, { n: 1, slot: 2, answer: lock.secret.map((d, k) => (k === 0 ? (d + 1) % 10 : d)).map((d, k, a) => (a.indexOf(d) !== k ? (d + 5) % 10 : d)), now: 5000 }));
  check(r.out === "wrong" && r.g.game.board.strikes === 1, "a wrong code tried costs the team a strike");
  r = act(r.g, g => teamTry(g, { n: 1, slot: 1, answer: lock.secret, now: 61000 }));
  check(r.out === "open" && runOf(r.g.game, 0).secs === 60 + 30, "the right one opens it: the team's time, a strike's 30 seconds on it");
  // Race: the same code, each on their own board
  let R = freshTable(people(3), { now: 0, deal: { kind: "break", play: "race", variant: "small", seed: 8 } });
  const code = targetOf(R.game, 0);
  check(targetOf(R.game, 2).join() === code.join(), "Race: the same code for everyone");
  for (const [slot, at] of [[0, 100], [1, 300]]) R = act(R, g => begin(g, { n: 1, slot, now: at })).g;
  const miss = code.join() === "0,1,2" ? [3, 4, 5] : [0, 1, 2];
  R = act(R, g => ownGuess(g, { n: 1, slot: 0, seen: 0, guess: miss, now: 1000 })).g;
  r = act(R, g => ownGuess(g, { n: 1, slot: 0, seen: 0, guess: miss, now: 1001 }));
  check(r.out === "taken" && r.g.game.seats.s0.rows.length === 1, "a guess sent twice (a slow connection) counts once");
  R = act(R, g => ownGuess(g, { n: 1, slot: 0, seen: 1, guess: code, now: 5100 })).g;
  R = act(R, g => ownGuess(g, { n: 1, slot: 1, seen: 0, guess: miss, now: 2000 })).g;
  R = act(R, g => ownGuess(g, { n: 1, slot: 1, seen: 1, guess: code, now: 4300 })).g;
  check(isOver(R.game, [0, 1]) && !isOver(R.game, [0, 1, 2]), "it's over once everyone who began has finished, unless someone at the table is still to begin (one away doesn't hold it up)");
  R = act(R, g => begin(g, { n: 1, slot: 2, now: 200 })).g;
  check(!isOver(R.game, [0, 1]), "and one who began holds it until they finish, here or not");
  R = act(R, g => ownGuess(g, { n: 1, slot: 2, seen: 0, guess: code, now: 9000 })).g;
  const st = standings(R.game);
  check(st[0].slot === 2 && st[1].slot === 1 && st[2].slot === 0 && isOver(R.game, [0, 1, 2]), "the fewest guesses wins, then the quicker (each timed from their own first look)");
  check(resultOf(R, 2, [0, 1, 2]).won && !resultOf(R, 1, [0, 1, 2]).won, "the winner's record says won, the others' not");
  // Versus: each sets a code for the next round the table
  let V = freshTable(people(2), { now: 0, deal: { kind: "break", play: "versus", variant: "classic", seed: 1 } });
  check(setterOf(V.game, 0) === 1 && setterOf(V.game, 1) === 0 && !allSet(V.game) && !act(V, g => begin(g, { n: 1, slot: 0, now: 5 })).out, "Versus: two break each other's; nobody begins before both codes are set");
  V = act(V, g => setCode(g, { n: 1, slot: 0, code: [1, 2, 3, 4], now: 10 })).g;
  check(act(V, g => setCode(g, { n: 1, slot: 0, code: [0, 0, 0, 0], now: 11 })).out === "set", "a code once set stays set");
  V = act(V, g => setCode(g, { n: 1, slot: 1, code: [5, 5, 0, 0], now: 50 })).g;
  check(allSet(V.game) && V.game.start === 50 && targetOf(V.game, 1).join() === "1,2,3,4" && targetOf(V.game, 0).join() === "5,5,0,0", "the breaking starts with the last code set; each breaks the other's");
  V = act(V, g => begin(g, { n: 1, slot: 0, now: 60 })).g;
  V = act(V, g => begin(g, { n: 1, slot: 1, now: 70 })).g;
  V = act(V, g => ownGuess(g, { n: 1, slot: 0, seen: 0, guess: [5, 5, 0, 0], now: 400 })).g;
  V = act(V, g => ownGuess(g, { n: 1, slot: 1, seen: 0, guess: [1, 2, 3, 4], now: 300 })).g;
  check(standings(V.game)[0].slot === 1 && runOf(V.game, 1).ms === 250 && resultOf(V, 1, [0, 1]).won, "both in one: the quicker wins, timed from the start they shared");
  const three = dealGame({ kind: "break", play: "versus", seed: 2 }, [0, 1, 2], 0);
  check(setterOf(three, 0) === 2 && setterOf(three, 1) === 0 && setterOf(three, 2) === 1, "three in Versus: each breaks the code of the one before them round the table");
  check(dealGame({ kind: "lock", play: "versus", seed: 2 }, [0, 1], 0).play === "team", "a lock has no Versus: it's dealt as a team");
  // Race Lock: hints and strikes count
  let RL = freshTable(people(2), { now: 0, deal: { kind: "lock", play: "race", level: "easy", seed: 4 } });
  const lk = lockOf(RL.game);
  RL = act(RL, g => begin(g, { n: 1, slot: 0, now: 0 })).g;
  RL = act(RL, g => begin(g, { n: 1, slot: 1, now: 0 })).g;
  RL = act(RL, g => ownHint(g, { n: 1, slot: 0, seen: 0 }) ? "ok" : "no").g;
  RL = act(RL, g => ownTry(g, { n: 1, slot: 0, answer: lk.secret, now: 20000 })).g;
  RL = act(RL, g => ownTry(g, { n: 1, slot: 1, answer: lk.secret, now: 45000 })).g;
  check(runOf(RL.game, 0).secs === 50 && runOf(RL.game, 1).secs === 45 && standings(RL.game)[0].slot === 1, "Race Lock: time plus 30 seconds a hint (or a wrong code): 20 s and a hint loses to 45 s");
  // a new game at the table
  const N = act(R, g => newGameAt(g, { n: 1, deal: { kind: "lock", play: "race", level: "hard", seed: 9 }, slots: [0, 1, 2], now: 99 }));
  check(N.out && N.g.n === 2 && N.g.game.kind === "lock" && !act(N.g, g => newGameAt(g, { n: 1, deal: {}, slots: [0], now: 100 })).out && act(N.g, g => ownGuess(g, { n: 1, slot: 0, seen: 0, guess: code, now: 1 })).out === "moved",
    "a new game for the table (asked for once: a second ask on the old game does nothing), and a move made on the old game does nothing");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("bulls: the scoring, the codemakers, the computer's levels, Lock's one answer and its grades, the shared clues and tables together");
