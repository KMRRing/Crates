// The x86 SSE intrinsics Arasan's network code uses (its SSE2, SSSE3 and SSE4.1 paths), written over WebAssembly SIMD,
// so the same source and the same arithmetic run in a browser. A stand-in for <immintrin.h> for the WebAssembly build only.
#pragma once
#include <wasm_simd128.h>
#include <stdint.h>

typedef v128_t __m128i;
typedef v128_t __m128;

#define _MM_SHUFFLE(z, y, x, w) (((z) << 6) | ((y) << 4) | ((x) << 2) | (w))

static inline __m128i _mm_load_si128(const __m128i* p) { return wasm_v128_load(p); }
static inline __m128i _mm_loadu_si128(const __m128i* p) { return wasm_v128_load(p); }
static inline __m128i _mm_loadl_epi64(const __m128i* p) { return wasm_v128_load64_zero(p); }
static inline void _mm_store_si128(__m128i* p, __m128i a) { wasm_v128_store(p, a); }
static inline void _mm_storeu_si128(__m128i* p, __m128i a) { wasm_v128_store(p, a); }

static inline __m128i _mm_setzero_si128() { return wasm_i32x4_splat(0); }
static inline __m128i _mm_set1_epi8(char x) { return wasm_i8x16_splat(x); }
static inline __m128i _mm_set1_epi16(short x) { return wasm_i16x8_splat(x); }
static inline __m128i _mm_set1_epi32(int x) { return wasm_i32x4_splat(x); }
static inline __m128i _mm_setr_epi32(int a, int b, int c, int d) { return wasm_i32x4_make(a, b, c, d); }
static inline __m128i _mm_cvtsi32_si128(int x) { return wasm_i32x4_make(x, 0, 0, 0); }
static inline int _mm_cvtsi128_si32(__m128i a) { return wasm_i32x4_extract_lane(a, 0); }
#define _mm_extract_epi32(a, imm) wasm_i32x4_extract_lane((a), (imm))

static inline __m128i _mm_add_epi16(__m128i a, __m128i b) { return wasm_i16x8_add(a, b); }
static inline __m128i _mm_sub_epi16(__m128i a, __m128i b) { return wasm_i16x8_sub(a, b); }
static inline __m128i _mm_add_epi32(__m128i a, __m128i b) { return wasm_i32x4_add(a, b); }
static inline __m128i _mm_sub_epi32(__m128i a, __m128i b) { return wasm_i32x4_sub(a, b); }
static inline __m128i _mm_mullo_epi16(__m128i a, __m128i b) { return wasm_i16x8_mul(a, b); }
static inline __m128i _mm_mullo_epi32(__m128i a, __m128i b) { return wasm_i32x4_mul(a, b); }
static inline __m128i _mm_min_epi16(__m128i a, __m128i b) { return wasm_i16x8_min(a, b); }
static inline __m128i _mm_max_epi16(__m128i a, __m128i b) { return wasm_i16x8_max(a, b); }
static inline __m128i _mm_min_epi32(__m128i a, __m128i b) { return wasm_i32x4_min(a, b); }
static inline __m128i _mm_max_epi32(__m128i a, __m128i b) { return wasm_i32x4_max(a, b); }
static inline __m128i _mm_cmpeq_epi32(__m128i a, __m128i b) { return wasm_i32x4_eq(a, b); }
static inline __m128i _mm_cmpgt_epi8(__m128i a, __m128i b) { return wasm_i8x16_gt(a, b); }
static inline __m128i _mm_cmpgt_epi32(__m128i a, __m128i b) { return wasm_i32x4_gt(a, b); }

static inline __m128i _mm_and_si128(__m128i a, __m128i b) { return wasm_v128_and(a, b); }
static inline __m128i _mm_or_si128(__m128i a, __m128i b) { return wasm_v128_or(a, b); }
static inline __m128i _mm_andnot_si128(__m128i a, __m128i b) { return wasm_v128_andnot(b, a); }  // (not a) and b

static inline __m128i _mm_slli_epi16(__m128i a, int n) { return n > 15 ? wasm_i16x8_splat(0) : wasm_i16x8_shl(a, n); }
static inline __m128i _mm_srli_epi16(__m128i a, int n) { return n > 15 ? wasm_i16x8_splat(0) : wasm_u16x8_shr(a, n); }
static inline __m128i _mm_srai_epi16(__m128i a, int n) { return wasm_i16x8_shr(a, n > 15 ? 15 : n); }
static inline __m128i _mm_srai_epi32(__m128i a, int n) { return wasm_i32x4_shr(a, n > 31 ? 31 : n); }
static inline __m128i _mm_slli_epi64(__m128i a, int n) { return n > 63 ? wasm_i64x2_splat(0) : wasm_i64x2_shl(a, n); }
static inline __m128i _mm_srli_epi64(__m128i a, int n) { return n > 63 ? wasm_i64x2_splat(0) : wasm_u64x2_shr(a, n); }

// the high 16 bits of each signed 16 x 16 product
static inline __m128i _mm_mulhi_epi16(__m128i a, __m128i b) {
  const __m128i lo = wasm_i32x4_shr(wasm_i32x4_extmul_low_i16x8(a, b), 16);
  const __m128i hi = wasm_i32x4_shr(wasm_i32x4_extmul_high_i16x8(a, b), 16);
  return wasm_i16x8_narrow_i32x4(lo, hi);
}

// pairs of signed 16-bit products added into 32 bits
static inline __m128i _mm_madd_epi16(__m128i a, __m128i b) { return wasm_i32x4_dot_i16x8(a, b); }

// the unsigned 32-bit products of the low half of each 64-bit lane
static inline __m128i _mm_mul_epu32(__m128i a, __m128i b) {
  return wasm_u64x2_extmul_low_u32x4(wasm_i32x4_shuffle(a, a, 0, 2, 0, 2), wasm_i32x4_shuffle(b, b, 0, 2, 0, 2));
}

// pairs of (unsigned byte of a) x (signed byte of b) products added into 16 bits, saturating
static inline __m128i _mm_maddubs_epi16(__m128i a, __m128i b) {
  const __m128i lo = wasm_i16x8_mul(wasm_u16x8_extend_low_u8x16(a), wasm_i16x8_extend_low_i8x16(b));
  const __m128i hi = wasm_i16x8_mul(wasm_u16x8_extend_high_u8x16(a), wasm_i16x8_extend_high_i8x16(b));
  return wasm_i16x8_add_sat(wasm_i16x8_shuffle(lo, hi, 0, 2, 4, 6, 8, 10, 12, 14), wasm_i16x8_shuffle(lo, hi, 1, 3, 5, 7, 9, 11, 13, 15));
}

static inline __m128i _mm_packus_epi16(__m128i a, __m128i b) { return wasm_u8x16_narrow_i16x8(a, b); }
static inline __m128i _mm_cvtepi8_epi16(__m128i a) { return wasm_i16x8_extend_low_i8x16(a); }
static inline __m128i _mm_unpacklo_epi8(__m128i a, __m128i b) {
  return wasm_i8x16_shuffle(a, b, 0, 16, 1, 17, 2, 18, 3, 19, 4, 20, 5, 21, 6, 22, 7, 23);
}
static inline __m128i _mm_unpackhi_epi8(__m128i a, __m128i b) {
  return wasm_i8x16_shuffle(a, b, 8, 24, 9, 25, 10, 26, 11, 27, 12, 28, 13, 29, 14, 30, 15, 31);
}

static inline __m128 _mm_castsi128_ps(__m128i a) { return a; }
static inline int _mm_movemask_ps(__m128 a) { return (int)wasm_i32x4_bitmask(a); }
#define _mm_shuffle_epi32(a, imm) \
  wasm_i32x4_shuffle((a), (a), (imm) & 3, ((imm) >> 2) & 3, ((imm) >> 4) & 3, ((imm) >> 6) & 3)
#define _mm_shufflelo_epi16(a, imm) \
  wasm_i16x8_shuffle((a), (a), (imm) & 3, ((imm) >> 2) & 3, ((imm) >> 4) & 3, ((imm) >> 6) & 3, 4, 5, 6, 7)
