// Landfall's fog and track (landfall-model.js): the seeded draws, the covariance and its ellipse, the Kalman update (a sight
// shrinks the fog only along its direction, and the filter is honest about its own errors), the process noise (larger along the
// track than across it) and the track against shoals, the coast and the harbour.
import { draw, gaussAt, rng, vec, bearing, fogOf, addP, copyP, ellipse, legNoise, fold, enters, nearest, inside, firstEvent } from "../landfall-model.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// the draws are a pure function of the seed and the counter
check(draw(7, 3) === draw(7, 3) && draw(7, 3) !== draw(7, 4) && draw(7, 3) !== draw(8, 3), "a draw depends on its seed and its number only");
{
  const xs = Array.from({ length: 4000 }, (_, i) => draw(12345, i)), m = xs.reduce((t, x) => t + x, 0) / xs.length;
  const g = Array.from({ length: 4000 }, (_, i) => gaussAt(99, 2 * i)), gm = g.reduce((t, x) => t + x, 0) / g.length, gv = g.reduce((t, x) => t + (x - gm) ** 2, 0) / g.length;
  check(xs.every(x => x >= 0 && x < 1) && Math.abs(m - 0.5) < 0.02, "uniform draws lie in [0, 1) and average one half");
  check(Math.abs(gm) < 0.05 && Math.abs(gv - 1) < 0.08, `normal draws have mean ${gm.toFixed(3)} and variance ${gv.toFixed(3)}`);
  const S = { seed: 5, n: 0 }, r = rng(S), a = r.u(), b = r.g();
  check(S.n === 3 && a === draw(5, 0) && b === gaussAt(5, 1), "rng advances the voyage's own counter: one for a uniform, two for a normal");
}
check(near(vec(90)[0], 1) && near(vec(0)[1], 1) && near(bearing([1, 1]), 45) && near(bearing([-1, 0]), 270), "headings run from north through east");

// the ellipse
{
  const e = ellipse(fogOf(2)), k = 2.45;
  check(near(e.rx, 2 * k, 1e-6) && near(e.ry, 2 * k, 1e-6), "a round fog of sd 2 is a circle of radius 2 x 2.45");
  const long = [[9, 0, 0], [0, 1, 0], [0, 0, 0]], f = ellipse(long);
  check(near(f.rx, 3 * k, 1e-6) && near(f.ry, k, 1e-6) && near(Math.abs(f.angle), 0, 1e-6), "a fog of sd 3 east-west and 1 north-south has its long axis along east");
  const slant = [[5, 4, 0], [4, 5, 0], [0, 0, 0]], s = ellipse(slant);
  check(near(s.angle, 45, 1e-6) && near(s.rx, 3 * k, 1e-6) && near(s.ry, k, 1e-6), "a correlated fog leans 45 degrees");
}

// the process noise
{
  const Q = legNoise({ logSigma: 0.05, compassSigma: 1, current: [2, 1] }, 90, 60);   // due east: along is x
  check(Q[0][0] > Q[1][1] && near(Q[0][1], 0, 1e-9), `a leg due east grows the fog more along the track (${Math.sqrt(Q[0][0]).toFixed(2)} nm) than across (${Math.sqrt(Q[1][1]).toFixed(2)} nm)`);
  const R = legNoise({ logSigma: 0.05, compassSigma: 1, current: [2, 1] }, 0, 60);    // due north: along is y
  check(R[1][1] > R[0][0], "...and due north it is the other way about");
  check(near(Q[0][0] + Q[1][1], R[0][0] + R[1][1], 1e-6), "turning the course turns the noise without changing its total");
}

// the Kalman update: the fog shrinks only along the sight
{
  const E = [0, 0], P = fogOf(10), a = [0, 1], f = fold(E, 0, P, a, 0, 1, 4);   // a latitude sight (north), sd 1, says we are 4 nm north
  check(f.P[1][1] < 1.01 && near(f.P[0][0], 100, 1e-9), `a latitude sight takes the north-south sd from 10 to ${Math.sqrt(f.P[1][1]).toFixed(2)} and leaves east-west at 10`);
  check(near(f.E[1], 4 * 100 / 101, 1e-9) && near(f.E[0], 0, 1e-12), "...and moves the estimate north almost all the way to the sight, not sideways");
  const g = fold(E, 0, P, [Math.SQRT1_2, Math.SQRT1_2], 0, 1, 0);
  check(g.P[0][1] < -40 && near(g.P[0][0], g.P[1][1], 1e-9), "a north-east sight leaves the fog a strip along the line of position (x and y become anti-correlated)");
  const e = ellipse(g.P);
  check(e.rx / 2.45 > 9.9 && e.ry / 2.45 < 1.1, `...a strip of sd ${(e.rx / 2.45).toFixed(1)} nm along the line and ${(e.ry / 2.45).toFixed(1)} nm across it`);
  const h = fold(E, 0, P, a, 0, 1, 0), c = fold(E, 0, P, a, 0, 100, 0);
  check(h.P[1][1] < c.P[1][1], "a sharper sight shrinks the fog more than a poor one");
  const e1 = fold([0, 0], 0, P, a, 0, 1, 3), e2 = fold(e1.E, 0, e1.P, a, 0, 1, 3);
  check(e2.P[1][1] < e1.P[1][1] && e2.E[1] > e1.E[1], "two sights are better than one");
  check(JSON.stringify(P) === JSON.stringify(fogOf(10)) && E[0] === 0, "fold leaves its inputs alone");
  // with a clock error in the state, an east-west star makes the clock and the east position trade off
  const Pc = fogOf(5, 3), k = 0.25 * Math.cos(55 * Math.PI / 180), ew = fold([0, 0], 0, Pc, [1, 0], k, 1, 0);
  check(ew.P[2][2] < Pc[2][2] && ew.P[0][2] !== 0, "a sight east or west learns something about the clock too, and ties it to the position");
}

// honesty: simulate fixes and check the filter's claimed variance matches the real errors
{
  let sum = 0, n = 0;
  for (let i = 0; i < 3000; i++) {
    const true_ = [gaussAt(1, 6 * i) * 6, gaussAt(1, 6 * i + 2) * 6], sigma = 0.8, z = true_[1] + gaussAt(1, 6 * i + 4) * sigma;   // the estimate is at 0, 0
    const f = fold([0, 0], 0, fogOf(6), [0, 1], 0, sigma, z), err = true_[1] - f.E[1];
    sum += err * err / f.P[1][1]; n++;
  }
  check(Math.abs(sum / n - 1) < 0.1, `the filter's variance is honest: mean normalised squared error ${(sum / n).toFixed(2)} (1 is exact)`);
}

// the track against hazards
check(near(enters([0, 0], [10, 0], [5, 0, 1]), 0.4, 1e-9), "a track enters a circle where it meets its edge");
check(enters([0, 0], [10, 0], [5, 3, 1]) === null && enters([0, 0], [3, 0], [5, 0, 1]) === null, "...and misses it, or stops short of it");
check(enters([5, 0], [10, 0], [5, 0, 1]) === 0, "a track that starts inside is already in");
check(near(nearest([0, 0], [10, 0], [5, 3]), 3) && near(nearest([0, 0], [10, 0], [14, 3]), 5), "nearest approach to a segment, past its end too");
{
  const sq = [[0, 0], [4, 0], [4, 4], [0, 4]];
  check(inside([2, 2], sq) && !inside([5, 2], sq) && !inside([2, -1], sq), "a point is in or out of a polygon");
  const L = { harbour: { x: 20, y: 0, r: 5 }, shoals: [{ name: "Rock", x: 8, y: 10, r: 2 }], land: [[[30, -50], [30, 50], [60, 50], [60, -50]]] };
  check(firstEvent(L, [0, 0], [25, 0]).kind === "harbour", "a track at the harbour's door is an arrival");
  check(firstEvent(L, [0, 10], [20, 10]).kind === "shoal" && firstEvent(L, [0, 10], [20, 10]).name === "Rock", "a track across a shoal grounds on it, by name");
  check(firstEvent(L, [0, -20], [40, -20]).kind === "land", "a track into the coast grounds on the land");
  check(firstEvent(L, [0, 30], [20, 30]) === null, "open water is nothing");
  const L2 = { harbour: { x: 28, y: 0, r: 5 }, shoals: [], land: L.land };
  check(firstEvent(L2, [0, 0], [40, 0]).kind === "harbour", "the harbour's circle is open water even where it overlaps the land");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("landfall-model: draws, fog, process noise, the Kalman update and the hazards");
