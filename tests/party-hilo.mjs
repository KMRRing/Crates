// Higher or Lower (party-hilo.js): a deck is the 52 each once, shuffled fairly and the same for the same seed; a tap
// turns the next card until the last; the verdict goes by rank alone, aces high; and only a deck is taken back from
// what the phone kept.
import hilo, { newDeck, next, verdict, isDeck, rankOf, suitOf, nameOf, RANKS } from "../party-hilo.js";
import { seeded, playable, seatsText, fits, GAMES, ELSEWHERE, ONE_PHONE } from "../party-core.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const d = newDeck(seeded(7));
check(isDeck(d) && d.at === 0, "a new deck: the 52 each once, the first card showing");
check(JSON.stringify(newDeck(seeded(7))) === JSON.stringify(d) && JSON.stringify(newDeck(seeded(8))) !== JSON.stringify(d), "the same seed, the same deck; another, another");
let at = d, turns = 0;
while (next(at)) { at = next(at); turns++; }
check(turns === 51 && at.at === 51 && next(at) === null && at.order === d.order, "51 taps turn every card, then the deck is done");
// fair: over many shuffles each card comes first about as often as any other (Fisher–Yates)
const rng = seeded(1), first = new Array(52).fill(0), N = 52000;
for (let i = 0; i < N; i++) first[newDeck(rng).order[0]]++;
check(Math.min(...first) > 800 && Math.max(...first) < 1200, `every card as likely to come first (${Math.min(...first)}–${Math.max(...first)} of ${N} for 1,000 expected)`);
check(RANKS.length === 13 && rankOf(0) === 0 && rankOf(51) === 12 && suitOf(51) === 3 && nameOf(51) === "ace of spades" && nameOf(0) === "two of diamonds" && nameOf(34) === "ten of hearts", "a card's rank and suit, by name");
check(verdict(0, 51) === "higher" && verdict(51, 0) === "lower" && verdict(48, 51) === "same" && verdict(3, 4) === "higher" && verdict(44, 40) === "lower", "higher, lower or the same by rank alone, aces high");
check(!isDeck(null) && !isDeck({ order: d.order.slice(1), at: 0 }) && !isDeck({ order: [...d.order.slice(1), d.order[1]], at: 0 })
  && !isDeck({ order: d.order, at: 52 }) && !isDeck({ order: d.order.map(String), at: 0 }) && isDeck({ order: d.order, at: 51 }), "only a deck taken back from what the phone kept");
const e = playable("hilo");
check(e?.kind === "phone" && e.def === hilo && seatsText(e) === "Any number, on one phone" && fits(e, 1) && fits(e, 12) && e.logo?.startsWith("<svg"), "in Party's list, on one phone, for any number");
check(new Set([...GAMES, ...ONE_PHONE, ...ELSEWHERE].map(g => g.id)).size === GAMES.length + ONE_PHONE.length + ELSEWHERE.length, "its id its own");
check(hilo.rules.length && hilo.blurb && hilo.css === "party-hilo.css" && typeof hilo.view === "function", "its rules, blurb, styles and view");

console.log(bad ? `party-hilo: ${bad} failed` : "party-hilo: every check passed");
process.exit(bad ? 1 : 0);
