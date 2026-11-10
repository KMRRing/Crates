// Shunt's plates: the campaign (shunt-campaign-data.js, made by shunt-pick.mjs: chapters of levels, then Endless), and the daily (the
// day's plate, the same for everyone). Pure: seeded, no DOM. The rules of a campaign are campaign.js's; the daily's goal and stars come
// from the beam search (`rating`), so a goal is always one the search met.
// The twelve levels from before (LEGACY, made with tools: shunt-gen.mjs) keep their ids and their places in the campaign's chapters;
// the eight that teach have a coach.
import { fresh, N, STUD } from "./shunt-engine.js";
import { rng, search } from "./shunt-bots.js";
import { CHAPTERS, LEVELS as MADE, ENDLESS } from "./shunt-campaign-data.js";

export const LEGACY = [
  {id:"l1",name:"Shove",stud:[],jewels:[],start:{9:0,10:0},deal:[0,0,0,0,0],goal:{score:10},stars:[17,25],best:26,sol:[3,0,0,2,4]},
  {id:"l2",name:"Pitch",stud:[],jewels:[],start:{1:1,10:1,16:0},deal:[1,0,1,0,0,0,0,1,1],goal:{score:33},stars:[37,42],best:44,sol:[12,8,-1,26,5,5,-1,0,2,16,6]},
  {id:"l3",name:"Shear",stud:[],jewels:[],start:{1:0,5:0,6:1,10:0},deal:[0,1,0,1,1,0,1,0,0],goal:{score:39},stars:[44,50],best:52,sol:[0,1,-1,5,23,7,-1,25,23,27,2]},
  {id:"l4",name:"Jam",stud:[],jewels:[],start:{9:1,10:0,11:0},deal:[0,0,0,1,0,1,1,1,1,0,0],goal:{nojam:true,score:42},stars:[47,52],best:54,sol:[5,5,2,6,-1,6,6,6,-1,9,13,9,3]},
  {id:"l5",name:"Hold",stud:[],jewels:[],start:{6:0,16:1},deal:[1,0,0,1,0,0,0,1,1,1,0,1],goal:{nojam:true,score:43},stars:[45,47],best:49,sol:[-1,5,7,24,-1,24,9,9,24,-1,19,4,-1,2,24,1]},
  {id:"l6",name:"Idler",stud:[],jewels:[],start:{2:2,15:1},deal:[1,2,0,1,0,1,3,2,0,3,0,2,1],goal:{score:46},stars:[52,58],best:60,sol:[5,1,-1,7,12,7,25,-1,1,2,6,-1,25,-1,8,3,4]},
  {id:"l7",name:"Jewels",stud:[],jewels:[7,12,6],start:{13:0,14:0},deal:[1,1,0,0,0,1,0,0,1,0,1,1],goal:{jewels:true,score:73},stars:[78,84],best:87,sol:[3,-1,6,4,-1,27,27,9,7,8,24,22,20,0]},
  {id:"l8",name:"Bridge",stud:[],jewels:[],start:{14:1,15:0},deal:[0,0,1,1,1,0,1,4,0,4,0,1],goal:{trains:{k:2,m:3},score:46},stars:[50,54],best:56,sol:[5,3,9,11,-1,9,8,6,1,1,-1,1,10,2]},
  {id:"l9",name:"Full plate",stud:[],jewels:[],start:{},deal:[0,1,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,1,0],goal:{nojam:true,score:57},stars:[63,69],best:72,sol:[0,-1,0,2,12,12,5,-1,1,-1,25,3,3,16,4,6,10,17,6,12,-1,8,10]},
  {id:"l10",name:"Jewel box",stud:[],jewels:[5,12,18],start:{},deal:[0,0,0,0,0,2,1,2,2,0,1,1,1,1,0,2,2,2,1],goal:{jewels:true,score:86},stars:[92,99],best:103,sol:[6,8,8,8,7,1,-1,25,25,22,3,5,25,13,-1,11,12,0,22,-1,4,17]},
  {id:"l11",name:"Fusion",stud:[],jewels:[],start:{},deal:[0,0,0,1,0,4,2,2,2,0,1,1,1,1,0,4,2,5,1],goal:{trains:{k:3,m:4},score:60},stars:[66,73],best:76,sol:[0,0,0,-1,2,4,-1,16,8,24,-1,24,2,-1,3,6,24,5,7,8,-1,29,7,5]},
  {id:"l12",name:"Workshop",stud:[9,7,11],jewels:[5,13],start:{},deal:[1,0,4,2,2,1,5,6,4,1,1,0,2,0,3,0],goal:{jewels:true,score:68,trains:{k:2,m:4}},stars:[74,80],best:83,sol:[1,-1,3,-1,25,6,-1,6,6,-1,12,22,-1,8,0,23,2,-1,17,7,26,9]},
];

// What each level teaches. tip: the level's line when nothing else is being said; coach: one line per shove made (the last
// repeats); guide: the coach pulses the best lever each turn (else only where `pulse` says); demo: at the first turn the
// coach pulses a lever that shows this (a shear, a jam) and the shove is held back until another lever is chosen; swap: the
// coach pulses Swap on the first turn (the best line begins with a swap).
const META = [
  { tip: "Tap a steel tab at the edge of the plate to preview a shove, tap it again to shove. Gears of one pitch that touch mesh and turn; three in a chain are a train, and a train scores.",
    guide: true, coach: ["Tap the glowing lever to preview the shove, then tap it again to shove the gear in.", "Gears of one pitch (tooth size) that touch mesh. Three in a chain make a train.", "Longer trains score more. Keep your chain growing.", "Keep going: the plate is judged when the queue runs out."] },
  { tip: "Two pitches (tooth sizes). Only gears of the same pitch mesh, so grow a chain of each.",
    guide: true, coach: ["Two pitches: gold teeth and rose-gold teeth. Only gears of the same pitch mesh.", "Follow the glow, it marks a good shove. Preview shows what it does.", "Keep each pitch in its own chain.", "Keep going: the plate is judged when the queue runs out."] },
  { tip: "A shove slides a whole line, so it can pull a gear away from its neighbours and break a train: that is shear. Preview before you shove.",
    demo: "shear", coach: ["Tap the glowing lever to see what it does.", "Look for a flashing train in the preview: that shove would break it.", "A preview that scores less than now is a shove to think about."] },
  { tip: "Three gears of one pitch touching in a triangle are an odd ring: they cannot all turn, so they jam, lock red and score nothing. Leave no jam.",
    demo: "jam", coach: ["Tap the glowing lever to see what it does.", "Red means jammed. Check the preview for red before you shove.", "No jam anywhere when the plate is judged."] },
  { tip: "Swap sets the next gear aside, or brings the held one back: free, once a turn. The queue shows five gears ahead; plan the order.",
    swap: true, coach: ["Tap Swap: it sets this gear aside and shows the one after it. The glow marks the best order.", "The held gear waits in the cradle. Swap again to bring it back.", "One swap a turn. The queue shows five gears ahead."] },
  { tip: "The black idler meshes with every pitch, so it joins chains of different pitches. It can also close a ring and jam.",
    coach: ["The black idler meshes with every pitch: it can join a gold chain to a rose-gold one.", "Put it between two chains, not in a triangle.", "Idlers can jam a ring too: watch the preview."] },
  { tip: "A train sitting on a jewel is worth half as much again, per jewel. Cover all the jewels with trains that turn.",
    coach: ["A jewel under a turning train pays half as much again. Cover all three.", "A jewel under a jammed train pays nothing.", "Keep the jewels in mind as the plate fills."] },
  { tip: "A bridge shows two pitches and meshes both, so it fuses their trains into one. You need two separate trains: keep the bridges inside one pitch.",
    coach: ["A bridge shows two pitches and meshes both, so it fuses two trains into one.", "You need two separate trains: preview to see if a shove joins them.", "A fused train scores less than two trains."] },
  { tip: "No jam anywhere. Think about where the last gears will go before the plate fills." },
  { tip: "Cover every jewel with trains that turn, in three pitches." },
  { tip: "Three separate trains of four or more. Keep the bridges inside one pitch." },
  { tip: "Studs (rivets) never move and end a line, so a shove stops short of them. Bridges, jewels and studs together." },
];

const COACH = Object.fromEntries(LEGACY.map((d, i) => [d.id, META[i]]));
/** The levels with a coach (the first eight from before, each opening a chapter): hints are offered there after two undos or a shove that lost score. */
export const COACHED = new Set(LEGACY.slice(0, 8).map(d => d.id));
/** The campaign's levels in order, numbered from one, each with its chapter, the coach's lines where it has them, and as its tip the
 *  coach's, or for a chapter's first level its rule (one line, no more: campaign.js). */
export const LEVELS = MADE.map((d, i) => ({ ...d, no: i + 1, ...COACH[d.id], tip: COACH[d.id]?.tip || (MADE[i - 1]?.chapter !== d.chapter ? CHAPTERS[d.chapter].rule : ""), coach: COACH[d.id]?.coach || null }));
/** What campaign.js is given. */
export const CAMPAIGN = { chapters: CHAPTERS, levels: LEVELS, endless: ENDLESS };
export { ENDLESS };

/** A goal in words: "No jam, score 42". */
export function goalWords(goal) {
  const bits = [];
  if (goal.nojam) bits.push("no jam");
  if (goal.jewels) bits.push("cover every jewel");
  if (goal.trains) bits.push(`${goal.trains.k} separate trains of ${goal.trains.m}+`);
  if (goal.score != null) bits.push(`score ${goal.score}`);
  const s = bits.join(", ");
  return s ? s[0].toUpperCase() + s.slice(1) : "Pure score";
}

// ---------- the daily's plate (and the plate maker by difficulty it uses) ----------
export const DIFFS = ["easy", "medium", "hard"];
/** How much of the beam's score a plate's goal asks, by difficulty (the daily asks the hard plate's, with its three stars). */
const ASK = { easy: 0.62, medium: 0.76, hard: 0.86 };
const WIDTH = 40;

function pickCells(R, n, used) {
  const out = [];
  while (out.length < n) { const c = Math.floor(R() * N); if (!used.has(c)) { used.add(c); out.push(c); } }
  return out;
}
/** A plate's board and deck (no goal yet) from a seed and a difficulty. */
export function plateOf(seed, diff, { noStart = false } = {}) {
  const R = rng(Math.imul(seed | 0, 0x9E3779B1) ^ 0x85EBCA6B), used = new Set();
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const stud = diff === "hard" ? pickCells(R, Math.floor(R() * 3), used) : [];
  const jewels = pickCells(R, diff === "easy" ? 1 : diff === "medium" ? 2 : 3, used);
  const start = {};
  const starters = noStart ? 0 : diff === "easy" ? 3 : diff === "medium" ? 2 : Math.floor(R() * 3);
  const sets = diff === "easy" ? [0, 1] : [0, 1, 2];
  for (const c of pickCells(R, starters, new Set(used))) start[c] = sets[Math.floor(R() * sets.length)];
  for (const c of Object.keys(start)) used.add(+c);
  const free = N - stud.length - Object.keys(start).length;
  const deal = [];
  if (diff === "easy") { const a = 5 + Math.floor(R() * 3); for (let i = 0; i < 12; i++) deal.push(i < a ? 0 : 1); }
  else if (diff === "medium") { for (let i = 0; i < 2; i++) deal.push(3); while (deal.length < 13) deal.push(Math.floor(R() * 3)); }
  else {
    for (let i = 1 + Math.floor(R() * 2); i > 0; i--) deal.push(3);
    for (let i = 0; i < 2; i++) deal.push(4 + Math.floor(R() * 3));
    while (deal.length < free) deal.push(Math.floor(R() * 3));
  }
  return { stud, jewels, start, deal: shuffle(deal) };
}
/** The plate's goal and stars from the beam's score for it. */
export function rated(plate, score, diff) {
  const t3 = Math.floor(score * 0.97), goal = Math.min(t3 - 1, Math.max(10, Math.round(score * ASK[diff]))), t2 = Math.max(goal, Math.floor((goal + t3) / 2));
  return { ...plate, goal: { score: goal }, stars: [t2, Math.max(t3, t2)] };
}
/** The beam search that rates a plate, to run in slices (bots.js `search`); done(spec) gets the plate with its goal. */
export function rating(plate, diff) {
  const sr = search(fresh({ ...plate, goal: {} }), WIDTH);
  return { step: ms => sr.step(ms), result: () => rated(plate, sr.result().score, diff) };
}
/** The daily's plate for a day (YYYYMMDD): the hard plate, with no starting gears, seeded by the day. */
export function dailyPlate(day) {
  return { kind: "daily", day, diff: "hard", ...plateOf(day, "hard", { noStart: true }) };
}
export { STUD };
