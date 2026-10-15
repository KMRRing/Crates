// Higher or Lower (party-hilo.js): a deck is the 52 each once, shuffled fairly and the same for the same seed; a tap
// turns the next card until the last, then shuffles; the verdict goes by rank alone, aces high; only a deck is taken
// back from what a phone kept; and at a party everyone's phone has the same card, anyone's tap turns the next for
// everyone, two taps on one card turn only one, the host shuffles, the narrator says each card, and the state
// survives the database.
import { partyTable } from "./party-harness.js";
import { readFileSync } from "node:fs";
import { roundTrip, same } from "./rtdb.js";
import hilo, { newDeck, next, turned, verdict, isDeck, tap, reshuffle, told, rankOf, suitOf, nameOf, RANKS } from "../party-hilo.js";
import { seeded, playable, seatsText, fits, GAMES } from "../party-core.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the deck ----------
const d = newDeck(seeded(7));
check(isDeck(d) && d.at === 0, "a new deck: the 52 each once, the first card showing");
check(JSON.stringify(newDeck(seeded(7))) === JSON.stringify(d) && JSON.stringify(newDeck(seeded(8))) !== JSON.stringify(d), "the same seed, the same deck; another, another");
let at = d, turns = 0;
while (next(at)) { at = next(at); turns++; }
check(turns === 51 && at.at === 51 && next(at) === null && at.order === d.order, "51 taps turn every card, then the deck is done");
const again = turned(at, seeded(3));
check(isDeck(again) && again.at === 0 && again.deal === 2 && turned(d).at === 1 && turned(d).order === d.order, "the tap after the last shuffles the second deck");
const rng = seeded(1), first = new Array(52).fill(0), N = 52000;
for (let i = 0; i < N; i++) first[newDeck(rng).order[0]]++;
check(Math.min(...first) > 800 && Math.max(...first) < 1200, `every card as likely to come first (${Math.min(...first)}–${Math.max(...first)} of ${N} for 1,000 expected)`);
check(RANKS.length === 13 && rankOf(0) === 0 && rankOf(51) === 12 && suitOf(51) === 3 && nameOf(51) === "ace of spades" && nameOf(0) === "two of diamonds" && nameOf(34) === "ten of hearts", "a card's rank and suit, by name");
check(verdict(0, 51) === "higher" && verdict(51, 0) === "lower" && verdict(48, 51) === "same" && verdict(3, 4) === "higher" && verdict(44, 40) === "lower", "higher, lower or the same by rank alone, aces high");
check(!isDeck(null) && !isDeck({ order: d.order.slice(1), at: 0 }) && !isDeck({ order: [...d.order.slice(1), d.order[1]], at: 0 })
  && !isDeck({ order: d.order, at: 52 }) && !isDeck({ order: d.order.map(String), at: 0 }) && isDeck({ order: d.order, at: 51 }), "only a deck taken back from what a phone kept");

// ---------- where it's listed ----------
const e = playable("hilo");
check(GAMES.includes(hilo) && e?.kind === "party" && typeof hilo.solo === "function" && hilo.keepsView && seatsText(e) === "Any number on one phone, or 2–24 on their own"
  && fits(e, 2) && fits(e, 24) && !fits(e, 1), "one of Party's games, and played on one phone too");
const apps = readFileSync(new URL("../apps.js", import.meta.url), "utf8");
check(/id: "hilo", sec: "party", name: "Higher or Lower", href: "\.\/party\.html\?game=hilo", logo: LOGO\("hilo", HILO_LOGO\)/.test(apps)
  && /^ {2}hilo: `<svg viewBox="0 0 20 20"/m.test(apps) && /^ {2}hilo: `<svg class="k-ico"/m.test(apps), "a tile on the games screen, opening it, with its logo in every theme");

// ---------- at a party ----------
{
  const t = await partyTable(["Korbi", "Mei", "Ana"]);
  check(await t.start("hilo") && isDeck(t.state) && t.state.at === 0 && t.state.deal === 1 && t.branch.say?.text.startsWith("Higher or Lower"), "the host starts it: a deck on the table, the narrator saying how it's played");
  check(t.seats.every(s => same(s.data.game.state, t.state)), "every phone has the same deck and card");
  const sees = () => ({ at: t.state.at, deal: t.state.deal || 1 });
  const seen = sees();
  check(await t.act(1, st => tap(st, seen, t.uid(1))) && t.state.at === 1 && t.state.by === t.uid(1), "Mei's tap turns the next card for everyone");
  check((await t.act(2, st => tap(st, seen, t.uid(2)))) === false && t.state.at === 1, "Ana's tap on the card Mei already turned turns nothing");
  check(await t.act(2, st => tap(st, sees(), t.uid(2))) && t.state.at === 2 && t.seats.every(s => s.data.game.state.at === 2), "her tap on the card showing turns the next");
  const said = told(t.state, "Ana"), v = verdict(t.state.order[1], t.state.order[2]);
  check(said === `Ana: the ${nameOf(t.state.order[2])}. ${v === "same" ? "The same: drink!" : v === "higher" ? "Higher." : "Lower."}`, `the narrator: "${said}"`);
  while (t.state.at < 51) await t.act(0, st => tap(st, sees(), t.uid(0)));
  check(await t.act(1, st => tap(st, sees(), t.uid(1))) && t.state.at === 0 && t.state.deal === 2 && isDeck(t.state), "after the last card, the next tap shuffles a new deck");
  check(told(t.state, "Mei") === `Mei shuffled a new deck: the ${nameOf(t.state.order[0])}.`, "and the narrator says so");
  await t.act(0, st => reshuffle(st, t.uid(0)));
  check(t.state.at === 0 && t.state.deal === 3, "the host's Shuffle: a new deck");
  check(same(roundTrip(t.state), t.state), "the state comes back from the database as it went");
  check(hilo.advance(t.state, { players: t.players, inputs: {}, now: t.now }) === null, "nothing moves on by itself");
}

console.log(bad ? `party-hilo: ${bad} failed` : "party-hilo: every check passed");
process.exit(bad ? 1 : 0);
