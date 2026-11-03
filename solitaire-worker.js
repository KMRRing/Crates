// Looks for deals that can be won, and for the moves that win a position (solitaire-solver.js), off the page: a two-suit
// Spider deal takes a few seconds of searching on a phone, a hint up to one.
import { answer } from "./solitaire-solver.js";

self.onmessage = e => {
  const { id } = e.data;
  self.postMessage({ id, result: answer(e.data, tried => self.postMessage({ id, tried })) });
};
