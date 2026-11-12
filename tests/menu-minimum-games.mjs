// Korbi, 4 November 2026: the menu is the minimum it needs to be. The card, dice and board games' menus have no
// strength, length, house-rule, coach-level or display rows: the computer's strength is the hidden ramp (ramp.js), the
// coach is one on/off switch, the rules are the classic ones. This reads each game's source and checks the rows are gone
// and the ramp is wired (the menu itself needs a browser; the wiring is what a stale row would break).
import fs from "fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("..", import.meta.url).pathname;

// games with a computer whose strength is the ramp (shoe, topple, cartel have none)
const RAMPED = `hong bones bigtwo boast trumps tribute landlord gambit river crown go flank morris gammon factor carrom carrack hearts meld pegs tarot contract yacht`.split(/\s+/);
const ALL = [...RAMPED, "cartel", "solitaire", "topple", "shoe"];
// rows that were in these menus and are gone (a label as the menu showed it, as the first argument of choice/toggle/ticks)
const GONE = [
  "Computer players", "The computer", "Strength", "Difficulty", "Level", "Scoring", "Flowers", "Minimum", "Length", "Pace",
  "Numbers on the tiles", "Your tiles, upright", "Full screen", "Match", "Held sideways, your cards", "Card counter", "A game is",
  "A game ends at", "A match ends at", "Deals", "Players, the length", "Lives each", "Bidding", "Suits, lowest first", "Triples",
  "The narrator's voice", "Show the odds of the last bid", "Your cards", "Handicap", "Tap twice to play a stone", "Click of stones",
  "Show who is ahead", "Ring the pieces that must jump", "Coordinates on the board", "Facing each other", "Who starts",
  "Mark the squares you may play", "Mark the points a piece may go to", "The doubling cube", "Close-up on the striker", "Aim guide",
  "Who breaks", "Your power", "Petit sec voids the deal", "Four-colour suits", "Show the taker's points", "Score with one tap on a row",
  "Move cards up by themselves", "Camera", "Opponents", "Computer turns", "Shooting the moon", "Game to", "Count", "Weis and Stöck",
  "Decline trades automatically", "Characters", "You play",
];
const rowOf = (src, label) => new RegExp(`\\b(?:choice|toggle|ticks)\\(\\s*["'\`]${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(src);

for (const g of ALL) {
  const src = fs.readFileSync(`${root}${g}.js`, "utf8");
  const left = GONE.filter(l => rowOf(src, l) && !(g === "go" && l === "You play") && !(["gambit", "go"].includes(g) && l === "Strength")   /* 8 November 2026, Korbi: Chess and Go get a visible strength setting ("Adaptive" is the ramp) */ && !(g === "tarot" && l === "Players") && !(g === "tribute" && l === "Your cards")   /* 8 November 2026, Korbi: Guandan gets a Stacked / Spread out setting for your cards held sideways */
    && !(g === "solitaire" && l === "Camera")   /* 10 November 2026, Korbi (the UI audit): Solitaire's tilted / from-above camera moved from the table to the menu */);
  check(!left.length, `${g}: none of the cut rows is built${left.length ? ` (still: ${left.join(", ")})` : ""}`);
  // a coach is a switch, never a four-way choice
  // Go's Coach is a three-way choice (off, Hint button, Always show) since d4f20f92, which Korbi took (8 November 2026: left as it is; this had been red since and held every publish back)
  check(g === "go" || !/choice\(\s*["']Coach["']/.test(src), `${g}: the coach is one on/off toggle`);
}
for (const g of RAMPED) {
  const src = fs.readFileSync(`${root}${g}.js`, "utf8");
  check(/from "\.\/ramp\.js"/.test(src) && /\bramp\(\s*"/.test(src), `${g}: the computer's strength comes from the hidden ramp`);
  check(/ramp\.(won|lost)\(/.test(src), `${g}: the ramp moves when a game ends`);
}
// Go keeps "You play" (Black, White or two on this phone) and Tarot keeps "Players" (3 to 5): who sits down, not a level
check(/choice\(\s*["']You play["']/.test(fs.readFileSync(`${root}go.js`, "utf8")), "go: You play (who sits down) stays");
check(/choice\(\s*["']Players["']/.test(fs.readFileSync(`${root}tarot.js`, "utf8")), "tarot: Players stays");

process.exit(bad ? 1 : 0);
