// Finding a game on the games screen (games-find.js, games-bar.js; docs/the-games-screen.md): stars, the search, the filter by
// section and by players, and when a pull on the list brings the bar down. The pure parts run here; the bar itself was
// tried in a browser by hand (wheel and touch), which a test of this suite doesn't do.
import fs from "node:fs";
import { favourites, setFavourite, listing, FAVOURITES, FAV, takes, PLAYERS, AKA, fold, searchable, answers, shows, nothing, pulls } from "../games-find.js";
import { GAMES, ELSEWHERE } from "../party-core.js";
import { COOP_GAMES } from "../coop-games.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const root = new URL("..", import.meta.url).pathname;

// ---------- the games, as apps.js lists them ----------
const src = fs.readFileSync(root + "apps.js", "utf8");
const APPS = [...src.matchAll(/^ {2}\{ id: "(\w+)"([^\n]*)$/gm)].map(([, id, rest]) => ({
  id, sec: rest.match(/sec: "(\w+)"/)?.[1], within: rest.match(/within: "(\w+)"/)?.[1], name: rest.match(/name: "([^"]+)"/)?.[1], soon: /soon: true/.test(rest),
  players: (m => (m ? [+m[1], +m[2]] : null))(rest.match(/players: \[(\d+), (\d+)\]/)),
}));
const SECTIONS = [...src.match(/export const SECTIONS = \[([^\n]*)\];/)[1].matchAll(/\["(\w+)", "([^"]+)"\]/g)].map(m => [m[1], m[2]]);
const tiles = APPS.filter(a => a.sec);
check(APPS.length >= 100 && tiles.length >= 90 && SECTIONS.length >= 7, `apps.js read: ${APPS.length} entries, ${tiles.length} tiles, ${SECTIONS.length} sections`);

// ---------- every game says how many can play it, and says it truthfully ----------
const noPlayers = APPS.filter(a => !a.players).map(a => a.id);
check(!noPlayers.length, `every entry has players: [fewest, most]${noPlayers.length ? `; not ${noPlayers.join(", ")}` : ""}`);
check(APPS.every(a => a.players && Number.isInteger(a.players[0]) && Number.isInteger(a.players[1]) && a.players[0] >= 1 && a.players[0] <= a.players[1]), "…each a whole range, the fewest at least one");
// what each game offers, from the places that decide it: Party's own games (their min and max, one phone too where they have a solo()),
// a table or duo match in party-core's ELSEWHERE (one person plays too: the computer fills the seats; the most the table seats), a
// duo match without a party table (the pair's two), a board two share through a party of two (coop-games.js: they take the
// pair's two, and are in neither DUO_GAMES nor ELSEWHERE, whose games are matches dealt in the pair's room or a table's), else one person alone
const duo = Object.fromEntries([...fs.readFileSync(root + "suite.js", "utf8").match(/DUO_GAMES = \{([^}]*)\}/)[1].matchAll(/(\w+): "/g)].map(m => [m[1], 1]));
const BY_HAND = new Set(["party", "cue"]);       // Party's lobby for 2 to 24; Cue, one phone passed round
const off = [];
for (const a of APPS) {
  if (!a.players || a.soon || BY_HAND.has(a.id)) continue;
  const party = GAMES.find(g => g.id === a.id), e = ELSEWHERE.find(x => x.id === a.id || x.tiles?.includes(a.id));
  const want = party ? [typeof party.solo === "function" ? 1 : party.min, party.max] : e ? [1, e.max] : duo[a.id] || COOP_GAMES[a.id] || a.id === "glyph" ? [1, 2] : [1, 1];
  if (!same(a.players, want)) off.push(`${a.id} ${JSON.stringify(a.players)} not ${JSON.stringify(want)}`);
}
check(!off.length, `players agree with party-core.js, DUO_GAMES and what each game seats${off.length ? `: ${off.join("; ")}` : ""} (a game that gets a table or a party changes its entry)`);
check(APPS.filter(a => a.soon).every(a => a.players[1] <= 5), "a game not built yet says what its note plans, no more than five");
const PARTY = APPS.filter(a => a.sec === "party" && a.id !== "cue");
check(PARTY.every(a => a.players[1] >= 2), "every Party game takes a table");

// ---------- players: the filter ----------
check(PLAYERS.map(([v]) => v).join() === ",1,2,3-4,5+", "the filter's choices: any, solo, 2, 3 to 4, 5 or more");
check(takes([1, 1], "1") && !takes([1, 1], "2") && takes([1, 2], "2") && takes([1, 2], "1") && !takes([1, 2], "3-4"), "solo-only and a pair");
check(takes([3, 12], "3-4") && takes([3, 12], "5+") && !takes([3, 12], "2") && !takes([3, 12], "1") && takes([2, 4], "3-4") && !takes([2, 4], "5+"), "party tables");
check(takes([1, 6], "5+") && takes([1, 4], "3-4") && !takes([1, 4], "5+") && takes([4, 10], "3-4") && takes([5, 8], "5+") && !takes([5, 8], "3-4"), "edges of the ranges");
check(takes([1, 1], "") && takes(undefined, "") && !takes(undefined, "2"), "any takes every game, and a game with no range takes no count");

// ---------- stars ----------
const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
{
  const st = memory(), ids = tiles.map(a => a.id);
  check(favourites(ids, st).size === 0, "no stars to begin with");
  setFavourite("quote", true, st); setFavourite("river", true, st);
  check(same([...favourites(ids, st)].sort(), ["quote", "river"]) && st.m.get("home:fav:quote") === "1" && FAV === "home:fav:", "a star is the key home:fav:<id>, a games-screen prefix (suite.js syncs every key but suite:'s)");
  setFavourite("quote", false, st);
  check(same([...favourites(ids, st)], ["river"]) && !st.m.has("home:fav:quote"), "taking a star off removes its key (a removal syncs like any change)");
  st.setItem("home:fav:gone", "1"); st.setItem("home:fav:crates", "no");
  check(same([...favourites(ids, st)], ["river"]), "the star of a game that has gone, or a value that isn't one, does nothing");
  const broken = { getItem() { throw new Error("storage is blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  let threw = false;
  try { favourites(ids, broken); setFavourite("quote", true, broken); setFavourite("quote", false, broken); } catch { threw = true; }
  check(!threw && favourites(ids, broken).size === 0, "with no storage (a private window) it neither breaks nor stars");
}

// ---------- the Favourites section: every starred game, above the sections, once ----------
{
  const plain = listing(tiles, SECTIONS, new Set());
  check(same(plain.map(g => g.id), SECTIONS.map(([id]) => id)) && plain.every(g => g.apps.every(a => a.sec === g.id)) && plain.flatMap(g => g.apps).length === tiles.length,
    "nothing starred: no Favourites, just the sections, as they were");
  const stars = ["river", "nexus", "punt", "crates"], lists = listing(tiles, SECTIONS, new Set(stars)), favs = lists[0];
  const order = tiles.map(a => a.id).filter(i => stars.includes(i));
  check(favs.id === FAVOURITES && favs.title === "Favourites" && same(favs.apps.map(a => a.id), order), "starred: Favourites comes first, with every starred game in the screen's order (sections, then each section's own)");
  check(same(order.slice().sort(), stars.slice().sort()) && new Set(order.map(i => by0(i).sec)).size >= 2, "…across sections (the stars chosen here sit in more than one)");
  const rest = lists.slice(1), shown = lists.flatMap(g => g.apps.map(a => a.id));
  check(same(rest.map(g => g.id), SECTIONS.map(([id]) => id)) && rest.every(g => g.apps.every(a => !stars.includes(a.id) && a.sec === g.id)), "…the sections follow in their order, without the starred games");
  check(shown.length === tiles.length && new Set(shown).size === tiles.length, "…and every game is on the screen once: a star moves a game, it doesn't copy it");
  const home = listing(tiles, SECTIONS, new Set(stars.slice(0, 2))), back = listing(tiles, SECTIONS, new Set());
  check(same(back.map(g => g.apps.map(a => a.id)), plain.map(g => g.apps.map(a => a.id))) && home.find(g => g.id === by0("nexus").sec).apps.every(a => a.id !== "nexus"), "taking the stars off puts each game back where it was");
  const one = SECTIONS.map(([id]) => id), lone = tiles.filter(a => a.sec === "knowledge").map(a => a.id);
  const empty = listing(tiles, SECTIONS, new Set(lone)), left = empty.find(g => g.id === "knowledge");
  check(left && !left.apps.length && one.every(id => empty.some(g => g.id === id)), "a section with all its games starred stays in the list, empty (the screen hides it)");
  function by0(id) { return tiles.find(a => a.id === id); }
}

// ---------- search ----------
const by = Object.fromEntries(tiles.map(a => [a.id, a]));
const found = Object.fromEntries(tiles.map(a => [a.id, searchable(a, SECTIONS)]));
const hits = want => tiles.filter(a => shows(a, found[a.id], want)).map(a => a.id);
check(hits({}).length === tiles.length && hits({ query: "  " }).length === tiles.length, "an empty search is every game");
check(fold("Hold'em") === "holdem" && fold("Guilloché") === "guilloche" && fold("Who am I?") === "who am i" && fold(null) === "", "folded: no accents, no punctuation, no apostrophe, lower case");
check(same(hits({ query: "courier" }), ["reckoning"]) && same(hits({ query: "reckoning" }), ["reckoning"]), "Courier is found by its name and by its id (its page, saves and keys are still reckoning)");
check(same(hits({ query: "lexicon" }), ["lexicon"]) && same(hits({ query: "glyph" }), ["glyph"]) && same(hits({ query: "almanac" }), ["lexicon"]), "an old name is found by the id (Almanac's lexicon, Slate's glyph)");
check(same(hits({ query: "hold'em" }), ["holdem"]) && same(hits({ query: "holdem" }), ["holdem"]) && hits({ query: "hold" }).includes("holdem"), "Hold'em, whichever way it's typed");
check(hits({ query: "word" }).includes("crossword") && hits({ query: "word" }).includes("codeword") && hits({ query: "word" }).includes("assay"), "a word inside a name (Crossword, Codeword) and a word game (Assay)");
check(same(hits({ query: "mahjong" }), ["hong"]) && same(hits({ query: "chess" }).sort(), ["gambit", "river"]) && hits({ query: "chess school" }).join() === "gambit" && hits({ query: "xiangqi" }).join() === "river", "genre words find the game");
check(hits({ query: "puzzle rush" }).length >= 8 && hits({ query: "puzzle rush" }).includes("gambit") && hits({ query: "killer" }).join() === "sudoku" && hits({ query: "jigsaw" }).join() === "sudoku" && hits({ query: "block blast" }).join() === "loose" && hits({ query: "picross" }).includes("nonogram") && hits({ query: "loom" }).includes("nonogram") && hits({ query: "weaving" }).includes("nonogram"),
  "the modes without a tile are found: puzzle rush (on the games that have it), Nonet's killer and jigsaw, Loose cargo, Loom (a mode of Nonogram)");
check(hits({ query: "party" }).length >= 14 && hits({ query: "party" }).includes("undercover") && hits({ query: "knowledge" }).length === tiles.filter(a => a.sec === "knowledge").length, "a section's name finds its games");
check(same(hits({ query: "sudoku crates" }), []) && same(hits({ query: "pipe dream" }), ["pipes"]), "every word typed has to match (and each is the start of a word)");
check(!hits({ query: "ta" }).includes("delta") && hits({ query: "tar" }).includes("tarot"), "two letters match only the start of a word, not the middle of a name");
check(same(hits({ query: "casino" }).sort(), ["baccarat", "blackjack", "craps", "holdem", "roulette", "sicbo"]), "casino finds the casino games, all in the Appendix");
check(same(hits({ query: "silo" }), ["silo"]) && hits({ query: "connect four" }).join() === "silo" && hits({ query: "draughts" }).join() === "crown", "the games not built yet are found by what they are");
// 3 November 2026: the games with a well-known name wear it (docs/README), and whoever knows the old name, or another name for the game, still finds it
const olds = { gambit: "chess", river: "xiangqi", tribute: "guandan", hong: "mahjong", gammon: "backgammon", go: "go", crown: "draughts", flank: "reversi", silo: "four in a row", pegs: "cribbage", meld: "gin rummy", landlord: "dou dizhu", contract: "contract bridge", bones: "dominoes", boast: "liar's dice" };
check(Object.entries(olds).every(([id, name]) => by[id].name.toLowerCase() === name && hits({ query: id }).includes(id) && hits({ query: name }).includes(id)), "a game renamed for its common name is found by that name and by its old one (its id)");
check(hits({ query: "chinese chess" }).join() === "river" && hits({ query: "checkers" }).join() === "crown" && hits({ query: "fight the landlord" }).join() === "landlord" && hits({ query: "connect four" }).join() === "silo", "and by the other names it goes by");
check(Object.keys(AKA).every(id => by[id]) && tiles.every(a => !AKA[a.id] || AKA[a.id] === AKA[a.id].toLowerCase()), "every alias is for a game with a tile, in lower case");

// ---------- the filter and the search together ----------
check(hits({ section: "idle" }).length === tiles.filter(a => a.sec === "idle").length && hits({ section: "idle" }).every(i => by[i].sec === "idle"), "a section");
check(hits({ count: "5+" }).every(i => by[i].players[1] >= 5) && hits({ count: "1" }).every(i => by[i].players[0] === 1), "players");
check(same(hits({ section: "puzzle", query: "sudoku" }), ["sudoku"]) && same(hits({ section: "minigames", query: "sudoku" }), []), "section and search");
check(hits({ count: "2", query: "chess" }).join() !== "" && same(hits({ count: "5+", query: "chess" }), []), "players and search");
const all = hits({}), reset = hits({ query: "", section: "", count: "" });
check(same(all, reset), "clearing both restores the list exactly");
check(nothing({ query: "xyzzy" }, SECTIONS) === "No game matches “xyzzy”." && nothing({ query: "x", section: "minigames", count: "1" }, SECTIONS) === "No game matches “x” in Minigames for solo."
  && nothing({ count: "3-4" }, SECTIONS) === "No game matches for 3 to 4 players.", "an empty result says plainly what it was for");

// ---------- the pull ----------
{
  const run = (events) => { const d = pulls(); let out = null; for (const [kind, ...args] of events) { const r = d[kind](...args); if (r && !out) out = r; } return out; };
  // touch: y grows downward; the list's scrollTop at each event is the last argument
  check(run([["touchStart", 300, 0], ["touchMove", 305, 0], ["touchMove", 320, 0]]) === "pull", "touch: a drag down of more than 12px from the very top is a pull");
  check(run([["touchStart", 300, 0], ["touchMove", 308, 0], ["touchMove", 310, 0]]) === null, "…a small one is not");
  check(run([["touchStart", 300, 140], ["touchMove", 340, 100], ["touchMove", 380, 60], ["touchMove", 420, 20], ["touchMove", 460, 0], ["touchMove", 520, 0]]) === null, "touch: begun below the top and arriving at it is only a scroll back up");
  check(run([["touchStart", 300, 0], ["touchMove", 290, 6], ["touchMove", 320, 0], ["touchMove", 340, 0]]) === null, "touch: scrolled down a little and back is not a pull");
  check(run([["touchStart", 300, -30], ["touchMove", 330, -60]]) === "pull", "touch: an iPhone's bounce (scrollTop below zero) is still the top");
  check(run([["touchStart", 300, 0], ["touchMove", 280, 0]]) === "push", "touch: a drag up is a push, where the bar goes away");
  check(run([["touchStart", 300, 0], ["touchEnd"], ["touchMove", 340, 0]]) === null, "touch: a move with no touch begun says nothing");
  {
    const d = pulls(); d.touchStart(300, 0);
    check(d.touchMove(330, 0) === "pull" && d.touchMove(360, 0) === null, "touch: one touch says one thing");
    d.touchEnd(); d.touchStart(300, 0);
    check(d.touchMove(330, 0) === "pull", "…and the next touch starts afresh");
  }
  // wheel: events carry their time; within 150 ms of each other they are one gesture
  const wheel = (steps) => { const d = pulls(); let out = null, t = 1000; for (const [dy, top, gap = 16] of steps) { t += gap; const r = d.wheel(dy, top, t); if (r && !out) out = r; } return out; };
  check(wheel([[-4, 0], [-6, 0], [-8, 0]]) === "pull", "wheel: up at the very top is a pull");
  check(wheel([[-100, 0]]) === "pull", "wheel: one notch of a mouse wheel is enough");
  check(wheel([[-3, 0], [-3, 0]]) === null, "wheel: a flutter of a few pixels is not");
  check(wheel([[-30, 90], [-30, 60], [-30, 30], [-30, 0], [-30, 0], [-30, 0], [-30, 0]]) === null, "wheel: a gesture that began below the top and arrives at it does not reveal");
  check(wheel([[-30, 20], [-30, 0], [-30, 0, 400], [-30, 0, 16]]) === "pull", "wheel: the same, but after a pause of 150 ms or more the next events are a new gesture, at the top");
  check(wheel([[-30, 0, 16], [-30, 0, 149], [-30, 0, 16]]) === "pull" && wheel([[-3, 40], [-3, 0, 149], [-3, 0, 149], [-30, 0, 149]]) === null, "wheel: a gap under 150 ms keeps it one gesture");
  check(wheel([[12, 0], [12, 0]]) === "push" && wheel([[12, 200], [12, 212]]) === "push", "wheel: down is a push, from the top or from lower");
  check(wheel([[30, 0], [-30, 0], [-30, 0]]) === "push", "wheel: one gesture says one thing");
  check(wheel([[-60, 5], [-60, 0]]) === null, "wheel: a list not quite at the top (5px) does not count as the top");
}

// ---------- wired in ----------
const bar = fs.readFileSync(root + "games-bar.js", "utf8"), css = fs.readFileSync(root + "style.css", "utf8");
check(/import \{ bindFind, starButton \} from "\.\/games-bar\.js"/.test(src) && /bindFind\(\{ dlg, list, apps: (?:APPS|shown\(\)), sections: (?:SECTIONS|shownSections\(\)) \}\)/.test(src) && /\$\{starButton\(a\)\}<\/li>/.test(src), "the games screen binds the finding and every tile has its star beside its link");
check(/addEventListener\("suite:pulled", draw\)/.test(bar) && /addEventListener\("close", \(\) => \{ reset\(\); hide\(\); \}\)/.test(bar), "the stars redraw when another device's come in, and a closed screen forgets its search");
check(/\.apps-find\b/.test(css) && /\.app-star\b/.test(css) && !/alert\(|confirm\(|prompt\(/.test(bar), "the bar and the star have their styles, and no browser pop-ups");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("games-find: stars, search, filter and the pull as specified");
