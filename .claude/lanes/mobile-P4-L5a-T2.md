# mobile-P4-L5a-T2 - mobile-release-config task 2: app icon and adaptive icon from the tokens (worker)
Status: task 2 done (feat committed)
## Log
- Red: `apps/mobile/scripts/icons.mjs` is a stub exporting `IMAGES` (empty), `brandColors`, `render`, `encodePng`; the two stub functions throw `not implemented`. Failures are assertion-level from the stub, not import errors:
```
not ok 1 - committed icons match the generator   (error: 'not implemented', at brandColors)
not ok 2 - app config points at the icons         (error: 'not implemented', at brandColors)
# tests 2  # pass 0  # fail 2
```
- `npm ci` ran once at the worktree root (no node_modules was present); `package-lock.json` unchanged.
- Green: `icons.mjs` implemented per design.md Decisions 1 and 2; `node scripts/icons.mjs` wrote `assets/icon.png` (1024, RGB) and `assets/adaptive-icon.png` (1024, RGBA, scale 0.8). `app.json` gained only `icon` and `android.adaptiveIcon` (diff: 7 added lines).
- Visual check: icon = brand surface with on-brand bolt; adaptive = on-brand bolt on transparent (viewer shows white).
- Gates (last lines):
```
node --test scripts/*.test.mjs   -> # tests 5 # pass 5 # fail 0
npm run build --workspace packages/ui -> tsc -p tsconfig.build.json, exit 0
npm run lint --workspace apps/mobile -> eslint ., exit 0
npm run test --workspace apps/mobile -- --run -> Test Suites: 25 passed, 25 total; Tests: 94 passed, 94 total
npm run build --workspace apps/mobile -> Exported: dist, exit 0
openspec validate --all --strict -> Totals: 20 passed, 0 failed (20 items)
```
- Status: task 2 done (2.1 to 2.3 ticked). Task 3 not started (waits on expo-splash-screen).
