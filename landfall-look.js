// Landfall in 3D, the parts that are arithmetic (landfall-scene.js draws, landfall-stage.js listens; tests/landfall-look.mjs checks these):
// where a bearing and a height are in the scene, how far down the navigator is looking (the table) and how far up (the sky), the
// ship's slow roll, how bright and how large a star is drawn, and the resolution that keeps a phone at its frame rate.
//
// The scene's axes: x east, y up, z south (so the north is -z and a bearing of 0 looks down -z). The ship floats at the origin with
// her bow toward -z; she is turned by her heading, and the camera is a child of her, so the sky (fixed to the world) moves against
// her rigging as she rolls.
export const D2R = Math.PI / 180;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
/** The shortest signed turn from `a` to `b`, degrees. */
export const wrapDiff = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;

/** The unit vector toward a bearing (degrees from north through east) and a height (degrees above the horizon). */
export function dirOf(az, alt) {
  const a = az * D2R, h = alt * D2R, c = Math.cos(h);
  return [Math.sin(a) * c, Math.sin(h), -Math.cos(a) * c];
}
/** The bearing and height of a direction: the inverse of dirOf. */
export function azAltOf([x, y, z]) {
  const n = Math.hypot(x, y, z) || 1;
  return { az: ((Math.atan2(x, -z) / D2R) % 360 + 360) % 360, alt: Math.asin(clamp(y / n, -1, 1)) / D2R };
}

// ---------- where the navigator is looking ----------
export const PITCH_MIN = -90, PITCH_MAX = 88;
/** Looking down at the table, 0 (not at all) to 1 (the chart fills the view): the pitch at which the gaze starts to settle on it, and where it has. */
export const tableBlend = pitch => smooth((-14 - pitch) / 30);
/** The pose the camera takes for a look: `look` { az, pitch } is the player's own (a bearing, and degrees up or down); `table` { yaw, pitch, eye } where the table is looked at. */
export function poseOf(look, table, stand) {
  const b = tableBlend(look.pitch);
  const yaw = look.az + b * wrapDiff(look.az, table.az);
  return { b, az: yaw, pitch: lerp(look.pitch, table.pitch, b), eye: stand.eye.map((v, i) => lerp(v, table.eye[i], b)) };
}
/** A look moved by a drag of (dx, dy) pixels, `ppd` pixels to a degree. The sky follows the finger on both axes, as on the flat page: dragging up looks down at the table, dragging down looks up at the sky, sideways turns about the horizon. */
export function dragLook(look, dx, dy, ppd) {
  return { az: (look.az - dx / ppd + 360) % 360, pitch: clamp(look.pitch + dy / ppd, PITCH_MIN, PITCH_MAX) };
}
/** One step of a critically damped approach of `cur` to `target` (degrees, shortest way for a bearing); `rate` is about 1 / the seconds it takes to settle. */
export function ease(cur, target, dt, rate, wrap = false) {
  const d = wrap ? wrapDiff(cur, target) : target - cur, f = 1 - Math.exp(-dt * rate);
  return wrap ? (cur + d * f + 360) % 360 : cur + d * f;
}
/** The field of view for the window's shape: the horizontal angle `zoom` (degrees) is kept, within what a phone's width can bear; returns the vertical one. */
export function vfovOf(aspect, hfov) {
  return 2 * Math.atan(Math.tan(hfov * D2R / 2) / Math.max(0.3, aspect)) / D2R;
}
/** The widest and narrowest horizontal angle of the view, degrees. */
export const HFOV = { min: 18, max: 92, stand: 64 };

// ---------- the sea moving the ship ----------
/**
 * The ship's motion at `t` seconds: roll and pitch in degrees and heave in metres. Two slow waves of different periods, so no two
 * rolls are alike, scaled by the swell (0 to about 1.8) and a storm; none at all for a player who has asked for less motion.
 */
export function shipMotion(t, swell = 0.6, storm = 0, reduced = false) {
  if (reduced) return { roll: 0, pitch: 0, heave: 0 };
  const a = (0.7 + 1.5 * swell) * (1 + 1.2 * storm), w1 = 2 * Math.PI / 7.3, w2 = 2 * Math.PI / 4.6;
  return {
    roll: a * (0.62 * Math.sin(t * w1) + 0.38 * Math.sin(t * w2 + 1.3)),
    pitch: a * 0.45 * (0.7 * Math.sin(t * w1 * 0.83 + 0.6) + 0.3 * Math.sin(t * w2 * 1.2 + 2.1)),
    heave: 0.05 * a * Math.sin(t * w1 * 1.1 + 0.4),
  };
}
/** The wind, 0 (a breath) to 1 (a gale): the swell and the weather between them. */
export const windOf = (swell = 0.6, weather = "clear") => clamp(0.16 + 0.34 * swell + (weather === "swell" ? 0.2 : 0) + (weather === "storm" ? 0.55 : 0) + (weather === "cloud" ? 0.08 : 0), 0, 1);

// ---------- the stars ----------
/**
 * How a star is drawn: its brightness 0 to 1 (the same rule as the flat sky, so a star that is there in one is there in the other), and
 * the angular width of its glow in degrees. `lim` is the faintest magnitude seen, `lamp` whether the lamp burns (it costs the eye its dark).
 */
export function starLook(mag, alt, lim, lamp, t = 0, hr = 0) {
  const ext = 0.3 / Math.max(0.12, Math.sin(Math.max(0.5, alt) * D2R)) - 0.3, m = mag + ext, limit = lim - (lamp ? 0.8 : 0);
  let a = clamp((limit - m) / 1.1 + 0.1, 0, 1);
  if (a <= 0.01) return { a: 0, size: 0 };
  // scintillation (13 November 2026): quick and irregular, three beats that never line up, more the more air the light comes through
  const deep = clamp((30 - alt) / 26, 0, 1), f = 2.1 + (hr % 7) * 0.37;
  const tw = 1 + (0.07 + 0.3 * deep) * (0.55 * Math.sin(t * f + hr) + 0.3 * Math.sin(t * f * 2.71 + hr * 1.3) + 0.15 * Math.sin(t * f * 5.13 + hr * 0.7));
  a = clamp(a * tw, 0, 1);
  return { a, size: clamp(0.5 + 0.2 * (2.6 - m), 0.45, 1.5) };
}

// ---------- resolution ----------
/**
 * The pixel ratio that keeps a phone at its frame rate: `st` { ratio, slow, fast } is moved by the time a frame took (ms). Many slow
 * frames in a row shave it, many quick ones give it back, never above `cap` (the screen's own) or below 0.55.
 */
export function adapt(st, ms, cap) {
  if (ms > 24) { st.slow++; st.fast = 0; } else if (ms < 13) { st.fast++; st.slow = 0; } else { st.slow = Math.max(0, st.slow - 1); st.fast = Math.max(0, st.fast - 1); }
  if (st.slow >= 20) { st.ratio = Math.max(0.55, st.ratio - 0.12); st.slow = 0; return true; }
  if (st.fast >= 180 && st.ratio < cap) { st.ratio = Math.min(cap, st.ratio + 0.1); st.fast = 0; return true; }
  return false;
}

// ---------- the sky's colour ----------
/** The light on the deck from the sky: how much of the day there is (0 in the dark, 1 in full sun) for the sun's height. */
export const dayLight = sunAlt => smooth((sunAlt + 9) / 15);
