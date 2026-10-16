#!/bin/sh
# Test for the three refreshed scenarios; run from the repository root. Greps only, starts nothing.
f=0
ok() { if eval "$2"; then :; else echo "FAIL: $1"; f=$((f+1)); fi; }
status=$(sed -n '/^## Status/,/^## /p' README.md)
mobile=$(sed -n '/^## Mobile app/,/^## Commands/p' README.md)
ok "quick start: no 'not on main yet'" '! grep -q "not on \`main\` yet" README.md'
ok "tree has apps/mobile" '[ -d apps/mobile ]'
ok "status names v0.3.0" 'printf %s "$status" | grep -q "v0.3.0"'
ok "status: Phase 4 in progress on main" 'printf %s "$status" | grep -q "Phase 4 .*is in progress on \`main\`"'
for s in 'cd apps/mobile && npx expo start --port 5176' 'Expo Go' 'EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080' 'localhost:5176' '[apps/mobile/README.md](apps/mobile/README.md)'; do
  ok "mobile section: $s" 'printf %s "$mobile" | grep -qF "$s"'
done
ok "apps/mobile/README.md exists" '[ -f apps/mobile/README.md ]'
ok "CLAUDE.md: no 'once apps/mobile lands'" '! grep -qF "once \`apps/mobile\` lands" CLAUDE.md'
[ $f -eq 0 ] && echo "readme mobile check: ok" || { echo "readme mobile check: $f failures"; exit 1; }
