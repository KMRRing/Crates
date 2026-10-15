// Whispers (party-whispers.js), played in Node on the database in memory with the host's phone running it
// (tests/party-harness.js): how the books go round (each page by the next hand, every hand in every book, ending on
// words; at an even table the owner draws their own first page), what each player is passed; a game through: first
// pages written, drawn, named, the books shown a page at a time by anyone's Next (a second tap or an old one moving
// nothing), read out, to the end; the clock taking a drawing as it stands and the book's words for a page nobody wrote;
// a player who leaves; first pages from the book, none the party has had.
import { partyTable } from "./party-harness.js";
import whispers, { pagesFor, kindOf, workerOf, bookOf, wordsFor, PACES } from "../party-whispers.js";
import { PHRASES } from "../party-draw-words.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const NAMES = ["Korbi", "Mei", "Ana", "Bo", "Lin"];
const books = t => Object.values(t.state.order).map((_, i) => Object.values(t.state.books?.[i]?.pages || {}));

// ---------- how the books go round ----------
check([3, 4, 5, 6, 7].map(pagesFor).join() === "3,5,5,7,7" && kindOf(0) === "write" && kindOf(1) === "draw" && kindOf(2) === "guess" && kindOf(5) === "draw",
  "a book's pages: the first written, then drawn and named in turn, always ending on words");
{
  let ok = true, own = true;
  for (let n = 3; n <= 10; n++) for (let k = 0; k < pagesFor(n); k++) {
    const hands = Array.from({ length: n }, (_, b) => workerOf(b, k, n));
    if (new Set(hands).size !== n || hands.some((w, b) => bookOf(w, k, n) !== b)) ok = false;
  }
  for (let n = 3; n <= 10; n++) for (let b = 0; b < n; b++) {
    const hands = Array.from({ length: pagesFor(n) }, (_, k) => workerOf(b, k, n));
    if (new Set(hands).size !== n || hands[0] !== b || (n % 2 === 0 && hands[1] !== b)) own = false;
  }
  check(ok, "each page round, every player has exactly one book in hand");
  check(own, "every player's hand is in every book; at an even table the owner draws their own first page");
}
check(wordsFor({ pages: [{ t: "a cat" }, { d: "x" }, { blank: true }] }, 3) === "a cat" && wordsFor({ pages: [{ t: "a cat" }, { d: "x" }, { t: "a dog" }] }, 3) === "a dog",
  "the words to draw: the page before, or the last words in the book when it was left blank");

// ---------- a game ----------
{
  const t = await partyTable(NAMES.slice(0, 3));
  check(await t.start("whispers", {}) && t.state.step === "write" && t.state.k === 0 && t.state.deadline - t.now === PACES.normal.write * 1000, "Whispers starts with three: first pages, 45 seconds");
  check(/first page/.test(t.branch.say.text) && Object.values(t.state.offer).every(o => Object.values(o).length === 3), "the narrator asks for first pages; the book offers each player three");
  for (let i = 0; i < 3; i++) await t.send(i, { k: 0, t: `first page ${i}`, done: i !== 2 });
  check(t.state.step === "write", "a page not yet done is waited for");
  await t.send(2, { k: 0, t: "first page 2", done: true });
  check(t.state.step === "draw" && t.state.k === 1 && books(t).every((b, i) => b[0].t === `first page ${i}` && b[0].by === t.uid(i)), "everyone done: each book has its owner's first page, and the drawing starts");
  check(/draw what's written/.test(t.branch.say.text), "the narrator says what to do");
  // each draws the book passed to them: player i has book i-1's words
  for (let i = 0; i < 3; i++) await t.send(i, { k: 1, d: `drawing ${i}`, done: true });
  const b1 = books(t);
  check(t.state.step === "guess" && b1.every((b, j) => b[1].d === `drawing ${(j + 1) % 3}` && b[1].by === t.uid((j + 1) % 3)), "each first page drawn by the next player round");
  await t.send(0, { k: 2, t: "a guess", done: true });
  await t.send(0, { k: 1, t: "stale", done: true });
  check(t.state.step === "guess", "a page sent for another step counts for nothing");
  for (let i = 0; i < 3; i++) await t.send(i, { k: 2, t: `guess ${i}`, done: true });
  const b2 = books(t);
  check(t.state.step === "show" && b2.every((b, j) => b.length === 3 && b[2].t === `guess ${(j + 2) % 3}`), "named by the player after: three pages a book, and the books are shown");
  check(t.state.book === 0 && t.state.page === 0 && /Every book has been round. Korbi's book. Korbi wrote: first page 0/.test(t.branch.say.text), "the first book's first page read out");
  await t.send(1, { next: "0.0" });
  check(t.state.page === 1 && /Mei drew that/.test(t.branch.say.text), "anyone's Next turns the page");
  await t.send(2, { next: "0.0" });
  check(t.state.page === 1, "a Next for a page already turned moves nothing");
  await t.send(2, { next: "0.1" });
  check(t.state.page === 2 && /Ana took it for: guess 2. And that's how it ended/.test(t.branch.say.text), "the book's last words, read as its ending");
  await t.send(0, { next: "0.2" });
  check(t.state.book === 1 && t.state.page === 0 && /Mei's book/.test(t.branch.say.text), "then the next book");
  for (const at of ["1.0", "1.1", "1.2", "2.0", "2.1", "2.2"]) await t.send(1, { next: at });
  check(t.state.step === "over" && !Object.values(t.state.winners || {}).length && /every book/.test(t.branch.say.text), "every book shown: the end, with no winner");
}
{
  // four players: the owner draws their own first page; the clock; a page nobody wrote; one who leaves
  const t = await partyTable(NAMES.slice(0, 4));
  await t.start("whispers", { pace: "quick" });
  await t.send(0, { k: 0, t: "a boat", done: true });
  await t.send(1, { k: 0, t: "a goat", done: false });          // typed, not done
  await t.tick(PACES.quick.write * 1000);
  const b = books(t), offer = Object.values(t.state.offer[t.uid(2)]);
  check(t.state.step === "draw" && b[1][0].t === "a goat" && b[2][0].house && b[2][0].t === offer[0], "the clock: words typed are taken, and a page nobody wrote is the book's");
  for (let i = 0; i < 4; i++) await t.send(i, { k: 1, d: `own ${i}`, done: i < 2 });
  await t.send(2, { k: 1, d: "half done" });
  await t.tick(PACES.quick.draw * 1000);
  const b1 = books(t);
  check(t.state.step === "guess" && b1.every((bk, j) => bk[1].by === t.uid(j)) && b1[2][1].d === "half done", "at an even table each draws their own first page; a drawing still going is taken as it stands");
  const bo = t.uid(3);
  await t.leave(3);
  for (let i = 0; i < 3; i++) await t.send(i, { k: 2, t: `name ${i}`, done: true });
  const b2 = books(t), blankBook = b2.findIndex(bk => bk[2].blank);
  check(t.state.step === "draw" && blankBook >= 0 && b2[blankBook][2].by === bo, "a player who leaves isn't waited for; their page is left blank");
  check(wordsFor({ pages: b2[blankBook] }, 3) === b2[blankBook][0].t, "and the next to draw it gets the book's last words");
}
{
  // first pages from the book: none the party has had, and the party remembers them
  const t = await partyTable(NAMES.slice(0, 3));
  await t.start("whispers", { first: "book" });
  const firsts = books(t).map(b => b[0].t);
  check(t.state.step === "draw" && t.state.k === 1 && firsts.every(p => PHRASES.includes(p)) && new Set(firsts).size === 3, "from the book: everyone starts by drawing a page of the book's");
  check(firsts.every(p => Object.values(t.branch.shown.whispers).includes(p)), "the party remembers them");
  const s = whispers.start({ players: [{ uid: "a", name: "A" }, { uid: "b", name: "B" }, { uid: "c", name: "C" }], options: { first: "book" }, rng: Math.random, now: 0, shown: PHRASES.slice(3) });
  check(s.books.map(b => b.pages[0].t).sort().join() === PHRASES.slice(0, 3).sort().join(), "the book's pages the party hasn't had come first");
}
{
  const t = await partyTable(NAMES.slice(0, 2));
  check(!(await t.start("whispers", {})), "Whispers doesn't start with two");
}
check(whispers.min === 3 && whispers.max === 10 && whispers.keepsView && PHRASES.length >= 120 && new Set(PHRASES).size === PHRASES.length, `three to ten; ${PHRASES.length} first pages in the book, each once`);

console.log(bad ? `party-whispers: ${bad} failed` : "party-whispers: every check passed");
process.exit(bad ? 1 : 0);
