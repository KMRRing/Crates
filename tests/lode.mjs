// Lode (README, Lode): the themes and their words, the generator (every board's words fill it in exactly one way, the
// spanning word crossing it, no two paths crossing), grading (each level inside its band, the levels apart), the
// rules of a run (theme words, other words towards hints, hints, giving up, the score), the rival, saved state, the
// team's letters shared out so the parts make the whole and none alone does, a table of three through the database's
// own round trip, and the daily the same everywhere for a day.
import fs from "fs";
globalThis.window = {};
globalThis.atob = b => Buffer.from(b, "base64").toString("binary");
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const E = await import("../lode-engine.js");
const T = await import("../lode-table.js");
const { SPAN } = await import("../lode-themes.js");
const { BANK } = await import("../core.js");
const { today } = await import("../days.js");
const { roundTrip, same } = await import("./rtdb.js");
const { CELLS, COLS, ROWS, THEMES, LEVELS, SHAPES, BANDS, SLACK, MAX_TWICE, PER_HINT, HINT_COST, SHOW_COST, makeBoard, boardFor, countCovers, tracings, geometry, themesFor, dailyDeal,
  pickTheme, newRun, tidyRun, submit, useHint, giveUp, scoreOf, missesOf, lockedCells, shares, rivalPlan, rivalAt, RIVALS, letters, wordsOf, outside } = E;

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const q = (xs, p) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];

// ---------- the themes ----------
{
  const ids = new Set(BANK.map(a => a.entity)), forms = Object.values(SPAN).flat();
  check(Object.keys(SPAN).every(id => ids.has(id)), "every spanning word is for a theme of the knowledge base");
  check(forms.every(f => /^[A-Z]{6,15}$/.test(f)), "every spanning word is 6 to 15 letters, A to Z: long enough to cross the board");
  check(THEMES.length >= 140 && themesFor({ level: "medium" }).length >= 140 && themesFor({ level: "easy" }).length >= 110, `themes enough at every level (${THEMES.length}, ${themesFor({ level: "easy" }).length} at Easy)`);
  check(letters("Björk") === "BJORK" && letters("Weißwurst") === "WEISSWURST" && letters("Ørsted") === "ORSTED" && letters("Christians­borg") === "CHRISTIANSBORG", "names become board letters: accents dropped, ß as SS, Ø as O, soft hyphens gone");
  const cu = THEMES.find(t => t.id === "copper"), zm = THEMES.find(t => t.id === "zambia");
  check(!wordsOf(cu).some(w => w.text.includes("COPPER")) && wordsOf(zm).some(w => w.text === "COPPER"), "a theme never deals a word that holds its own name (Copperbelt under Copper), though another theme may (Copper under Zambia)");
  check(themesFor({ pool: "countries" }).every(t => t.kind === "country") && themesFor({ pool: "commodities" }).every(t => t.kind === "commodity")
    && !themesFor({ off: ["eu"] }).some(t => t.group === "eu"), "a pool deals its kind, and a region or sector left out deals nothing of it");
}

// ---------- the generator ----------
const crosses = (b) => {                 // a square board's two diagonals of one 2×2 block, both drawn
  if (b.shape === "hex") return false;
  const seen = new Map();
  for (const w of b.words) for (let k = 1; k < w.cells.length; k++) {
    const a = w.cells[k - 1], c = w.cells[k], ra = Math.floor(a / COLS), rc = Math.floor(c / COLS), ca = a % COLS, cc = c % COLS;
    if (ra === rc || ca === cc) continue;
    const block = Math.min(ra, rc) * COLS + Math.min(ca, cc);
    if (seen.has(block)) return true;
    seen.set(block, 1);
  }
  return false;
};
const boards = [], timings = [];
{
  let tried = 0;
  const problems = { made: [], cover: [], letters: [], span: [], steps: [], lengths: [], once: [], unique: [], twice: [], title: [], holds: [] };
  for (const shape of Object.keys(SHAPES)) for (const level of Object.keys(LEVELS)) {
    const list = themesFor({ level });
    for (let k = 0; k < 24; k++) {
      const t = list[(k * 37 + level.length * 11 + shape.length) % list.length], seed = 1000 + k * 7919;
      tried++;
      const t0 = performance.now(), b = makeBoard({ seed, theme: t.id, level, shape });
      timings.push(performance.now() - t0);
      if (!b) { problems.made.push(`${t.id}/${level}/${shape}`); continue; }
      boards.push(b);
      const geo = geometry(b.shape), cells = b.words.flatMap(w => w.cells);
      if (cells.length !== CELLS || new Set(cells).size !== CELLS) problems.cover.push(b.theme);
      if (b.letters.length !== CELLS || b.words.some(w => w.cells.some((c, i) => b.letters[c] !== w.text[i]))) problems.letters.push(b.theme);
      const span = b.words[0].cells, cols = span.map(c => c % COLS), rows = span.map(c => Math.floor(c / COLS));
      if (!((cols.includes(0) && cols.includes(COLS - 1)) || (rows.includes(0) && rows.includes(ROWS - 1))) || !Object.values(SPAN[b.theme]).includes(b.words[0].text)) problems.span.push(b.theme);
      if (b.words.some(w => w.cells.some((c, i) => i && !geo.touch[w.cells[i - 1]].has(c))) || crosses(b)) problems.steps.push(b.theme);
      if (b.words.slice(1).some(w => w.text.length < 4 || w.text.length > 10) || b.words.length < 5 || b.words.length > 9) problems.lengths.push(b.theme);
      if (new Set(b.words.map(w => w.text)).size !== b.words.length || b.words.some(w => b.words.some(o => o !== w && o.text.includes(w.text)))) problems.holds.push(b.theme);
      const ways = b.words.map(w => tracings(b, w.text, 3).length);
      if (ways.some(n => n < 1)) problems.once.push(b.theme);
      if (ways.filter(n => n > 1).length !== b.twice || b.twice > MAX_TWICE) problems.twice.push(b.theme);
      if (countCovers(b, 2) !== 1) problems.unique.push(b.theme);
      const said = letters(b.title.text);
      if (!b.title.text || b.words.some(w => said.includes(w.text)) || said.includes(letters(b.name).split(" ")[0])) problems.title.push(`${b.theme}: ${b.title.text}`);
    }
  }
  const say = (k, what) => check(!problems[k].length, `${what}${problems[k].length ? `: ${problems[k].slice(0, 6).join(", ")}` : ""}`);
  say("made", `a board for every theme, level and shape tried (${tried}: Square and Hex, Easy, Medium and Hard)`);
  say("cover", "the words between them use every letter exactly once");
  say("letters", "each word is written along its own path");
  say("span", "the spanning word is the theme's, and touches two opposite sides");
  say("steps", "every step is to a touching letter, and no two paths' diagonals cross");
  say("lengths", "words of 4 to 10 letters, six to nine to a board with the spanning word");
  say("holds", "no word twice, and none inside another (COPPER in COPPERBELT would trace twice)");
  say("once", "every word can be traced along its own path");
  say("twice", `at most ${MAX_TWICE} words a board that also trace a second way, and the board knows which`);
  say("unique", "the solver finds exactly one way the words cover the board, counting up to two");
  say("title", "the title names neither the theme nor a word on the board");
  const share = s => boards.filter(b => b.shape === s && b.twice === 0).length / boards.filter(b => b.shape === s).length;
  check(share("hex") >= 0.6 && share("square") >= 0.25, `most boards trace every word one way only (Hex ${Math.round(100 * share("hex"))}%, Square ${Math.round(100 * share("square"))}%)`);
  check(q(timings, 0.5) < 60 && q(timings, 0.9) < 250, `a board is made quickly here: median ${q(timings, 0.5).toFixed(1)} ms, 90% within ${q(timings, 0.9).toFixed(1)} ms`);
}

// ---------- the solver, on a board made by hand ----------
{
  // eight rows, each its own word in letters found nowhere else, cover the board one way; make the first two rows
  // ABCDEF and FEDCBA and they cover it a second way too (each reads the other's row backwards), a board the
  // generator never keeps
  const own = "GHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const rows = (top, second) => [top, second, ...Array.from({ length: 6 }, (_, k) => own.slice(k * 6, k * 6 + 6))];
  const boardOf = rs => ({ shape: "square", letters: rs.join(""), words: rs.map((t, k) => ({ text: t, cells: Array.from({ length: 6 }, (_, i) => k * 6 + i) })) });
  const one = boardOf(rows("ABCDEF", own.slice(36, 42))), two = boardOf(rows("ABCDEF", "FEDCBA"));
  check(countCovers(one, 2) === 1 && countCovers(two, 2) === 2 && tracings(two, "ABCDEF", 5).length >= 2, "the solver counts one cover where there is one, a second where there is one, and stops at two");
  check(tracings({ shape: "square", letters: "NORWAY" + "Q".repeat(42) }, "NORWAY", 5).length === 1 && tracings({ shape: "hex", letters: "ABCDEF" + "GHIJKL" + "Q".repeat(36) }, "AGB", 5).length === 1
    && tracings({ shape: "hex", letters: "ABCDEF" + "GHIJKL" + "Q".repeat(36) }, "AHB", 5).length === 0, "tracing follows the board's shape: a hex row's neighbours are the two below it, offset");
}

// ---------- grading ----------
{
  const inBand = boards.filter(b => !outside(b.grade, b.level)).length / boards.length;
  check(inBand >= 0.9, `nine boards in ten or more, every theme tried, inside their level's band (${Math.round(100 * inBand)}%)`);
  // boards as they're dealt: a theme that can't make a board inside the band gives way to the next the seed picks
  const dealt = [];
  for (const shape of Object.keys(SHAPES)) for (const level of Object.keys(LEVELS)) for (let k = 0; k < 16; k++) dealt.push(boardFor({ seed: 500 + k * 104729, level, shape }).board);
  const by = lv => dealt.filter(b => b.level === lv).map(b => b.grade.score);
  const [e, m, h] = ["easy", "medium", "hard"].map(by);
  console.log(`     grades dealt: Easy ${q(e, .1)}/${q(e, .5)}/${q(e, .9)}, Medium ${q(m, .1)}/${q(m, .5)}/${q(m, .9)}, Hard ${q(h, .1)}/${q(h, .5)}/${q(h, .9)} (10th, 50th, 90th)`);
  check(q(e, .5) < q(m, .5) && q(m, .5) < q(h, .5) && q(e, .9) < q(h, .1), "the levels' grades stand apart: Easy below Medium below Hard, Easy's hardest tenth under Hard's easiest");
  check(dealt.every(b => outside(b.grade, b.level) <= SLACK) && Math.max(...e) < Math.min(...h), "no board is dealt far outside its band: no Easy board as hard as any Hard one");
  const knowE = boards.filter(b => b.level === "easy").flatMap(b => b.words.slice(1).map(w => w.d)), knowH = boards.filter(b => b.level === "hard").flatMap(b => b.words.slice(1).map(w => w.d));
  check(!knowE.includes(3) && knowH.filter(d => d === 3).length > knowH.length / 4, "Easy deals no specialist link; Hard leans on them");
  const acr = boards.filter(b => b.level === "easy").some(b => b.words.slice(1).some(w => w.shown.length > 1 && /^[A-Z0-9]+$/.test(w.shown)));
  check(!acr, "Easy deals no acronyms");
  const turns = lv => boards.filter(b => b.level === lv).flatMap(b => b.grade.words.map(g => g.turns));
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  check(mean(turns("easy")) < mean(turns("medium")) && mean(turns("medium")) < mean(turns("hard")), "Easy's paths turn least, Hard's most");
}

// ---------- the same board everywhere ----------
{
  const deal = { seed: 4242, theme: "norway", level: "medium", shape: "square" };
  check(same(makeBoard(deal), makeBoard(deal)) && !same(makeBoard(deal), makeBoard({ ...deal, seed: 4243 })), "a board is made from its deal alone: the same deal, the same board");
  const d = dailyDeal(today(new Date("2026-10-20T12:00:00Z")));
  check(d.seed === 20261020 && same(d, dailyDeal(20261020)) && d.level === "medium" && d.shape === "square" && d.mix === null && d.pool === "mixed", "today's deal is the date's: Medium, square, every theme and topic, nobody's settings in it");
  const t1 = boardFor(d), t2 = boardFor(dailyDeal(20261020)), t3 = boardFor(dailyDeal(20261021));
  check(!!t1 && same(t1, t2) && !!E.themeById(t1.deal.theme) && !same(t1.board.letters, t3.board.letters), "and the same board on every phone that day, another the next");
  const list = themesFor({ level: "medium" });
  check(pickTheme(9, list, list.slice(0, list.length - 1).map(t => t.id)) === list[list.length - 1].id, "a random board passes over the themes dealt lately");
  const { KB_TOPICS } = await import("../topics.js");
  const trade = Object.fromEntries(KB_TOPICS.country.map(([k]) => [k, ["nrg", "met", "trade", "co", "mkt"].includes(k) ? 2 : 0]));
  const b = makeBoard({ seed: 77, theme: "norway", level: "medium", shape: "square", mix: trade });
  const ws = wordsOf(E.themeById("norway")), on = b.words.slice(1).map(w => ws.find(x => x.text === w.text));
  check(!!b && on.filter(w => w.topics.some(t => trade[t] > 0)).length >= on.length - 1, "a mix of topics deals its topics' words, the others only if the theme needs them to fill a board");
}

// ---------- a run ----------
{
  const b = makeBoard({ seed: 31337, theme: "coffee", level: "medium", shape: "square" }), run = newRun();
  const theme1 = b.words[1], out1 = submit(b, run, theme1.cells);
  check(out1.kind === "theme" && out1.w === 1 && run.found.includes(1) && submit(b, run, theme1.cells).kind === "bad", "a theme word traced is found, and its letters lock (they can't be traced again)");
  const span = submit(b, run, b.words[0].cells);
  check(span.kind === "span" && run.found.includes(0), "the spanning word is found as the mother lode");
  // an English word on the board that isn't a theme word, traced through free cells
  const { isWord } = await import("../wordlist.js");
  const locked = lockedCells(b, run), geo = geometry(b.shape);
  let other = null;
  const seek = (path, txt) => {
    if (other) return;
    if (txt.length >= 4 && isWord(txt) && !b.words.some(w => w.text === txt)) { other = [...path]; return; }
    if (txt.length >= 6) return;
    for (const j of geo.nbrs[path[path.length - 1]]) if (!locked[j] && !path.includes(j)) seek([...path, j], txt + b.letters[j]);
  };
  for (let i = 0; i < CELLS && !other; i++) if (!locked[i]) seek([i], b.letters[i]);
  check(!!other, "the board holds other English words to find");
  const w1 = submit(b, run, other);
  check(w1.kind === "word" && run.extra.length === 1 && run.meter === 1 && submit(b, run, other).kind === "had", "another word counts towards a hint, once");
  const near = { ...tidyRun(JSON.parse(JSON.stringify(run))), extra: [], meter: PER_HINT - 1 };
  check(submit(b, near, other).earned === true && near.charges === 1 && near.meter === 0, `every ${PER_HINT} other words earn a hint`);
  const pair = (() => { for (let i = 0; i < CELLS; i++) if (!locked[i]) for (const j of geo.nbrs[i]) if (!locked[j]) return [i, j]; return null; })();
  check(submit(b, tidyRun(JSON.parse(JSON.stringify(run))), pair).kind === "short" && submit(b, run, [pair[0], pair[0]]).kind === "bad", "a trace under four letters is too short, and one through a letter twice is no trace");
  const h = { ...tidyRun(JSON.parse(JSON.stringify(run))), charges: 2 };
  const first = useHint(b, h), second = useHint(b, h);
  const target = E.hintTarget(b, { ...h, found: [...h.found], revealed: [] });
  check(first.step === 1 && second.step === 2 && second.w === first.w && h.hints === 2 && h.charges === 0 && useHint(b, h) === null && h.hinted.includes(first.w), "a hint lights a word's letters, a second numbers them, and none is left");
  check(first.w !== 0 && b.words[first.w].d === Math.max(...b.words.map((w, i) => (h.found.includes(i) ? 0 : i ? w.d : 0))) && target === first.w, "a hint shows the hardest word still hidden, never the spanning word while another is left");
  const g = tidyRun(JSON.parse(JSON.stringify(run)));
  g.ms = 95_400; g.hints = 1;
  check(giveUp(b, g) && g.done && g.gaveUp && g.revealed.length === b.words.length - g.found.length && scoreOf(g) === 95 + HINT_COST + SHOW_COST * g.revealed.length, "giving up shows the rest: the score is the seconds, a hint's cost and each word shown's");
  check(missesOf(b, { ...g, hinted: [first.w] }).length === new Set([first.w, ...g.revealed.filter(i => i)]).size, "the words a hint showed or giving up revealed go to the pile");
  const done = newRun();
  for (const w of b.words) submit(b, done, w.cells);
  check(done.done && done.found.length === b.words.length && submit(b, done, b.words[1].cells).kind === "done", "every word found ends the board");
  check(same(tidyRun(JSON.parse(JSON.stringify(run))), run) && same(tidyRun(roundTrip(newRun())), newRun()), "a run saved and read back (as JSON, or from the database, which keeps no empty lists) is as it was");
  // a word that also traces a second way is found along either
  const tw = boards.find(x => x.twice > 0);
  const wi = tw.words.findIndex(w => tracings(tw, w.text, 3).length > 1), other2 = tracings(tw, tw.words[wi].text, 3).find(p => [...p].sort().join() !== [...tw.words[wi].cells].sort().join());
  const r2 = newRun(), o2 = submit(tw, r2, other2);
  check(o2.w === wi && o2.moved && lockedCells(tw, r2).reduce((n, x) => n + x, 0) === tw.words[wi].text.length && tw.words[wi].cells.every(c => lockedCells(tw, r2)[c]), "a word traced through its twin letters is found, and locks its own cells");
}

// ---------- the rival ----------
{
  const b = boards.find(x => x.level === "medium" && x.shape === "square");
  const plans = Object.keys(RIVALS).map(lv => rivalPlan(b, lv));
  check(plans.every(p => p.length === b.words.length && new Set(p.map(x => x.w)).size === b.words.length && p.every((x, i) => !i || x.at > p[i - 1].at)), "a rival finds every word, one after another");
  const ends = plans.map(p => p[p.length - 1].at);
  check(ends[0] > ends[1] && ends[1] > ends[2] && ends[2] > 60_000 && ends[0] < 20 * 60_000, `Steady is slower than Sharp, Sharp than Ace, each at a person's pace (${ends.map(x => Math.round(x / 1000)).join(", ")} s)`);
  const p = plans[1];
  check(rivalAt(p, 0).found === 0 && rivalAt(p, p[2].at).found === 3 && rivalAt(p, Infinity).done && same(rivalPlan(b, "sharp"), p), "its progress at any moment, the same on every phone");
  const pos = p.findIndex(x => x.w === 0);
  check(pos >= 1 && pos <= 3, "it finds the spanning word once a few words are in");
}

// ---------- together: the letters shared out ----------
{
  let fine = true, even = true, alone = true;
  for (const b of boards.slice(0, 60)) for (let k = 2; k <= 6; k++) {
    const hold = shares(b, k), count = Array(k).fill(0);
    hold.forEach(s => count[s]++);
    if (Math.max(...count) - Math.min(...count) > b.words.length) even = false;
    for (const w of b.words) {
      const seats = new Set(w.cells.map(c => hold[c]));
      if (seats.size !== Math.min(k, w.text.length)) fine = false;
      if (seats.size < 2) alone = false;
    }
  }
  check(fine, "every word runs through every seat's letters (as many seats as it has letters, up to six)");
  check(alone, "so no seat alone holds a whole word: the parts make the whole and none alone does");
  check(even, "each seat holds about as many letters as the others");
}

// ---------- the table, through the database's round trip ----------
{
  const b = makeBoard({ seed: 99, theme: "fame", level: "medium", shape: "square" });
  const players = { u0: { name: "Korbi", slot: 0 }, u1: { name: "Sarah", slot: 1 }, u2: { name: "Mei", slot: 2 } };
  const now0 = 1_000_000;
  let g = T.tidy(roundTrip(T.freshTable(players, { board: b, mode: "team", people: 3, now: now0 })));
  const act = fn => { const next = structuredClone(g); const out = fn(T.tidy(next)); g = T.tidy(roundTrip(next)); return out; };
  check(T.isTable(g) && same(g.board.letters, b.letters) && g.board.words.length === b.words.length && g.board.words.every((w, i) => same(w.cells, b.words[i].cells)), "a table keeps its board, whole, through the database");
  const all = [0, 1, 2], open0 = T.readable(g, 0, all), open1 = T.readable(g, 1, all), open2 = T.readable(g, 2, all);
  check(open0.every((x, c) => x + open1[c] + open2[c] === 1), "with all three here, each letter is read by exactly one of them");
  check(b.words.every(w => w.cells.some(c => !open0[c]) && w.cells.some(c => !open1[c])), "no player can read a whole word alone");
  check(T.readable(g, 0, [0, 1]).every((x, c) => x || T.holders(g)[c] === 1), "a seat whose player is away opens its letters to the rest");
  const here = { u0: { game: "lode", online: true }, u1: { game: "lode", online: true }, u2: { game: "lode", online: true } };
  check(same(T.presentSlots(g, here, "u0"), [0, 1, 2]) && same(T.presentSlots(g, { u1: { game: "crates" } }, "u0"), [0]), "who's at the table: those with Lode open, and this phone");
  g.players.u1.trace = T.traceText(1, b.words[2].cells.slice(0, 3));
  g = T.tidy(roundTrip(g));
  const seen0 = T.tracesOf(g, here, "u0");
  check(seen0.length === 1 && seen0[0].slot === 1 && same(seen0[0].cells, b.words[2].cells.slice(0, 3)) && !T.tracesOf(g, here, "u1").length
    && !T.tracesOf(g, { u0: here.u0 }, "u0").length, "what a player traces shows on the others' boards, not their own, and only while they're here");
  const o1 = act(x => T.submitAt(x, { n: 1, slot: 1, cells: b.words[2].cells, now: now0 + 6000 }));
  check(o1.kind === "theme" && g.by.w2 === 1 && T.readable(g, 0, all).every((x, c) => x || !b.words[2].cells.includes(c)), "a word found by one is the table's: its finder kept, its letters open to all");
  g.players.u1.trace = T.traceText(1, b.words[2].cells);
  check(!act(x => T.newGameAt(x, { n: 9, board: b, mode: "team", now: now0 })) && T.tracesOf({ ...g, n: 2 }, here, "u0").length === 0, "a trace from an earlier board shows on none");
  delete g.players.u1.trace;
  check(act(x => T.submitAt(x, { n: 0, slot: 0, cells: b.words[3].cells, now: now0 + 7000 })).kind === "moved", "a trace made on a board the table has moved on from does nothing");
  for (const [i, w] of b.words.entries()) if (i !== 2) act(x => T.submitAt(x, { n: 1, slot: i % 3, cells: w.cells, now: now0 + 60_000 + i }));
  const res = T.resultOf(g, 0, all, now0 + 70_000);
  check(g.team.done && res?.coop && res.won && res.lower && res.score === Math.round((g.team.ms) / 1000) && Object.keys(g.by).length === b.words.length, "every word found ends the board: one result for the team, its time on the table's clock");
  // a race at the same table, with a rival
  check(act(x => T.newGameAt(x, { n: 1, board: makeBoard({ seed: 5, theme: "copper", level: "easy", shape: "hex" }), mode: "race", now: now0 + 100_000, bot: "ace" })) && g.n === 2 && g.mode === "race" && g.bot === "ace" && !g.team.found.length,
    "a new board for the table, in the other mode");
  const start = g.start;
  act(x => T.beginAt(x, { n: 2, slot: 0, now: start - 500 }));
  act(x => T.beginAt(x, { n: 2, slot: 1, now: start + 20_000 }));
  check(T.runOf(g, 0).begun === start && T.runOf(g, 1).begun === start + 20_000 && !act(x => T.beginAt(x, { n: 2, slot: 0, now: start + 30_000 })), "a run begins at the table's start, or later for one who comes late, once");
  act(x => T.reportAt(x, { n: 2, slot: 0, run: { found: 3, hints: 0 } }));
  check(T.runOf(g, 0).found === 3 && !T.raceOver(g, [0, 1]), "runs are reported as they go");
  act(x => T.reportAt(x, { n: 2, slot: 0, run: { found: 7, hints: 1, done: true, ms: 200_000, score: 230 } }));
  act(x => T.reportAt(x, { n: 2, slot: 1, run: { found: 7, hints: 0, done: true, ms: 150_000, score: 150 } }));
  check(!act(x => T.reportAt(x, { n: 2, slot: 1, run: { found: 7, done: true, ms: 1, score: 1 } })) && T.runOf(g, 1).score === 150, "a finished run stands");
  check(T.raceOver(g, [0, 1]) && !T.raceOver(g, [0, 1, 2]), "the race is over when every run that began is done and nobody here is still to begin");
  const rows = T.standingsOf(g, start + 400_000, true), bot = T.botAt(g, Infinity);
  check(rows.every((r, i) => !i || rows[i - 1].score <= r.score) && rows.find(r => r.slot === 1).rank < rows.find(r => r.slot === 0).rank
    && rows.some(r => r.slot === null && r.label === RIVALS.ace.label && r.score === bot.score), "the standings rank the lowest score first, the rival among them where it finishes");
  const r1 = T.resultOf(g, 1, [0, 1], start + 400_000), r0 = T.resultOf(g, 0, [0, 1], start + 400_000);
  check(r1.won === (bot.score > 150) && !r0.won && r0.score === 230 && !r1.coop, "the pair's record: the winner first alone, the rival counted");
}

// ---------- the daily on every device ----------
{
  const b1 = boardFor(dailyDeal(20261031)), b2 = boardFor(JSON.parse(JSON.stringify(dailyDeal(20261031))));
  const replay = boardFor({ ...b1.deal });
  check(same(b1, b2) && same(replay.board, b1.board), "a day's board, dealt twice from scratch, is the same board, and its deal (theme and all) deals it again");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("lode: themes, the generator (one cover, spanning word, no crossings), grading, the solver, a run, hints, the rival, saved state, the team's shares, a table through the database, the daily");
