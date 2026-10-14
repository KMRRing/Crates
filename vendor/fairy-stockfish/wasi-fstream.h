// File streams that never open, for a build of the engine with no file system (WebAssembly in a web page's worker):
// libc++ for WASI is built without <fstream>, and the engine opens files only for options a page never sets (an NNUE
// net, a tablebase, a variants file, a debug log). Force-included before the engine's own sources.
#pragma once
#include <istream>
#include <ostream>
#include <sstream>
#include <string>

#if defined(_LIBCPP_HAS_NO_FILESYSTEM)
_LIBCPP_BEGIN_NAMESPACE_STD

template <class C, class T>
class basic_ifstream : public basic_istream<C, T> {
  basic_stringbuf<C, T> sb_;
public:
  basic_ifstream() : basic_istream<C, T>(&sb_) {}
  explicit basic_ifstream(const char* name, ios_base::openmode mode = ios_base::in) : basic_ifstream() { open(name, mode); }
  explicit basic_ifstream(const string& name, ios_base::openmode mode = ios_base::in) : basic_ifstream() { open(name, mode); }
  void open(const char*, ios_base::openmode = ios_base::in) { this->setstate(ios_base::failbit); }
  void open(const string& name, ios_base::openmode mode = ios_base::in) { open(name.c_str(), mode); }
  bool is_open() const { return false; }
  void close() { this->setstate(ios_base::failbit); }
  basic_stringbuf<C, T>* rdbuf() const { return const_cast<basic_stringbuf<C, T>*>(&sb_); }
};

template <class C, class T>
class basic_ofstream : public basic_ostream<C, T> {
  basic_stringbuf<C, T> sb_;
public:
  basic_ofstream() : basic_ostream<C, T>(&sb_) {}
  explicit basic_ofstream(const char* name, ios_base::openmode mode = ios_base::out) : basic_ofstream() { open(name, mode); }
  explicit basic_ofstream(const string& name, ios_base::openmode mode = ios_base::out) : basic_ofstream() { open(name, mode); }
  void open(const char*, ios_base::openmode = ios_base::out) { this->setstate(ios_base::failbit); }
  void open(const string& name, ios_base::openmode mode = ios_base::out) { open(name.c_str(), mode); }
  bool is_open() const { return false; }
  void close() { this->setstate(ios_base::failbit); }
  basic_stringbuf<C, T>* rdbuf() const { return const_cast<basic_stringbuf<C, T>*>(&sb_); }
};

template <class C, class T>
class basic_fstream : public basic_iostream<C, T> {
  basic_stringbuf<C, T> sb_;
public:
  basic_fstream() : basic_iostream<C, T>(&sb_) {}
  explicit basic_fstream(const char* name, ios_base::openmode mode = ios_base::in | ios_base::out) : basic_fstream() { open(name, mode); }
  explicit basic_fstream(const string& name, ios_base::openmode mode = ios_base::in | ios_base::out) : basic_fstream() { open(name, mode); }
  void open(const char*, ios_base::openmode = ios_base::in | ios_base::out) { this->setstate(ios_base::failbit); }
  void open(const string& name, ios_base::openmode mode = ios_base::in | ios_base::out) { open(name.c_str(), mode); }
  bool is_open() const { return false; }
  void close() { this->setstate(ios_base::failbit); }
  basic_stringbuf<C, T>* rdbuf() const { return const_cast<basic_stringbuf<C, T>*>(&sb_); }
};

_LIBCPP_END_NAMESPACE_STD
#endif
