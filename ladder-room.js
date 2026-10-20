// Ladder together (README, Ladder): a stand-in while the table is built; solo only.
export function createLadderRoom() {
  return {
    on: false, joining: false, inAddress: false,
    join: async () => false, menu() {}, elapsed: () => 0, keep() {}, report() {}, finish() {}, again() {}, setLevel() {}, resync() {},
    mayPlay: () => true, mayChange: () => true, whyNot: () => "", oneEnd: () => false, label: () => "", waiting: () => "",
    drawLine(box) { box.hidden = true; }, drawResult() {}, teamMove() {}, teamUndo() {}, teamHint() {},
  };
}
