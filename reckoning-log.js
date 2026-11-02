// Reckoning's log: every swipe and every event of a run as a numbered line, so a run can be copied out and a line
// pointed at ("#41: I wanted the left gull"). Pure (no page): the page hands it the run as each swipe and event happens,
// and the numbers, the times and the words are made here, tested in Node (tests/reckoning.mjs).
//
// A swipe line says what the swipe met: where the hero was and what he was doing, and the foes about to reach him with
// the seconds until each does (the windows are in seconds, so that is the number that explains what a swipe did). The
// lines after it, with the next numbers, are what the rules did about it.
import { speed } from "./reckoning-engine.js";

const LANE = { "-1": "L", 0: "M", 1: "R" };
const lane = n => LANE[n] ?? String(n);
const num = (x, d = 2) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d);
const f1 = x => x.toFixed(1), f2 = x => x.toFixed(2);

export const LEGEND = [
  "L, M, R: the left, middle and right lane. +0.31s: the seconds until a foe reaches me (it is in seconds that the swipes' windows are).",
  "A foe within a lane of me sees me, winds up, then launches at the lane I was in; \"launched at M\" is where the hit will land.",
  "y: my height in metres, vy: how fast I am going up (m/s). A gull of a question is marked gate<n>; its answer is the card over its lane.",
  "#n is the line's number: say \"#n, I wanted …\" and I can find the moment.",
].join("\n");

const MIND = ["", " sees me", " winding up", ""];
/** What a foe is, for a line: kind, lane, the seconds until it reaches the hero, and what it is about to do. */
function foeText(S, f) {
  const t = (f.z - S.hero.z) / speed(S);
  const mind = f.ph === 3 ? ` launched at ${lane(f.aim)}${f.kind === "gull" ? " (a dive)" : ""}` : MIND[f.ph || 0];
  return `${f.kind} ${lane(f.lane)} ${num(t)}s${f.y > 0.3 ? ` y${f1(f.y)}` : ""}${f.gate ? ` gate${f.gate.id}` : ""}${mind}`;
}

/** The hero: lane, what he is doing, and what the rules are holding for him. */
export function heroText(S) {
  const h = S.hero, bits = [`lane ${lane(h.lane)}`];
  if (h.lunge) {
    const f = S.world.foes.find(x => x.id === h.lunge.foe);
    bits.push(`flying y=${f2(h.y)} at ${f ? foeText(S, f) : "a foe"} (${h.lunge.how}, ${f2(h.lunge.left)}s left)`);
  }
  else if (h.mode === "wall") bits.push(`on the ${lane(h.wall)} wall y=${f2(h.y)}`);
  else if (h.mode === "air") bits.push(`air y=${f2(h.y)} vy=${num(h.vy, 1)}`);
  else bits.push("running");
  if (h.roll > 0) bits.push(`rolling ${f2(h.roll)}s`);
  if (h.jumps > 0) bits.push("jump in hand");
  if (h.guard && S.t < h.guard.until) bits.push(`guarded ${h.guard.dir} ${f2(h.guard.until - S.t)}s`);
  if (h.hurt > 0) bits.push(`hurt-grace ${f2(h.hurt)}s`);
  return bits.join(", ");
}

/** The foes about to reach the hero (or just past), nearest first. */
export function foesText(S, n = 6) {
  const v = speed(S);
  const near = S.world.foes.filter(f => f.alive && !f.spent && (f.z - S.hero.z) / v > -0.15 && (f.z - S.hero.z) / v < 1.3)
    .sort((a, b) => a.z - b.z).slice(0, n);
  return near.length ? near.map(f => foeText(S, f)).join("; ") : "none";
}

export class RunLog {
  /** `S` the run it is for; `resumed` when the page picked a run up part way (what came before is not here). */
  constructor(S, resumed = false) {
    this.seed = S.seed; this.n = 0; this.lines = [];
    if (resumed) this.note(S, "run picked up here: the swipes before this line are not kept");
  }

  add(S, text) {
    this.n++;
    this.lines.push(`#${this.n} t=${f2(S.t)} z=${f1(S.hero.z)} ${text}`);
    if (this.lines.length > 900) this.lines.splice(0, this.lines.length - 900);    // the last ones: a run is long and what matters is recent
    return this.n;
  }

  note(S, text) { return this.add(S, `| ${text}`); }

  /** A swipe, as it lands: before the rules have done anything with it. */
  swipe(S, dir) { return this.add(S, `| swipe ${dir.toUpperCase()} | me: ${heroText(S)} | foes: ${foesText(S)}`); }

  /** An event the rules made. */
  event(S, ev) {
    const text = describe(S, ev);
    if (text) this.add(S, `| ${text}`);
  }

  /** Everything, for copying: what the page is, the legend, then the lines. */
  text(head = "") {
    return [`Reckoning log, run ${this.seed}${head ? `, ${head}` : ""}`, LEGEND, "", ...this.lines].join("\n");
  }

  toJSON() { return { seed: this.seed, n: this.n, lines: this.lines }; }
  static from(data) { const l = Object.create(RunLog.prototype); l.seed = data.seed; l.n = data.n; l.lines = data.lines; return l; }
}

/** An event as a line, or "" for the ones that say nothing a person would look for. */
export function describe(S, ev) {
  const foe = id => S.world.foes.find(f => f.id === id);
  const named = id => { const f = foe(id); return f ? `${f.kind} ${lane(f.lane)}${f.gate ? ` gate${f.gate.id}` : ""}` : "a foe"; };
  switch (ev.type) {
    case "wait": return `${ev.dir.toUpperCase()}: nothing to work on yet, kept for 0.14 s`;
    case "late": return `${ev.dir.toUpperCase()}: the kept swipe took effect`;
    case "drop": return `${ev.dir.toUpperCase()}: nothing came of it, dropped`;
    case "jump": return ev.air ? "jump again, in the air" : "jump";
    case "lane": return `lane → ${lane(ev.lane)}`;
    case "lunge": return `${ev.retarget ? "the cut moves to" : ev.sweep ? "the cut goes on to" : "cut at"} ${ev.kind}${ev.gate ? ` gate${ev.gate}` : ""} (${ev.how})`;
    case "kill": return `KILL ${named(ev.id)} (${ev.how}${ev.chain ? `, chain ${ev.chain}` : ""}${ev.right ? ", the right answer" : ""})`;
    case "roll": return ev.again ? "roll again, no gap" : ev.land ? "roll on landing" : "roll";
    case "notice": return `${named(ev.id)} sees me${ev.look ? `, looks ${ev.look < 0 ? "left" : "right"}` : ""}`;
    case "wind": return `${named(ev.id)} winds up`;
    case "launch": return `${named(ev.id)} launches at lane ${lane(ev.aim)}${ev.kind === "gull" ? " (dives)" : ""}`;
    case "dive": return ev.slam ? "dive, a slam" : "dive";
    case "walljump": return `wall jump off the ${lane(ev.side)} wall`;
    case "wallrun": return `wall run, the ${lane(ev.side)} wall`;
    case "wallleave": return "left the wall";
    case "wallend": return "the wall ended";
    case "land": return ev.slam ? "land, a slam" : "land";
    case "shockwave": return `shockwave, ${ev.n} cut`;
    case "hurt": return `HURT by ${named(ev.id)}, ${ev.hearts} hearts left`;
    case "fall": return `FALL into the water, ${ev.hearts} hearts left`;
    case "clang": return `CLANG: the wrong gull (${named(ev.id)})`;
    case "answer": {
      const q = ev.q, pick = ev.pick == null ? "none" : q.o[ev.pick];
      return `ANSWER gate${ev.gate} ${ev.ok === true ? "right" : ev.ok === false ? "wrong" : "missed"}: "${q.q}" picked ${pick}; right ${q.o[q.a]}`;
    }
    case "heart": return `a heart back, ${ev.hearts}`;
    case "over": return `OVER, ${ev.score} points`;
    default: return "";
  }
}
