// A stand-in for <pthread.h> in the WebAssembly build, which has no threads (and a C library without the header): the
// engine's thread pool is built with one thread, the caller's own, so only the calls that name the caller are ever
// made. Making a thread stops the engine.
#pragma once
#include <stdlib.h>
#include <string.h>
#define __NEED_pthread_t
#define __NEED_pthread_attr_t
#include <bits/alltypes.h>
static inline pthread_t pthread_self(void) { return 0; }
static inline int pthread_attr_init(pthread_attr_t* a) { memset(a, 0, sizeof *a); return 0; }
static inline int pthread_attr_destroy(pthread_attr_t* a) { (void)a; return 0; }
static inline int pthread_attr_getstacksize(const pthread_attr_t* a, size_t* s) { (void)a; *s = 1u << 23; return 0; }
static inline int pthread_attr_setstacksize(pthread_attr_t* a, size_t s) { (void)a; (void)s; return 0; }
static inline int pthread_create(pthread_t* t, const pthread_attr_t* a, void* (*f)(void*), void* x) { (void)t; (void)a; (void)f; (void)x; abort(); }
static inline int pthread_join(pthread_t t, void** r) { (void)t; (void)r; return 0; }
