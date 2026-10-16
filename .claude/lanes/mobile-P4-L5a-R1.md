# mobile-P4-L5a-R1 - review of mobile-release-config
Status: done
## Doing
Verdict: approve with one follow-up that must not be lost (finding 1).
## Found
Gates (node 22.23.3): `node --test scripts/*.test.mjs` 6/6; lint, typecheck clean; jest 25 suites / 94 tests; `npm run build` exports; `openspec validate --all --strict` 20 passed. `node scripts/icons.mjs` rewrites all three PNGs byte-identical (git status clean for assets): deterministic. Lock diff adds only expo-splash-screen (its deps already in the lock). eas.json has no submit/credentials/ids; no LAN addresses or secrets. Test-first order holds for every feat. No hex in scripts or tests; app.json literals tested equal to --brand.
Non-blocking:
1. apps/mobile/package.json:10 `test` is still `jest --ci`: the six node:test checks do not run in `make test-web` or CI, so no scenario of this change is guarded after merge. Needs the L2 change (`jest --ci && node --test scripts/*.test.mjs`) before or right after landing; track it.
2. apps/mobile/README.md Preview build step 3: set EXPO_PUBLIC_CORE_URL comes after the build step, but the value is inlined at build time; move it before step 2.
3. apps/mobile/README.md step 1 says "Expo CLI ... npx eas-cli login": it is the EAS CLI.
4. apps/mobile/scripts/icons.mjs:46 rgb() yields NaN (written as 0) if a token ever stops being #RRGGBB; throw on a non-hex value in brandColors.
5. apps/mobile/scripts/icons.test.mjs: splash centre pixel (on-brand, opaque) not asserted; equality with render() covers it only against the generator itself.
6. icons.mjs:106 `>>> 0` on zlib.crc32 is redundant (already unsigned). release-config.test.mjs uses semicolons, icons.test.mjs does not.
7. Working tree shows uncommitted edits to openspec/changes/mobile-release-config/design.md and tasks.md (not mine; the committed head is what I reviewed).
## Requests
- to mobile manager: land finding 1 with L2 or soon after.
## Blockers
