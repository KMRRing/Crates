// Pipes on the cube: the levels (November 2026). A level is where the wellhead (src) and the terminal (term) are, as [tile, side], its rock, its old pipe
// (tile: piece), its stakes (tiles, in order), the hand of pieces to lay (a b x, a count each) and the routes that solve it: the side
// the oil leaves each tile by, as digits, from the wellhead's outlet on. Made by pipes-solid-pick.mjs from pipes-solid-make.js, which keeps rock
// only where the level needs it to have one answer (and old pipe and stakes only where they are needed too), and checked
// by tests/pipes-solid.mjs, which solves every level again and wants those routes and no others.
// A level's id is its identity (stars are kept by it): new levels go at the end of a chapter with a new id.

export const CHAPTERS = [
  { key: "a", name: "Edges", rule: "The oil runs over the edges from one face to the next. Turn the pieces to fit." },
  { key: "b", name: "Crossings", rule: "A crossing carries the oil across itself: one piece, two passes." },
  { key: "c", name: "Old pipe", rule: "Old pipe is already in the ground. The oil must run through it." },
  { key: "d", name: "Stakes", rule: "The oil passes the numbered stakes in order." },
  { key: "e", name: "The cube", rule: "Everything at once, on the big cube." },
];

export const LEVELS = [
  // Edges
  { id: "cube-a1", name: "Arris", chapter: "a", solid: "cube", m: 3, src: [34,0], term: [46,2], rocks: [32], olds: {}, stakes: [], hand: "a6 b1", sols: ["3033210"] },
  { id: "cube-a2", name: "Quoin", chapter: "a", solid: "cube", m: 3, src: [49,1], term: [7,0], rocks: [21,8,3], olds: {}, stakes: [], hand: "a6 b2", sols: ["21120322"] },
  { id: "cube-a3", name: "Mitre", chapter: "a", solid: "cube", m: 3, src: [11,1], term: [18,1], rocks: [20,12,41,10,26], olds: {}, stakes: [], hand: "a5 b4", sols: ["012222303"] },
  { id: "cube-a4", name: "Hip", chapter: "a", solid: "cube", m: 3, src: [32,2], term: [1,3], rocks: [5,37,29,51,40], olds: {}, stakes: [], hand: "a8 b3", sols: ["12222230301"] },
  // Crossings
  { id: "cube-b1", name: "Gantry", chapter: "b", solid: "cube", m: 3, src: [19,0], term: [25,1], rocks: [14,15,43], olds: {}, stakes: [], hand: "a5 b2 x1", sols: ["112222223"] },
  { id: "cube-b2", name: "Flyover", chapter: "b", solid: "cube", m: 3, src: [49,2], term: [5,0], rocks: [28,32,53], olds: {}, stakes: [], hand: "a5 b1 x2", sols: ["2230031112"] },
  { id: "cube-b3", name: "Trestle", chapter: "b", solid: "cube", m: 3, src: [1,0], term: [47,1], rocks: [50,24,45], olds: {}, stakes: [], hand: "a7 b2 x1", sols: ["33100100223"] },
  { id: "cube-b4", name: "Span", chapter: "b", solid: "cube", m: 3, src: [10,0], term: [33,2], rocks: [11,41,6,51,39,45], olds: {}, stakes: [], hand: "a9 b2 x1", sols: ["0121103222330"] },
  // Old pipe
  { id: "cube-c1", name: "Spool", chapter: "c", solid: "cube", m: 3, src: [15,3], term: [42,2], rocks: [50], olds: {"5":"a0","18":"a2"}, stakes: [], hand: "a4 b5", sols: ["12232210011"] },
  { id: "cube-c2", name: "Flange", chapter: "c", solid: "cube", m: 3, src: [8,1], term: [28,1], rocks: [21], olds: {"1":"b0","53":"b1"}, stakes: [], hand: "a10 b1", sols: ["3201332230033"] },
  { id: "cube-c3", name: "Gasket", chapter: "c", solid: "cube", m: 3, src: [16,3], term: [1,2], rocks: [], olds: {"7":"b0","18":"a3","23":"b1"}, stakes: [], hand: "a10 b1", sols: ["23212101110100"] },
  { id: "cube-c4", name: "Coupling", chapter: "c", solid: "cube", m: 3, src: [43,1], term: [41,3], rocks: [12,17,27], olds: {"19":"b0","26":"a0","33":"b0"}, stakes: [], hand: "a9 b3", sols: ["203000103022211"] },
  // Stakes
  { id: "cube-d1", name: "Peg", chapter: "d", solid: "cube", m: 4, src: [34,2], term: [60,0], rocks: [43,27,17,29], olds: {}, stakes: [77,31], hand: "a6 b6", sols: ["110323300002"] },
  { id: "cube-d2", name: "Marker", chapter: "d", solid: "cube", m: 4, src: [25,1], term: [17,2], rocks: [27,83,85,38], olds: {}, stakes: [29,32], hand: "a9 b4", sols: ["2322300033010"] },
  { id: "cube-d3", name: "Cairn", chapter: "d", solid: "cube", m: 4, src: [67,2], term: [77,2], rocks: [41,11], olds: {}, stakes: [14,79,42], hand: "a7 b6", sols: ["1111103223011"] },
  { id: "cube-d4", name: "Bearing", chapter: "d", solid: "cube", m: 4, src: [64,0], term: [75,2], rocks: [58,67], olds: {}, stakes: [18,57,15], hand: "a8 b6", sols: ["33012221111120"] },
  // The cube
  { id: "cube-e1", name: "Tallinn", chapter: "e", solid: "cube", m: 4, src: [93,3], term: [49,0], rocks: [1,90,54,59,80,83,20,9], olds: {}, stakes: [], hand: "a7 b3 x2", sols: ["32100010012333"] },
  { id: "cube-e2", name: "Zug", chapter: "e", solid: "cube", m: 4, src: [40,0], term: [39,3], rocks: [15,90,43,14,7,4,0,45,33,3,89], olds: {"36":"a2","38":"a1"}, stakes: [], hand: "a8 b6", sols: ["3223321232111001"] },
  { id: "cube-e3", name: "Ningbo", chapter: "e", solid: "cube", m: 4, src: [34,3], term: [89,3], rocks: [2,37,29,87,83,51], olds: {}, stakes: [3,92], hand: "a10 b4 x1", sols: ["3222221330323301"] },
  { id: "cube-e4", name: "Fujairah", chapter: "e", solid: "cube", m: 4, src: [16,2], term: [76,0], rocks: [22,37,33,31,25], olds: {"72":"a2","91":"a0"}, stakes: [83,32], hand: "a9 b6", sols: ["32101221000110112"] },
];
