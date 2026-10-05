// Slate's referee off the page: Check and Suggest search whole boards, which can take a moment on a phone.
import { checkBoard, suggestWord } from "./slate-solve.js";
self.onmessage = e => {
  const { id, kind, board, letters, placed, slot } = e.data;
  const out = kind === "check" ? checkBoard(board, letters, placed, slot) : suggestWord(board, letters, slot);
  self.postMessage({ id, ...out });
};
