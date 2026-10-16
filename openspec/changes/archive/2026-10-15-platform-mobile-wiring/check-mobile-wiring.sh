#!/bin/sh
# Checks the platform-mobile-wiring scenarios: core's dev and e2e origins in the Makefile, README, CLAUDE.md, docs/figma.md.
# Run from the repository root: sh openspec/changes/platform-mobile-wiring/check-mobile-wiring.sh [make] [docs]
# (no argument runs both). Starts nothing: make -n only.
# Prints one FAIL line per gap; the last line is "mobile wiring check: ok" or "mobile wiring check: N failures".
f=0
fail() { echo "FAIL: $*"; f=$((f+1)); }
has() { printf '%s\n' "$2" | grep -qF -- "$3" || fail "$1 lacks: $3"; }
lacks() { printf '%s\n' "$2" | grep -qF -- "$3" && fail "$1 still has: $3"; }
count() { grep -oF -- "$2" "$1" | wc -l | tr -d ' '; }
prior=openspec/changes/archive/2026-10-15-platform-rider-wiring/check-wiring.sh
sections=${*:-make docs}

for s in $sections; do case $s in
make)
  dev="'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176'"
  e2e="'http://localhost:15173,http://localhost:15174,http://localhost:15175,http://localhost:15176'"
  has "make -n core" "$(env -u SHOPPERSTOP_CORE_WEB_ORIGINS make -n core 2>&1)" "SHOPPERSTOP_CORE_WEB_ORIGINS=$dev"
  has "make -n rider" "$(env -u SHOPPERSTOP_RIDER_WEB_ORIGINS make -n rider 2>&1)" "SHOPPERSTOP_RIDER_WEB_ORIGINS=$dev"
  out=$(SHOPPERSTOP_CORE_WEB_ORIGINS=leak SHOPPERSTOP_RIDER_WEB_ORIGINS=leak make -n e2e 2>&1)
  lacks "make -n e2e" "$out" leak
  line=$(printf '%s\n' "$out" | grep -F 'npm run e2e')
  has "make -n e2e npm run e2e" "$line" "SHOPPERSTOP_CORE_WEB_ORIGINS=$e2e"
  has "make -n e2e npm run e2e" "$line" "SHOPPERSTOP_RIDER_WEB_ORIGINS=$e2e"
  [ "$(count Makefile localhost:5176)" = 2 ] || fail "Makefile: want localhost:5176 exactly twice"
  [ "$(count Makefile localhost:15176)" = 2 ] || fail "Makefile: want localhost:15176 exactly twice"
  grep -nE 'apps/mobile|expo' Makefile && fail "Makefile names apps/mobile or expo"
  # The rider-wiring make checks still hold, except its four assertions on the old three-origin lists.
  # Its make section needs a tree without services/rider and apps/rider (it runs `make rider` for real),
  # so it runs on a scratch tree: this Makefile and the directories its make -n checks need (no packages/ui, so `make rider-app` builds nothing).
  if [ -f "$prior" ]; then
    tmp=$(mktemp -d)
    cp Makefile "$tmp/"
    mkdir -p "$tmp/services/core" "$tmp/apps/web" "$tmp/apps/admin" "$tmp/scripts" "$tmp/node_modules"
    touch "$tmp/services/core/sqlc.yaml" "$tmp/scripts/postman.mjs"
    (cd "$tmp" && sh "$OLDPWD/$prior" make) 2>&1 | grep '^FAIL' \
      | grep -vF "make -n core lacks: SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:5173,http://localhost:5174,http://localhost:5175'" \
      | grep -vF "make -n e2e npm run e2e lacks: SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175'" \
      | grep -vF "make -n rider lacks: SHOPPERSTOP_RIDER_WEB_ORIGINS='http://localhost:5173,http://localhost:5174,http://localhost:5175'" \
      | grep -vF "make -n e2e npm run e2e lacks: SHOPPERSTOP_RIDER_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175'" \
      | while read -r l; do echo "prior $l"; done | grep . && fail "rider-wiring make checks regressed (lines above)"
    rm -rf "$tmp"
  else fail "missing $prior"; fi
  ;;
docs)
  sh openspec/changes/archive/2026-10-12-platform-readme-claude/check-docs.sh >/dev/null 2>&1 || fail "the platform-readme-claude docs check fails"
  sh "$prior" docs >/dev/null 2>&1 || fail "the platform-rider-wiring docs check fails"
  status=$(awk '/^## /{p=($0=="## Status")} p' README.md)
  has "README ## Status" "$status" "Phase 4"
  mob=$(awk '/^## /{p=($0=="## Mobile app")} p' README.md)
  [ -n "$mob" ] || fail "README has no '## Mobile app' section"
  for p in 'cd apps/mobile && npx expo start --port 5176' 'Expo Go' 'EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080' 'localhost:5176'; do
    has "README ## Mobile app" "$mob" "$p"; done
  if [ ! -d apps/mobile ]; then has "README ## Mobile app" "$mob" '`apps/mobile` is not on `main` yet'; fi
  grep -qE '\]\(\.?/?apps/mobile' README.md CLAUDE.md && fail "a Markdown link points into apps/mobile"
  c=$(cat CLAUDE.md)
  grep -q '^apps/mobile/' CLAUDE.md || fail "CLAUDE.md layout has no line starting apps/mobile/"
  for p in 'Phase 4' '15176' ':5176' 'npx expo start' 'rides on `make test-web` and `make e2e`'; do has CLAUDE.md "$c" "$p"; done
  g=$(cat docs/figma.md)
  for p in 'ShopperStop App Design' 'https://claude.ai/artifact/75BFgGxUe3viRFjgvn8Ywy' '19 artboards' '390×844' 'tokens.css' 'no `Mobile` page'; do
    has docs/figma.md "$g" "$p"; done
  lacks docs/figma.md "$g" 'add it when the mobile app spec lands'
  for cmd in orchestrate manage; do has ".claude/commands/$cmd.md" "$(cat .claude/commands/$cmd.md)" '`mobile`'; done
  ;;
*) fail "unknown section: $s (want make or docs)" ;;
esac; done

if [ "$f" -eq 0 ]; then echo "mobile wiring check: ok"; else echo "mobile wiring check: $f failures"; exit 1; fi
