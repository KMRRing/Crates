// Rack (rack-rules.js, rack-bot.js): a word game on a board for two to four. The board's premium squares (symmetric, the
// right number of each) and the bag (100 tiles, 187 points, two blanks); the word list with its two-letter words; what a
// play scores (letter and word premiums only for the tiles laid that turn, the star, cross words, a blank's nothing, seven
// tiles' fifty) and what it is refused for; the turn (tiles you hold, swapping only from a full bag, six scoreless turns, going
// out); the computer player's play-finder against a plain search over a small word list (every play it makes is legal, and
// it misses none); whole games of three strengths with every tile accounted for at every step; the state through the
// database; and the page wired to it.
// Run: node tests/rack.mjs
import fs from "node:fs";
import { rules, evaluate, premiumAt, fullBag, VALUES, COUNTS, TWO, isPlay, SIZE, CELLS, CENTER, HAND, BINGO, SCORELESS } from "../rack-rules.js";
import { dictionary, findPlays, rankPlays, LEVEL_NAMES, leaveValue } from "../rack-bot.js";
import { newRecord, applyMove, botMove, seeded, shuffle } from "../seats.js";
import { wordsOf } from "../wordlist.js";
import { roundTrip, same as sameKeys } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;
const sq = (r, c) => r * SIZE + c;
/** A board from rows of text ("." empty, letters tiles) given by their first row and column. */
function boardOf(...at) {
  const b = Array(CELLS).fill(".");
  for (const [r, c, word] of at) [...word].forEach((ch, k) => { b[sq(r, c + k)] = ch; });
  return b.join("");
}
const across = (r, c, word) => [...word].map((ch, k) => [sq(r, c + k), ch]);
const down = (r, c, word) => [...word].map((ch, k) => [sq(r + k, c), ch]);
const EMPTY = ".".repeat(CELLS);
const words = r => r.words.map(w => `${w.word}:${w.score}`).join(" ");

// ---------- the board and the bag ----------
{
  const count = {};
  let sym = true;
  for (let i = 0; i < CELLS; i++) {
    const p = premiumAt(i), r = (i / SIZE) | 0, c = i % SIZE;
    count[p] = (count[p] || 0) + 1;
    for (const j of [sq(r, 14 - c), sq(14 - r, c), sq(14 - r, 14 - c), sq(c, r)]) if (premiumAt(j) !== p) sym = false;
  }
  check(count.W === 8 && count.w === 16 && count["*"] === 1 && count.L === 12 && count.l === 24 && sym && premiumAt(CENTER) === "*", "the board has 8 triple-word, 16 double-word, 12 triple-letter, 24 double-letter squares and the star, the same turned or mirrored");
  const bag = fullBag();
  check(bag.length === 100 && bag.filter(t => t === "?").length === 2 && bag.reduce((n, t) => n + VALUES[t], 0) === 187 && Object.keys(COUNTS).length === 27, "the bag holds 100 tiles worth 187, with two blanks");
  check(TWO.size >= 120 && TWO.has("qi") && TWO.has("za") && TWO.has("ok") && !TWO.has("zz") && !TWO.has("xx"), "the two-letter words are there (Collins)");
  check(isPlay("QUIZ") && isPlay("qi") && isPlay("qat") && !isPlay("qz") && !isPlay("xyzzy") && isPlay("Trained"), "the word list takes any case, two letters from the list, and rejects what isn't a word");
}

// ---------- what a play scores ----------
{
  let r = evaluate(EMPTY, across(7, 4, "QUIZ"));
  check(r.score === 44 && words(r) === "QUIZ:44", `QUIZ from the star: (10+1+1+10) × 2 = 44 (${r.score})`);
  r = evaluate(EMPTY, across(7, 3, "HELLO"));
  check(r.score === 24, `HELLO: the H on a double letter, the star doubles the word: (8+1+1+1+1) × 2 = 24 (${r.score})`);
  r = evaluate(EMPTY, across(7, 7, "TRAINED"));
  check(r.bingo && r.score === 18 + BINGO, `seven tiles add ${BINGO}: TRAINED (1+1+1+1+2+1+2) × 2 + 50 (${r.score})`);
  r = evaluate(EMPTY, [[sq(7, 6), "C"], [sq(7, 7), "a"], [sq(7, 8), "T"]]);
  check(r.score === 8, `a blank is worth nothing: C + a + T = 4, doubled by the star (${r.score})`);
  const cat = boardOf([7, 6, "CAT"]);
  r = evaluate(cat, [[sq(7, 9), "S"]]);
  check(r.score === 6 && words(r) === "CATS:6", `the star doubles only the turn it is covered: CATS is 6 (${r.score})`);
  r = evaluate(cat, [[sq(8, 8), "O"]]);
  check(r.score === 3 && words(r) === "TO:3", `a word down from the T: T + O on a double letter = 3 (${r.score})`);
  r = evaluate(cat, across(8, 7, "TO"));
  check(r.score === 8 && r.words.length === 3, `a word beside a word makes three: TO 3, AT 2, TO 3 = 8 (${words(r)})`);
  r = evaluate(boardOf([0, 0, "AB"]), [[sq(0, 2), "A"], [sq(0, 3), "D"]]);
  check(r.error && /ABAD/.test(r.error), `a longer word than the tiles laid is the one that must be a word (${r.error})`);
  r = evaluate(boardOf([7, 5, "AT"]), [[sq(6, 5), "H"], [sq(6, 6), "A"]]);
  check(!r.error && r.score === 14 && r.words.map(w => w.word).sort().join() === "AT,HA,HA", `two tiles laid over two make three words: HA 6, HA 5, AT 3 = 14 (${r.error || words(r)})`);
}

// ---------- what a play is refused for ----------
{
  const cat = boardOf([7, 6, "CAT"]);
  const why = (board, put) => evaluate(board, put).error || "";
  check(/one row or one column/.test(why(EMPTY, [[sq(7, 7), "A"], [sq(8, 8), "T"]])), "tiles not in one line are refused");
  check(/no gap/.test(why(EMPTY, [[sq(7, 5), "A"], [sq(7, 7), "T"]])), "a gap in the word is refused");
  check(/star/.test(why(EMPTY, across(2, 2, "CAT"))), "the first word must cover the star");
  check(/at least two/.test(why(EMPTY, [[CENTER, "A"]])), "a single tile alone is no word");
  check(/join/.test(why(cat, across(1, 1, "DOG"))), "a word must join the tiles on the board");
  check(/already has a tile/.test(why(cat, [[sq(7, 7), "E"]])), "a square with a tile can't take another");
  check(/QZX/.test(why(EMPTY, across(7, 6, "QZX"))) && /isn't in the word list/.test(why(EMPTY, across(7, 6, "QZX"))), "a word that isn't in the list is refused, and named");
  check(/ZZ/.test(why(cat, [[sq(8, 7), "Z"], [sq(8, 8), "Z"]])) || /isn't in/.test(why(cat, [[sq(8, 7), "Z"], [sq(8, 8), "Z"]])), "so is a cross word that isn't");
  check(/off the board|isn't on the board/.test(why(EMPTY, [[999, "A"], [1000, "B"]])) && /letter/.test(why(EMPTY, [[CENTER, "7"]])), "a square off the board, or a tile that is no letter, is refused");
  check(/at least one/.test(why(EMPTY, [])), "no tiles is no play");
}

// ---------- the turn ----------
const mk = (seats = 2, seed = 7) => newRecord(rules, { seats, seed });
{
  let G = mk(2, 9);
  const s = G.state, seat = rules.toMove(s);
  check(s.racks.every(r => r.length === HAND) && s.bag.length === 100 - 2 * HAND && s.board === EMPTY && rules.toMove(s) === s.first, "a deal: seven tiles each, 86 in the bag, the star bare");
  check(applyMove(rules, G, 1 - seat, { t: "pass" }).error, "a seat out of turn is refused");
  G.state.racks[seat] = "QUIZXYZ";
  check(/don't have/.test(applyMove(rules, G, seat, { t: "play", put: across(7, 6, "CAT") }).error), "you can't lay a tile you don't hold");
  check(/no blank/.test(applyMove(rules, G, seat, { t: "play", put: across(7, 6, "caT") }).error), "…nor a blank you don't hold");
  G.state.racks[seat] = "CAT?EEE";
  let g = applyMove(rules, G, seat, { t: "play", put: [[sq(7, 6), "C"], [sq(7, 7), "a"], [sq(7, 8), "T"]] });
  check(!g.error && g.G.state.racks[seat].length === HAND && g.G.state.scores[seat] === 8 && g.G.state.board[sq(7, 7)] === "a" && g.G.state.turn === 1 - seat, `a play uses a tile and the blank, refills to seven, scores and passes the turn (${g.error || ""})`);
  check(!g.error && g.G.state.racks[seat].startsWith("AEEE") && g.G.state.bag.length === 100 - 2 * HAND - 3 && g.G.state.racks[seat].slice(4) === G.state.bag.slice(0, 3), "…the tiles kept stay, and three are drawn from the front of the bag");
  const sw = applyMove(rules, mk(2, 9), rules.toMove(mk(2, 9).state), { t: "swap", tiles: "" });
  check(/Pick/.test(sw.error), "swapping nothing is refused");
  const H = mk(2, 9), hs = rules.toMove(H.state), rack = H.state.racks[hs];
  g = applyMove(rules, H, hs, { t: "swap", tiles: rack.slice(0, 3) });
  check(!g.error && g.G.state.bag.length === H.state.bag.length && g.G.state.racks[hs].length === HAND && g.G.state.scores[hs] === 0 && g.G.state.passes === 1, "a swap keeps the bag its size, scores nothing, and is a scoreless turn");
  const tiles = s0 => [...s0.board].filter(c => c !== ".").length + s0.bag.length + s0.racks.reduce((n, r) => n + r.length, 0);
  check(tiles(g.G.state) === 100, "…and no tile is lost");
  H.state.bag = "ABCDEF";
  check(/fewer than seven/.test(applyMove(rules, H, hs, { t: "swap", tiles: "A" }).error), "no swapping from a bag of fewer than seven");
  check(/don't have/.test(applyMove(rules, mk(2, 9), rules.toMove(mk(2, 9).state), { t: "swap", tiles: "9" }).error), "…nor tiles you don't hold");
}
{
  let G = mk(2, 3), n = 0;
  while (!rules.over(G.state) && n < 10) { const r = applyMove(rules, G, rules.toMove(G.state), { t: "pass" }); G = r.G; n++; }
  const f = G.state.final;
  check(n === SCORELESS && rules.over(G.state) && f.out === -1 && f.totals.every((t, i) => t === -f.left[i]) && G.state.winners.length >= 1, `${SCORELESS} turns running without a word end the game, each losing their own tiles`);
  check(applyMove(rules, G, 0, { t: "pass" }).error, "…and nobody moves after that");
}
{
  // going out: the other's tiles are added to yours and taken from theirs
  const G = mk(2, 5);
  const seat = rules.toMove(G.state);
  G.state.board = boardOf([7, 6, "CAT"]);
  G.state.bag = "";
  G.state.racks[seat] = "S";
  G.state.racks[1 - seat] = "QZ";
  G.state.scores = [100, 100];
  const g = applyMove(rules, G, seat, { t: "play", put: [[sq(7, 9), "S"]] });
  const f = g.G?.state.final;
  check(!g.error && rules.over(g.G.state) && f.out === seat && f.adj[seat] === 20 && f.adj[1 - seat] === -20 && f.totals[seat] === 100 + 6 + 20 && f.totals[1 - seat] === 80 && g.G.state.winners.join() === String(seat), `going out adds the other's tiles (20) to your score and takes them from theirs (${g.error || JSON.stringify(f)})`);
}

// ---------- the play-finder against a plain search ----------
// A small word list so a plain search over every word and every place it could go is quick; the finder must find exactly those plays.
const small = [...TWO, ...[3, 4, 5].flatMap(n => wordsOf(n, 0))];
const toy = { words: [...new Set(small)].sort(), has: w => toy.set.has(w.toLowerCase()) };
toy.set = new Set(toy.words);
const key = put => [...put].sort((a, b) => a[0] - b[0]).map(p => p[0] + p[1]).join();
function plain(board, rack) {
  const out = new Set(), first = !/[A-Z]/.test(board);
  for (const w of toy.words) {
    const W = w.toUpperCase();
    for (const side of first ? [0] : [0, 1]) for (let line = 0; line < SIZE; line++) for (let from = 0; from + W.length <= SIZE; from++) {   // the first word down is the first across, turned: not looked for twice
      const put = [], tiles = [...rack];
      let ok = true;
      for (let k = 0; k < W.length && ok; k++) {
        const i = side ? sq(from + k, line) : sq(line, from + k), have = board[i];
        if (have !== ".") { if (have.toUpperCase() !== W[k]) ok = false; continue; }
        const t = tiles.indexOf(W[k]);
        if (t < 0) ok = false; else { tiles.splice(t, 1); put.push([i, W[k]]); }
      }
      if (ok && put.length && !evaluate(board, put, toy.has).error) out.add(key(put));
    }
  }
  return out;
}
{
  const rng = seeded(2024);
  let positions = 0, plays = 0, wrong = 0, missed = 0, extra = 0;
  for (let game = 0; game < 3; game++) {
    let board = EMPTY;
    const bag = shuffle(fullBag().filter(t => t !== "?"), rng);
    for (let turn = 0; turn < 7; turn++) {
      const rack = bag.splice(0, 7).join(""), found = findPlays(board, rack, toy);
      const want = plain(board, rack), got = new Set(found.map(key));
      positions++;
      plays += got.size;
      for (const k of want) if (!got.has(k)) missed++;
      for (const k of got) if (!want.has(k)) extra++;
      for (const p of found) if (evaluate(board, p, toy.has).error) wrong++;
      if (!found.length) continue;
      const pick = found[Math.floor(rng() * found.length)];
      board = [...board].map((c, i) => { const p = pick.find(x => x[0] === i); return p ? p[1] : c; }).join("");
    }
  }
  check(positions === 21 && plays > 300, `${positions} positions, ${plays} plays found in all`);
  check(wrong === 0 && extra === 0, `every play the finder makes is a legal one (${wrong} refused, ${extra} not in the plain search)`);
  check(missed === 0, `…and it misses none that the plain search finds (${missed} missed)`);
  // blanks: each play the finder makes with one is legal, uses no more blanks than the rack has, and the letters are real tiles otherwise
  let blankPlays = 0, blankBad = 0;
  const board = boardOf([7, 5, "WORD"]);
  for (const p of findPlays(board, "AE?T", toy)) {
    const blanks = p.filter(x => x[1] === x[1].toLowerCase()).length;
    if (blanks) blankPlays++;
    const left = [..."AE?T"];
    for (const x of p) { const t = left.indexOf(x[1] === x[1].toLowerCase() ? "?" : x[1]); if (t < 0) blankBad++; else left.splice(t, 1); }
    if (evaluate(board, p, toy.has).error) blankBad++;
  }
  check(blankPlays > 20 && blankBad === 0, `plays with a blank (${blankPlays}) are legal and never use a tile the rack lacks`);
}
{
  // the levels know more or fewer words, and the harder never has fewer plays than the easier
  const rack = "RETAINS", empty = findPlays(EMPTY, rack, dictionary("easy")).length, hard = findPlays(EMPTY, rack, dictionary("hard")).length;
  check(dictionary("easy").words.length < dictionary("medium").words.length && dictionary("medium").words.length < dictionary("hard").words.length, "Easy knows fewer words than Medium, Medium fewer than Hard");
  check(empty > 0 && hard >= empty && LEVEL_NAMES.length === 3, `RETAINS opens with ${empty} plays for Easy, ${hard} for Hard`);
  check(leaveValue(["?", "S"]) > leaveValue(["Q", "V"]) && leaveValue(["E", "R", "T"]) > leaveValue(["I", "I", "I"]), "keeping a blank and an S is worth more than a Q and a V; three I's are worse than E R T");
}

// ---------- whole games ----------
const total = s => [...s.board].filter(c => c !== ".").length + s.bag.length + s.racks.reduce((n, r) => n + r.length, 0);
{
  const t0 = Date.now();
  let games = 0, steps = 0, lost = 0, refused = 0, unfinished = 0, scoreOff = 0, roundTrips = 0, restored = 0, bingos = 0;
  const run = (seats, level, seed) => {
    let G = newRecord(rules, { seats, seed }), n = 0, sum = new Array(seats).fill(0);
    while (!rules.over(G.state) && n < 400) {
      const seat = rules.toMove(G.state), mv = botMove(rules, G, seat, level), r = applyMove(rules, G, seat, mv);
      if (r.error) { refused++; console.log("refused:", level, seed, r.error, JSON.stringify(mv)); break; }
      const st = r.G.state;
      if (total(st) !== 100) lost++;
      if (st.last?.did === "play") { sum[seat] += st.last.score; if (st.last.bingo) bingos++; }
      if (n % 7 === 0) {
        roundTrips++;
        if (sameKeys(rules.restore(structuredClone(st)), rules.restore(roundTrip(structuredClone(st))))) restored++;
      }
      G = r.G;
      steps++;
      n++;
    }
    if (!rules.over(G.state)) unfinished++;
    else if (G.state.scores.some((v, i) => v !== sum[i] + G.state.final.adj[i])) scoreOff++;
    games++;
    return G;
  };
  for (const [seats, level, seed] of [[2, "easy", 1], [2, "medium", 3], [2, "hard", 5], [2, "hard", 6], [3, "medium", 7], [4, "easy", 8]]) run(seats, level, seed);
  check(refused === 0 && unfinished === 0, `${games} whole games of the three strengths, two to four seats, ${steps} moves, none of the computer's moves refused, all finished`);
  check(lost === 0 && scoreOff === 0, "every tile is accounted for after every move, and each score is its plays' sum and the end's settling");
  check(roundTrips > 20 && restored === roundTrips, `the state comes back whole through the database (${restored} of ${roundTrips} samples)`);
  console.log(`     (${Date.now() - t0} ms)`);
  // the best player beats the weakest, over a few games
  let hardWins = 0, ties = 0;
  for (let seed = 40; seed < 44; seed++) {
    let G = newRecord(rules, { seats: 2, seed });
    while (!rules.over(G.state)) {
      const seat = rules.toMove(G.state), level = seat === 0 ? "hard" : "easy";
      G = applyMove(rules, G, seat, botMove(rules, G, seat, level)).G;
    }
    const sc = G.state.scores;
    if (sc[0] > sc[1]) hardWins++; else if (sc[0] === sc[1]) ties++;
  }
  check(hardWins >= 3, `Hard beats Easy in ${hardWins} of 4 games`);
}

// ---------- the pages ----------
{
  const apps = fs.readFileSync(root + "apps.js", "utf8"), html = fs.readFileSync(root + "rack.html", "utf8"), page = fs.readFileSync(root + "rack.js", "utf8"), css = fs.readFileSync(root + "rack.css", "utf8");
  check(/id: "rack",[^\n]*href: "\.\/rack\.html"[^\n]*logo: LOGO\("rack", RACK_LOGO\)/.test(apps) && !/id: "rack"[^\n]*soon: true/.test(apps), "the tile opens the game, not the placeholder");
  check(/rack\.css/.test(html) && /rack\.js/.test(html) && /class="rack (full (titled )?)?fit-screen beside"/.test(html) && /id="board"/.test(html) && /id="rack"/.test(html) && /id="bar"/.test(html), "the page links its styles and script and has its board, rack and buttons");
  check(/seatPage\(/.test(page) && /seatRounds\("rack"/.test(page) && /noteStreak\("rack"/.test(page), "the page runs on seats-ui.js, tells Random its rounds and keeps its streak");
  check(/\.rk-board/.test(css) && /orientation: landscape\) and \(min-width: 700px/.test(css), "the stylesheet draws the board and has its sideways layout");
  const read = f => fs.readFileSync(root + f, "utf8");
  check(/id: "rack", name: "Rack", kind: "table", page: "rack\.html"/.test(read("party-core.js")), "Party lists it among the table games");
  check(/rack: \{ name: "Rack", page: "\.\/rack\.html" \}/.test(read("rooms.js")), "a table's room knows its page");
  check(/rack: "a game"/.test(read("random-core.js")) && !/rack: "not built yet"/.test(read("random-core.js")), "Random deals it, a game a round");
  check(/rack: "streak"/.test(read("suite.js")), "the games screen shows its streak");
  check(!/\brack\b/.test(read("soon-data.js").replace(/\/\/[^\n]*/g, "").replace(/line:[^\n]*|todo:[^\n]*|"[^"\n]*"/g, "")), "the placeholder's entry is gone");
}

console.log(bad ? `rack: ${bad} problems` : "rack: all fine");
if (bad) process.exitCode = 1;
