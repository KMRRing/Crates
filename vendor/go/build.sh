#!/bin/bash
# Builds vendor/go/go-nn.wasm from go-nn.c: clang 18 and wasm-ld, no libraries (the C is freestanding), WebAssembly SIMD.
#   bash vendor/go/build.sh [out.wasm]
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=${1:-$HERE/go-nn.wasm}
clang --target=wasm32 -O3 -msimd128 -ffreestanding -fno-builtin -nostdlib -ffast-math -fno-unroll-loops \
  -Wl,--no-entry -Wl,--export=conv -Wl,--export=bnact -Wl,--export=addto -Wl,--export=addbias -Wl,--export=gpool \
  -Wl,--export=__heap_base -Wl,--export-memory -Wl,-z,stack-size=16384 -Wl,--initial-memory=1048576 \
  -o "$OUT" "$HERE/go-nn.c"
ls -l "$OUT"
