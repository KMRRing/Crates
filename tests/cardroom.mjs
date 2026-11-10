// The card room's hand (cardroom.js): a fanned hand shows every card's corner; one too long for a row lies in two for the whole
// deal (Korbi, 10 Nov 2026, the UI audit: Tarot's trumps lost their numbers under their neighbours on a phone).
import { fannedLayout, stackedLayout } from "../cardroom.js";
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } else console.log(`ok   ${what}`); };
const rem = 16, ids = n => Array.from({ length: n }, (_, i) => i), cols = (...ns) => { let k = 0; return ns.map(n => ids(n).map(() => k++)); };

const hearts = fannedLayout(cols(4, 3, 3, 3), rem, 340, { big: 1.55 });
check(hearts.height === hearts.H && hearts.at.every(a => a.y === 0), "thirteen cards on a phone lie in one row");
const xs = hearts.at.map(a => a.x).sort((a, b) => a - b);
check(xs.every((x, i) => i === 0 || x - xs[i - 1] >= rem * 1.05 - 0.01), "each shows at least its corner");

const tarot = fannedLayout(cols(9, 5, 4), rem, 340, { big: 1.4, most: 24 });
check(tarot.height > tarot.H && new Set(tarot.at.map(a => a.y)).size === 2, "Tarot's eighteen (twenty-four with the dog) lie in two rows on a phone");
const rows = [0, 1].map(r => tarot.at.filter(a => a.y === (r ? Math.max(...tarot.at.map(b => b.y)) : 0)).map(a => a.x).sort((a, b) => a - b));
check(rows.every(row => row.every((x, i) => i === 0 || x - row[i - 1] >= rem * 1.35 - 0.01)), "in two rows a trump's number shows whole");
check(rows[1].length && Math.min(...tarot.at.filter(a => a.y > 0).map(a => a.z)) > Math.max(...tarot.at.filter(a => a.y === 0).map(a => a.z)), "the second row lies over the first");
const late = fannedLayout(cols(2, 1), rem, 340, { big: 1.4, most: 24 });
check(late.height === tarot.height, "three cards left keep the deal's two rows of room: the table doesn't change size as the hand empties");
check(fannedLayout(cols(9, 5, 4), rem, 900, { big: 1.4, most: 24 }).height === tarot.H, "with a tablet's width the same hand is one row");

const stacked = stackedLayout(cols(1, 3, 2), rem, 340);
check(stacked.height > stacked.H && stacked.at.length === 6, "stacked columns keep the room of the deepest stack");
console.log(bad ? `${bad} FAILED` : "cardroom: the hand's layouts hold");
process.exitCode = bad ? 1 : 0;
