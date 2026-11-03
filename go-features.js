// The inputs of the g170 network (KataGo's version 7 input layout, cpp/neuralnet/nninputs.cpp fillRowV7): 22 planes over the
// board and 19 numbers about the game, all seen from the side to move. Chinese rules, positional superko, no handicap
// "playout doubling" hint. Left at zero: the ladder planes (14 to 17) and the pass-alive area planes (18, 19), which only
// sharpen the net's judgement; a net that has never seen them nonzero plays as it does with them off.

import { BLACK, WHITE, EMPTY, opp, neighbours } from "./go-rules.js";

export const IN_C = 22, IN_G = 19;

/** pos: the Position; made: the moves so far as [{ c, pt }] (only the last five matter); komi: White's; returns the two arrays. */
export function featuresOf(pos, made, komi) {
  const n = pos.n, cells = n * n, b = pos.b, nb = neighbours(n);
  const spatial = new Float32Array(cells * IN_C), globals = new Float32Array(IN_G);
  const pla = pos.toMove, o = opp(pla);
  const libs = new Int16Array(cells), done = new Uint8Array(cells), stones = [];
  for (let i = 0; i < cells; i++) {
    const base = i * IN_C;
    spatial[base] = 1;
    const v = b[i];
    if (v === EMPTY) continue;
    spatial[base + (v === pla ? 1 : 2)] = 1;
    if (!done[i]) {
      const l = pos.group(i, stones);
      for (const s of stones) { libs[s] = l; done[s] = 1; }
    }
    const l = libs[i];
    if (l >= 1 && l <= 3) spatial[base + 2 + l] = 1;
  }
  if (pos.ko >= 0) spatial[pos.ko * IN_C + 6] = 1;
  // the last five moves, as long as they alternate and the latest is the opponent's
  for (let k = 0; k < 5; k++) {
    const m = made[made.length - 1 - k];
    if (!m || m.c !== (k % 2 === 0 ? o : pla)) break;
    if (m.pt < 0) globals[k] = 1;
    else spatial[m.pt * IN_C + 9 + k] = 1;
  }
  globals[5] = (pla === WHITE ? komi : -komi) / 20;
  globals[6] = 1; globals[7] = 0.5;           // positional superko
  globals[14] = pos.passes >= 1 ? 1 : 0;       // a pass now would end the game
  void nb;
  return { spatial, globals };
}
