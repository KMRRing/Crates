// Shunt's plates: the campaign (shunt-campaign-data.js, made by shunt-pick.mjs: chapters of levels, then Endless), and the daily (the
// day's plate, the same for everyone). Pure: seeded, no DOM. The rules of a campaign are campaign.js's; every goal and its stars come
// from the longest trains the beam search makes on the plate (`tiers`), so three stars are always within reach.
// The twelve levels from before (LEGACY) keep their ids, plates and places in the campaign's chapters; the eight that teach have a coach.
import { N, STUD } from "./shunt-engine.js";
import { rng, longest } from "./shunt-bots.js";
import { CHAPTERS, LEVELS as MADE, ENDLESS } from "./shunt-campaign-data.js";

// k: how many trains the goal asks for (their size, and the stars, are shunt-pick.mjs's); goal: the plate's other conditions
export const LEGACY = [
  {id:"l1",name:"Shove",k:1,stud:[],jewels:[],start:{9:0,10:0},deal:[0,0,0,0,0],goal:{}},
  {id:"l2",name:"Pitch",k:2,stud:[],jewels:[],start:{1:1,10:1,16:0},deal:[1,0,1,0,0,0,0,1,1],goal:{}},
  {id:"l3",name:"Shear",k:2,stud:[],jewels:[],start:{1:0,5:0,6:1,10:0},deal:[0,1,0,1,1,0,1,0,0],goal:{}},
  {id:"l4",name:"Jam",k:2,stud:[],jewels:[],start:{9:1,10:0,11:0},deal:[0,0,0,1,0,1,1,1,1,0,0],goal:{nojam:true}},
  {id:"l5",name:"Hold",k:2,stud:[],jewels:[],start:{6:0,16:1},deal:[1,0,0,1,0,0,0,1,1,1,0,1],goal:{nojam:true}},
  {id:"l6",name:"Idler",k:2,stud:[],jewels:[],start:{2:2,15:1},deal:[1,2,0,1,0,1,3,2,0,3,0,2,1],goal:{}},
  {id:"l7",name:"Jewels",k:2,stud:[],jewels:[7,12,6],start:{13:0,14:0},deal:[1,1,0,0,0,1,0,0,1,0,1,1],goal:{jewels:true}},
  {id:"l8",name:"Bridge",k:2,stud:[],jewels:[],start:{14:1,15:0},deal:[0,0,1,1,1,0,1,4,0,4,0,1],goal:{}},
  {id:"l9",name:"Full plate",k:2,stud:[],jewels:[],start:{},deal:[0,1,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,1,0],goal:{nojam:true}},
  {id:"l10",name:"Jewel box",k:3,stud:[],jewels:[5,12,18],start:{},deal:[0,0,0,0,0,2,1,2,2,0,1,1,1,1,0,2,2,2,1],goal:{jewels:true}},
  {id:"l11",name:"Fusion",k:3,stud:[],jewels:[],start:{},deal:[0,0,0,1,0,4,2,2,2,0,1,1,1,1,0,4,2,5,1],goal:{}},
  {id:"l12",name:"Workshop",k:2,stud:[9,7,11],jewels:[5,13],start:{},deal:[1,0,4,2,2,1,5,6,4,1,1,0,2,0,3,0],goal:{jewels:true}},
];

// What each level teaches. tip: the level's line when nothing else is being said; coach: one line per shove made (the last
// repeats); guide: the coach pulses the best lever each turn (else only where `pulse` says); demo: at the first turn the
// coach pulses a lever that shows this (a shear, a jam) and the shove is held back until another lever is chosen; swap: the
// coach pulses Swap on the first turn (the best line begins with a swap).
const META = [
  { tip: "Tap a steel tab at the edge of the plate to preview a shove, tap it again to shove. Gears of one pitch that touch mesh; three or more in a chain are a train. Grow the one the goal asks for.",
    guide: true, coach: ["Tap the glowing lever to preview the shove, then tap it again to shove the gear in.", "Gears of one pitch (tooth size) that touch mesh. Three in a chain make a train.", "Keep your chain growing: a longer train earns more stars.", "Keep going: the plate is judged when the queue runs out."] },
  { tip: "Two pitches (tooth sizes). Only gears of the same pitch mesh, so grow a chain of each.",
    guide: true, coach: ["Two pitches: gold teeth and rose-gold teeth. Only gears of the same pitch mesh.", "Follow the glow, it marks a good shove. Preview shows what it does.", "Keep each pitch in its own chain.", "Keep going: the plate is judged when the queue runs out."] },
  { tip: "A shove slides a whole line, so it can pull a gear away from its neighbours and break a train: that is shear. Preview before you shove.",
    demo: "shear", coach: ["Tap the glowing lever to see what it does.", "Look for a flashing train in the preview: that shove would break it.", "A preview that shrinks your trains is a shove to think about."] },
  { tip: "Three gears of one pitch touching in a triangle are an odd ring: they cannot all turn, so they jam, lock red and don't count. Leave no jam.",
    demo: "jam", coach: ["Tap the glowing lever to see what it does.", "Red means jammed. Check the preview for red before you shove.", "No jam anywhere when the plate is judged."] },
  { tip: "Swap sets the next gear aside, or brings the held one back: free, once a turn. The queue shows five gears ahead; plan the order.",
    swap: true, coach: ["Tap Swap: it sets this gear aside and shows the one after it. The glow marks the best order.", "The held gear waits in the cradle. Swap again to bring it back.", "One swap a turn. The queue shows five gears ahead."] },
  { tip: "The black idler meshes with every pitch, so it joins chains of different pitches. It can also close a ring and jam.",
    coach: ["The black idler meshes with every pitch: it can join a gold chain to a rose-gold one.", "Put it between two chains, not in a triangle.", "Idlers can jam a ring too: watch the preview."] },
  { tip: "Every jewel has to end under a train that turns. Cover all of them, and grow the trains the goal asks for.",
    coach: ["Every jewel has to end under a turning train: cover all three.", "A jewel under a jammed train doesn't count.", "Keep the jewels in mind as the plate fills."] },
  { tip: "A bridge shows two pitches and meshes both, so it fuses their trains into one. You need two separate trains: keep the bridges inside one pitch.",
    coach: ["A bridge shows two pitches and meshes both, so it fuses two trains into one.", "You need two separate trains: preview to see if a shove joins them.", "A fused train counts as one, and you need two."] },
  { tip: "No jam anywhere. Think about where the last gears will go before the plate fills." },
  { tip: "Cover every jewel with trains that turn, in three pitches." },
  { tip: "Three separate trains: keep the bridges inside one pitch." },
  { tip: "Studs (rivets) never move and end a line, so a shove stops short of them. Bridges, jewels and studs together." },
];

const COACH = Object.fromEntries(LEGACY.map((d, i) => [d.id, META[i]]));
/** The levels with a coach (the first eight from before, each opening a chapter): hints are offered there after two undos or a shove that set your trains back. */
export const COACHED = new Set(LEGACY.slice(0, 8).map(d => d.id));
/** The campaign's levels in order, numbered from one, each with its chapter, the coach's lines where it has them, and as its tip the
 *  coach's, or for a chapter's first level its rule (one line, no more: campaign.js). */
export const LEVELS = MADE.map((d, i) => ({ ...d, no: i + 1, ...COACH[d.id], tip: COACH[d.id]?.tip || (MADE[i - 1]?.chapter !== d.chapter ? CHAPTERS[d.chapter].rule : ""), coach: COACH[d.id]?.coach || null }));
/** What campaign.js is given. */
export const CAMPAIGN = { chapters: CHAPTERS, levels: LEVELS, endless: ENDLESS };
export { ENDLESS };

/** A goal in words: "2 trains of 5+, no jam". */
export function goalWords(goal) {
  const bits = [];
  if (goal.trains) bits.push(goal.trains.k === 1 ? `a train of ${goal.trains.m}+` : `${goal.trains.k} trains of ${goal.trains.m}+`);
  if (goal.jewels) bits.push("cover every jewel");
  if (goal.nojam) bits.push("no jam");
  const s = bits.join(", ");
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}
/**
 * A goal and stars from the longest trains the beam found (m: each of k trains that long): the goal two gears short of it, a star
 * for each gear more. Korbi, 10 November 2026: the stars ask for the same thing, longer ("2 trains of 5+", then 6+, then 7+).
 */
export function tiers(k, m) {
  const g = Math.max(3, m - 2);
  return { trains: { k, m: g }, stars: [Math.max(g, m - 1), m] };
}

// ---------- the daily's plate ----------
const WIDTH = 40;

function pickCells(R, n, used) {
  const out = [];
  while (out.length < n) { const c = Math.floor(R() * N); if (!used.has(c)) { used.add(c); out.push(c); } }
  return out;
}
/** The daily's plate for a day (YYYYMMDD), the same for everyone: up to two studs, two jewels to cover, three pitches, an idler or two
 *  and two bridges in a deck of sixteen; its goal (two trains of a size: `rating`) is set by the search. */
export function dailyPlate(day) {
  const R = rng(Math.imul(day | 0, 0x9E3779B1) ^ 0x85EBCA6B), used = new Set();
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const stud = pickCells(R, Math.floor(R() * 3), used), jewels = pickCells(R, 2, used).sort((x, y) => x - y);
  const deal = [];
  for (let i = 1 + Math.floor(R() * 2); i > 0; i--) deal.push(3);
  for (let i = 0; i < 2; i++) deal.push(4 + Math.floor(R() * 3));
  while (deal.length < 16) deal.push(Math.floor(R() * 3));
  return { kind: "daily", day, stud, jewels, start: {}, deal: shuffle(deal), goal: { jewels: true } };
}
/** The search that sets a plate's goal, to run in slices (bots.js): two trains (one, if two of five or more can't be made); result()
 *  is the plate with its goal (`tiers`), stars and the best found. */
export function rating(plate) {
  let k = 2, sr = longest(plate, k, { width: WIDTH }), got = null;
  return {
    step(ms) {
      if (!sr.step(ms)) return false;
      const r = sr.result();
      if ((r && r.m >= 5) || k === 1) { got = r || { m: 3 }; return true; }
      sr = longest(plate, --k, { width: WIDTH });
      return false;
    },
    result() { const t = tiers(k, got.m); return { ...plate, goal: { ...plate.goal, trains: t.trains }, stars: t.stars, best: got.m }; },
  };
}
export { STUD };
