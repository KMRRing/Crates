// What Deck covers (deck-scope.js; README, Deck, "Scope"): the games and topics a review draws from, kept as what's taken
// out. Checked here: a scope read back from whatever a device kept; a game out takes its cards out; a topic out takes the
// cards only about it, not a card with another topic in; a card about nothing the base knows follows its game; the topics
// on offer; the ticks of the sheet; and that the games screen, Settings and Deck's page are wired to it.
import fs from "node:fs";
import { scopeOf, keptScope, whole, covers, inScope, topicsOf, withOut, afterTicks, sayScope } from "../deck-scope.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const root = new URL("../", import.meta.url).pathname;

// a few entities and the subjects the base gives them
const SUBJ = { norway: "Countries", chile: "Countries", mona: "Paintings", leo: "Painters", brent: "Commodities", exile: "Law" };
const of = id => SUBJ[id];
const card = (game, ...about) => ({ id: `${game}:${about.join("+") || "x"}`, game, about });

// ---------- what a device kept ----------
check(same(scopeOf(null), { games: [], subjects: [] }) && same(scopeOf("junk"), { games: [], subjects: [] }) && same(scopeOf(7), { games: [], subjects: [] }), "nothing kept, or something unreadable: the whole deck");
check(same(scopeOf({ games: ["punt", "punt", 3, ""], subjects: "Law" }), { games: ["punt"], subjects: [] }), "a list is read as ids without duplicates, and anything else in it or beside it is dropped");
check(keptScope({}) === null && keptScope({ games: [], subjects: [] }) === null && keptScope(null) === null, "everything covered keeps nothing (the key goes)");
check(same(keptScope({ games: ["quote"], subjects: ["Law"] }), { games: ["quote"], subjects: ["Law"] }), "a narrowed scope is kept as it is");
check(whole(null) && whole({}) && !whole({ games: ["punt"] }) && !whole({ subjects: ["Law"] }), "whole says nothing is out");

// ---------- a card in or out ----------
const none = scopeOf(null);
check(covers(none, card("punt", "norway"), of) && covers(none, card("parley")), "at first every card is covered");
check(!covers({ games: ["punt"] }, card("punt", "norway"), of) && covers({ games: ["punt"] }, card("quote", "norway"), of), "a game out takes its cards out and no others");
check(!covers({ subjects: ["Countries"] }, card("chart", "norway"), of) && !covers({ subjects: ["Countries"] }, card("punt", "norway", "chile"), of), "a topic out takes out the cards about only that topic, however many things in it");
check(covers({ subjects: ["Painters"] }, card("punt", "mona", "leo"), of), "a card about two topics stays while one of them is in");
check(!covers({ subjects: ["Painters", "Paintings"] }, card("punt", "mona", "leo"), of), "…and goes when both are out");
check(covers({ subjects: ["Countries"] }, card("parley"), of) && covers({ subjects: ["Countries"] }, card("rush", "unknown-thing"), of), "a card about nothing the base knows follows its game alone");
check(covers({ subjects: ["Countries"] }, card("punt", "norway"), null), "no index to ask (none loaded yet): a card is judged by its game alone");
check(!covers({ games: ["punt"], subjects: ["Law"] }, card("punt", "norway"), of) && !covers({ games: ["quote"], subjects: ["Countries"] }, card("punt", "norway"), of) && covers({ games: ["quote"], subjects: ["Law"] }, card("punt", "norway"), of),
  "games and topics both narrow: a card must pass both");
const deck = [card("punt", "norway"), card("quote", "brent"), card("chart", "chile"), card("parley"), card("punt", "mona", "leo"), card("rush")];
check(same(inScope(deck, { games: ["punt"], subjects: ["Countries"] }, of).map(c => c.id), ["quote:brent", "parley:x", "rush:x"]), "a scope of games and topics keeps the cards that pass, in their order");
check(inScope(deck, none, of).length === deck.length, "the whole deck is every card");

// ---------- the topics on offer ----------
const LABELS = ["Countries", "Commodities", "Paintings", "Painters", "Law", "Sport"];
check(same(topicsOf(deck, LABELS, none, of), ["Countries", "Commodities", "Paintings", "Painters"]), "the topics offered are those the piles have something about, in the base's order");
check(same(topicsOf([], LABELS, { subjects: ["Law"] }), ["Law"]), "a topic already out is offered even with nothing in the piles, so none is stuck out unseen");

// ---------- the sheet's ticks ----------
const GAMES = ["punt", "quote", "chart"];
let s = afterTicks(none, "games", GAMES, ["punt", "chart"]);
check(same(s.games, ["quote"]) && !s.subjects.length, "unticking a game puts it out");
s = afterTicks(s, "games", GAMES, GAMES);
check(whole(s), "ticking it again puts it back");
s = afterTicks({ games: ["gone", "quote"], subjects: ["Law"] }, "games", GAMES, ["quote", "chart"]);
check(same(s.games, ["gone", "punt"]) && same(s.subjects, ["Law"]), "a tick changes its own kind alone, and an id no longer on offer keeps what it was");
check(same(afterTicks(none, "subjects", ["Law", "Sport"], []).subjects, ["Law", "Sport"]), "None puts every topic on offer out");
check(same(withOut({ games: ["punt"] }, "subjects", ["Law", "Law"]), { games: ["punt"], subjects: ["Law"] }), "withOut sets one kind and keeps the other");

// ---------- in words ----------
check(/^Everything/.test(sayScope(none)) && sayScope({ games: ["punt"] }) === "Left out: 1 game." && sayScope({ games: ["a", "b"], subjects: ["Law"] }) === "Left out: 2 games and 1 topic.", "the sheet says what is out, or that nothing is");

// ---------- the pages are wired to it ----------
const apps = fs.readFileSync(root + "apps.js", "utf8"), deckJs = fs.readFileSync(root + "deck.js", "utf8"), row = fs.readFileSync(root + "deck-row.js", "utf8"), html = fs.readFileSync(root + "deck.html", "utf8");
check(/class="rd-row" data-deck/.test(apps) && /bindDeckRow\(\{\s*row: dlg\.querySelector\("\[data-deck\]"\)/.test(apps), "the games screen has its Deck line, under Random's");
check(/BANNER = "suite:banner"/.test(apps) && /toggle\("Random and Deck on this screen"/.test(apps) && /data-rows/.test(apps), "Settings puts the Random and Deck lines away, on this device (a suite: key, which doesn't sync)");
check(/KEY = "suite:deck"/.test(row) && /deck\.html#review/.test(row) && /IN_FRAME/.test(row) && /\blan\b/.test(row), "the Deck line keeps its scope under a suite: key, starts a review by the address, and keeps out of a partner's frame and an offline party");
check(/import\("\.\/kb-index\.js"\)/.test(row) && !/^import[^\n]*kb-index/m.test(row), "the knowledge base's index is fetched only when it's needed, not carried by every page");
check(/inScope\(pile\.due\(\)/.test(deckJs) && /arrange\(dueNow\(\)/.test(deckJs) && /#review/.test(deckJs) && /id="scopeBtn"/.test(html), "Deck's own page reviews, counts and starts from the same scope");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("deck scope: games and topics left in or out, as the sheet, the games screen's line and Deck's review all read them");
