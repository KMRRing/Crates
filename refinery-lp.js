// Refinery's LP: a two-phase simplex, small and dense, enough for a refinery plan of a few hundred flows. Every
// refinery is planned this way (PIMS, GRTMPS, RPMS are LP models): maximise the margin subject to the stream balances,
// the units' capacities, the hydrogen balance and the products' specs, all linear in the flows. The duals it returns
// are the plan's marginal values: what one more barrel of a stream, or of a unit's capacity, would earn.

const EPS = 1e-9;

/**
 * Maximises c·x subject to rows ({ a: { column: coefficient }, op: "<=" | ">=" | "=", b }) and x ≥ 0, over n columns.
 * Returns { status: "optimal" | "infeasible" | "unbounded", x, value, duals (one per row, for the row as given) }.
 */
export function simplex(n, c, rows, { maxIter = 20000 } = {}) {
  const m = rows.length;
  // each row scaled so its largest coefficient is one (spec rows mix densities and indices into the thousands), and
  // turned so its right-hand side isn't negative
  const sign = new Float64Array(m), scale = new Float64Array(m);
  let nSlack = 0, nArt = 0;
  const kind = rows.map((r, i) => {
    let big = Math.abs(r.b);
    for (const v of Object.values(r.a)) big = Math.max(big, Math.abs(v));
    scale[i] = big > EPS ? 1 / big : 1;
    sign[i] = r.b < 0 ? -1 : 1;
    const op = sign[i] < 0 ? (r.op === "<=" ? ">=" : r.op === ">=" ? "<=" : "=") : r.op;
    if (op === "<=") nSlack++; else if (op === ">=") { nSlack++; nArt++; } else nArt++;
    return op;
  });
  const N = n + nSlack + nArt, W = N + 1;
  const T = Array.from({ length: m }, () => new Float64Array(W));
  const basis = new Int32Array(m), ident = new Int32Array(m), isArt = new Uint8Array(N);
  let sCol = n, aCol = n + nSlack;
  rows.forEach((r, i) => {
    const row = T[i], k = sign[i] * scale[i];
    for (const [j, v] of Object.entries(r.a)) row[+j] += v * k;
    row[N] = r.b * k;
    if (kind[i] === "<=") { row[sCol] = 1; basis[i] = ident[i] = sCol++; }
    else if (kind[i] === ">=") { row[sCol++] = -1; row[aCol] = 1; isArt[aCol] = 1; basis[i] = ident[i] = aCol++; }
    else { row[aCol] = 1; isArt[aCol] = 1; basis[i] = ident[i] = aCol++; }
  });
  const pivot = (pr, pc) => {
    const prow = T[pr], pv = prow[pc];
    for (let j = 0; j < W; j++) prow[j] /= pv;
    for (let i = 0; i < m; i++) {
      if (i === pr) continue;
      const row = T[i], f = row[pc];
      if (Math.abs(f) < 1e-14) continue;
      for (let j = 0; j < W; j++) row[j] -= f * prow[j];
    }
    basis[pr] = pc;
  };
  // runs the simplex on a cost vector; allowed(j) says which columns may enter
  const run = (cost, allowed) => {
    const red = new Float64Array(N);
    let stall = 0, last = -Infinity;
    for (let it = 0; it < maxIter; it++) {
      // reduced costs: cost_j − Σ cost_basis · T_ij
      for (let j = 0; j < N; j++) red[j] = cost[j];
      let z = 0;
      for (let i = 0; i < m; i++) { const cb = cost[basis[i]]; if (cb) { const row = T[i]; for (let j = 0; j < N; j++) red[j] -= cb * row[j]; z += cb * row[N]; } }
      // Dantzig's rule, falling back to Bland's (the first improving column) while the objective stalls, so it can't cycle
      if (z > last + 1e-10) { last = z; stall = 0; } else stall++;
      let pc = -1, best = 1e-9;
      for (let j = 0; j < N; j++) {
        if (red[j] <= 1e-9 || !allowed(j)) continue;
        if (stall > 30) { pc = j; break; }
        if (red[j] > best) { best = red[j]; pc = j; }
      }
      if (pc < 0) return "optimal";
      let pr = -1, ratio = Infinity;
      for (let i = 0; i < m; i++) {
        const a = T[i][pc];
        if (a > 1e-9) { const q = T[i][N] / a; if (q < ratio - 1e-12 || (Math.abs(q - ratio) <= 1e-12 && basis[i] < basis[pr])) { ratio = q; pr = i; } }
      }
      if (pr < 0) return "unbounded";
      pivot(pr, pc);
    }
    return "optimal";                      // out of iterations: the best found so far
  };
  // phase 1: drive the artificial columns to zero
  if (nArt) {
    const cost1 = new Float64Array(N);
    for (let j = 0; j < N; j++) if (isArt[j]) cost1[j] = -1;
    run(cost1, () => true);
    let infeas = 0;
    for (let i = 0; i < m; i++) if (isArt[basis[i]]) infeas += T[i][N];
    if (infeas > 1e-6) return { status: "infeasible", x: new Float64Array(n), value: -Infinity, duals: new Float64Array(m) };
    // artificials still in the basis at zero: swap them out for any real column with a coefficient in their row
    for (let i = 0; i < m; i++) {
      if (!isArt[basis[i]]) continue;
      for (let j = 0; j < n + nSlack; j++) if (Math.abs(T[i][j]) > 1e-9) { pivot(i, j); break; }
    }
  }
  // phase 2: the real objective, artificials barred
  const cost2 = new Float64Array(N);
  for (let j = 0; j < n; j++) cost2[j] = c[j] || 0;
  const status = run(cost2, j => !isArt[j]);
  const x = new Float64Array(n);
  for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = T[i][N];
  let value = 0;
  for (let j = 0; j < n; j++) value += (c[j] || 0) * x[j];
  // duals: c_B·B⁻¹, read from the columns that began as the identity, undone for the row's scaling and turning
  const duals = new Float64Array(m);
  for (let r = 0; r < m; r++) {
    let y = 0;
    for (let i = 0; i < m; i++) y += cost2[basis[i]] * T[i][ident[r]];
    duals[r] = y * sign[r] * scale[r];
  }
  return { status, x, value, duals };
}
