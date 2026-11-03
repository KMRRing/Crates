# Files
`bank.js` is the word bank as base64-encoded JSON, so answers aren't visible at a glance. It is built from `kb/` (README, The knowledge base) and is append-only: board codes point at answer and word positions, so words are only ever added at the end of an answer and answers at the end of the bank. `gen.js` builds and checks boards, including the split boards for hidden mode.
