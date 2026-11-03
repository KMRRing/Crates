// Tap to build (factor-tap.js): on your own turn every legal road, post and factory spot you can pay for is a tap that builds
// it. Nothing is offered that you can't pay for or have no piece left of; the three kinds never share a spot; the engine
// accepts every move a tap makes. Run: node tests/factor-tap.mjs
import { rules, fresh, roadSpots, postSpots, factorySpots, COSTS } from "../factor-rules.js";
import { VERTS } from "../factor-board.js";
import { seeded } from "../seats.js";
import { affordable, buildSpots, tapMove } from "../factor-tap.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const clone = v => JSON.parse(JSON.stringify(v));
const act = (s, seat, move) => rules.act(clone(s), seat, move, { rng: seeded(1), now: 0 });

/** Seat 0 to build: a post on corner 0, roads on two of its edges and one beyond, so there are places for all three kinds. */
function table(hand) {
  const s = fresh({ seats: 4, options: {}, rng: seeded(3) });
  s.step = "main"; s.turn = 0; s.turnNo = 5; s.rolled = true;
  s.vo[0] = 1; s.vl[0] = 1;
  const [e0] = VERTS[0].edges;
  s.eo[e0] = 1;
  const far = VERTS[0].adj.find(w => VERTS[w].edges.includes(e0)), beyond = VERTS[far].edges.find(e => e !== e0);
  s.eo[beyond] = 1;                                              // the road runs on, so the corner beyond it is a post spot
  s.hand[0] = [...hand];
  return s;
}
const RICH = [5, 5, 5, 5, 5];
const size = sp => sp.v.size + sp.e.size;

{
  const s = table([0, 0, 0, 0, 0]), sp = buildSpots(s, 0);
  check(size(sp) === 0, "with no cards nothing is ringed, so a tap builds nothing");
  check(tapMove(s, 0, "e", roadSpots(s, 0)[0]) === null, "…and a tap on a place that could be built if you had the cards does nothing");
}
{
  const s = table([1, 1, 0, 0, 0]), sp = buildSpots(s, 0);
  check(sp.e.size === roadSpots(s, 0).length && sp.v.size === 0, "a timber and a clay ring the roads, and only them");
  const at = [...sp.e][0];
  check(JSON.stringify(tapMove(s, 0, "e", at)) === JSON.stringify({ t: "build", what: "road", at }), "a tap on a ringed edge is a road");
  check(tapMove(s, 0, "v", 0) === null && tapMove(s, 0, "e", -1) === null, "a corner with no ring, and an edge that isn't one, build nothing");
}
{
  const s = table([0, 0, 0, 2, 3]), sp = buildSpots(s, 0);
  check(sp.e.size === 0 && [...sp.v].join() === "0", "two grain and three iron ring the post to upgrade, alone");
  check(tapMove(s, 0, "v", 0)?.what === "factory", "a tap on it is a factory");
}
{
  const s = table(RICH), sp = buildSpots(s, 0);
  const posts = postSpots(s, 0), works = factorySpots(s, 0);
  check(posts.length > 0 && works.length > 0 && roadSpots(s, 0).length > 0, "the table has a place for each kind");
  check(posts.every(v => !works.includes(v)), "a corner is a post spot or a factory spot, never both: a tap is never ambiguous");
  check(sp.v.size === posts.length + works.length && sp.e.size === roadSpots(s, 0).length, "with everything paid for, every legal place of every kind is ringed");
  let every = true;
  for (const e of sp.e) every &&= typeof act(s, 0, tapMove(s, 0, "e", e)) !== "string";
  for (const v of sp.v) every &&= typeof act(s, 0, tapMove(s, 0, "v", v)) !== "string";
  check(every, "the engine accepts the move of every ringed place");
  check([...sp.v].every(v => tapMove(s, 0, "v", v).what === (works.includes(v) ? "factory" : "post")), "a corner builds what it is: a factory on your post, a post on an empty corner");
  const only = buildSpots(s, 0, "road");
  check(only.v.size === 0 && only.e.size === sp.e.size, "the Road button narrows the rings to roads");
  check(tapMove(s, 0, "v", works[0], "post") === null, "…and a tap on a place of another kind builds nothing");
}
{
  const s = table(RICH);
  check(size(buildSpots(s, 1)) === 0 && tapMove(s, 1, "e", roadSpots(s, 0)[0]) === null, "it is only ever your own turn's");
  for (const step of ["roll", "discard", "blockade", "steal", "offer", "pick", "causeway", "setup"]) {
    const t = clone(s); t.step = step;
    if (size(buildSpots(t, 0)) !== 0) check(false, `no rings in the ${step} step`);
  }
  check(true, "and only in the main step (the setup and the free roads have their own taps)");
  const out = clone(s); out.eo.fill(1); for (let i = 0; i < out.eo.length; i++) if (i % 2) out.eo[i] = 2;
  check(!affordable(out, 0, "road") && buildSpots(out, 0, "road").e.size === 0, "with all fifteen roads on the island, none is ringed");
  check(affordable(s, 0, "post") && !affordable(table([1, 1, 1, 0, 0]), 0, "post") && COSTS.post.join() === "1,1,1,1,0", "a post needs its four cards");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
