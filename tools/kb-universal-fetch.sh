#!/bin/bash
# Fetches the Wikimedia dumps the universality score reads, into one folder outside the repo (about 1.4 GB for the
# pilot's twelve editions). Usage: bash tools/kb-universal-fetch.sh [folder]   (default /tmp/kb-universal/data)
# Hosts needed: dumps.wikimedia.org only. Wikidata's SPARQL service (query.wikidata.org) and the pageview REST API
# (wikimedia.org/api/rest_v1) throttle a shared address hard (HTTP 429, retry-after 1000 s), so the pilot does not depend on them.
set -e
DIR="${1:-/tmp/kb-universal/data}"
UA="CodexKnowledgeResearch/0.1 (Korbi's game suite; repo KMRRing/Crates)"
MONTH="${MONTH:-2026-09}"
mkdir -p "$DIR/clickstream" "$DIR/dump"
get() { [ -s "$2" ] || { curl -sS --retry 3 -A "$UA" -o "$2.part" "$1" && mv "$2.part" "$2"; }; }
# CC0: which links readers followed, per edition (title → title, count of 10 or more)
for l in en de fr es pt ru zh ja ar hi ko id it; do
  get "https://dumps.wikimedia.org/other/clickstream/$MONTH/clickstream-${l}wiki-$MONTH.tsv.gz" "$DIR/clickstream/clickstream-${l}wiki-$MONTH.tsv.gz"
done
# English Wikipedia's tables: a page's Wikidata item and disambiguation flag, the languages it exists in, redirects
for f in enwiki-latest-page_props.sql.gz enwiki-latest-langlinks.sql.gz enwiki-latest-redirect.sql.gz enwiki-latest-pages-articles-multistream-index.txt.bz2; do
  get "https://dumps.wikimedia.org/enwiki/latest/$f" "$DIR/dump/$f"
done
echo "done: $DIR"
