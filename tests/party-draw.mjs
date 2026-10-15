// What Party's drawing games draw with (party-draw.js) and the words they draw (party-draw-words.js): a drawing as text
// and back, every point where it was, steps short and long, a dot, the edges of the page, text from another phone that
// can't all be read; a stroke simplified to the points that shape it; a minute and a half of drawing a few kilobytes;
// a guess that names the word (case, an article, a plural, a letter off a long word, Chinese exactly) and one that's
// close; the words, by kind, each in both languages at a level.
import { encode, decode, strokeText, simplify, guessIs, guessNear, GRID, INKS, PENS, ERASER } from "../party-draw.js";
import { KINDS, WORDS } from "../party-draw-words.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- a drawing as text ----------
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
{
  const strokes = [
    { c: 0, w: 1, p: [10, 20, 12, 25, 50, 25, 50, 26] },                 // short steps, one longer than a short step can say
    { c: 3, w: 2, p: [0, 0, 1023, 1023, 0, 1023] },                     // corner to corner: every step written in full
    { c: ERASER, w: 0, p: [500, 500] },                                 // a dot
    { c: INKS.length - 2, w: PENS.length - 1, p: [31, 31, 0, 0, 31, 62, 62, 31] },   // steps of exactly 31 each way
  ];
  const text = encode(strokes);
  check(same(decode(text), strokes), `a drawing comes back as it went (${text.length} characters for four strokes)`);
  check(!/\s/.test(text) && text.split(".").length === 4 && strokeText(strokes[2]).length === 6, "strokes joined by full stops; a dot is six characters");
  check(text.split(".")[0].length === 2 + 4 + 2 + 5 + 2, "a short step is two characters, a long one five");
}
{
  // many random strokes, steps of every size
  const strokes = Array.from({ length: 60 }, () => {
    const p = [Math.floor(rnd() * GRID), Math.floor(rnd() * GRID)];
    for (let i = 0, n = 1 + Math.floor(rnd() * 40); i < n; i++) {
      const far = rnd() < 0.15, d = () => Math.round((rnd() - 0.5) * (far ? 400 : 50));
      p.push(Math.max(0, Math.min(GRID - 1, p.at(-2) + d())), Math.max(0, Math.min(GRID - 1, p.at(-2) + d())));
    }
    return { c: Math.floor(rnd() * INKS.length), w: Math.floor(rnd() * PENS.length), p };
  });
  check(same(decode(encode(strokes)), strokes), "sixty random strokes, near and far steps, come back exactly");
}
{
  const good = encode([{ c: 1, w: 1, p: [100, 100, 110, 104] }]);
  check(same(decode(`${good}.!!.zz`), decode(good)), "what can't be read is left out: a stroke of other characters, an ink there isn't");
  check(decode(`${good.slice(0, -1)}`).length === 1 && decode("").length === 0 && decode(null).length === 0 && decode("BA").length === 0, "a stroke cut short keeps what came; nothing is no strokes");
  check(decode("BB____").every(s => s.p.every(v => v >= 0 && v < GRID)), "a point beyond the page is put on its edge");
}

// ---------- fewer points ----------
{
  const line = []; for (let x = 0; x <= 600; x += 3) line.push(x, 200 + (x % 2));
  const s = simplify(line);
  check(s.length === 4 && s[0] === 0 && s[2] === 600, `a straight line is its two ends (${line.length / 2} points to ${s.length / 2})`);
  const corner = []; for (let i = 0; i <= 100; i++) corner.push(i <= 50 ? i * 4 : 200, i <= 50 ? 100 : 100 + (i - 50) * 4);
  const c = simplify(corner);
  check(c.length === 6 && c[2] === 200 && c[3] === 100, "a corner keeps its corner");
  check(same(simplify([5, 5]), [5, 5]) && same(simplify([5, 5, 9, 9]), [5, 5, 9, 9]), "a dot and a two-point line stay as they are");
}
{
  // a minute and a half of drawing: forty strokes of a wandering hand, sampled as a finger moves, then simplified
  const strokes = Array.from({ length: 40 }, () => {
    let x = 200 + rnd() * 600, y = 200 + rnd() * 600, a = rnd() * 6.28;
    const p = [];
    for (let i = 0; i < 90; i++) { a += (rnd() - 0.5) * 0.5; x = Math.max(0, Math.min(1023, x + 6 * Math.cos(a))); y = Math.max(0, Math.min(1023, y + 6 * Math.sin(a))); p.push(Math.round(x), Math.round(y)); }
    return { c: 0, w: 1, p: simplify(p) };
  });
  const text = encode(strokes);
  check(text.length < 8000, `forty curving strokes are ${(text.length / 1024).toFixed(1)} KB as they travel`);
}

// ---------- guesses ----------
{
  const giraffe = ["giraffe", "长颈鹿"], cat = ["cat", "kitten", "猫"], glasses = ["glasses", "spectacles", "眼镜"];
  check(guessIs("Giraffe", giraffe) && guessIs("  a giraffe! ", giraffe) && guessIs("giraffes", giraffe) && guessIs("girafe", giraffe), "the word in any case, with an article, plural, or a letter off a long word");
  check(guessIs("长颈鹿", giraffe) && !guessIs("长颈", giraffe) && !guessIs("长颈鹿鹿", giraffe), "Chinese exactly");
  check(guessIs("cats", cat) && guessIs("Kittens", cat) && !guessIs("cap", cat) && !guessIs("", cat) && !guessIs("dog", cat), "another way to say it counts; a short word with a letter off doesn't");
  check(guessIs("horses", ["horse"]) && guessIs("boxes", ["box"]) && guessIs("glass", glasses) && guessIs("ice-cream", ["ice cream"]), "plurals both ways, and spaces or hyphens aside");
  check(guessNear("giraf", giraffe) && guessNear("cream", ["ice cream"]) && !guessNear("girafe", giraffe) && !guessNear("zebra", giraffe) && !guessNear("鹿", giraffe), "close: two letters off, or most of the word; a right guess or a far one isn't");
}

// ---------- the words ----------
{
  check(WORDS.length >= 600 && KINDS.length >= 12 && KINDS.every(k => k.words.length >= 30 && k.en && k.zh), `${WORDS.length} words in ${KINDS.length} kinds, each of thirty or more, each kind named in both languages`);
  const ids = WORDS.map(w => w.id.toLowerCase());
  check(new Set(ids).size === ids.length, "every word once");
  check(WORDS.every(w => [1, 2, 3].includes(w.level) && w.en.every(x => x && x === x.trim()) && w.zh.every(x => x && x === x.trim()) && /\p{Script=Han}/u.test(w.zh[0])), "each at a level, in English, and in Chinese (shown in characters)");
  const shownZh = WORDS.map(w => w.zh[0]);
  check(new Set(shownZh).size === shownZh.length, "no two words shown the same in Chinese");
  const levels = [1, 2, 3].map(l => WORDS.filter(w => w.level === l).length);
  check(levels.every(n => n >= 100), `enough at every level for many games (${levels.join(", ")} easy, medium, hard)`);
  // a word that's a right guess for another word would make that one too easy (or wrong): none answers for another
  const clash = [];
  for (const a of WORDS) for (const b of WORDS) if (a !== b && a.kind === b.kind && guessIs(a.en[0], b.en)) clash.push(`${a.id}/${b.id}`);
  check(!clash.length, `no word in a kind is a right guess for another of it${clash.length ? `: ${clash.slice(0, 6).join(", ")}` : ""}`);
}

console.log(bad ? `party-draw: ${bad} failed` : "party-draw: every check passed");
process.exit(bad ? 1 : 0);
