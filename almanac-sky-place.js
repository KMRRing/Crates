// Where each star stands: the stored layout (almanac-sky-layout.js, written offline by almanac-sky-build.mjs) read back,
// and a place worked out for anything kb/ has gained since. Pure, so tests and the page share it.
//
// A star is a thing in kb/ that isn't a copy of another (`same`). Its position is in "sky units": the sky is a flattened
// disc about 100 units from its middle to its edge.

const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return h >>> 0; };
/** A float in [0, 1) that depends only on the text and a number: the same on every device. */
export function jitter(text, k) { return (fnv(`${k}:${text}`) >>> 8) / 16777216; }

/** The layout as a Map from a thing's id to its x, y, z. */
export function decode(layout) {
  const bin = atob(layout.xyz), view = new DataView(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) view.setUint8(i, bin.charCodeAt(i));
  const ids = layout.ids ? layout.ids.split("\n") : [], at = new Map();
  ids.forEach((id, k) => at.set(id, [0, 1, 2].map(c => view.getInt16(2 * (3 * k + c), true) / layout.step)));
  return at;
}

/**
 * The stars of a knowledge base and where they stand.
 *   entities, links   kb/'s
 *   primary           the subject (an index) of each entity, by its place in `entities`
 *   layout            LAYOUT from almanac-sky-layout.js
 * Returns { stars, xyz, kept }: `stars` the entity indexes that are stars, `xyz` a Float32Array of their positions, and
 * `kept` how many had a place in the layout (the rest were put near their neighbours, or their subject's middle).
 */
export function place(entities, links, primary, layout) {
  const stored = decode(layout), stars = [], row = new Map();
  entities.forEach((e, i) => { if (!e.same) { row.set(e.id, stars.length); stars.push(i); } });
  entities.forEach(e => { if (e.same && row.has(e.same)) row.set(e.id, row.get(e.same)); });
  const n = stars.length, xyz = new Float32Array(3 * n), have = new Uint8Array(n);
  let kept = 0;
  stars.forEach((i, r) => {
    const at = stored.get(entities[i].id);
    if (at) { xyz.set(at, 3 * r); have[r] = 1; kept++; }
  });
  if (kept === n) return { stars, xyz, kept };
  // the middle of each subject's stars, for a newcomer with no neighbour that has a place
  const sum = new Map();
  stars.forEach((i, r) => {
    if (!have[r]) return;
    const m = sum.get(primary[i]) || sum.set(primary[i], [0, 0, 0, 0]).get(primary[i]);
    m[0] += xyz[3 * r]; m[1] += xyz[3 * r + 1]; m[2] += xyz[3 * r + 2]; m[3]++;
  });
  const near = new Map();                                    // a newcomer's neighbours that have a place
  for (const l of links) {
    const a = row.get(l.from), b = row.get(l.to);
    if (a == null || b == null || a === b) continue;
    if (!have[a] && have[b]) (near.get(a) || near.set(a, []).get(a)).push(b);
    if (!have[b] && have[a]) (near.get(b) || near.set(b, []).get(b)).push(a);
  }
  stars.forEach((i, r) => {
    if (have[r]) return;
    const id = entities[i].id, around = near.get(r), c = [0, 0, 0];
    if (around?.length) {
      for (const q of around) for (let k = 0; k < 3; k++) c[k] += xyz[3 * q + k] / around.length;
    } else {
      const m = sum.get(primary[i]);
      if (m) for (let k = 0; k < 3; k++) c[k] = m[k] / m[3];
    }
    for (let k = 0; k < 3; k++) xyz[3 * r + k] = c[k] + (jitter(id, k) - 0.5) * (around?.length ? 5 : 16) * (k === 1 ? 0.6 : 1);
  });
  return { stars, xyz, kept };
}
