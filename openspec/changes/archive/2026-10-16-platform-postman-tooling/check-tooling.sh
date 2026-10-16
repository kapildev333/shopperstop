#!/bin/sh
# Checks the platform-postman-tooling scenarios that node --test does not cover: make gen and README.md.
# Run from the repository root: sh openspec/changes/platform-postman-tooling/check-tooling.sh [make] [docs]
# (no argument runs both). Starts nothing: make -n, then a real make gen (sqlc and npm scripts only).
# Prints one FAIL line per gap; the last line is "tooling check: ok" or "tooling check: N failures".
f=0
fail() { echo "FAIL: $*"; f=$((f+1)); }
has() { printf '%s\n' "$2" | grep -qF -- "$3" || fail "$1 lacks: $3"; }
# in_order <label> <text> <pattern>...: each pattern occurs, each first occurrence after the previous one.
in_order() {
  label=$1 text=$2 prev=-1; shift 2
  for p in "$@"; do
    n=$(printf '%s' "$text" | grep -boF -- "$p" | head -1 | cut -d: -f1)
    if [ -z "$n" ] || [ "$n" -le "$prev" ]; then fail "$label: '$p' missing or out of order"; return; fi
    prev=$n
  done
}
# section <heading>: README.md from that heading up to the next "## " heading.
section() { awk -v h="$1" '$0 == h {on=1; print; next} on && /^## / {exit} on' README.md; }

for s in ${*:-make docs}; do case $s in
make)
  in_order "make -n gen" "$(make -n gen)" 'cd services/core && sqlc generate' 'cd services/rider && sqlc generate' \
    'npm run gen:api --workspace packages/ui --if-present' 'npm run gen:tokens --workspace packages/ui --if-present'
  before=$(git status --porcelain)
  make gen >/dev/null 2>&1 || fail "make gen exited non-zero"
  [ "$(git status --porcelain)" = "$before" ] || fail "make gen changed files: $(git status --porcelain | tr '\n' ' ')"
  ;;
docs)
  t=$(section '## Troubleshooting')
  [ -n "$t" ] || fail "README.md has no ## Troubleshooting section"
  for p in "Cannot read properties of null (reading 'edgesOut')" '10.9.9' '@vitest/browser-playwright' \
    'npm install --package-lock-only' 'npm ci --dry-run'; do has Troubleshooting "$t" "$p"; done
  has "make gen row" "$(grep -F '| `make gen` |' README.md)" 'packages/ui/src/tokens.ts'
  a=$(section '## API')
  has API "$a" 'serviceToken'
  has API "$a" 'x-service-token'
  ;;
*) fail "unknown section $s" ;;
esac; done

if [ "$f" -eq 0 ]; then echo "tooling check: ok"; else echo "tooling check: $f failures"; exit 1; fi
