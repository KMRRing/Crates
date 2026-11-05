// Carrack's thinking, off the page's thread: the Expert computer players' orders and the coach's weighing (carrack-coach.js's
// `handle`), one message in, one answer out.
import { handle } from "./carrack-coach.js";

self.onmessage = e => {
  let result = null;
  try { result = handle(e.data); } catch (err) { console.error(err); }
  self.postMessage({ id: e.data.id, result });
};
