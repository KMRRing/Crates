// Hanse's sounds, as far as they can be tested: which sounds a move calls for, worked out from the state before it and after
// it (factor-cues.js), and the Sound switch's saved choice. How they sound is not tested: nobody has heard them in Node.
// Run: node tests/factor-cues.mjs
import { rules, fresh } from "../factor-rules.js";
import { seeded } from "../seats.js";
import { cuesBetween, readOn, keepOn, SOUND_KEY, MOST_CUES } from "../factor-cues.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const clone = v => JSON.parse(JSON.stringify(v));
const names = (a, b, viewer) => cuesBetween(a, b, viewer).map(c => c.name).join();
const table = () => { const s = fresh({ seats: 4, options: {}, rng: seeded(3) }); s.step = "main"; s.turn = 0; s.turnNo = 5; s.rolled = true; return s; };
const step = (s, seat, move) => { const r = rules.act(clone(s), seat, move, { rng: seeded(5), now: 0 }); if (typeof r === "string") throw new Error(r); return r; };

// ---------- the dice ----------
{
  const a = table(); a.step = "roll"; a.rolled = false;
  const b = step(a, 0, { t: "roll" });
  const c = cuesBetween(a, b, 0)[0];
  check(c.name === "dice" && c.total === b.roll[0] + b.roll[1] && c.mine, "a roll sounds the dice, with the total, loud for your own roll");
  check(!cuesBetween(a, b, 2)[0].mine, "…and soft for someone else's");
  check(cuesBetween(b, b, 0).length === 0, "a move seen twice sounds nothing");
  a.devs[0] = ["privateer"]; a.fresh = [];
  const p = step(a, 0, { t: "play", card: "privateer" });
  check(!cuesBetween(a, p, 0).some(c => c.name === "dice"), "a Privateer played before the roll is not a roll");
  check(cuesBetween(a, p, 0).some(c => c.name === "card"), "…it is a card played");
}

// ---------- building ----------
{
  const s = table(); s.vo[0] = 1; s.vl[0] = 1; s.hand[0] = [5, 5, 5, 5, 5];
  const road = step(s, 0, { t: "build", what: "road", at: 0 });
  const at = road.eo.findIndex(x => x), e0 = road.eo.findIndex(x => x);
  check(names(s, road, 0) === "road" && at === e0, "a road sounds a road");
  const works = step(s, 0, { t: "build", what: "factory", at: 0 });
  check(names(s, works, 0) === "factory", "a factory sounds a factory (a post becoming one is not a new post)");
  const post = clone(s); post.vo[0] = 0; post.vl[0] = 0; post.eo[0] = 1; post.hand[0] = [5, 5, 5, 5, 5];
  const posts = (await import("../factor-rules.js")).postSpots(post, 0);
  const placed = step(post, 0, { t: "build", what: "post", at: posts[0] });
  check(names(post, placed, 0) === "post", "a post sounds a post");
  check(cuesBetween(post, placed, 1)[0].mine === false && cuesBetween(post, placed, 0)[0].mine === true, "a piece is loud for the seat it is the colour of, soft for the others");
}

// ---------- the blockade, a steal, a card, a trade ----------
{
  const s = table(); s.step = "blockade"; s.back = "main";
  const to = [...s.kind.keys()].find(i => i !== s.robber);
  const b = clone(s); b.robber = to; b.step = "main";
  check(names(s, b, 0) === "blockade", "the blockade moving is a sound of its own");
  const t = clone(b); t.say = "{s0} took a card from {s1}.";
  check(names(b, t, 0) === "steal", "a card taken is a steal");
  const d = table(); d.hand[0] = [0, 0, 1, 1, 1];
  const bought = step(d, 0, { t: "buy" });
  check(names(d, bought, 0) === "card", "a development card bought is a card");
  const o = table(); o.hand[0] = [4, 0, 0, 0, 0];
  const bank = step(o, 0, { t: "bank", give: [4, 0, 0, 0, 0], get: [0, 1, 0, 0, 0] });
  check(names(o, bank, 0) === "trade", "a trade at the bank sounds a trade");
}

// ---------- titles, turns, the end ----------
{
  const a = table(), b = clone(a); b.longest = 2;
  check(names(a, b, 0) === "title" && !cuesBetween(a, b, 0)[0].mine && cuesBetween(a, b, 2)[0].mine, "the longest road changing hands sounds a title, loud only for its new holder");
  const c = clone(a); c.army = 1;
  check(names(a, c, 0) === "title", "so does the largest fleet");
  const e = clone(a); e.longest = 2; const f = clone(e); f.longest = -1;
  check(cuesBetween(e, f, 0).length === 0, "a road cut with nobody holding the title sounds nothing");
  const t = clone(a); t.turn = 1;
  const u = clone(t); u.turn = 0;
  check(names(t, u, 0) === "turn" && names(a, t, 0) === "" && names(t, u, null) === "", "your turn beginning sounds; a rival's does not, and a watcher hears none");
  const w = clone(a); w.step = "over"; w.winner = 0;
  check(names(a, w, 0) === "win" && names(a, w, 1) === "lose", "the game's end: a win for the winner, a kinder sound for the rest");
  const big = clone(a); big.step = "over"; big.winner = 1; big.longest = 1; big.army = 1; big.robber = (a.robber + 1) % 19; big.deck.pop(); big.say = "x traded y";
  check(cuesBetween(a, big, 0).length === MOST_CUES && cuesBetween(a, big, 0).at(-1).name === "lose", `a move sounds at most ${MOST_CUES} things at once, and the end of the game is never the one cut`);
}

// ---------- the bell ----------
{
  const s = table(); s.hand[0] = [2, 0, 1, 0, 0]; s.hand[1] = [0, 3, 0, 1, 0]; s.hand[2] = [0, 0, 0, 2, 2];
  const o = step(s, 0, { t: "offer", give: [1, 0, 0, 0, 0], get: [0, 0, 0, 1, 0] });
  check(names(s, o, 1) === "bell" && cuesBetween(s, o, 1)[0].ask, "an offer that has come to you is a bell (and `ask`, so Ignore trades can keep it quiet)");
  check(names(s, o, 3) === "" && names(s, o, 0) === "" && names(s, o, 2) === "", "...to nobody else, and not to the one who made it");
  const next = step(o, 1, { t: "answer", yes: true });
  check(next.step === "offer" && names(o, next, 2) === "bell" && names(o, next, 1) === "", "the next seat asked hears it when it is its turn to answer");
  const picked = step(next, 2, { t: "answer", yes: true });
  check(picked.step === "pick" && names(next, picked, 0) === "bell" && !cuesBetween(next, picked, 0)[0].ask, "the answers to your offer are a bell too, one that Ignore trades does not silence");
}

// ---------- the switch ----------
{
  const store = new Map(), fake = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  check(readOn(fake) === true, "sound is on until it is switched off");
  keepOn(fake, false);
  check(readOn(fake) === false && store.get(SOUND_KEY) === "false", "switched off, it stays off");
  keepOn(fake, true);
  check(readOn(fake) === true, "and on again");
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  check(readOn(broken) === true && (keepOn(broken, false), true), "a browser that blocks storage plays on, and never throws");
  check(SOUND_KEY.startsWith("suite:"), "the choice is this device's (a suite: key never syncs)");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
