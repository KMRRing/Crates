// Solitaire (solitaire-engine.js, solitaire-solver.js): the cards and the deals (every game's cards are all there, the
// same deal for a key on every device), the rules played on small positions and by a random player (cards never lost
// or made, every move the engine lists legal and made), the solver (the deals it keeps are won by lines the engine
// replays; the same try for a key twice; a hint from a game under way), the course (every position a real one, every
// answer a legal move that a tap makes), and the page wired to the suite.
import fs from "node:fs";
import * as E from "../solitaire-engine.js";
import { makeDeal, solve, certifies, answer } from "../solitaire-solver.js";
import { COURSE, positionOf, specOf, matches } from "../solitaire-course.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;
const read = f => fs.readFileSync(root + f, "utf8");

// ---------- the cards and the deals ----------
{
  const counts = id => { const T = E.tableOf(id), by = {}; for (let c = 0; c < E.VARIANTS[id].cards; c++) { const k = `${T.rank[c]}${"dchs"[T.suit[c]]}`; by[k] = (by[k] || 0) + 1; } return by; };
  check(Object.values(counts("klondike1")).every(n => n === 1) && Object.keys(counts("klondike1")).length === 52, "a pack is 52 different cards");
  check(Object.keys(counts("spider1")).length === 13 && Object.values(counts("spider1")).every(n => n === 8), "one-suit Spider is spades, eight of each rank");
  check(Object.keys(counts("spider2")).length === 26 && Object.values(counts("spider2")).every(n => n === 4), "two-suit Spider is spades and hearts, four of each");
  check(Object.keys(counts("spider4")).length === 52 && Object.values(counts("spider4")).every(n => n === 2), "four-suit Spider is two packs");
  const ok = E.IDS.every(id => {
    const o = E.shuffled(id, 20261103, 0);
    return E.validOrder(id, o) && JSON.stringify(o) === JSON.stringify(E.shuffled(id, 20261103, 0)) && JSON.stringify(o) !== JSON.stringify(E.shuffled(id, 20261103, 1)) && JSON.stringify(o) !== JSON.stringify(E.shuffled(id, 20261104, 0));
  });
  check(ok, "a deal is every card once, the same for a day on every device, and another for another day or try");
  const sizes = id => E.newGame(id, E.shuffled(id, 1)).cols.map(c => c.length).join();
  check(sizes("klondike1") === "1,2,3,4,5,6,7" && sizes("freecell") === "7,7,7,7,6,6,6,6" && sizes("spider1") === "6,6,6,6,5,5,5,5,5,5", "the columns are dealt as the rules say");
  const k = E.newGame("klondike3", E.shuffled("klondike3", 1)), s = E.newGame("spider2", E.shuffled("spider2", 1));
  check(k.stock.length === 24 && k.down.join() === "0,1,2,3,4,5,6" && s.stock.length === 50 && s.down.join() === "5,5,5,5,4,4,4,4,4,4", "Klondike's stock is 24 and Spider's 50, with the top cards face up");
  check(E.IDS.every(id => E.CHECKED(id) === certifies(id)), "the page and the solver agree which deals are checked");
}

// ---------- the rules, on positions ----------
{
  const g = t => positionOf(t), why = (s, f, to, n = 1) => E.whyNot(s, { f, t: to, n });
  const T = i => E.place(E.TAB, i), F = i => E.place(E.FND, i), C = i => E.place(E.CEL, i);
  let s = g({ cols: ["_Kd 7c", "6h", "7d", "Qs"] });
  check(why(s, T(1), T(0)) === null && /other colour/.test(why(s, T(1), T(2)) || ""), "a red card goes on a black one a rank higher, and not on a red one");
  check(/needs a K/.test(why(s, T(3), T(0)) || "") && /needs an 8/.test(why(s, T(2), T(1)) || ""), "a card needs the right rank to go on, and says which");
  s = g({ cols: ["_4h Kh", "", "9c"] });
  check(why(s, T(0), T(1)) === null && /king/i.test(why(s, T(2), T(1)) || ""), "Klondike: only a king goes into an empty column");
  s = g({ cols: ["_8s As"], found: "" });
  check(why(s, T(0), F(3)) === null && why(s, T(0), F(0)) !== null, "an ace goes up to its own suit's foundation only");
  s = g({ cols: ["_8s 2s"], found: "As" });
  check(why(s, T(0), F(3)) === null, "the next card of the suit follows");
  s = g({ cols: ["_8s 3s"], found: "As" });
  check(/2/.test(why(s, T(0), F(3)) || ""), "and no other");
  s = g({ cols: ["_9d 6s", "Jh"], stock: "Ac 5h" });
  check(E.stockMove(s).n === 1 && why(s, E.stockMove(s).f, E.stockMove(s).t) === null, "a tap on the stock turns a card");
  let t = E.apply(s, E.stockMove(s));
  check(t.waste.length === 1 && why(t, E.place(E.WST), T(0)) === null, "the waste's top card is in play");
  s = g({ v: "klondike3", cols: ["_9d 6s"], stock: "Ac 5h 7d 2h" });
  t = E.apply(s, E.stockMove(s));
  check(E.stockMove(s).n === 3 && t.waste.length === 3 && t.waste.at(-1) === 2 * 13 + 4 && t.stock.length === 1, "draw three turns three, the third on top");
  s = g({ cols: ["_9d 6s"], waste: "Ac 5h 7d" });
  const re = E.stockMove(s), r2 = E.apply(s, re);
  check(re.n === 3 && r2.stock.length === 3 && r2.waste.length === 0 && r2.stock.at(-1) === s.waste[0], "with the stock gone the waste turns over, the first turned card on top again");
  s = g({ v: "freecell", cols: ["9s 8h 7c", "Td", "Ks", "Kh", "Kc", "Qs", "Qh", "Kd"], cells: "- - Jc Jd" });
  check(E.capacity(s, false) === 3 && why(s, T(0), T(1), 3) === null && why(s, T(0), T(1), 4) !== null, "FreeCell: two free cells carry three cards");
  s = g({ v: "freecell", cols: ["9s 8h 7c", "Td", "Ks", "Kh", "Kc", "Qs", "Qh", "Kd"], cells: "Jc Jd Jh -" });
  check(E.capacity(s, false) === 2 && /carry 2/.test(why(s, T(0), T(1), 3) || ""), "with one free cell, two, and it says so");
  s = g({ v: "freecell", cols: ["9s 8h 7c", "Td", "", "Kh", "Kc", "Qs", "Qh", "Kd"], cells: "Jc Jd - -" });
  check(E.capacity(s, false) === 6 && E.capacity(s, true) === 3, "an empty column doubles it, unless it is where the run is going");
  s = g({ v: "freecell", cols: ["Ks"], found: "" });
  check(/stays/.test(why(E.apply(g({ v: "freecell", cols: ["_2s As"] }), { f: T(0), t: F(3), n: 1 }), F(3), T(0)) || ""), "FreeCell: a card on a foundation stays there");
  s = g({ v: "spider2", cols: ["9s 8h 7s", "Th", "9s 8s"] });
  check(E.maxRun(s, 0) === 1 && E.maxRun(s, 2) === 2 && why(s, T(2), T(1), 2) === null && why(s, T(0), T(1), 2) !== null, "Spider: only a run of one suit moves together, onto any suit");
  s = g({ v: "spider1", cols: ["Ks", "Qs", "Js", "Ts", "9s", "8s", "7s", "6s", "5s", "4s"], stock: 10 });
  check(why(s, E.place(E.STK), E.place(E.STK), 10) === null, "Spider: a row is dealt when every column has a card");
  s = g({ v: "spider1", cols: ["Ks", "", "Js", "Ts", "9s", "8s", "7s", "6s", "5s", "4s"], stock: 10 });
  check(/column/.test(why(s, E.place(E.STK), E.place(E.STK), 10) || ""), "and not while one is empty");
  s = g({ v: "spider1", cols: ["_2s Ks Qs Js Ts 9s 8s 7s 6s 5s 4s 3s 2s", "As"] });
  t = E.apply(s, { f: T(1), t: T(0), n: 1 });
  check(t.runs.length === 1 && t.runs[0].length === 13 && t.cols[0].length === 1 && t.down[0] === 0 && E.onFoundation(t) === 13, "Spider: a king to ace of one suit leaves the table, and the card under it turns up");
}

// ---------- a random player: nothing is lost or made, every listed move is legal and is made ----------
{
  let seed = 7;
  const rnd = n => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
  let wrong = 0, steps = 0;
  for (const id of E.IDS) {
    for (let game = 0; game < 3; game++) {
      const s = E.newGame(id, E.shuffled(id, 100 + game));
      for (let i = 0; i < 160 && !E.won(s); i++) {
        const ms = E.moves(s);
        if (!ms.length) break;
        const m = ms[rnd(ms.length)], before = s.cols.reduce((n, c) => n + c.length, 0) + s.stock.length + s.waste.length + s.cells.filter(c => c >= 0).length + s.found.reduce((a, b) => a + b, 0) + s.runs.length * 13;
        if (E.whyNot(s, m)) { wrong++; break; }
        E.applyMut(s, m);
        const after = s.cols.reduce((n, c) => n + c.length, 0) + s.stock.length + s.waste.length + s.cells.filter(c => c >= 0).length + s.found.reduce((a, b) => a + b, 0) + s.runs.length * 13;
        if (before !== after || s.cols.some((c, k) => s.down[k] > Math.max(0, c.length - 1))) wrong++;
        steps++;
      }
    }
  }
  check(wrong === 0 && steps > 1500, `a random player makes ${steps} moves over 18 games, never losing a card or making one, never a move the engine lists but won't make`);
}

// ---------- the solver ----------
{
  const cases = [["freecell", 3], ["klondike1", 3], ["klondike3", 3], ["spider1", 3]];
  let wonAll = true, notes = [];
  for (const [id, n] of cases) {
    for (let key = 20261101; key < 20261101 + n; key++) {
      const d = makeDeal(id, key);
      const log = (d.line || []).slice();
      const r = E.replay(id, d.order, log);
      if (!d.certified || r.done !== log.length || !E.won(r.s)) { wonAll = false; notes.push(`${id} ${key}`); }
    }
  }
  check(wonAll, `the deals it keeps are won by the lines it finds, replayed on the engine${notes.length ? `: not ${notes.join(", ")}` : ""}`);
  const a = makeDeal("klondike1", 20261105), b = makeDeal("klondike1", 20261105);
  check(a.tryNo === b.tryNo && JSON.stringify(a.order) === JSON.stringify(b.order), "a key gives the same deal twice (budgets are positions, not time)");
  const four = makeDeal("spider4", 20261105);
  check(!four.certified && four.tryNo === 0 && JSON.stringify(four.order) === JSON.stringify(E.shuffled("spider4", 20261105, 0)), "a four-suit deal is the shuffle as it falls");
  // a hint from a game under way: the line wins from there
  const d = makeDeal("freecell", 20261106), r = E.replay("freecell", d.order, d.line.slice(0, 20));
  const h = solve(r.s);
  const again = E.replay("freecell", d.order, [...d.line.slice(0, 20), ...h.line]);
  check(h.line && again.done === 20 + h.line.length && E.won(again.s), "a hint from twenty moves in is a line that wins from there");
  const hint = answer({ op: "hint", game: r.s });
  check(Array.isArray(hint.line) && hint.line.length === h.line.length, "the worker's answer to a hint is that line");
  check(solve(positionOf({ cols: ["Ks", "Kh"] }), 2000).line === null, "a position with no win is answered without one");
}

// ---------- the course ----------
{
  const ids = new Set(), problems = [];
  let tasks = 0, quizzes = 0;
  for (const c of COURSE.chapters) for (const l of c.lessons) {
    if (ids.has(l.id)) problems.push(`lesson ${l.id} twice`);
    ids.add(l.id);
    l.steps.forEach((st, i) => {
      const where = `${l.id} ${i + 1}`;
      if (!st.say) problems.push(`${where}: no words`);
      let g = null;
      try { g = st.table ? positionOf(st.table) : null; } catch (e) { problems.push(`${where}: ${e.message}`); }
      if (st.quiz) { quizzes++; if (!(st.answer >= 0 && st.answer < st.quiz.length) || !st.why) problems.push(`${where}: a choice needs an answer in range and why`); }
      else if (st.answer != null) {
        tasks++;
        if (!g) { problems.push(`${where}: a move with no table`); return; }
        let spec;
        try { spec = specOf(st.answer); } catch (e) { problems.push(`${where}: ${e.message}`); return; }
        const all = E.moves(g), want = all.filter(m => matches(spec, m));
        if (!want.length) { problems.push(`${where}: "${st.answer}" is no legal move`); return; }
        const tap = spec.stock ? E.stockMove(g) : E.bestMove(g, want[0].f, want[0].n);
        if (!tap || !want.some(m => E.sameMove(tap, m))) problems.push(`${where}: a tap on the card makes another move than "${st.answer}"`);
        if (!st.then) problems.push(`${where}: no words for after`);
      }
    });
  }
  check(!problems.length, `the course's ${tasks} moves and ${quizzes} choices are real: every position parses, every answer is one legal move that a tap makes${problems.length ? `: ${problems.join("; ")}` : ""}`);
  check(COURSE.chapters.map(c => c.id).join() === "klondike,freecell,spider,strategy", "the chapters are the three games in order, then strategy");
}

// ---------- the page ----------
{
  const html = read("solitaire.html"), page = read("solitaire.js"), css = read("solitaire.css"), suite = read("suite.js"), apps = read("apps.js"), rc = read("random-core.js");
  check(/solitaire\.css/.test(html) && /solitaire\.js/.test(html) && /cards\.css/.test(html) && /class="solitaire fit-screen beside"/.test(html), "the page links its styles and script and fits the screen");
  check(/IN_FRAME/.test(page) && /roundOver\("solitaire"\)/.test(page) && /noteStreak\("solitaire"/.test(page), "it counts a streak, tells Random its round and leaves a watching frame alone");
  check(/solitaire: "streak"/.test(suite) && /ROUNDS = \{[\s\S]*solitaire: "/.test(rc) && /id: "solitaire", sec: "table", name: "Solitaire", href: "\.\/solitaire\.html"/.test(apps), "the games screen shows its streak, Random deals it, and its tile opens the page");
  check(/orientation: landscape\) and \(min-width: 700px\)/.test(css) && /prefers-color-scheme: dark/.test(css) && /data-mode="night"/.test(css), "it has a sideways layout and a night one");
  check(!/\b(alert|confirm|prompt)\(/.test(page), "it asks with the suite's own pop-ups");
  check(/new Worker\(new URL\("\.\/solitaire-worker\.js", import\.meta\.url\)/.test(page), "the solver runs in a worker");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("solitaire: the cards, the rules, the solver, the course and the page hold");
