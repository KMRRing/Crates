// Nonogram's dealer (nonogram-pictures.js): a picture you couldn't name comes back, but not every game (Korbi,
// 31 October 2026: "always giving me the same one, Switzerland"), and the rest come round the whole pool in turn.
import { poolOf, puzzleOf, dealPicture, dailyPicture, rng, HOLD_BACK } from "../nonogram-pictures.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const KEEP = 400;
/** `n` deals one after the other, each told what the last ones were (newest first), as the page does. */
function play(n, args, seed) {
  const rand = rng(seed), out = [];
  let seen = [];
  for (let i = 0; i < n; i++) {
    const got = dealPicture({ ...args, seen, rand });
    out.push(got.id);
    seen = [got.id, ...seen.filter(x => x !== got.id)].slice(0, KEEP);   // as the page notes it (noteSeen)
  }
  return out;
}

// the smallest topic, so the whole pool comes round in a short run; some lakes make no puzzle this small, and are never dealt
const dealable = poolOf("lakes", "world").map(p => p.id).filter(id => puzzleOf(id, "small"));
const due = poolOf("countries", "europe").find(p => p.name === "Switzerland").id;

{
  const out = play(300, { topic: "countries", size: "small", prefer: [due] }, 7);
  const times = out.filter(id => id === due).length;
  check(times > 20 && times < 200, `a due picture comes back, but not at every deal (${times} of 300)`);
  let last = -Infinity, nearest = Infinity;
  out.forEach((id, i) => { if (id === due) { nearest = Math.min(nearest, i - last); last = i; } });
  check(nearest > HOLD_BACK, `…and never within ${HOLD_BACK} deals of its last showing (the nearest two were ${nearest} apart)`);
  const others = out.filter(id => id !== due);
  check(new Set(others).size > 100, `…while the other deals are different pictures (${new Set(others).size} of ${others.length})`);
}
{
  const n = dealable.length, round = play(n, { topic: "lakes", size: "small" }, 3);
  check(new Set(round).size === n, `with nothing due, every picture is dealt once before any is dealt twice (${new Set(round).size} different in ${n} deals)`);
  const twice = play(n * 2, { topic: "lakes", size: "small" }, 3);
  check(twice.slice(n, n + 5).every((id, i) => id === twice[i]), "…and the second time round begins with the one dealt longest ago, then the next");
}
{
  // the page tells the worker [the picture on the board, ...what it noted], which has the board's picture in twice
  const n = dealable.length, round = play(n, { topic: "lakes", size: "small" }, 5), seen = [round.at(-1), ...round.slice().reverse()];
  const next = dealPicture({ topic: "lakes", size: "small", seen, rand: rng(1) });
  check(next.id === round[0], "a picture in the list twice counts from its newest showing: the next deal is the one longest ago");
}
{
  const days = [20261020, 20261021, 20261022, 20261101, 20270101, 20271231];
  check(days.every(d => dailyPicture(d) === dailyPicture(d)) && new Set(days.map(dailyPicture)).size >= 5, "a day's picture is the same on every deal and differs between days");
}
console.log(bad ? `${bad} FAILED` : "all passed");
process.exit(bad ? 1 : 0);
