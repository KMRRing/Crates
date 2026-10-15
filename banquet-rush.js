// Banquet's rush, "call it", without its page (banquet-rush-ui.js, on rush-sheet.js): the calls a banquet table wants
// at once, against the clock. Both hands shown, call the total in its verse (划拳) or its Cantonese (十五二十), first with
// the numbers on the calls, then without; then Lao Wang's last throws to read, and the call his habits make likeliest
// (your hand and his favourite, his last few throws counting most, as Sharp counts them). The bank is dealt here from a
// fixed seed, the same on every phone, and drawn on the course's stage (banquet-course.js). Pure: the page and the
// tests share it.
import { HUA, SHIWU, HANDS } from "./banquet-rules.js";

const seeded = n => () => (n = (n * 16807) % 2147483647) / 2147483647;
/**
 * The favourite in a run of throws, as Sharp weighs them (each once, the last four one and a half more); clear when it
 * leads the next by two and is thrown more often than any other, so that counting alone finds it too.
 */
export function favourite(history) {
  const w = new Map(), n = x => history.filter(y => y === x).length;
  history.forEach((x, i) => w.set(x, (w.get(x) || 0) + 1 + (i >= history.length - 4 ? 1.5 : 0)));
  const ranked = [...w].sort((a, b) => b[1] - a[1]), hand = ranked[0][0];
  return { hand, clear: (ranked.length === 1 || ranked[0][1] >= ranked[1][1] + 2) && ranked.every(([x]) => x === hand || n(x) < n(hand)) };
}

/**
 * The bank: 30 at each rating. 1-2: 划拳's totals with the numbers on the calls; 3-4 without; 5: 十五二十's with them;
 * 6 without; 7-8: Lao Wang's last throws to read, 划拳 with the numbers; 9: without; 10: 十五二十's to read, without.
 */
function bank() {
  const rng = seeded(20261015), pick = list => list[Math.floor(rng() * list.length)], out = [];
  const add = (r, p) => out.push({ id: `b${String(out.length + 1).padStart(3, "0")}`, r, ...p });
  for (let r = 1; r <= 10; r++) {
    for (let k = 0; k < 30; k++) {
      const mode = r === 5 || r === 6 || r === 10 ? "shiwu" : "huaquan", hands = HANDS[mode], bare = ![1, 2, 5, 7, 8].includes(r);
      if (r <= 6) {
        // totals: the smaller first two ratings keep to the lower half of 划拳's
        let mine = pick(hands), theirs = pick(hands);
        if (r <= 2) while (mine + theirs > 6) [mine, theirs] = [pick(hands), pick(hands)];
        add(r, { kind: "count", mode, mine, theirs, bare, best: mine + theirs });
        continue;
      }
      // a run of throws with a clear favourite, now and then changed lately; the habit weaker as the ratings rise
      const [early, lately] = r <= 8 ? [0.55, 0.75] : [0.35, 0.5];
      let history, fav;
      do {
        const n = 7 + Math.floor(rng() * 4), likes = pick(hands), late = rng() < 0.3 ? pick(hands) : likes;
        history = Array.from({ length: n }, (_, i) => (rng() < (i >= n - 4 ? lately : early) ? (i >= n - 4 ? late : likes) : pick(hands)));
        fav = favourite(history);
      } while (!fav.clear);
      const mine = pick(hands);
      add(r, { kind: "read", mode, mine, history, bare, best: mine + fav.hand });
    }
  }
  return out;
}
export const PUZZLES = bank();

/** A puzzle as the course's stage draws it: the hands (or yours and his last throws), the calls, the right one. */
export const stepOf = p => ({ mode: p.mode, mine: p.mine, theirs: p.theirs, history: p.history, bare: p.bare, answer: p.best });
/** The verdict on a call: { verdict: "best" | "wrong", mine, best }. */
export const judge = (p, call) => ({ verdict: call === p.best ? "best" : "wrong", mine: { name: call }, best: { name: p.best } });
/** A call in words: its characters and number, "三星照, 3". */
export const callText = (mode, c) => `${mode === "shiwu" ? SHIWU[c].zh : HUA[c].zh}, ${c}`;
/** The question a puzzle asks. */
export const askText = p => (p.kind === "count" ? `${p.mode === "shiwu" ? "十五二十" : "划拳"}: call the total.` : `You throw ${p.mine}. Lao Wang's last throws: call what his habits make likeliest.`);
/** Why the right call is right. */
export function whyText(p) {
  if (p.kind === "count") return `Your ${p.mine} and his ${p.theirs}.`;
  const fav = favourite(p.history).hand, n = p.history.filter(x => x === fav).length, last = p.history.slice(-4).filter(x => x === fav).length;
  return `Your ${p.mine} and his favourite ${fav}: ${n} of his last ${p.history.length}${last ? `, ${last} of the last four` : ""}.`;
}
