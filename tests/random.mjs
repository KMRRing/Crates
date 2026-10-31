// Random mode (README, Random mode; random-core.js its rules, random.js the page's side). Checked here: every game on
// the games screen is decided, dealt (with what its round is) or left out (with why); every game it deals says when
// its round is over, read from its own files, and names itself when it does; the pick never deals the game just
// played while another is chosen; a choice of nothing can't start it; the choice kept on the device, the run kept in
// the session, the solo-only address and a seats game's round as its step changes.
import fs from "fs";
import { ROUNDS, LEFT_OUT, ELIGIBLE, chosenFrom, keptFrom, canStart, pickNext, soloAddress, runOf, endsRound } from "../random-core.js";
import { pick } from "../tools/pick-tests.mjs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const root = new URL("..", import.meta.url).pathname;

// ---------- every game on the games screen, decided ----------
// the games screen's tiles, read from apps.js: { id, sec, page, party }; a mode with no tile of its own (`within`) isn't one
const apps = fs.readFileSync(root + "apps.js", "utf8");
const TILES = [...apps.matchAll(/\{ id: "([\w-]+)", (?:sec: "(\w+)"|within: "\w+"), [^\n]*?href: "\.\/([\w-]+)\.html[^"]*"[^\n]*?\}/g)]
  .filter(m => m[2]).map(m => ({ id: m[1], sec: m[2], page: m[3], party: /party: true/.test(m[0]) }));
check(TILES.length >= 80 && TILES.some(t => t.id === "glyph" && t.page === "slate"), `the games screen's tiles read from apps.js (${TILES.length})`);
const tileIds = new Set(TILES.map(t => t.id));
const undecided = TILES.filter(t => !t.party && !ROUNDS[t.id] && !LEFT_OUT[t.id]).map(t => t.id);
check(!undecided.length, `every game is dealt or left out${undecided.length ? `: not ${undecided.join(", ")} (add each to ROUNDS with its round, or to LEFT_OUT with why, in random-core.js)` : ""}`);
const both = ELIGIBLE.filter(id => LEFT_OUT[id]), stray = [...ELIGIBLE, ...Object.keys(LEFT_OUT)].filter(id => !tileIds.has(id));
check(!both.length && !stray.length, `each decided once, and only games the screen has${both.length ? `: both ${both.join(", ")}` : ""}${stray.length ? `: unknown ${stray.join(", ")}` : ""}`);
check(TILES.filter(t => t.party).every(t => !ROUNDS[t.id]), "Party's own games are never dealt (they open Party, for people round a table)");
check(Object.values(ROUNDS).every(r => typeof r === "string" && r.length > 3) && Object.values(LEFT_OUT).every(r => typeof r === "string" && r.length > 10),
  "every game dealt says what its round is, and every one left out why");

// ---------- every game dealt says when its round is over ----------
// a game's own files: its page's name (slate.js, slate-*.js), and the few named otherwise (Crates' solo game, solo.js)
const OWN = { crates: ["solo.js"] };
const scripts = fs.readdirSync(root).filter(f => f.endsWith(".js"));
const ownFiles = t => [...new Set([...scripts.filter(f => f === `${t.page}.js` || f.startsWith(`${t.page}-`)), ...(OWN[t.id] || [])])];
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");   // comments out
const silent = [], misnamed = [];
for (const id of ELIGIBLE) {
  const t = TILES.find(x => x.id === id);
  if (!t) continue;
  const said = [];
  for (const f of ownFiles(t)) {
    const src = strip(fs.readFileSync(root + f, "utf8"));
    for (const m of src.matchAll(/\b(?:roundOver|seatRounds)\(\s*(?:(["'])([\w-]+)\1|([A-Za-z_$][\w$]*))/g)) {
      // an id given by name is a constant of the file's own (Slate's GAME)
      const name = m[2] ?? src.match(new RegExp(`\\b(?:const|let)\\s+${m[3]}\\s*=\\s*["']([\\w-]+)["']`))?.[1];
      said.push({ f, name });
    }
  }
  if (!said.length) silent.push(`${id} (${ownFiles(t).join(", ") || "no files"})`);
  for (const s of said) if (s.name !== id && s.name !== t.page) misnamed.push(`${s.f} says ${s.name ?? "a name it doesn't define"}, not ${id}`);
}
check(!silent.length, `every game dealt calls roundOver when its round is over (${ELIGIBLE.length} games)${silent.length ? `: not ${silent.join(", ")}` : ""}`);
check(!misnamed.length, `each names itself when it does${misnamed.length ? `: ${misnamed.join("; ")}` : ""}`);
// a game left out says nothing: random mode never sends you there, so a call would do nothing (a game that says when its
// round is over belongs in ROUNDS: Guilloché, once its rebuild calls it)
const talking = Object.keys(LEFT_OUT).map(id => TILES.find(x => x.id === id)).filter(Boolean)
  .filter(t => ownFiles(t).some(f => /\b(?:roundOver|seatRounds)\(/.test(strip(fs.readFileSync(root + f, "utf8")))));
check(!talking.length, `no game left out calls it${talking.length ? `: ${talking.map(t => t.id).join(", ")} (move each to ROUNDS in random-core.js, with what its round is)` : ""}`);

// ---------- the pick ----------
const seq = values => { let i = 0; return () => values[i++ % values.length]; };
const fractions = n => Array.from({ length: n }, (_, i) => i / n).concat([0.9999999999]);
{
  let repeats = 0;
  for (const chosen of [["glyph", "delta"], ["crates", "punt", "quote"], ELIGIBLE]) for (const current of chosen) for (const x of fractions(97)) if (pickNext(chosen, current, () => x) === current) repeats++;
  check(!repeats, "the pick never deals the game just played while another is chosen");
  const reached = new Set(fractions(400).map(x => pickNext(ELIGIBLE, "crates", () => x)));
  check(reached.size === ELIGIBLE.length - 1 && !reached.has("crates"), "any other game chosen can come next");
  check(pickNext(["sudoku"], "sudoku", seq([0.5])) === "sudoku" && pickNext(["sudoku"], null, seq([0])) === "sudoku", "the only game chosen comes again");
  check(pickNext([], "crates") === null && pickNext(null, null) === null && pickNext(["lexicon", "party"], null) === null, "nothing chosen (or nothing it deals): no game");
  check(pickNext(["crates", "lexicon"], null, seq([0.99])) === "crates", "a game it doesn't deal is never picked");
  let ones = 0;
  for (let i = 0; i < 2000; i++) if (pickNext(["glyph", "delta", "spot"], "glyph") === "delta") ones++;
  check(ones > 850 && ones < 1150, `the others come about equally often (Delta ${ones} of 2,000 against Spot)`);
}

// ---------- the choice ----------
check(same(chosenFrom(null), [...ELIGIBLE]) && same(chosenFrom(undefined), [...ELIGIBLE]) && same(chosenFrom({}), [...ELIGIBLE]), "every game is chosen at first");
check(same(chosenFrom({ out: ["crates", "punt"] }), ELIGIBLE.filter(id => id !== "crates" && id !== "punt")), "a game taken out isn't chosen");
check(same(keptFrom(["crates", "glyph"]).out, ELIGIBLE.filter(id => id !== "crates" && id !== "glyph")) && same(chosenFrom(keptFrom(["crates", "glyph"])), ["crates", "glyph"]),
  "the device keeps the games taken out, and reads the choice back the same");
check(same(chosenFrom({ out: [...keptFrom(["crates"]).out.filter(id => id !== "loom")] }), ["crates", "loom"]),
  "a game the device didn't know of when the choice was kept (added since) comes in, as every game does at first");
check(same(keptFrom(["crates", "nonsense", "lexicon"]), keptFrom(["crates"])), "a game it doesn't deal is never kept as chosen");
check(!canStart([]) && !canStart(null) && !canStart(["lexicon"]) && canStart(["crates"]) && canStart(chosenFrom(null)), "a choice of nothing can't start random mode");
check(!canStart(chosenFrom(keptFrom([]))), "None everywhere, kept and read back: nothing to start");

// ---------- the run, the address, a seats game's round ----------
check(same(runOf(JSON.stringify({ game: "glyph", at: 5 })), { game: "glyph", at: 5 }) && runOf("") === null && runOf("{") === null && runOf(null) === null
  && runOf(JSON.stringify({ game: "lexicon" })) === null && runOf(JSON.stringify({ at: 3 })) === null, "a run kept in the session is read back, anything else is none");
check(soloAddress("") && soloAddress("?b=ABC&cat=mixed") && soloAddress("?solo=ABCDEFGH"), "a game alone: random mode plays");
check(["?room=ABCD", "?room=ABCD&new=1", "?table=QWER", "?table=QWER&party=ZXCV&at=1", "?party=ZXCV", "?watch=1", "?watch=1&frame=1", "?b=1&room=ABCD"].every(q => !soloAddress(q)),
  "never in a duo match, at a table, in a party or in a partner's watching view");
check(!endsRound(null, "shown", ["shown"]) && !endsRound(null, "over"), "a table as it stood when the page opened ends no round");
check(endsRound("play", "shown", ["shown"]) && endsRound("trick", "scored", ["scored"]) && endsRound("play", "over") && endsRound("scored", "over", ["scored"]),
  "a hand shown or scored, or the game over, ends one");
check(!endsRound("shown", "shown", ["shown"]) && !endsRound("play", "trick", ["scored"]) && !endsRound("bid", "passed", ["scored"]) && !endsRound("over", "play") && !endsRound("play", "shown"),
  "nothing else does: the same step again, a trick, a deal passed out, a new game, a step not listed");

// ---------- the module the page loads ----------
const page = strip(fs.readFileSync(root + "random.js", "utf8"));
check(/export function roundOver\(/.test(page) && /export function seatRounds\(/.test(page) && /export function bindRandom\(/.test(page), "random.js gives the games roundOver and seatRounds, and the games screen bindRandom");
check(/sessionStorage\.setItem\(RUN/.test(page) && /localStorage\.setItem\(CHOICE/.test(page) && /CHOICE = "suite:random"/.test(page) && /RUN = "suite:random-run"/.test(page),
  "the choice is kept on the device under a suite: key (never synced), the run in the session");
check(/IN_FRAME/.test(page) && /\blan\b/.test(page) && /soloAddress\(location\.search\)/.test(page), "random.js asks the frame, the offline party and the address before anything");
check(/bindRandom\(\{[^}]*row: dlg\.querySelector\("\[data-random\]"\)/.test(apps) && /class="rd-cell" data-random/.test(apps), "the games screen has its Random cell, beside Deck's");
check(["random.js", "random-core.js"].every(f => pick([f], 0, { slow: true }).includes("tests/random.mjs")), "a change to random mode runs its own test");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log(`random: ${ELIGIBLE.length} games dealt, each saying when its round is over; the pick, the choice and the run as they should be`);
