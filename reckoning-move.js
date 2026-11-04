// Courier's feel: what the camera and the hero's body are doing between what the rules say. The rules (reckoning-engine.js)
// put the hero at an exact place at every step; this is how he, and the eye that follows him, get there: springs that start
// quickly and arrive softly or overshoot, a pose that is carried over from the one before instead of snapping to the next
// (an offset that dies away: "inertialisation"), and the camera that lags a lane change, widens with speed and settles
// after a landing. Pure numbers (no three.js, no page, no clock), so it is the same from the same frames in Node
// (tests/reckoning.mjs); reckoning-3d.js feeds it the hero as the rules have him and draws what it says.
//
// Every spring takes a speed `w` (1/s: its response takes about 4.7/w seconds) and a damping `z` (1 is critical: it arrives
// without overshoot; below it, the less, the more it overshoots and rings). A `dt` of 0 (the game paused) changes nothing.

import { T } from "./reckoning-tune.js";

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/** Steps any { x, v } towards `target`, in slices of at most 1/240 s, so a long frame stays stable. */
export function stepSpring(s, target, dt, w, z = 1) {
  if (!(dt > 0)) return s.x;
  const n = Math.min(32, Math.ceil(dt * 240)), h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += (w * w * (target - s.x) - 2 * z * w * s.v) * h;
    s.x += s.v * h;
  }
  return s.x;
}

/** One damped spring on a number: `x` and its speed `v`. */
export class Spring {
  constructor(x = 0) { this.x = x; this.v = 0; }
  to(target, dt, w, z = 1) { return stepSpring(this, target, dt, w, z); }
  /** Gives it a push (a change of its speed). */
  kick(v) { this.v += v; return this; }
  set(x) { this.x = x; this.v = 0; return this; }
}

/** A pose as a list of numbers that is carried over when the pose changes: the numbers asked for now are the new pose's,
 *  and what is shown is those plus an offset, which is whatever the old pose was showing minus the new pose's first, then
 *  dies away on its own spring. So a jump that becomes a lunge, a roll that ends in a run, never snaps, and the new pose
 *  still moves as itself (the stride is not slowed by being smoothed). `ws` is how quickly each number's offset dies. */
export class Inertia {
  constructor(n, w = 18, z = 0.8) {
    this.n = n; this.ws = Array.isArray(w) ? w : new Array(n).fill(w); this.z = z;
    this.off = new Array(n).fill(0); this.vel = new Array(n).fill(0); this.out = new Array(n).fill(0); this.key = null;
  }
  step(key, target, dt) {
    if (this.key === null) { for (let i = 0; i < this.n; i++) this.out[i] = target[i]; }
    else if (key !== this.key) for (let i = 0; i < this.n; i++) this.off[i] = this.out[i] - target[i];
    this.key = key;
    for (let i = 0; i < this.n; i++) {
      const sp = { x: this.off[i], v: this.vel[i] };
      stepSpring(sp, 0, dt, this.ws[i], this.z);
      this.off[i] = sp.x; this.vel[i] = sp.v;
      this.out[i] = target[i] + this.off[i];
    }
    return this.out;
  }
}

/** The way a light thing on the hero (the scarf's ends, the coat's tails, the plume, the hair) hangs: dragged by the air he
 *  runs through. The drag is on the air's flow round it, which is his speed (backwards) and his climb (down when he rises, up
 *  when he falls), set against its own weight, so it hangs when he is slow, streams out when he is fast, droops in a jump and
 *  flares in a fall; across, it trails the way he is moving sideways. `kd` is how light it is (the bigger, the more it streams).
 *  A spring takes it there, loosely, so it lags a change and rings after it. Angles are the joint's: x, from hanging straight
 *  down, backwards; z, sideways. */
export class Streamer {
  constructor(kd, w = 16, z = 0.3) { this.kd = kd; this.w = w; this.z = z; this.a = new Spring(0); this.b = new Spring(0); }
  update(dt, air) {
    const { kd } = this;
    const a = Math.atan2(kd * air.speed, 1 + kd * air.vy), b = -Math.atan(kd * air.vx);
    this.a.to(a + (air.flutter || 0), dt, this.w, this.z);
    this.b.to(b, dt, this.w, this.z);
  }
  /** A push on both angles (a landing throws it forward, a lane change whips it across). */
  kick(a, b = 0) { this.a.kick(a); this.b.kick(b); }
}

/** The camera. `update(dt, s)` takes the hero as drawn, { x, y, vx, speed, wall, rolling, lunging }, and gives where the camera is
 *  in the hero's terms (x across, y up, `back` metres behind him, what it looks at, its field of view over the base one in
 *  degrees, and its roll in radians): it follows his lane late and leans the way he goes, rises with him late so a jump shows,
 *  draws back and widens with speed, banks with a wall run, and a landing dips it and lets it spring back. */
export class CameraRig {
  constructor() {
    this.sx = new Spring(0); this.sy = new Spring(3.2); this.sback = new Spring(5.4); this.sfov = new Spring(0);
    this.sroll = new Spring(0); this.slook = new Spring(1.2); this.sdip = new Spring(0); this.spunch = new Spring(0);
    this.out = { x: 0, y: 3.2, back: 5.4, lookX: 0, lookY: 1.2, ahead: 10, fov: 0, roll: 0 };
  }
  /** Back to where the camera stands for a hero at rest in his lane, at once (a new run). */
  reset(x = 0) {
    this.sx.set(x * 0.55); this.sy.set(3.2); this.sback.set(5.4); this.slook.set(1.2);
    for (const s of [this.sfov, this.sroll, this.sdip, this.spunch]) s.set(0);
  }
  /** A landing at `impact` m/s: the camera dips and the picture draws in a little, and both come back with an overshoot. */
  land(impact) { this.sdip.x -= clamp(impact * 0.028, 0.05, 0.5) * T.CAM_KICK; this.spunch.x -= clamp(impact * 0.12, 0.4, 3) * T.CAM_KICK; }
  /** The field of view opens for a moment (a cut, a dive): `deg` degrees, back in a third of a second. */
  punch(deg) { this.spunch.x += deg * T.CAM_KICK; }
  /** Pushes the camera's height (a jump's kick, a slam). */
  bump(y) { this.sdip.kick(y * T.CAM_KICK); }
  update(dt, s) {
    const k = clamp((s.speed - 8) / 8, 0, 1), f = T.CAM_FOLLOW;   // how fast: 0 up to 8 m/s, 1 at the full 16; f: how quickly the springs chase the hero
    this.sx.to(s.x * 0.55 + s.vx * 0.05, dt, 7 * f, 0.85);
    this.sy.to(3.2 + Math.min(Math.max(s.y, 0), 4) * 0.35 + Math.max(0, Math.min(s.y, 8) - 4) * 0.55 - (s.rolling ? 0.3 : 0) - k * 0.25, dt, (s.y > 3 ? 11 : 6.5) * f, 0.8);       // up a wall or on a balcony it keeps up, or the hero climbs out of the picture
    this.sdip.to(0, dt, 10, 0.4);
    this.sback.to(5.4 + k * 1.0 + (s.lunging ? 0.2 : 0) + Math.min(Math.max(s.y, 0), 6) * 0.12, dt, 4.5 * f, 0.9);
    this.sfov.to(k * 6, dt, 5, 0.8);
    this.spunch.to(0, dt, 9, 0.55);
    this.sroll.to(clamp(s.vx * 0.0032, -0.06, 0.06) * 1 - (s.wall || 0) * 0.075, dt, 9, 0.55);
    this.slook.to(1.2 + Math.min(Math.max(s.y, 0), 4) * 0.25 + Math.max(0, Math.min(s.y, 8) - 4) * 0.45, dt, (s.y > 3 ? 13 : 8) * f, 0.9);
    const o = this.out;
    o.x = this.sx.x; o.y = this.sy.x + this.sdip.x; o.back = this.sback.x; o.lookX = this.sx.x * 0.6; o.lookY = this.slook.x;
    o.ahead = 10 + k * 2; o.fov = this.sfov.x + this.spunch.x; o.roll = this.sroll.x;
    return o;
  }
}
