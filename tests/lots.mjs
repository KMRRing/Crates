// Lots (README, Lots): the bank of categories, the wordplay rules, the generator (exactly one way to sort every board,
// decoys counted), the difficulty it measures and the levels it deals, the computer player, a solo board through
// classic and the wall and through JSON, the pair's table through the database's round trip, the hidden split, the
// crossed one, and the daily.
import { CATS, BY_ID, SET, TOPICS, PRESETS, LEVELS, LEVEL, SIZE, MISTAKES, WALL, fits, fitsOf, reason, deal, daily, analyse,
  solutions, sortings, classify, points, wallPoints, reverseRainbow, namingOptions, split, SPLITS, cleanMix } from "../lots-engine.js";
import { plan, at, RIVALS } from "../lots-bot.js";
import * as run from "../lots-run.js";
import * as room from "../lots-room.js";
import { tierOf } from "../wordlist.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- the bank ----------
{
  const problems = [];
  const ids = new Set();
  for (const c of CATS) {
    if (ids.has(c.id)) problems.push(`two categories ${c.id}`);
    ids.add(c.id);
    if (c.w.length <= SIZE) problems.push(`${c.id}: ${c.w.length} members, more than four needed`);
    if (new Set(c.w).size !== c.w.length) problems.push(`${c.id}: a member twice`);
    for (const w of c.x) if (c.w.includes(w)) problems.push(`${c.id}: ${w} both a member and an also`);
    for (const w of [...c.w, ...c.x]) if (!/^[A-Z]+$/.test(w)) problems.push(`${c.id}: ${w} isn't one word in capitals`);
    for (const w of c.w) if (w.length > 11) problems.push(`${c.id}: ${w} is too long for a tile`);
    if (c.rule) for (const w of c.w) if (!fits(c, w)) problems.push(`${c.id}: ${w} doesn't fit its own rule`);
    for (const r of c.refs) if (!BY_ID.has(r)) problems.push(`${c.id}: @${r} names no category`);
    if (!TOPICS.some(([t]) => t === c.topic) || ![1, 2, 3, 4].includes(c.d) || !c.name) problems.push(`${c.id}: topic, difficulty or name`);
    if (c.set && !SET[c.set]) problems.push(`${c.id}: no set ${c.set}`);
  }
  check(!problems.length, `every category: more than four members, none twice, one word each, short enough, its rule's members fit it${problems.length ? `:\n    ${problems.slice(0, 12).join("\n    ")}` : ""}`);
  check(CATS.length >= 300 && TOPICS.every(([t]) => CATS.filter(c => c.topic === t).length >= 15) && [1, 2, 3, 4].every(d => CATS.filter(c => c.d === d).length >= 25),
    `a bank of ${CATS.length} categories, every topic and every difficulty well stocked`);
  // every phrase lists every word of the bank that makes it (the word list says FOOT·BALL is a word); these don't read as one
  const NOT_PHRASES = new Set(["_fly BRIE", "ear- NEST", "star- RING", "star- RED", "_saw FORE", "_saw OVER"]);
  const words = [...new Set(CATS.flatMap(c => c.w))], missing = [];
  for (const c of CATS) if (c.key) for (const w of words) {
    if (w === c.key || c.all.has(w) || NOT_PHRASES.has(`${c.id} ${w}`)) continue;
    const t = tierOf((c.kind === "after" ? w + c.key : c.key + w).toLowerCase());
    if (t >= 0 && t <= 4) missing.push(`${c.id}: ${w}`);
  }
  check(!missing.length, `every phrase takes in every word of the bank that makes it (${CATS.filter(c => c.key).length} phrases, ${words.length} words)${missing.length ? `: not ${missing.slice(0, 10).join(", ")}` : ""}`);
  const rev = BY_ID.get("reverse"), unlisted = words.filter(w => { const r = [...w].reverse().join(""); return r !== w && !rev.all.has(w) && tierOf(r.toLowerCase()) >= 0 && tierOf(r.toLowerCase()) <= 3; });
  check(!unlisted.length, `every word of the bank that reads as another backwards fits "Another word backwards"${unlisted.length ? `: not ${unlisted.join(" ")}` : ""}`);
  check(BY_ID.get("scales").all.has("HALIBUT") && BY_ID.get("bark").all.has("BEAGLE") && BY_ID.get("bark").all.has("OAK"), "an @ reference takes in another category's words (every fish has scales)");
}

// ---------- the rules ----------
{
  const c = id => BY_ID.get(id);
  check(fits(c("hid-animal"), "BULLION") && fits(c("hid-animal"), "PLANT") && !fits(c("hid-animal"), "LION") && reason(c("hid-animal"), "MOLECULE") === "MOLE inside",
    "hidden: an animal inside a word counts, three letters too (PLANT), the animal itself doesn't");
  check(fits(c("start-body"), "LEGEND") && !fits(c("start-body"), "LEG") && fits(c("anag-country"), "PURE") && !fits(c("anag-country"), "PERU") && reason(c("anag-country"), "PURE") === "PERU rearranged",
    "starts and anagrams: LEGEND, PURE for PERU, neither the word itself");
  check(fits(c("front-body"), "GLOBE") && reason(c("front-body"), "GLOBE") === "G + LOBE" && fits(c("back-body"), "SKINT") && !fits(c("back-body"), "LEGS"),
    "a letter and a word, a word and a letter (not a plural)");
  check(fits(c("lose-country"), "PAIN") && !fits(c("lose-country"), "SPAIN") && reason(c("lose-country"), "ALES") === "W·ALES", "a word without its first letter");
  check(fits(c("palindrome"), "KAYAK") && !fits(c("palindrome"), "KAYAKS") && fits(c("novowel"), "LYNX") && !fits(c("novowel"), "LYNXES") && fits(c("alpha"), "ALMOST") && !fits(c("alpha"), "ALSO"),
    "palindromes, no vowels, letters in order (five letters or more)");
  check(fitsOf("BASS").has("fish") && fitsOf("BASS").has("instruments") && reason(c("_ball"), "FOOT") === "FOOT·BALL" && reason(c("reverse"), "STAR") === "RATS",
    "a word fits every category that has it (BASS: a fish and an instrument); a phrase and a reversal explain themselves");
}

// ---------- the solver ----------
{
  const A = { id: "a", rule: null, all: new Set(["A1", "A2", "A3", "A4", "X"]) }, B = { id: "b", rule: null, all: new Set(["B1", "B2", "B3", "X"]) };
  const C = { id: "c", rule: null, all: new Set(["C1", "C2", "C3", "C4"]) }, D = { id: "d", rule: null, all: new Set(["D1", "D2", "D3", "D4", "A4"]) };
  const words = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "X", "C1", "C2", "C3", "C4", "D1", "D2", "D3", "D4"];
  check(solutions(words, [A, B, C, D]) === 1, "a herring the board forces home (X fits A and B, and B has nowhere else to find a fourth) leaves one sorting");
  const A2 = { ...A, all: new Set([...A.all, "B1"]) }, B2 = { ...B, all: new Set([...B.all, "A1"]) };
  check(solutions(words.map(w => (w === "X" ? "B4" : w)), [A2, { ...B2, all: new Set([...B2.all, "B4"]) }, C, D]) === 2,
    "two herrings between the same lots that could swap give two sortings");
  check(sortings(words, [A, B, C, D]).length === 1 && sortings([...words.slice(0, 15), "ZZ"], [A, B, C, D]).length === 0, "the sortings, as strings, and none for a board that can't be sorted");
}

// ---------- the generator, the levels and the grading ----------
const N = 90;
const dealt = Object.fromEntries(LEVELS.map(level => [level, []]));
{
  const problems = [], slow = [];
  for (const level of LEVELS) for (let seed = 1; seed <= N; seed++) {
    const t0 = Date.now(), b = deal({ seed: seed * 101 + 3, level }), ms = Date.now() - t0;
    if (ms > 400) slow.push(`${level} ${seed}: ${ms} ms`);
    if (!b) { problems.push(`${level} ${seed}: none dealt`); continue; }
    dealt[level].push(b);
    const cats = b.g.map(g => BY_ID.get(g.c)), words = b.g.flatMap(g => g.w);
    if (new Set(words).size !== 16 || b.g.length !== SIZE || b.g.some(g => g.w.length !== SIZE)) problems.push(`${level} ${seed}: not sixteen words in four lots`);
    if (b.g.some((g, k) => g.w.some(w => !fits(cats[k], w)))) problems.push(`${level} ${seed}: a word outside its lot's category`);
    if (solutions(words, cats, 3) !== 1) problems.push(`${level} ${seed}: not one sorting`);
    // a brute check of the same: every word in every category it fits, four to each, every way
    const options = words.map(w => cats.map((c, k) => (fits(c, w) ? k : -1)).filter(k => k >= 0));
    let ways = 0;
    (function go(i, room) { if (i === 16) { ways++; return; } for (const k of options[i]) if (room[k]) { room[k]--; go(i + 1, room); room[k]++; } })(0, [4, 4, 4, 4]);
    if (ways !== 1) problems.push(`${level} ${seed}: ${ways} sortings by brute force`);
    if (b.g.some(g => g.w.some(w => cats.some(c => c.key && (w === c.key || w.includes(c.key)))))) problems.push(`${level} ${seed}: a tile holds a phrase's key`);
    const a = analyse(b), [least, most] = LEVEL[level].herrings;
    if (a.herrings.length < least || a.herrings.length + a.phantoms.length > most) problems.push(`${level} ${seed}: ${a.herrings.length} herrings, ${a.phantoms.length} decoys`);
    if (level === "hard" && !a.herrings.some(([, k, j]) => cats[j].d < cats[k].d)) problems.push(`hard ${seed}: no herring that bites`);
    if (level === "easy" && (a.phantoms.length || a.lookPast)) problems.push(`easy ${seed}: a decoy or a look past`);
    if (b.g.some((g, k) => k && cats[k].d < cats[k - 1].d)) problems.push(`${level} ${seed}: lots not ranked easiest first`);
  }
  check(!problems.length, `${N * 3} boards, a third at each level: sixteen words, each in a lot whose category it fits, one way to sort them (by the solver and by brute force), no tile holding a phrase's key, the level's herrings and decoys, ranked easiest first${problems.length ? `:\n    ${problems.slice(0, 10).join("\n    ")}` : ""}`);
  check(!slow.length, `every deal under 400 ms${slow.length ? `: not ${slow.slice(0, 5).join(", ")}` : ""}`);
  check(same(deal({ seed: 77, level: "hard" }), deal({ seed: 77, level: "hard" })) && !same(deal({ seed: 77, level: "hard" }), deal({ seed: 78, level: "hard" })), "the same seed deals the same board; another seed another");
  const grades = level => dealt[level].map(b => analyse(b).grade), mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  const [e, m, h] = LEVELS.map(grades);
  check(Math.max(...e) < Math.min(...h) && mean(e) + 2 < mean(m) && mean(m) + 2 < mean(h),
    `the grade (links, look-pasts, herrings, decoys) separates the levels: Easy ${Math.min(...e)}–${Math.max(...e)}, Medium ${Math.min(...m)}–${Math.max(...m)} (mean ${mean(m).toFixed(1)}), Hard ${Math.min(...h)}–${Math.max(...h)}`);
  const share = level => dealt[level].filter(b => analyse(b).herrings.length).length / dealt[level].length;
  const two = dealt.hard.filter(b => analyse(b).herrings.length === 2).length / dealt.hard.length;
  check(share("easy") === 0 && share("medium") > 0.25 && share("medium") < 0.7 && share("hard") === 1 && two > 0.05 && two < 0.5 && dealt.hard.every(b => analyse(b).lookPast >= 1),
    `herrings: none on Easy, ${Math.round(share("medium") * 100)}% of Medium boards, every Hard board (${Math.round(two * 100)}% two), every Hard board makes you find a harder lot first`);
  const narrow = deal({ seed: 5, level: "medium", weights: { ...Object.fromEntries(TOPICS.map(([t]) => [t, 0])), mk: 1, wp: 1, ph: 1, sc: 1 } });
  check(narrow && narrow.g.every(g => ["mk", "wp", "ph", "sc"].includes(BY_ID.get(g.c).topic)) && same(cleanMix({ wp: 0, ph: 0, mn: 0, th: 0, mk: 0, sc: 0, pl: 0, cu: 0, sp: 0, fd: 0 }), PRESETS.balanced.topics),
    "the topics a player leaves out aren't dealt; a mix of nothing is every topic");
  const recent = deal({ seed: 9, level: "medium" }).g.map(g => g.c);
  let again = 0;
  for (let s = 10; s < 40; s++) again += deal({ seed: s, level: "medium", recent }).g.filter(g => recent.includes(g.c)).length;
  check(again < 8, `categories dealt lately come back rarely (${again} in 30 boards)`);
}

// ---------- the computer player ----------
{
  const stats = (level, boards) => {
    let mistakes = 0, won = 0, time = 0;
    boards.forEach((b, i) => { const p = plan(b, level, i + 1), r = at(p, Infinity); mistakes += r.mistakes; if (r.won) { won++; time += p.end; } });
    return { mistakes: mistakes / boards.length, won: won / boards.length, time: time / Math.max(1, won) };
  };
  const easy = dealt.easy.slice(0, 50), hard = dealt.hard.slice(0, 50);
  const [ne, ce, ee] = Object.keys(RIVALS).map(r => stats(r, easy)), [nh, ch, eh] = Object.keys(RIVALS).map(r => stats(r, hard));
  check(nh.mistakes > ch.mistakes && ch.mistakes > eh.mistakes && nh.time > ch.time && ch.time > eh.time,
    `the better player makes fewer mistakes and finishes sooner (Hard: Novice ${nh.mistakes.toFixed(2)} mistakes in ${Math.round(nh.time / 1000)} s, Club ${ch.mistakes.toFixed(2)}, Expert ${eh.mistakes.toFixed(2)} in ${Math.round(eh.time / 1000)} s)`);
  check(ce.mistakes < ch.mistakes && ce.time < ch.time && ne.won >= nh.won && ee.won >= eh.won, "every player makes more mistakes and takes longer on Hard than on Easy: the grading agrees with play");
  const b = dealt.medium[0], p = plan(b, "club", 3);
  check(same(p, plan(b, "club", 3)) && p.events.every((e, i) => !i || e.t >= p.events[i - 1].t) && at(p, 0).found.length === 0 && at(p, Infinity).done,
    "a rival's game is fixed by its seed, its moves in time, nothing done at the start and over in the end");
  const first = p.events.find(e => e.kind === "found");
  check(first && BY_ID.get(b.g[first.g].c).d <= Math.max(...b.g.map(g => BY_ID.get(g.c).d)) && p.events.filter(e => e.kind === "found").every(e => e.words.every(w => b.g[e.g].w.includes(w))),
    "it puts in only lots it has right when it's sure, the plainer ones as they come to it");
}

// ---------- a solo board, classic and the wall, through JSON ----------
{
  const b = dealt.medium[1], J = r => JSON.parse(JSON.stringify(r));
  let r = run.newRun({ board: b, rival: "club" });
  check(run.isRun(r) && r.order.length === 16 && new Set(r.order).size === 16 && r.rival.plan.events.length > 0 && same(run.newRun({ board: b }).order, r.order), "a new run: the sixteen in an order of its own, the rival's game with it");
  const lotWords = k => b.g[k].w;
  // a wrong guess, one away, then the same again, then right
  const odd = lotWords(1)[0];
  for (const w of [...lotWords(0).slice(0, 3), odd]) run.pick(r, w);
  r = J(r);
  check(r.sel.length === 4 && run.pick(r, lotWords(2)[0]) === null, "four picks at most");
  let res = run.submit(r);
  check(res.res === "one" && r.mistakes === 1 && r.sel.length === 4, "three of a lot and one other: one away, a mistake, the picks kept to change one");
  check(run.submit(r).why === "tried" && r.mistakes === 1, "the same four again is turned down, no mistake");
  run.pick(r, odd); run.pick(r, lotWords(0)[3]);
  res = run.submit(J(r)) && run.submit(r);
  check(res.res === "right" && res.g === 0 && r.found.length === 1 && r.sel.length === 0 && run.placedOf(r).size === 4 && run.leftOf(r).length === 12, "right: the lot found, its words out of play");
  r = J(r);
  for (const k of [2, 1]) { for (const w of lotWords(k)) run.pick(r, w); run.submit(r); }
  check(r.done && r.won && r.found.length === 4 && same(r.found.slice(0, 3), [0, 2, 1]) && run.scoreOf(r) === points(4, 1, true) && run.scoreOf(r) === 7,
    "three found, the fourth falls into place: solved with one mistake, 7 of 8");
  check(run.dayScore(r) === 7 * 100000 + 99999 && run.versus(r) && [1, -1, 0].includes(run.versus(r).result), "the day's figure is points then time; you against the computer has a result");
  let lost = run.newRun({ board: b });
  for (let i = 0; i < MISTAKES; i++) { run.clearPicks(lost); for (let k = 0; k < 4; k++) run.pick(lost, b.g[k].w[i]); run.submit(lost); }
  check(lost.done && !lost.won && lost.mistakes === MISTAKES && run.scoreOf(lost) === 0, "the fourth mistake ends a classic board");
  check(reverseRainbow([3, 2, 1, 0]) && !reverseRainbow([0, 1, 2, 3]) && wallPoints(4, 4) === 10 && wallPoints(3, 2) === 5, "the reverse rainbow; the wall's points, ten for everything");
  // the wall
  let w = run.newRun({ board: b, mode: "wall" });
  check(!w.rival && w.lives === null && run.phaseOf(w) === "play", "a wall: no rival, lives only later");
  for (const x of [...lotWords(0).slice(0, 3), lotWords(1)[0]]) res = run.pick(w, x);
  check(res.res === "wrong" && w.sel.length === 0 && w.lives === null, "on the wall the fourth pick is the guess; wrong says no more than wrong, and costs nothing yet");
  for (const k of [0, 1]) for (const x of lotWords(k)) run.pick(w, x);
  check(w.found.length === 2 && w.lives === WALL.lives, "two lots found: three lives from now on");
  for (let i = 0; i < WALL.lives; i++) { const ws = [lotWords(2)[0], lotWords(2)[1], lotWords(3)[i], lotWords(3)[i + 1]]; for (const x of ws) run.pick(w, x); }
  check(run.phaseOf(w) === "name" && w.out === "lives" && !w.done, "out of lives: the wall freezes, the links to name");
  w = J(w);
  const offered = [];
  for (let k = 0; k < SIZE; k++) { const opts = run.namingFor(w, k); offered.push(opts.length === 4 && opts.includes(b.g[k].c)); run.nameLot(w, k < 3 ? b.g[k].c : opts.find(o => o !== b.g[k].c)); }
  check(offered.every(Boolean), "four links offered for every lot, its own among them");
  check(w.done && run.scoreOf(w) === 2 + 3 && run.maxScore(w) === 10, "every lot named, found or not: 2 lots and 3 links make 5 of 10");
  const t = run.newRun({ board: b, mode: "wall" });
  check(!run.tick(t, WALL.ms - 1) && run.tick(t, 5000) && t.out === "time" && t.ms === WALL.ms && run.wallLeft(t) === 0, "two and a half minutes, then the wall freezes");
  check(!run.isRun({ ...r, v: 0 }) && !run.isRun({ ...r, order: r.order.slice(1) }), "a stored run this code can't play is refused");
}

// ---------- naming ----------
{
  const b = dealt.hard[2], problems = [];
  for (let k = 0; k < SIZE; k++) {
    const o = namingOptions(b, k, b.seed);
    if (o.length !== 4 || new Set(o).size !== 4 || !o.includes(b.g[k].c)) problems.push(`lot ${k}: ${o}`);
    for (const id of o) if (id !== b.g[k].c && b.g[k].w.every(w => fits(BY_ID.get(id), w))) problems.push(`${id} fits all four of lot ${k}`);
    if (!same(o, namingOptions(b, k, b.seed))) problems.push("not repeatable");
  }
  check(!problems.length, `four links to name a lot by, its own and three that don't fit all its words, the same on every phone${problems.length ? `: ${problems.join(", ")}` : ""}`);
}

// ---------- the split: hidden play ----------
{
  const problems = [];
  for (const b of dealt.medium.slice(0, 40)) {
    const side = split(b, b.seed), mine = b.g.flatMap(g => g.w).filter(w => side[w] === 0);
    if (mine.length !== 8) problems.push("not eight each");
    if (b.g.some(g => { const n = g.w.filter(w => side[w] === 0).length; return n < 1 || n > 3; })) problems.push("a lot with no word of one side");
    for (const s of [0, 1]) if (b.g.some(g => g.w.every(w => side[w] === s))) problems.push("a lot one player holds whole");
  }
  check(!problems.length && SPLITS.every(s => s.reduce((a, b) => a + b, 0) === 8), "hidden: eight words each, every lot one to three from each side, so neither can make a lot alone");
}

// ---------- the pair's table, through the database's round trip ----------
{
  const tx = (g, change) => { const cur = room.tidy(roundTrip(g)); const out = change(cur); return out === false || out == null ? { g, out } : { g: roundTrip(cur), out }; };
  const seat = (name, slot) => ({ name, slot, pid: `p${slot}`, online: true });
  let g = roundTrip(room.freshRoom({ a: seat("Korbi", 0), b: seat("Sarah", 1) }, { seed: 42, level: "medium", mode: "crossed", now: 1000 }));
  const t0 = room.tidy(roundTrip(g));
  check(room.isRoom(t0) && t0.n === 1 && t0.order.length === 16 && same(t0.sel, {}) && same(t0.guesses, []) && t0.pending === null, "a new table holds its first board, whole after the round trip");
  const B = t0.board, lot = k => B.g[k].w;
  // Korbi's wrong guess: he sees only "wrong", Sarah sees one away
  for (const w of [...lot(0).slice(0, 3), lot(1)[0]]) g = tx(g, s => room.pickAt(s, { n: 1, slot: 0, word: w })).g;
  check(!tx(g, s => room.pickAt(s, { n: 1, slot: 0, word: lot(2)[0] })).out, "four picks at most");
  let r = tx(g, s => room.submitAt(s, { n: 1, slot: 0, words: [...lot(0).slice(0, 3), lot(1)[0]] }));
  g = r.g;
  const k0 = room.viewFor(room.tidy(roundTrip(g)), 0), s1 = room.viewFor(room.tidy(roundTrip(g)), 1);
  check(r.out === "one" && room.tidy(roundTrip(g)).mistakes === 1 && k0.guesses[0].r === "wrong" && s1.guesses[0].r === "one",
    "crossed: Korbi's guess was one away, which only Sarah's phone says; his says wrong");
  // Korbi finds lot 0: Sarah names it
  g = tx(g, s => room.pickAt(s, { n: 1, slot: 0, word: lot(1)[0] })).g;
  g = tx(g, s => room.pickAt(s, { n: 1, slot: 0, word: lot(0)[3] })).g;
  r = tx(g, s => room.submitAt(s, { n: 1, slot: 0, words: lot(0) }));
  g = r.g;
  let v = room.tidy(roundTrip(g));
  check(r.out === "right" && v.pending?.namer === 1 && v.pending.options.length === 4 && room.viewFor(v, 1).name && !room.viewFor(v, 0).name && v.found.length === 0,
    "a lot Korbi finds waits for Sarah to name it, from four links, on her phone only");
  check(tx(g, s => room.submitAt(s, { n: 1, slot: 1, words: lot(2) })).out === "naming" && !tx(g, s => room.nameAt(s, { n: 1, slot: 0, pick: B.g[0].c })).out, "nothing goes in while it waits, and it isn't his to name");
  g = tx(g, s => room.nameAt(s, { n: 1, slot: 1, pick: B.g[0].c })).g;
  v = room.tidy(roundTrip(g));
  check(v.found.length === 1 && v.found[0].named === true && v.found[0].by === 0 && v.pending === null, "Sarah names it: the lot is the team's, named");
  // Sarah finds the next two; the fourth falls into place
  for (const k of [1, 2]) {
    for (const w of lot(k)) g = tx(g, s => room.pickAt(s, { n: 1, slot: 1, word: w })).g;
    g = tx(g, s => room.submitAt(s, { n: 1, slot: 1, words: lot(k) })).g;
    const p = room.tidy(roundTrip(g)).pending;
    g = tx(g, s => room.nameAt(s, { n: 1, slot: 0, pick: k === 1 ? B.g[k].c : p.options.find(o => o !== B.g[k].c) })).g;
  }
  v = room.tidy(roundTrip(g));
  check(v.done && v.won && v.found.length === 4 && room.pointsOf(v) === points(4, 1, true) + 2 && room.maxPoints(v) === 12 && room.resultOf(v)?.coop && room.resultOf(v).won && room.resultOf(v).score == null && room.resultOf(v).match === "1000-1",
    "solved together with one mistake and two links named: 9 of 12, the pair's record a team board solved");
  check(v.tally.boards === 1 && v.tally.solved === 1, "the table's tally");
  const next = tx(g, s => room.nextAt(s, { n: 1, seed: 7, mode: "hidden" }));
  check(next.out && room.tidy(roundTrip(next.g)).n === 2 && room.tidy(roundTrip(next.g)).mode === "hidden" && !tx(next.g, s => room.nextAt(s, { n: 1, seed: 8 })).out,
    "the next board once, whoever asks first; a second ask from the old board changes nothing");
  // hidden: each holds eight; a guess is both players' picks
  g = next.g;
  v = room.tidy(roundTrip(g));
  const H = v.board, holderOf = w => room.holder(v, w), lotH = k => H.g[k].w;
  const mineK = lotH(0).filter(w => holderOf(w) === 0), theirsK = lotH(0).filter(w => holderOf(w) === 1);
  check(room.viewFor(v, 0).words.filter(x => x.sealed).length === 8 && room.viewFor(v, 0).words.filter(x => x.sealed).every(x => holderOf(x.w) === 1),
    "hidden: Korbi's phone seals Sarah's eight");
  check(!tx(g, s => room.pickAt(s, { n: 2, slot: 0, word: theirsK[0] })).out, "a sealed word can't be picked by the one who can't see it");
  for (const w of mineK) g = tx(g, s => room.pickAt(s, { n: 2, slot: 0, word: w })).g;
  // Sarah adds a wrong word of her own, then the right ones
  const wrongHers = H.g.flatMap((x, k) => (k ? x.w : [])).find(w => holderOf(w) === 1);
  const hers = [...theirsK.slice(0, theirsK.length - 1), wrongHers];
  for (const w of hers) g = tx(g, s => room.pickAt(s, { n: 2, slot: 1, word: w })).g;
  const guess = [...mineK, ...hers];
  r = tx(g, s => room.submitAt(s, { n: 2, slot: 0, words: guess }));
  g = r.g;
  v = room.tidy(roundTrip(g));
  check(r.out === "one" && room.viewFor(v, 1).guesses[0].odd === 1 && room.viewFor(v, 0).guesses[0].odd == null,
    "a one-away made of both players' picks: Sarah, who didn't guess, sees that the odd one is hers");
  check(room.viewFor(v, 0).guesses[0].w.filter(w => w === null).length === hers.length, "her words in that guess stay sealed on Korbi's phone");
  const holes = room.tidy({ ...roundTrip(g), sel: { s0: { 0: "A", 2: "B" } }, guesses: { 1: { by: 0, w: { 0: "X" }, r: "miss" } } });
  check(same(holes.sel.s0, ["A", "B"]) && holes.guesses.length === 1 && same(holes.guesses[0].w, ["X"]), "lists the database gives back with holes, or as objects, are lists again");
}

// ---------- the daily ----------
{
  const d = daily(20261020);
  check(same(d, daily(20261020)) && !same(d, daily(20261021)) && d.level === "medium" && d.seed === 20261020, "today's board: Medium, the day its seed, the same on every device, another tomorrow");
}

console.log(bad ? `lots: ${bad} problems` : `lots: ${CATS.length} categories; every board one way to sort; the levels, the rival, a run, the wall, the pair's table and the daily all hold`);
if (bad) process.exitCode = 1;
