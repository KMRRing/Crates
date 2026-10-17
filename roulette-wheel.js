// The wheel, drawn and spun: its pockets in the wheel's order round the rim (red, black, the zero green), the numbers
// above them, the rotor turning one way and the ball the other, slowing until the ball drops into the pocket the
// engine spun. spinTo(svg, pocket) animates it and resolves when the ball has settled; the wheel then stays as it ended,
// the winning pocket under the ball.
import { WHEEL, colourOf, label } from "./roulette-engine.js";

const R = 100;                                         // the wheel's radius, in its own units
const pocketAngle = p => (360 / WHEEL.length) * WHEEL.indexOf(p);
const polar = (r, deg) => [r * Math.sin(deg * Math.PI / 180), -r * Math.cos(deg * Math.PI / 180)];

/** The wheel as SVG markup: the rotor (pockets and numbers, turned by `turn` degrees) and the ball at `ball` degrees. */
export function wheelSvg({ turn = 0, ball = 0, ballR = 0.62 } = {}) {
  const step = 360 / WHEEL.length, parts = [];
  WHEEL.forEach((p, i) => {
    const a0 = i * step - step / 2, a1 = a0 + step, [x0, y0] = polar(R * 0.92, a0), [x1, y1] = polar(R * 0.92, a1), [x2, y2] = polar(R * 0.62, a1), [x3, y3] = polar(R * 0.62, a0);
    parts.push(`<path class="rw-pocket ${colourOf(p)}" d="M${x0.toFixed(2)} ${y0.toFixed(2)}A${R * 0.92} ${R * 0.92} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${R * 0.62} ${R * 0.62} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z"/>`);
    const [tx, ty] = polar(R * 0.83, i * step);
    parts.push(`<text class="rw-num" x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" font-size="7" transform="rotate(${(i * step).toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)})">${label(p)}</text>`);
  });
  const [bx, by] = polar(R * ballR, ball);
  return `<svg class="rw" viewBox="${-R - 3} ${-R - 3} ${2 * R + 6} ${2 * R + 6}" role="img" aria-label="The wheel">
    <circle class="rw-rim" r="${R}"/><g class="rw-rotor" transform="rotate(${turn.toFixed(2)})">${parts.join("")}
      <circle class="rw-hub" r="${R * 0.62}"/><circle class="rw-cone" r="${R * 0.3}"/>
      <path class="rw-turret" d="M0 ${-R * 0.26}L${R * 0.05} 0L0 ${R * 0.26}L${-R * 0.05} 0Z M${-R * 0.26} 0L0 ${R * 0.05}L${R * 0.26} 0L0 ${-R * 0.05}Z"/></g>
    <circle class="rw-ball" cx="${bx.toFixed(2)}" cy="${by.toFixed(2)}" r="${R * 0.045}"/>
    <path class="rw-pointer" d="M0 ${-R * 0.99}L${R * 0.035} ${-R * 0.93}L${-R * 0.035} ${-R * 0.93}Z"/></svg>`;
}

/**
 * Spins the wheel in `box` to `pocket`: the rotor turning clockwise and slowing; the ball running round the rim the other
 * way, slowing faster, dropping into the pockets and riding the last of the rotor's turn in its pocket, which ends at the
 * top under the pointer. Resolves once it has (with the rotor's angle, to start the next spin from). `ms` how long it
 * takes (shorter for a reader who asks for less motion).
 */
export function spinTo(box, pocket, { ms = 4200, from = 0 } = {}) {
  const reduce = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const total = reduce ? 600 : ms, at = pocketAngle(pocket);
  // the rotor ends with the pocket at the top: turned back by its angle, and three turns on from where it stood
  const start = from % 360, end = start + 3 * 360 + ((((-at - start) % 360) + 360) % 360);
  return new Promise(resolve => {
    const t0 = performance.now();
    const frame = now => {
      const t = Math.min(1, (now - t0) / total), turn = start + (end - start) * (1 - (1 - t) ** 3);
      // the ball against its pocket: six turns back to begin with, closing to none (so on screen it runs the other way)
      const behind = -6 * 360 * (1 - t) ** 2.4, drop = Math.min(1, Math.max(0, (t - 0.55) / 0.35));
      box.innerHTML = wheelSvg({ turn, ball: turn + at + behind, ballR: 0.95 - 0.18 * drop });
      if (t < 1) requestAnimationFrame(frame);
      else resolve(end % 360);
    };
    requestAnimationFrame(frame);
  });
}
