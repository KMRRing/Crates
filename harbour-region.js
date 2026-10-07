// Harbour's region layer: a refinery and its customers on a chart, played a month at a time. The player hires ships and
// gives each a load and the hour it first comes in to the refinery's berth; each then loops on its own: queue for the
// berth, lift, sail out, discharge into the customer's tank as room allows, sail back. Trucks draw the customer's tank
// steadily; an hour a ship can't discharge for want of room costs demurrage, and a unit the trucks can't have because
// the tank ran dry costs a penalty. The score is the month's P&L. Pure: no page, no clock.
export const CAPACITY = { coaster: 4, handy: 10 };

export const REGIONS = [
  {
    id: "estonia", chapter: "baltic", name: "Klaipėda to Muuga", teaches: "how many ships, and how big",
    brief: "A month of ORLEN diesel from Klaipėda to Muuga, near Tallinn, unblended: Estonia meets its renewables target largely with biomethane. Trucks draw six units a day from Muuga's sixteen-unit tank. Keep it from running dry.",
    refinery: { name: "Klaipėda", lat: 55.71, lon: 21.13, parcel: 2, price: 1.6 },     // one berth, two units an hour; $k a unit
    customer: { name: "Muuga", lat: 59.5, lon: 24.96, hours: 30, parcel: 4, price: 2.2, penalty: 1, tank: { cap: 16, start: 12, use: 0.25 } },
    fleet: { coaster: 4, handy: 2 }, hire: { coaster: 0.5, handy: 0.8 }, demurrage: 0.1, days: 28,
    // the sea lane, west of Saaremaa and Hiiumaa and into the Gulf of Finland: [lon, lat]
    lane: [[21.05, 55.72], [20.82, 56.3], [20.72, 57.1], [21.08, 57.85], [21.32, 58.32], [21.72, 58.95], [22.4, 59.36], [23.5, 59.56], [24.4, 59.62], [24.96, 59.52]],
    // the brilliant plan: two Handys, the second nominated at eight units, timed so neither waits much; the calm plan
    // (never dry, no waiting): two coasters and a light Handy. Each the best of 136,135 fleets, first hours every six.
    par: { profit: 57.7, calm: 0 },
    plans: [
      { par: ["profit"], ships: [{ type: "handy", load: 10, start: 6 }, { type: "handy", load: 8, start: 24 }] },
      { par: ["calm"], ships: [{ type: "coaster", load: 4, start: 0 }, { type: "coaster", load: 4, start: 6 }, { type: "handy", load: 8, start: 12 }] },
    ],
  },
];

/** The loads a ship may nominate: from a full hold down to half, in the berth's lifts. */
export function loadsFor(R, type) {
  const out = [], cap = CAPACITY[type], p = R.refinery.parcel;
  for (let u = Math.floor(cap / p) * p; u >= cap / 2; u -= p) out.push(u);
  return out;
}

// what a ship did in an hour, for the timeline: not yet in, at sea, waiting, loading, discharging
export const DID = { pre: 0, sea: 1, wait: 2, load: 3, dis: 5 };

/** The month, hour by hour. With record, also each ship's hours and place on the lane (0 the refinery, 1 the
 *  customer), the customer's tank, and the ledger as it builds, for the page to play back. */
export function simulate(R, ships, record = false) {
  const H = R.days * 24, c = R.customer, ref = R.refinery;
  const st = ships.map(s => ({ ...s, state: "in", t: s.start, lifts: 0, aboard: 0, idle: 0 }));
  let tank = c.tank.start, revenue = 0, bought = 0, dry = 0, demurrage = 0, berth = -1, delivered = 0;
  const queue = [];                                            // who waits for the berth, in order of arrival
  const rec = record ? { did: st.map(() => new Uint8Array(H)), at: st.map(() => new Float32Array(H)), level: new Float32Array(H),
    revenue: new Float32Array(H), bought: new Float32Array(H), demurrage: new Float32Array(H), dry: new Float32Array(H) } : null;
  for (let h = 0; h < H; h++) {
    const u = Math.min(tank, c.tank.use); dry += c.tank.use - u; tank -= u;     // the trucks draw first
    if (rec) rec.level[h] = tank;
    for (let i = 0; i < st.length; i++) {
      const s = st[i]; let did = DID.sea, at = 0;
      if (s.state === "in") { did = DID.pre; if (--s.t <= 0) { s.state = "queue"; queue.push(i); } }
      else if (s.state === "queue" || s.state === "lift") {
        if (s.state === "queue") {
          if (berth === -1 && queue[0] === i) { berth = i; queue.shift(); s.state = "lift"; s.lifts = 0; }
          else { s.idle++; demurrage += R.demurrage; did = DID.wait; }
        }
        if (s.state === "lift") {
          if (s.lifts >= s.load / ref.parcel) { berth = -1; s.state = "out"; s.t = c.hours; }
          else { s.lifts++; bought += ref.parcel * ref.price; s.aboard += ref.parcel; did = DID.load; }
        }
      }
      else if (s.state === "out") { at = 1 - s.t / c.hours; if (--s.t <= 0) s.state = "dis"; }
      else if (s.state === "dis") {
        at = 1; did = DID.dis;
        const want = Math.min(c.parcel, s.aboard);
        if (want <= 0) { s.state = "back"; s.t = c.hours; did = DID.sea; }
        else {
          // no ullage, no discharge: the part of the hour the tank's lack of room costs is waiting, on demurrage
          const p = Math.min(want, c.tank.cap - tank), lost = p <= 1e-9 ? 1 : (want - p) / c.parcel;
          if (lost > 1e-9) { s.idle += lost; demurrage += R.demurrage * lost; if (p <= 1e-9) did = DID.wait; }
          if (p > 1e-9) {
            tank += p; revenue += p * c.price; delivered += p; s.aboard -= p;
            if (s.aboard <= 1e-9) { s.aboard = 0; s.state = "back"; s.t = c.hours; }
          }
        }
      }
      else if (s.state === "back") { at = s.t / c.hours; if (--s.t <= 0) { s.state = "queue"; queue.push(i); } }
      if (rec) { rec.did[i][h] = did; rec.at[i][h] = at; }
    }
    if (rec) { rec.revenue[h] = revenue; rec.bought[h] = bought; rec.demurrage[h] = demurrage; rec.dry[h] = dry; }
  }
  const aboard = st.reduce((a, s) => a + s.aboard, 0) * ref.price;   // cargo still aboard, at what it cost
  const hire = ships.reduce((a, s) => a + R.hire[s.type] * R.days, 0), shortfall = dry * c.penalty;
  const profit = revenue - bought + aboard - hire - demurrage - shortfall;
  const r2 = v => Math.round(v * 10) / 10;
  return { profit: r2(profit), revenue: r2(revenue), bought: r2(bought), aboard: r2(aboard), hire: r2(hire), demurrage: r2(demurrage),
    shortfall: r2(shortfall), short: r2(dry), waiting: r2(st.reduce((a, s) => a + s.idle, 0)), delivered: r2(delivered), ships: ships.length, rec };
}

/** The month's measures: profit, and calm (hours waiting, for a plan that never runs the tank dry). */
export function measures(r) { return { profit: r.profit, calm: r.short > 1e-9 ? null : r.waiting }; }
