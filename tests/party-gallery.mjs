// Gallery (party-gallery.js), played in Node on the database in memory with the host's phone running it
// (tests/party-harness.js): a title the same as another, the real one refused as a title and anything too near it;
// a game: everyone drawing their own title, a blank page not hung; for each drawing, titles from everyone but its
// artist, the same title twice as one, the house making up the numbers; picks, never your own and never the artist's;
// the points (1,000 for the real title, 500 to the artist for each who found it, 500 for each one your title fooled);
// Next; the clock; a second round with new titles; the end; and the party's titles dealt last.
import { partyTable } from "./party-harness.js";
import gallery, { sameTitle, nearTitle, titleProblem, shownTitle, POINTS } from "../party-gallery.js";
import { TITLES } from "../party-draw-words.js";
import { encode } from "../party-draw.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const NAMES = ["Korbi", "Mei", "Ana", "Bo"];
const list = x => (x ? Object.values(x) : []);
const DRAWING = encode([{ c: 0, w: 1, p: [100, 100, 900, 900] }]);
const optsOf = t => list(t.state.opts).map(o => ({ ...o, by: list(o.by) }));

// ---------- titles ----------
check(sameTitle("A Nervous Lighthouse!", "a nervous lighthouse") && sameTitle("the dog's taxes", "a dog taxes") && !sameTitle("a nervous lighthouse", "a calm lighthouse"),
  "the same title: case, articles, apostrophes and plurals aside");
check(nearTitle("the very nervous lighthouse", "a nervous lighthouse") && !nearTitle("a lighthouse", "a nervous lighthouse") && !nearTitle("a shy volcano", "a nervous lighthouse"),
  "too near the real title: all of its words in it");
check(titleProblem("", "x y") === "Write a title." && /real title/.test(titleProblem("Nervous lighthouse.", "a nervous lighthouse")) && titleProblem("a lonely fridge", "a nervous lighthouse") === "",
  "what's wrong with a title, in words");
check(shownTitle("  a  lonely fridge. ") === "a lonely fridge" && shownTitle("x".repeat(80)).length === 50, "a title as the table sees it: tidied, at most fifty letters");
check(TITLES.length >= 120 && new Set(TITLES).size === TITLES.length && TITLES.every((a, i) => TITLES.every((b, j) => i === j || !sameTitle(a, b))), `${TITLES.length} titles to draw, no two alike`);

// ---------- a game ----------
{
  const t = await partyTable(NAMES);
  check(await t.start("gallery", {}) && t.state.step === "draw" && t.state.deadline - t.now === 90000, "Gallery starts with four: everyone draws, 90 seconds");
  const prompts = t.state.prompts, [u0, u1, u2, u3] = [0, 1, 2, 3].map(i => t.uid(i));
  check(new Set(Object.values(prompts)).size === 4 && Object.values(prompts).every(p => TITLES.includes(p)) && list(t.branch.shown.gallery).length === 4, "a different title each, remembered by the party");
  for (let i = 0; i < 3; i++) await t.send(i, { round: 0, d: DRAWING, done: true });
  check(t.state.step === "draw", "the drawings wait for everyone");
  await t.send(3, { round: 0, d: "", done: true });
  const art = list(t.state.art);
  check(t.state.step === "title" && art.length === 3 && !art.some(a => a.by === u3) && art.every(a => a.title === prompts[a.by] && a.d === DRAWING), "everyone done: the drawings hung, a blank page not");
  // the first drawing: titles from everyone but its artist
  const a = art[0], artist = t.seatOf(a.by), writers = [0, 1, 2, 3].filter(i => i !== artist);
  await t.send(writers[0], { round: 0, piece: 0, t: a.title });
  check(t.state.step === "title", "the real title isn't taken as another");
  await t.send(writers[0], { round: 0, piece: 0, t: "zz one title" });
  await t.send(writers[1], { round: 0, piece: 0, t: "ZZ One Title." });
  await t.send(writers[2], { round: 0, piece: 0, t: "zz other title" });
  const opts = optsOf(t), at = text => opts.findIndex(o => o.text.toLowerCase() === text);
  check(t.state.step === "pick" && opts.length === 4 && opts.filter(o => o.truth).length === 1 && opts.filter(o => o.house).length === 1 && opts[at("zz one title")].by.length === 2,
    "the titles in: the real one, the same title twice as one, the house's to make four");
  await t.send(artist, { round: 0, piece: 0, pick: opts.findIndex(o => o.truth) });
  await t.send(writers[0], { round: 0, piece: 0, pick: at("zz one title") });
  check(t.state.step === "pick", "the artist doesn't pick, and nobody picks their own title");
  await t.send(writers[0], { round: 0, piece: 0, pick: opts.findIndex(o => o.truth) });     // finds it
  await t.send(writers[1], { round: 0, piece: 0, pick: at("zz other title") });             // fooled by writer 2
  await t.send(writers[2], { round: 0, piece: 0, pick: at("zz one title") });               // fooled by writers 0 and 1
  const sc = t.state.scores, w = writers.map(i => t.uid(i));
  check(t.state.step === "reveal" && sc[w[0]] === POINTS.truth + POINTS.fool && sc[w[1]] === POINTS.fool && sc[w[2]] === POINTS.fool && sc[a.by] === POINTS.artist,
    `1,000 for the real title and 500 to its artist; 500 for each one your title fooled (${[...w, a.by].map(u => sc[u]).join(" ")})`);
  check(/fooled/.test(t.branch.say.text) && new RegExp(`The real title: ${a.title}`).test(t.branch.say.text), "the reveal read out");
  for (let i = 0; i < 4; i++) await t.send(i, { round: 0, piece: 0, next: true });
  check(t.state.step === "title" && t.state.at === 1, "everyone's Next: the next drawing");
  // the clock runs the rest
  for (const ms of [60000, 45000, 20000, 60000, 45000]) await t.tick(ms);
  check(t.state.step === "reveal" && t.state.at === 2, "the clock: titles and picks not made count for nothing, and the gallery goes on");
  await t.tick(20000);
  check(t.state.step === "over" && /That's the gallery/.test(t.branch.say.text) && list(t.state.winners).every(u => t.state.scores[u] === Math.max(...Object.values(t.state.scores))),
    "after the last drawing, the end and its winners");
}
{
  // two rounds: new titles for the second
  const t = await partyTable(NAMES.slice(0, 3));
  await t.start("gallery", { rounds: "2", secs: "60" });
  const first = Object.values(t.state.prompts);
  await t.tick(60000);
  check(t.state.step === "draw" && t.state.round === 1 && /Nothing was drawn/.test(t.branch.say.text) && Object.values(t.state.prompts).every(p => !first.includes(p)),
    "nothing drawn: on to the next round, with new titles");
  for (let i = 0; i < 3; i++) await t.send(i, { round: 1, d: DRAWING, done: true });
  check(t.state.step === "title" && list(t.state.art).length === 3, "the second round's drawings hung");
}
{
  // the party's titles dealt last
  const s = gallery.start({ players: [{ uid: "a", name: "A" }, { uid: "b", name: "B" }, { uid: "c", name: "C" }], options: {}, rng: Math.random, now: 0, shown: TITLES.slice(3) });
  check(Object.values(s.prompts).sort().join() === TITLES.slice(0, 3).sort().join(), "the titles the party hasn't had come first");
}
{
  const t = await partyTable(NAMES.slice(0, 2));
  check(!(await t.start("gallery", {})), "Gallery doesn't start with two");
}
check(gallery.min === 3 && gallery.max === 10 && gallery.keepsView, "three to ten players");

console.log(bad ? `party-gallery: ${bad} failed` : "party-gallery: every check passed");
process.exit(bad ? 1 : 0);
