#!/bin/sh
# Checks the platform scenarios of this change ("Repository documentation matches the tree").
# Run from the repository root: sh openspec/changes/platform-readme-claude/check-docs.sh
# Prints one FAIL line per gap; the last line is "docs check: ok" or "docs check: N failures"; exit status 0 only when ok.
f=0
fail() { echo "FAIL: $*"; f=$((f+1)); }
has() { grep -qF -- "$2" "$1" 2>/dev/null || fail "$1 lacks: $2"; }

test -f README.md || fail "README.md missing"
for s in '## Quick start' 'make dev' 'Docker' 'Go 1.27' '22.12' ':8080' ':5173' 'localhost:5174/admin/' '<details>' '## Screenshots' 'seed-demo --reset' \
  'admin@shopperstop.local' 'admin12345' 'koramangala@shopperstop.local' 'indiranagar@shopperstop.local' 'staff12345' \
  'demo@shopperstop.local' 'demo12345'; do has README.md "$s"; done
grep -q '^|.*|$' README.md 2>/dev/null || fail "README.md has no table"

for t in db dev test test-core test-web e2e gen postman prod-local; do has CLAUDE.md "\`make $t"; done
for s in 'make gen postman' 'shopperstop_core_e2e' '18080' '15173' '15174' '22.12' 'Tokens & Components' 'Customer web' 'Admin web'; do
  has CLAUDE.md "$s"; done
for s in 'sqlc diff' 'No product code yet'; do grep -qF "$s" CLAUDE.md && fail "CLAUDE.md still contains: $s"; done

# Every target in a `make ...` code span of either file exists (make -n prints, it starts nothing).
for t in $(cat README.md CLAUDE.md 2>/dev/null | grep -o '`make [a-z0-9 -]*`' | tr -d '`' | sed 's/^make //' | tr ' ' '\n' | grep -v '^-' | grep -v '^$' | sort -u); do
  make -n "$t" >/dev/null 2>&1 || fail "make -n $t fails"; done

# Relative links resolve from the root.
for p in $(cat README.md CLAUDE.md 2>/dev/null | grep -o '\](\([^)]*\))' | sed 's/^](//; s/)$//; s/#.*//' | grep -v '^http' | grep -v '^$' | sort -u); do
  test -e "$p" || fail "broken link: $p"; done

if [ "$f" -eq 0 ]; then echo "docs check: ok"; else echo "docs check: $f failures"; exit 1; fi
