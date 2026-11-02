// Where Reckoning's questions come from: the choice banks Punt asks from (the knowledge base, kb/, builds them), cut
// down to what a gull can carry across a phone's width: a question that fits a line or two, three answers of a few
// words each, one right. Each world draws on the banks that suit it; a bank is loaded when a run starts (the pages
// that list them are the ones tools/offline.mjs keeps for offline play). What a question is about (`about`, the
// kb/ entities) rides along, so a miss can go into the pile with them.

/** The worlds. The Hanseatic quay is the first: trade, merchants, the cities they sailed to, money, a refinery's words. */
export const WORLDS = {
  quay: {
    name: "The Hanseatic quay",
    banks: {
      merchants: () => import("./merchants-bank.js"),
      cities: () => import("./cities-bank.js"),
      eco: () => import("./eco-bank.js"),
      refining: () => import("./refining-bank.js"),
      titles: () => import("./titles-bank.js"),
    },
  },
};

export const MAX_ANSWER = 34;          // characters an answer may have (it sits on a gull's banner)
export const MAX_QUESTION = 70;         // characters a question may have: two lines over the quay on the narrowest phone, never cut

/** Questions that fit: one right answer, at least two wrong ones, all short. */
export function fitting(q) {
  return Array.isArray(q.a) && q.a.length === 1 && q.o.length >= 3 && q.q.length <= MAX_QUESTION && q.o.every(o => o.length <= MAX_ANSWER) && new Set(q.o).size === q.o.length;
}

/** Banks as the engine wants them: [{ bank, q }…] with a difficulty. */
export async function load(world = "quay") {
  const out = [];
  for (const [name, get] of Object.entries(WORLDS[world].banks)) {
    const m = await get();
    const list = m.MATHS || Object.values(m).find(Array.isArray) || [];
    for (const q of list) if (fitting(q)) out.push({ bank: name, q });
  }
  return out;
}

/** How hard the gate number n may be: Punt's scale of 1 to 10, climbing a notch every two gates. */
export const hardest = n => Math.min(10, 3 + Math.floor(n / 2));

/** The dealer `newGame({ deal })` wants. Easy questions first, harder as the gates go by; never one twice in a run while
    there are others; the right answer lands in a lane the random number picks. */
export function dealer(pool) {
  return (r, n, asked) => {
    const cap = hardest(n);
    let from = pool.filter(p => (p.q.d || 5) <= cap && !asked.includes(p.q.id));
    if (!from.length) from = pool.filter(p => !asked.includes(p.q.id));
    if (!from.length) from = pool;
    const { bank, q } = from[Math.floor(r() * from.length)];
    const right = q.o[q.a[0]], wrong = q.o.filter((_, i) => i !== q.a[0]);
    const two = [];
    while (two.length < 2) two.push(...wrong.splice(Math.floor(r() * wrong.length), 1));
    const slot = Math.floor(r() * 3), o = two;
    o.splice(slot, 0, right);
    return { id: q.id, bank, q: q.q, o, a: slot, x: q.x || "", about: q.about || [], d: q.d || 5 };
  };
}
