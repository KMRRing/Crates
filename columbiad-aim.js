// Columbiad's control in numbers (pure, so Node tests it): one slingshot-style drag back from the launch pad. The shot goes
// the way opposite the pull, and its power is how long the pull is; the pull is relative (it starts from the aim that
// stands, wherever the finger lands), so a small drag nudges and a long one swings, and a thumb at the foot of the screen
// can reach every aim. Screen coordinates here: x right, y down, in pixels; the engine's are x right, y up.
import { clampAim, direction, ANGLE_STEP, CHARGE_STEP, BARRELS } from "./columbiad-engine.js";

/** A full pull, in rem (the page multiplies by the root's size, so a tablet's is larger). */
export const PULL_REM = 9;
/** Under this a pull points nowhere yet: the angle that stands is kept. */
export const DEAD_REM = 0.3;
/** One tap of a nudge button. */
export const NUDGE_ANGLE = 0.5, NUDGE_CHARGE = 0.1;

const cap = lvl => lvl.barrels ?? BARRELS;
/** The outward direction at the level's site, in screen coordinates. */
const outward = lvl => { const [x, y] = direction(lvl.site ?? 90); return [x, -y]; };

/** The pull, in screen pixels, that shows an aim. */
export function pullOf(lvl, aim, full) {
  const len = aim.charge / cap(lvl) * full, [ux, uy] = direction(aim.angle);
  return [-ux * len, uy * len];
}
/** A pull kept on the side of the site's horizon the shell can leave by (it cannot be fired into the ground), and no longer than a full pull. */
export function constrain(lvl, p, full) {
  const [nx, ny] = outward(lvl);
  let x = p[0], y = p[1];
  const out = x * nx + y * ny;
  if (out > 0) { x -= out * nx; y -= out * ny; }
  const len = Math.sqrt(x * x + y * y);
  if (len > full) { x *= full / len; y *= full / len; }
  return [x, y];
}
/** The aim a pull means; a pull too short to point keeps the angle of `keep`. */
export function aimOf(lvl, p, full, keep, dead = 0) {
  const len = Math.sqrt(p[0] * p[0] + p[1] * p[1]);
  const angle = len <= dead ? keep.angle : Math.atan2(p[1], -p[0]) * 180 / Math.PI;
  return clampAim(lvl, { ...keep, angle, charge: len / full * cap(lvl) });
}
/** How many whole barrels the charge passed going from a to b (each is a tick under the thumb). */
export function crossed(a, b) { return Math.abs(Math.floor(b + 1e-9) - Math.floor(a + 1e-9)); }

/** A drag in progress: the pull as it stands, moved by the finger's own movement. */
export function begin(lvl, aim, full) { return { p: constrain(lvl, pullOf(lvl, aim, full), full), aim: { ...aim } }; }
export function move(lvl, drag, dx, dy, full, dead, k = 1) {
  drag.p = constrain(lvl, [drag.p[0] + dx * k, drag.p[1] + dy * k], full);        // k < 1: the fine drag, the aim moving a fraction of the finger
  const next = aimOf(lvl, drag.p, full, drag.aim, dead);
  const ticks = crossed(drag.aim.charge, next.charge);
  drag.aim = next;
  return { aim: next, ticks };
}
/** One step of direction (+1 turns it counter-clockwise, as seen) or of power. */
export function nudge(lvl, aim, dAngle, dCharge, k = 1) {
  return clampAim(lvl, { ...aim, angle: aim.angle + dAngle * NUDGE_ANGLE * k, charge: aim.charge + dCharge * NUDGE_CHARGE * k });
}
export { ANGLE_STEP, CHARGE_STEP };
