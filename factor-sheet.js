// Factor's rules on one page (the menu's link, the header's Rules): what a turn is, what things cost, where they go, how
// trading works. The costs are drawn with the resources' own marks, from the same table the rules use.
import { COSTS, PIECES, CARD_NAMES, CARD_TEXT, TARGETS, MAX_OFFERS } from "./factor-rules.js";
import { RES } from "./factor-board.js";
import { resIcon } from "./factor-draw.js";

const cost = c => c.map((n, i) => (n ? `<span class="fc-cost">${n > 1 ? `${n}` : ""}${resIcon(i)}</span>` : "")).join("");

export function rulesHtml(opts = {}) {
  const vp = opts.vp || 10;
  return `
<p>Factor is a game of founding trading posts on a new coast. The land pays whoever stands at a hex when its number is rolled, and you spend what you are paid on roads, posts and factories. <b>First to ${vp} points, on their own turn, wins.</b></p>
<h3>Points</h3>
<ul><li>A post is 1 point and a factory 2.</li><li>The <b>longest road</b> (five roads in a line at the least) is 2, and passes to anyone who gets a longer one.</li>
<li>The <b>largest fleet</b> (three Privateers played at the least) is 2, and passes to anyone who plays more.</li>
<li>Each <b>Patent</b> is 1, kept hidden until it wins.</li></ul>
<h3>Setting up</h3>
<p>Each seat in turn places a post and a road beside it, and then each again in the opposite order. The second post pays you one card for each hex it touches, so put it beside what you lack.</p>
<h3>A turn</h3>
<ol><li><b>Roll.</b> Every post at a hex with that number is paid one of its resource, every factory two. A hex with the blockade pays nothing.</li>
<li><b>A seven</b> pays nobody. Anyone holding eight cards or more gives up half (rounded down). Then the roller moves the blockade to another hex and takes one card, at random, from a player with a building on it.</li>
<li><b>Then, in any order:</b> build, trade, buy a card, play a card.</li><li><b>End the turn.</b></li></ol>
<h3>Building</h3>
<table class="fc-costs"><tbody>
<tr><td>Road</td><td>${cost(COSTS.road)}</td><td>${PIECES.road} of them</td></tr>
<tr><td>Post</td><td>${cost(COSTS.post)}</td><td>${PIECES.post}</td></tr>
<tr><td>Factory</td><td>${cost(COSTS.factory)}</td><td>${PIECES.factory}, replacing a post</td></tr>
<tr><td>Card</td><td>${cost(COSTS.dev)}</td><td>25 in the deck</td></tr></tbody></table>
<ul><li>A road joins your own road or building. Another player's building at the end of your road stops it going on.</li>
<li>A post goes at the end of one of your roads, and never beside another building: the corner between must stay empty.</li></ul>
<h3>Trading</h3>
<ul><li><b>The bank</b> takes 4 of one resource for 1 of another. A post or factory at a harbour does better: 3 for 1 at a 3:1 harbour, 2 for 1 at the 2:1 harbour of that resource.</li>
<li><b>The table</b> trades by offer, on your turn only: say what you give and what you want, and each of the others says yes or no. If more than one says yes, you choose. ${MAX_OFFERS} offers a turn.</li>
<li>The bank holds 19 of each resource. If it can't pay everyone what a roll owes, a lone player gets what is left and several get nothing.</li></ul>
<h3>Cards</h3>
<p>One card a turn, never the turn you bought it (a Privateer may be played before you roll).</p>
<ul>${Object.keys(CARD_NAMES).map(c => `<li><b>${CARD_NAMES[c]}.</b> ${CARD_TEXT[c]}</li>`).join("")}</ul>
<p class="fc-note">Factor plays by the rules of the island-trading game Catan made well known, which Colonist also plays in a browser. The names, the pictures and the code here are Factor's own. A game can be played to ${TARGETS.join(", ")} points, set in the menu.</p>`;
}
