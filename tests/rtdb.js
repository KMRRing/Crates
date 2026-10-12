// For the tests: what Firebase's Realtime Database does to a value written to it, so a game's room state can be checked
// without the database. It refuses the whole write for undefined, NaN or Infinity, a function, or a key with . # $ / [ ]
// or a control character anywhere in it (validateFirebaseData in the SDK; tests/fake-sync.js does the same in a
// browser); it keeps no nulls and no empty lists or objects; it keeps a list as an object of its indices; and it reads
// an object whose keys are all integers, more than half of them present, back as a list, with holes where the
// missing ones were.
const BAD_KEY = /[.#$/\[\]\x00-\x1f\x7f]/;
export function validate(v, path = "") {
  if (v === undefined) throw new Error(`contains undefined in property '${path}'`);
  if (typeof v === "function" || typeof v === "symbol" || typeof v === "bigint") throw new Error(`contains a ${typeof v} in property '${path}'`);
  if (typeof v === "number" && !Number.isFinite(v)) throw new Error(`contains ${v} in property '${path}'`);
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
    if (!k.length || (BAD_KEY.test(k) && !/^\.(sv|value|priority)$/.test(k))) throw new Error(`has an invalid key "${k}" in property '${path}'`);
    validate(x, path ? `${path}.${k}` : k);
  }
}
function store(v) {
  if (v === null) return undefined;
  if (typeof v !== "object") return v;
  const o = {};
  for (const [k, x] of Object.entries(v)) { const s = store(x); if (s !== undefined) o[k] = s; }
  return Object.keys(o).length ? o : undefined;
}
function back(s) {
  if (s === undefined) return null;
  if (typeof s !== "object") return s;
  const keys = Object.keys(s), ints = keys.every(k => /^(0|[1-9]\d*)$/.test(k));
  if (ints && Math.max(...keys.map(Number)) < 2 * keys.length) { const a = []; for (const k of keys) a[Number(k)] = back(s[k]); return a; }
  const o = {};
  for (const k of keys) o[k] = back(s[k]);
  return o;
}
/** A value written and read back, as the database would; throws as the database would on what it refuses. */
export const roundTrip = v => { validate(v); return back(store(v)); };
/** Whether two values are the same, whatever the order of their keys. */
export function same(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => Object.hasOwn(b, k) && same(a[k], b[k]));
}
