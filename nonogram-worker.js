// Nonogram's next picture, dealt and made away from the page (a module worker), so making a sparse Large picture never
// holds up a stroke: the page sends the menu's choices and what's been dealt lately, and gets back the picture and its
// puzzle, which it keeps for when Next is pressed (nonogram.js, prepare).
import { dealPicture, puzzleOf } from "./nonogram-pictures.js";

onmessage = ({ data }) => {
  const { n, args } = data;
  try {
    const got = dealPicture(args);
    postMessage({ n, got, puzzle: got ? puzzleOf(got.id, args.size, args.grid) : null });
  } catch (e) {
    postMessage({ n, got: null, puzzle: null, error: String(e?.message || e) });
  }
};
