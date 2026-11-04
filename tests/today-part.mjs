// Today's is a button, not a mode (Korbi, 4 November 2026: "daily shouldn't be served to the user in settings -> content
// 'random/levels/today's'. I feel like there should be a button 'do today's', if today's is available, and otherwise the
// menu should just be random/levels"). `todayPart` (menu.js) puts "Play today's" at the top of the menu while today's is
// still to play, one line ("Today's: done · 9 of 12") once it's done, and a line with a way back while it's being played.
// This tests what it says (today-core.js) and scans every page so that no game's content choice offers a daily again.
import fs from "fs";
import { todayState, markDone, markResult } from "../today-core.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("..", import.meta.url).pathname;

// ---------- what the part says ----------
check(JSON.stringify(todayState({ done: false })) === '{"kind":"play","button":"Play today\'s"}', "still to play: a Play today's button");
check(todayState({ done: true, result: "9 of 12" }).line === "Today's: done · 9 of 12", "done: one line with the game's result");
check(todayState({ done: true }).line === "Today's: done", "done with no result: just done");
check(todayState({ done: true, playing: true }).kind === "done", "done wins over playing (a replay is practice)");
const going = todayState({ playing: true, back: { text: "Back to level 3", fn: () => {} } });
check(going.kind === "playing" && going.line === "Today's: playing" && going.back.text === "Back to level 3", "playing: says so, with the way back it was given");
check(todayState({ playing: true, back: () => {} }).back.text === "Back to your run" && todayState({ playing: true }).back === null, "playing: a plain function gets a plain name; no run left, no way back");
check(markDone({ kind: "time", v: 754 }) && !markDone(null) && !markDone({ kind: "daily", best: 9, today: null }) && markDone({ kind: "daily", today: 0 }) && !markDone({ kind: "streak", v: 3 }), "a tile's mark: a time or a score today is done; a best or a streak is not");
check(markResult({ kind: "time", v: 754 }) === "12:34" && markResult({ kind: "time", v: 61 }) === "1:01" && markResult({ kind: "daily", today: 12345 }) === "12,345" && markResult(null) === "", "a mark's result: a time as m:ss, a score with its thousands");
check(todayState({ mark: { kind: "time", day: 1, v: 125 } }).line === "Today's: done · 2:05" && todayState({ mark: null }).kind === "play", "read from the tile's mark when the game gives none");

// ---------- no game offers a daily as a mode ----------
const PENDING = new Set(["assay", "nonogram", "mines", "crossword", "hong", "crown"]);   // not yet changed (this list goes when the last game is)
const files = fs.readdirSync(root).filter(f => /\.(js|html)$/.test(f) && f !== "sw.js" && !PENDING.has(f.replace(/\.\w+$/, "")));
/** The text of every call of name( … ) in src, to its closing parenthesis (strings skipped, so a bracket in a label can't end it). */
function calls(src, name) {
  const out = [];
  for (let at = src.indexOf(`${name}(`); at >= 0; at = src.indexOf(`${name}(`, at + 1)) {
    if (/[\w$.]/.test(src[at - 1] || "")) continue;
    let depth = 0, q = null, i = at + name.length;
    for (; i < src.length; i++) {
      const c = src[i];
      if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === "`") q = c;
      else if (c === "(") depth++;
      else if (c === ")" && --depth === 0) break;
    }
    out.push(src.slice(at, i + 1));
  }
  return out;
}
const OFFERS = /\[\s*(?:true|false|["'`][\w-]*["'`])\s*,\s*["'`](?:Today['’]?s|Daily|Today)["'`]\s*\]/;
const offenders = [];
for (const f of files.filter(f => f.endsWith(".js"))) {
  const src = fs.readFileSync(root + f, "utf8");
  for (const name of ["choice", "ticks"]) for (const c of calls(src, name)) if (OFFERS.test(c)) offenders.push(`${f}: ${c.slice(0, 70)}`);
  // a choice built from an object that has a daily key (Object.entries(KINDS)) says so by name
  for (const c of calls(src, "choice")) {
    const m = c.match(/Object\.entries\((\w+)\)\s*[,)]/);
    if (m && new RegExp(`const ${m[1]} = \\{[^}]*\\b(?:daily|today)\\s*:`).test(src)) offenders.push(`${f}: choice from ${m[1]}, which has a daily`);
  }
}
check(!offenders.length, `no choice offers Today's or Daily (it's todayPart's button)${offenders.length ? `: ${offenders.join("; ")}` : ""}`);

// a header select (the menu mirrors it) may still hold Today's so it can show it, but disabled: the menu has the button
const picks = [];
for (const f of files.filter(f => f.endsWith(".html"))) {
  const src = fs.readFileSync(root + f, "utf8");
  for (const m of src.matchAll(/<option\b[^>]*\bvalue="(?:daily|today)"[^>]*>/g)) if (!/\bdisabled\b/.test(m[0])) picks.push(f);
}
check(!picks.length, `a header select's Today's option is disabled${picks.length ? `: ${picks.join(", ")}` : ""}`);

// every game that has a daily and a menu gives it the shared part
const menuSrc = fs.readFileSync(root + "menu.js", "utf8");
check(/export function todayPart\(/.test(menuSrc) && /today-core\.js/.test(menuSrc), "menu.js exports todayPart");
const GAMES = `acrostic assay asterism bridges bulls calcudoku chart codeword columbiad crossword delta hitori ingot isomer kakuro ladder lanterns lode lots masyu mines moor nexus nonogram
  nurikabe order origin punt quote rush-menu slate slitherlink solitaire solo speedmaths-ui spot stow sudoku survey yacht yield`.split(/\s+/);
const lacking = GAMES.filter(g => !PENDING.has(g) && !/\btodayPart\(/.test(fs.readFileSync(`${root}${g}.js`, "utf8")));
check(!lacking.length, `the games with a daily use todayPart${lacking.length ? `, but not ${lacking.join(", ")}` : ""}`);

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
