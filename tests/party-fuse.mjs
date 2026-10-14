// Fuse (party-fuse.js, its words party-fuse-words.js), played in Node on the database in memory with the host's phone
// running it (tests/party-harness.js): the dictionary (decoded from its front-coding) and the letters a turn asks for;
// what makes a word count; a game: a word passing the bomb on with new letters, words that don't count, a word for
// another turn, the bomb going off at its hidden time, a life lost and the next bomb, the alphabet's life back, a player
// out, the last one winning; a holder who leaves; two players.
import { partyTable } from "./party-harness.js";
import fuse, { dictionary, wordProblem, examples, BONUS, FUSES } from "../party-fuse.js";
import { PROMPTS } from "../party-fuse-words.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the words ----------
const d = dictionary();
check(d.size === 79205, `the dictionary: ${d.size} words`);
check(["bringing", "kingdom", "colour", "color", "aardvark", "zymurgy", "queue", "rhythm"].every(w => d.has(w)) && !["xyzzy", "zxqv", "ab", "london"].some(w => d.has(w)),
  "common and rare words, British and American spellings; no names, no two-letter words, no nonsense");
check([...d].every(w => /^[a-z]{3,}$/.test(w)), "every word is three letters or more, a to z");
check(["easy", "medium", "hard"].every(k => PROMPTS[k].length > 100) && Object.values(PROMPTS).flat().every(p => /^[a-z]{2,3}$/.test(p)), "the letters a turn asks for: two or three, a hundred or more at each level");
{
  const count = p => { let n = 0; for (const w of d) if (w.includes(p)) n++; return n; };
  const fewest = PROMPTS.hard.reduce((m, p) => Math.min(m, count(p)), Infinity);
  check(fewest >= 60, `even the hardest letters are in ${fewest} words or more`);
}
check(wordProblem("Bringing", "ing") === "" && wordProblem("  KING! ", "ing") === "", "a word counts in any case, spaces and punctuation aside");
check(wordProblem("crown", "ing") === "No ING in it." && wordProblem("bringing", "ing", ["bringing"]) === "Played already." && wordProblem("zinging", "ing") === "" && wordProblem("blinging", "ing") === "Not in the dictionary.",
  "a word without the letters, one played already, one not in the dictionary");
check(examples("ing").join() === "ding,king,ping" && !examples("ing", ["ding"]).includes("ding"), "after a bomb, the shortest words that would have done, none played");
check(BONUS.length === 21 && !/[kwxyz]/.test(BONUS), "the alphabet bonus: 21 letters, all but k, w, x, y and z");

// ---------- a game ----------
const NAMES = ["Korbi", "Mei", "Ana", "Bo"];
const st = t => t.state;
const wordFor = (prompt, used = []) => { let best = null; for (const w of d) if (w.includes(prompt) && !used.includes(w) && (!best || w.length < best.length)) best = w; return best; };
const play = (t, word) => t.send(t.seatOf(st(t).holder), { word, tn: st(t).tn });
{
  const t = await partyTable(NAMES.slice(0, 3));
  check(await t.start("fuse", { lives: "2", level: "easy" }) && st(t).step === "play" && Object.values(st(t).lives).every(n => n === 2) && PROMPTS.easy.includes(st(t).prompt),
    "Fuse starts with three, two lives each, easy letters");
  const [lo, hi] = FUSES.normal, left = st(t).ends - t.now;
  check(left >= lo * 1000 && left <= hi * 1000 && /has the bomb/.test(t.branch.say.text), `a bomb lit for a time nobody sees (${Math.round(left / 1000)} seconds)`);
  const h1 = st(t).holder, p1 = st(t).prompt, other = Object.values(st(t).order).find(u => u !== h1);
  await t.send(t.seatOf(other), { word: wordFor(p1), tn: st(t).tn });
  check(st(t).holder === h1, "only the holder's word counts");
  await play(t, "zzzzzz");
  check(st(t).holder === h1, "a word not in the dictionary doesn't pass the bomb");
  await t.send(t.seatOf(h1), { word: wordFor(p1), tn: st(t).tn - 1 });
  check(st(t).holder === h1, "a word for another turn doesn't either");
  const w1 = wordFor(p1), tn = st(t).tn;
  await play(t, w1.toUpperCase());
  const order = Object.values(st(t).order);
  check(st(t).holder === order[(order.indexOf(h1) + 1) % 3] && st(t).prompt !== p1 && Object.values(st(t).used).includes(w1) && st(t).tn === tn + 1,
    `a word that counts (${w1}) passes the bomb to the next player, with new letters`);
  check(st(t).ends - t.now === left, "the bomb's time runs on as it's passed");
  const h2 = st(t).holder;
  await t.tick(st(t).ends - t.now);
  check(st(t).step === "boom" && st(t).lives[h2] === 1 && st(t).boom.uid === h2 && /Boom!/.test(t.branch.say.text), "it goes off in the holder's hands: a life lost");
  await t.tick(5000);
  check(st(t).step === "play" && st(t).holder === order[(order.indexOf(h2) + 1) % 3] && st(t).bombs === 2, "a new bomb, lit, in the next player's hands");
  // the alphabet bonus: one letter short, a word with it wins the life back
  const h3 = st(t).holder;
  await t.act(t.seatOf(h3), g => { g.lives[h3] = 1; g.letters = { ...(g.letters || {}), [h3]: BONUS.replace("v", "") }; g.prompt = "ive"; });
  await play(t, wordFor("ive"));
  check(st(t).lives[h3] === 2 && !st(t).letters?.[h3] && /every letter: a life back/.test(t.branch.say.text), "every common letter used: a life back, and the letters start again");
  // out: down to the last
  const h4 = st(t).holder;
  await t.act(t.seatOf(h4), g => { g.lives[h4] = 1; });
  await t.tick(st(t).ends - t.now);
  check(st(t).lives[h4] === 0 && st(t).boom.out && /is out/.test(t.branch.say.text), "out of lives, out");
  await t.tick(5000);
  check(st(t).holder !== h4, "the bomb never goes to a player who's out");
  const h5 = st(t).holder;
  await t.act(t.seatOf(h5), g => { g.lives[h5] = 1; });
  await t.tick(st(t).ends - t.now);
  const last = order.find(u => u !== h4 && u !== h5);
  check(st(t).step === "over" && Object.values(st(t).winners).join() === last && /wins!/.test(t.branch.say.text), "the last player with a life wins");
}
{
  // a holder who leaves, and two players
  const t = await partyTable(NAMES.slice(0, 3));
  await t.start("fuse", {});
  const h1 = st(t).holder;
  await t.leave(t.seatOf(h1));
  check(st(t).step === "play" && st(t).holder !== h1, "a holder who leaves passes the bomb on");
  await t.leave(t.seatOf(st(t).holder));
  check(st(t).step === "over" && Object.values(st(t).winners).length === 1, "with one player left, the game is over");
  const t2 = await partyTable(NAMES.slice(0, 2));
  check(await t2.start("fuse", { fuse: "short" }) && st(t2).ends - t2.now <= FUSES.short[1] * 1000, "two can play; a short fuse burns shorter");
}
check(fuse.min === 2 && fuse.max === 12 && ["level", "lives", "fuse"].every(id => fuse.options.some(o => o.id === id)), "two to twelve players; the letters' level, lives and the fuse");

console.log(bad ? `party-fuse: ${bad} failed` : "party-fuse: every check passed");
process.exit(bad ? 1 : 0);
