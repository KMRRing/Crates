// Hold'em's rules on one page (the menu's "The rules on one page", and the course's map): the game as Macau's regulation
// has it (Despacho 11/2008: the Article numbers are its), with what this table decides where the regulation is silent said
// as such. The Cantonese is the regulation's own words, with Jyutping. The hands are drawn as the table draws its cards.
import { cardHtml } from "./cards.js";
import { parseCards, CATEGORIES, ZH, JYUTPING, ROYAL_ZH, ROYAL_JP, rankOf, suitOf, RANKS } from "./holdem-eval.js";
import { BLINDS, STACK, RAKE_CAP } from "./holdem-rules.js";

const fmt = n => n.toLocaleString("en-GB");
const draw = text => `<span class="cd-line">${parseCards(text).map(id => cardHtml({ rank: RANKS[rankOf(id)] === "T" ? "10" : RANKS[rankOf(id)], suit: suitOf(id) })).join("")}</span>`;

// the hands, best first, each with five cards that make it (a royal flush is the top straight flush, listed apart as the regulation does)
export const HAND_EXAMPLES = [
  ["Royal flush", "Ah Kh Qh Jh Th", ROYAL_ZH, ROYAL_JP, "ace-high straight flush"],
  ["Straight flush", "9s 8s 7s 6s 5s", ZH[8], JYUTPING[8], "five in a row, one suit"],
  ["Four of a kind", "8c 8d 8h 8s Kd", ZH[7], JYUTPING[7], "four alike and the best other card"],
  ["Full house", "Kc Kd Kh 4s 4c", ZH[6], JYUTPING[6], "three alike and a pair"],
  ["Flush", "Ad Jd 8d 6d 3d", ZH[5], JYUTPING[5], "five of one suit"],
  ["Straight", "9h 8c 7d 6s 5h", ZH[4], JYUTPING[4], "five in a row; the ace is high or low (A-2-3-4-5)"],
  ["Three of a kind", "Qs Qd Qc 9h 4c", ZH[3], JYUTPING[3], "three alike and the two best others"],
  ["Two pair", "Js Jd 5h 5c Ac", ZH[2], JYUTPING[2], "two pairs and the best other card"],
  ["One pair", "Th Ts Ah 8d 3c", ZH[1], JYUTPING[1], "two alike and the three best others"],
  ["High card", "Ac Jd 8h 5s 2d", ZH[0], JYUTPING[0], "none of those: the five highest"],
];

export function rulesHtml(opts = {}) {
  const hands = opts.hands ?? 20, rake = opts.rake ?? 5;
  const row = ([name, cards, zh, jp, note], i) => `<tr><td>${i + 1}</td><td>${draw(cards)}</td><td><b>${name}</b><br><small>${note}</small></td><td><b>${zh}</b><br><small>${jp}</small></td></tr>`;
  return `
    <p>Texas Hold'em (德州撲克, dak1 zau1 pok3 haak1) as Macau's regulation has it (Despacho 11/2008). Two to six play. Each gets two cards face down, the hole cards; five more go face up in the middle, the board, in three stages; the best five cards out of a player's seven win the pot.</p>
    <h3>The table</h3>
    <p>A disc, the button (指示器, zi2 si6 hei3), marks the dealer and moves one seat clockwise every hand (Article 1). The player to its left posts the small blind (小盲注, siu2 maang4 zyu3), HK$${BLINDS.small}; the next the big blind (大盲注, daai6 maang4 zyu3), HK$${BLINDS.big}: forced bets that start the pot (Article 5). Heads-up, the button is the small blind.</p>
    <h3>A hand</h3>
    <ul>
      <li><b>Before the flop.</b> Betting starts with the player left of the big blind, who is last to act (Article 6): the big blind may check if nobody has raised.</li>
      <li><b>The flop.</b> Three cards face up, then a round of betting; <b>the turn</b>, one more card, another; <b>the river</b>, the last, another. From the flop the first player left of the button acts first and the button last (Article 7).</li>
      <li><b>The showdown.</b> The players left show their cards, the best five of seven win (Article 8). Play ends at once if everyone else folds: the last player takes the pot without showing.</li>
    </ul>
    <h3>What you may do</h3>
    <ul>
      <li><b>Fold</b> (蓋牌, goi3 paai2): give up the hand and what you've put in (Article 13). <b>Check</b>: pass when nothing is owed. <b>Call</b>: match the bet. <b>Raise</b>: make it more, by at least the last bet or raise (Article 12).</li>
      <li><b>All in</b> (全押, cyun4 aat3): bet every chip you have. There's no limit on a bet but your chips (Article 11); a player all in can win only what the others matched, and the rest is played for in a side pot between those with chips left.</li>
      <li>An all-in bet short of a full raise can be called but doesn't let those who had already acted raise again.</li>
    </ul>
    <h3>The hands</h3>
    <table class="hd-ranks"><tbody>${HAND_EXAMPLES.map(row).join("")}</tbody></table>
    <p>Suits never rank (Article 14). Equal hands split the pot, and the odd chips go to the first of them left of the button (Article 10). When two hands are of one kind the higher cards win; the other cards count as the regulation has it (Article 15): four of a kind takes the best other card, three of a kind two, two pair one, a pair three; a flush, a straight's top card and a high card compare card by card from the top.</p>
    <h3>The house</h3>
    <p>The house (佣金, jung6 gam1: the commission) takes 3 to 5% of the pot, and never more than five big blinds, HK$${fmt(RAKE_CAP * BLINDS.big)} (Article 16). Here ${rake ? `it's ${rake}%` : "there's none"}; the menu sets 5%, 3% or none. A bet nobody called goes back and isn't counted.</p>
    <h3>This game</h3>
    <p>A game is ${hands} hands; everyone starts with HK$${fmt(STACK)}, a hundred big blinds. A player who goes broke buys in again for the same, and the game goes on. Your result is your chips less every buy-in; the most ahead wins.</p>
    <p class="hd-rules-note">Where the regulation is silent (the size of the blinds, side pots, heads-up play, a short all-in not reopening the betting, buying in again) the table follows the usual casino rules.</p>`;
}
