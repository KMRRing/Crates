// Isomer (README, Isomer): the rules (placing letters, the checks, hints, the tray, the score), the generator (exactly
// one answer for every jumble and every final, across many seeds of every mode and level), the grading (the solver's
// depth by level, the levels apart in what they take a solver), the solver and the computer rival, a run kept through
// JSON, the pair's split (the halves make the whole and neither alone does) through the database's round trip, and the
// daily the same on every device for a day. Run: node tests/isomer.mjs
import fs from "fs";
globalThis.window = {};
globalThis.atob = b => Buffer.from(b, "base64").toString("binary");
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const W = await import("../isomer-words.js");
const K = await import("../isomer-kb.js");
const E = await import("../isomer-engine.js");
const T = await import("../isomer-table.js");
const { roundTrip } = await import("./rtdb.js");
const { today } = await import("../days.js");

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const MODES = Object.keys(E.MODES), LEVELS = Object.keys(E.LEVELS);
const letters = p => p.tray.map(([wi, s]) => p.words[wi].answer[s]).join("");
const sorted = s => [...s].sort().join("");

// ---------- the solver's measure: how deep a person's search goes ----------
{
  // the depth is the answer's place among every arrangement of its letters, ordered by how English each looks
  const byHand = w => {
    const all = new Set(), go = (left, cur) => { if (!left.length) { all.add(cur); return; } for (let i = 0; i < left.length; i++) go(left.slice(0, i) + left.slice(i + 1), cur + left[i]); };
    go(w, "");
    return [...all].filter(s => W.looks(s) > W.looks(w) + 1e-9).length + 1;
  };
  check(["black", "island", "ethnic", "bottle", "wisdom"].every(w => W.depthOf(w) === byHand(w)), "a word's depth is its place among all its arrangements by how English they look (checked by listing them)");
  check(W.depthOf("black") === 1 && W.depthOf("before") <= 2 && W.depthOf("island") > 30 && W.depthOf("ethnic") > 100, "BLACK and BEFORE fall into place at once; ISLAND and ETHNIC hide behind dozens of likelier strings");
  check(W.spellings("float") === 2 && W.spellings("bottle") === 1 && W.spellings("xqzv") === 0, "the solver counts the words some letters spell, up to two (FLOAT and ALOFT: two)");
  check(W.inflected("baked") && W.inflected("cities") && W.inflected("running") && !W.inflected("island") && !W.inflected("glass"), "inflections are told apart from words of their own");
  const p6 = W.pool(6, 1);
  check(p6.length > 300 && p6.every(x => W.spellings(x.w) === 1 && !W.inflected(x.w) && x.tier <= 1), `every word a jumble may be spells its letters' only word (${p6.length} of six letters, tier 1 or commoner)`);
  const r = E.rng(5);
  const jumbled = ["bottle", "island", "wisdom", "hyena", "rhythm"].map(w => [w, W.jumble(w, r, "plain"), W.jumble(w, r, "lure")]);
  check(jumbled.every(([w, a, b]) => W.hides(a, w) && W.hides(b, w) && sorted(a) === sorted(w) && sorted(b) === sorted(w)), "a jumble hides its answer: no letter in its place, no pair of its neighbours, and not a word itself");
  check(jumbled.every(([, a, b]) => W.looks(b) >= W.looks(a)), "a lure looks more like English than a plain jumble of the same word");
}

// ---------- the knowledge base: finals and themes ----------
{
  check(K.lettersOf("Hudson's Bay")?.letters === "hudsonsbay" && K.lettersOf("Hudson's Bay").parts.join() === "7,3" && K.lettersOf("Curaçao")?.letters === "curacao", "a name as letters: a possessive's apostrophe goes, accents go, words keep their lengths");
  check(K.lettersOf("OPEC") === null && K.lettersOf("LNG exports") === null && K.lettersOf("K-pop") === null && K.lettersOf("HS 0901") === null, "acronyms, one-letter words and digits can't be a final");
  const F = K.finalsAll();
  check(F.length > 5000 && F.some(f => f.kind === "name") && F.some(f => f.kind === "behind"), `${F.length} finals, both ways round: the thing from its hint, the country or commodity from its clue`);
  check(F.every(f => !K.clueOf(f).text.toLowerCase().includes(f.text.toLowerCase())), "no final's clue says its answer");
  const th = K.themesAll();
  check(th.length > 50 && th.every(t => t.clues.length >= 4 && t.clues.every(c => W.spellings(c.letters) <= 1)), `${th.length} countries and commodities a theme can be, each with four clues or more that spell no other word`);
  const pisco = F.find(f => f.kind === "name" && f.text === "Pisco" && K.clueOf(f).tag.startsWith("Peru"));
  const card = pisco && K.cardOf(pisco, E.rng(1));
  check(!!card && card.name && card.answer === "Pisco" && card.options.length === 4 && card.options[card.right[0]] === "Pisco" && card.ask.startsWith("Name it · Peru"),
    "a final not found goes to the pile as a name-it card: the hint, its answer and topic, the name to give, and four options");
}

// ---------- the generator: exactly one answer, every mode and level ----------
const made = {};
{
  let all = 0, one = 0, trays = 0, caps = 0, hidden = 0, echo = 0, bands = 0, fails = [];
  for (const mode of MODES) for (const level of LEVELS) {
    made[`${mode}/${level}`] = [];
    for (let s = 1; s <= 14; s++) {
      const p = E.makePuzzle(s * 104729 + 7, { mode, level, cat: ["mixed", "country", "commodity"][s % 3] });
      made[`${mode}/${level}`].push(p);
      all++;
      const c = E.countSolutions(p);
      if (c.one) one++; else fails.push(`${mode}/${level} #${s}: ${JSON.stringify(c)}`);
      if (sorted(letters(p)) === sorted(p.finals.map(f => f.answer).join(""))) trays++;
      if (p.words.every(w => w.circles.length >= 1 && w.circles.length <= (w.answer.length >= 7 ? 4 : w.answer.length >= 5 ? 3 : 2) && new Set(w.circles).size === w.circles.length)) caps++;
      if (p.words.every(w => W.hides(w.jumble, w.answer) || (p.theme && w.jumble !== w.answer))) hidden++;
      if (!p.theme && p.words.some(w => p.finals.some(f => E.echoes(w.answer, f.answer)))) echo++;
      const L = E.LEVELS[level];
      if (p.theme || p.words.every(w => w.tier <= L.tier && w.depth >= Math.min(L.warm[0], L.deep[0]) && w.depth <= Math.max(L.warm[1], L.deep[1]))) bands++;
    }
  }
  check(one === all, `every puzzle has exactly one answer: each jumble one word, each final one thing (${one} of ${all})${fails.length ? `: ${fails.slice(0, 3).join("; ")}` : ""}`);
  check(trays === all, "the tray holds exactly the finals' letters, the circled squares'");
  check(caps === all, "every word carries a circle at least, and no more than its length allows");
  check(hidden === all, "every jumble hides its word");
  check(echo === 0, "no jumble echoes a final (FRENCH beside FRANCE)");
  check(bands === all, "every word is as common and as deep as its level asks");
  const again = E.makePuzzle(104729 * 3 + 7, { mode: "classic", level: "hard", cat: "mixed" });
  check(JSON.stringify(again) === JSON.stringify(made["classic/hard"][2]), "the same seed and options deal the same puzzle");
  const th = made["theme/medium"];
  check(th.every(p => p.words.every(w => w.hint && w.text) && p.finals[0].clue.text === "What all four point to"), "a theme's jumbles carry their hints, and its final is what all four point to");
  check(th.filter(p => p.only).length >= th.length * 0.6, `most themes are a crate by Crates' rule: no other answer carries all four (${th.filter(p => p.only).length} of ${th.length})`);
  const dbl = made["double/medium"];
  check(dbl.every(p => p.finals.length === 2 && p.finals[1].kind === "behind" && !p.finals[0].clue.tag.includes(p.finals[1].text)), "Double: two finals from one tray, the thing's clue not naming its country or commodity, the other answer");
  check(made["jumbo/hard"].every(p => p.words.length === 6 && Math.max(...p.words.map(w => w.answer.length)) === 7), "Jumbo: six words, up to seven letters");
  const t0 = performance.now();
  for (let s = 0; s < 20; s++) E.makePuzzle(900 + s, { mode: "classic", level: "medium" });
  const each = (performance.now() - t0) / 20;
  check(each < 150, `a puzzle is dealt in ${each.toFixed(0)} ms here (a phone a few times that)`);
}

// ---------- the grading: the levels apart ----------
{
  const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const lines = [];
  let apart = true;
  for (const mode of MODES) {
    const m = LEVELS.map(level => median(made[`${mode}/${level}`].map(p => p.secs)));
    lines.push(`${mode} ${m.map(E.clock).join(" / ")}`);
    if (!(m[0] < m[1] && m[1] < m[2])) apart = false;
  }
  check(apart, `each mode's levels take the solver longer from Easy to Hard (median par: ${lines.join("; ")})`);
  const deep = level => median(made[`classic/${level}`].flatMap(p => p.words.map(w => w.depth)));
  check(deep("easy") <= 2 && deep("medium") < deep("hard"), `the words' median depth rises with the level (${deep("easy")}, ${deep("medium")}, ${deep("hard")})`);
}

// ---------- the solver and the computer ----------
{
  const p = made["classic/medium"][0];
  const plans = Object.keys(E.RIVALS).map(level => E.rivalPlan(p, level, 7));
  check(JSON.stringify(E.rivalPlan(p, "sharp", 7)) === JSON.stringify(plans[1]), "the computer plays the same way for the same seed (everyone at a table sees one rival)");
  check(plans.every(pl => pl.at.length === p.words.length + p.finals.length && pl.at.every(t => t > 0 && t <= pl.end)
    && Math.max(...pl.at.slice(0, p.words.length)) < Math.min(...pl.at.slice(p.words.length))), "it solves every jumble, then the final once the letters are in");
  const avg = level => made["classic/medium"].reduce((t, q, i) => t + E.rivalPlan(q, level, i).end, 0) / made["classic/medium"].length;
  check(avg("ace") < avg("sharp") && avg("sharp") < avg("steady"), `its levels are paced apart: Ace ${E.clock(avg("ace") / 1000)}, Sharp ${E.clock(avg("sharp") / 1000)}, Steady ${E.clock(avg("steady") / 1000)} on Medium`);
  check(E.rivalSolved(plans[1], 0) === 0 && E.rivalSolved(plans[1], plans[1].end) === p.words.length + p.finals.length, "how far it has got, as the clock runs");
}

// ---------- the rules: placing letters, the checks, hints, the tray ----------
{
  const p = made["classic/easy"][0], run = E.newRun(p), items = E.itemsOf(p), w0 = p.words[0];
  const tileFor = (i, ch) => E.rackOf(p, run, i).find(t => !t.used && t.open && t.ch === ch)?.k;
  check(E.place(p, run, p.words.length, 0) === "no", "a tray letter can't be placed before its word is solved");
  const wrongOrder = [...w0.jumble];
  let out = null;
  for (const ch of wrongOrder) out = E.place(p, run, 0, tileFor(0, ch) ?? -1);
  check(out === "wrong" && !run.solved[0] && E.spelled(p, run, 0) === w0.jumble, "a full row that isn't the word says so, and its letters stay to be moved");
  check(E.back(p, run, 0) && E.spelled(p, run, 0).trim().length === w0.answer.length - 1 && E.unplace(p, run, 0, 0) && E.clear(p, run, 0) && E.spelled(p, run, 0).trim() === "", "a letter comes back with ⌫, a tap on its square, or Clear");
  for (const ch of w0.answer) out = E.placeLetter(p, run, 0, ch);
  check(out === "solved" && run.solved[0] && E.place(p, run, 0, 0) === "no", "the word spelled is solved, and stays so");
  check(w0.circles.every(s => E.rackOf(p, run, p.words.length).some(t => t.open && t.ch === w0.answer[s])), "a solved word's circled letters open in the tray");
  // a hint: the right letter in the first square without it, locked there, and counted
  const h = E.hint(p, run, 1), wd = p.words[1];
  check(h === "hinted" && E.spelled(p, run, 1)[0] === wd.answer[0] && run.locked[1].includes(0) && !E.unplace(p, run, 1, 0) && E.hintsOf(run) === 1, "a hint places the first right letter, locked, for 15 s");
  const r2 = E.newRun(p);
  for (const ch of [...p.words[2].jumble].reverse()) E.placeLetter(p, r2, 2, ch);
  E.hint(p, r2, 2);
  check(E.spelled(p, r2, 2)[0] === p.words[2].answer[0] && !E.spelled(p, r2, 2).slice(1).includes(" ") === false, "a hint over a wrong letter takes it back to the rack");
  // the rest put right square by square, round any letter a hint locked in place
  const fill = (q, rn, i) => { E.clear(q, rn, i); E.itemsOf(q)[i].answer.split("").forEach((ch, s) => { if (rn.squares[i][s] < 0) E.placeLetter(q, rn, i, ch); }); };
  for (let i = 1; i < p.words.length; i++) fill(p, run, i);
  check(run.solved.slice(0, p.words.length).every(Boolean) && !run.done, "every jumble solved, the final still to do");
  const f = p.finals[0], fi = p.words.length;
  const fhint = E.hint(p, run, fi);
  for (const ch of f.answer.slice(1)) out = E.placeLetter(p, run, fi, ch);
  check(fhint === "hinted" && out === "solved" && run.done, "the final put together from the tray ends the puzzle");
  run.ms = 61_400;
  check(E.scoreOf(run) === 61 + 2 * E.PER_HINT, "the score: the seconds and 15 for each hinted letter");
  // a final's letter lent by a hint before its word is solved
  const r3 = E.newRun(p);
  check(E.hint(p, r3, fi) === "hinted" && r3.lent.length === 1 && E.rackOf(p, r3, fi).filter(t => t.open).length === 1, "a hint can lend the final a letter whose word isn't solved yet");
  // Double: the two finals share the tray, each tile once
  const d = made["double/easy"][0], rd = E.newRun(d);
  for (let i = 0; i < d.words.length; i++) for (const ch of d.words[i].answer) E.placeLetter(d, rd, i, ch);
  for (const ch of d.finals[0].answer) E.placeLetter(d, rd, d.words.length, ch);
  check(rd.solved[d.words.length] && E.rackOf(d, rd, d.words.length + 1).filter(t => !t.used).length === d.finals[1].answer.length, "Double: the first final takes its letters from the tray, and leaves the second's");
  for (const ch of d.finals[1].answer) out = E.placeLetter(d, rd, d.words.length + 1, ch);
  check(out === "solved" && rd.done, "and the second puts the rest together");
  check(items.length === p.words.length + 1 && E.nextOpen({ solved: [true, false, true] }, 2) === 1, "the next item still to do comes round the end");
}

// ---------- kept through JSON ----------
{
  const p = made["jumbo/medium"][1], run = E.newRun(p);
  E.placeLetter(p, run, 0, p.words[0].answer[0]); E.hint(p, run, 2); E.reshuffle(run, 3, E.rng(3)); run.ms = 12345;
  const back = E.tidyRun(JSON.parse(JSON.stringify(p)), JSON.parse(JSON.stringify(run)));
  check(JSON.stringify(back) === JSON.stringify(run), "a run and its puzzle come back whole from JSON (a reload, or a partner watching)");
  check(E.tidyRun(p, { squares: [] }) === null && E.tidyRun(p, null) === null, "a run that isn't this puzzle's is refused");
}

// ---------- the pair: two jumbles each, the final together ----------
{
  const p = made["classic/medium"][3];
  const players = { a: { name: "Korbi", slot: 0, online: true }, b: { name: "Sarah", slot: 1, online: true } };
  let g = roundTrip(T.freshPair(players, { puzzle: p, now: 1000 }));
  const tx = fn => { const cur = T.tidy(roundTrip(g)); const res = fn(cur); if (res !== false) g = roundTrip(cur); return res; };
  const own = s => T.tidy(roundTrip(g)).owners.map((o, i) => (o === s ? i : -1)).filter(i => i >= 0);
  const mine = own(0), theirs = own(1);
  check(mine.length === 2 && theirs.length === 2 && new Set([...mine, ...theirs]).size === 4, "each holds two of the four jumbles, and together they hold all four");
  const lens = s => own(s).map(i => p.words[i].answer.length).sort().join();
  check(lens(0) === lens(1), "each holds a word of each length");
  check(T.tidy(roundTrip(g)).puzzle.words.every((w, i) => w.answer === p.words[i].answer && w.circles.join() === p.words[i].circles.join()), "the puzzle comes back whole from the database");
  // neither can finish alone: the other's jumbles aren't theirs to solve, and without them the tray lacks letters
  check(tx(x => T.solveAt(x, { n: 1, i: theirs[0], slot: 0, now: 2000 })) === false, "a jumble the other holds can't be solved by you");
  check(tx(x => T.beginAt(x, { n: 1, now: 1500 })) && tx(x => T.beginAt(x, { n: 1, now: 9999 })) === false, "the team's clock starts once, when both are there");
  const run = E.newRun(p);
  for (const i of mine) { for (const ch of p.words[i].answer) E.placeLetter(p, run, i, ch); tx(x => T.solveAt(x, { n: 1, i, slot: 0, now: 3000 })); }
  const open = E.rackOf(p, run, p.words.length).filter(t => t.open).length;
  check(open < p.finals[0].answer.length, `one player's two jumbles open only part of the tray (${open} of ${p.finals[0].answer.length} letters)`);
  // every word of the clue is in one half or the other, and each half lacks some of it
  const wordsIn = h => new Set(`${h.tag || ""} ${h.text || ""}`.toLowerCase().match(/[a-z0-9]+/g) || []);
  const halvesOk = q => q.finals.every(f => {
    const whole = wordsIn(f.clue), a = wordsIn(f.halves[0]), b = wordsIn(f.halves[1]);
    return f.halves.length === 2 && [...whole].every(w => a.has(w) || b.has(w)) && [...whole].some(w => !a.has(w)) && [...whole].some(w => !b.has(w));
  });
  check(MODES.every(mode => made[`${mode}/medium`].every(halvesOk)), "every final's clue is in two halves, one on each phone: together they make the whole, and neither alone does");
  check(tx(x => T.hintAt(x, { n: 1, i: mine[0], slot: 1 })) === false && tx(x => T.hintAt(x, { n: 1, i: theirs[0], slot: 1 })), "a hint on your own jumble counts to the team");
  for (const i of theirs) tx(x => T.solveAt(x, { n: 1, i, slot: 1, now: 4000 }));
  check(T.allSolved(T.tidy(roundTrip(g))) === false, "the final is still to do once the jumbles are");
  check(tx(x => T.hintAt(x, { n: 1, i: p.words.length, slot: 0 })) && T.tidy(roundTrip(g)).fh.f0 === 1, "a hint on the final shows its next letter on both phones");
  tx(x => T.solveAt(x, { n: 1, i: p.words.length, slot: 1, now: 61500 }));
  const done = T.tidy(roundTrip(g));
  check(!!done.done && done.done.ms === 60000 && done.done.score === 60 + 2 * E.PER_HINT, "the last one solved ends it: the team's time from the start, and its hints");
  const res = T.resultOf(done);
  check(res?.coop && res.lower && res.won && res.score === done.done.score, "the pair's record gets the team's score, a time, lower the better");
  check(tx(x => T.newGameAt(x, { n: 1, puzzle: made["classic/medium"][4] })) && tx(x => T.solveAt(x, { n: 1, i: 0, slot: 0, now: 1 })) === false && T.tidy(roundTrip(g)).n === 2,
    "a new game at the table; a tap made on the old one does nothing");
  // the partner's solve, applied on this phone
  const q = made["classic/medium"][4], r = E.newRun(q);
  E.solveFrom(q, r, 1);
  check(r.solved[1] && E.spelled(q, r, 1) === q.words[1].answer, "a jumble your partner solved shows solved on your phone");
}

// ---------- the daily: the same on every device for a day ----------
{
  const day = today(new Date(Date.UTC(2026, 9, 20, 12)));
  const a = E.makePuzzle(day, E.DAILY), b = E.makePuzzle(day, { ...E.DAILY });
  const next = E.makePuzzle(today(new Date(Date.UTC(2026, 9, 21, 1))), E.DAILY);
  check(day === 20261020 && JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(next), "today's puzzle is dealt from the day alone: the same everywhere, another tomorrow");
  check(a.mode === "classic" && a.level === "medium" && a.words.length === 4, "today's is a Classic, Medium");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("isomer: all good");
