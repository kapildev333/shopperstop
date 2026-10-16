# mobile-P4-L5a-T3 - mobile-release-config task 3: splash screen from the tokens (worker)
Status: task 3 done (feat committed)
## Log
- Dependency first (manager decision, D43): `npm install expo-splash-screen@58.0.10 --save-exact --workspace apps/mobile` from the worktree root. npm moved the existing `@expo/metro-runtime` line in `apps/mobile/package.json`; that move was reverted by hand so the commit touches only the `expo-splash-screen` line (placed after `expo-secure-store`). Lock diff: `package-lock.json` +15 lines, one new package entry (`node_modules/expo-splash-screen` 58.0.10) plus the root dependency line; its deps `@expo/config-plugins`, `@expo/image-utils`, `xml2js` were already resolved, no other version changed. Commit `chore(mobile): add expo-splash-screen 58.0.10 (D43)`.
- Red: `test: splash uses the brand surface and the mark`. Failure before the plugin entry existed:
```
not ok 3 - splash uses the brand surface and the mark   (error: 'expo-splash-screen is in expo.plugins')
# tests 6  # pass 5  # fail 1
```
- Second red, `test: committed icons include the splash image`: the existing IMAGES file-list expectation now names `splash-icon.png`; red with `icons.mjs` still at two entries (`committed icons match the generator` and the splash test fail).
- Green: `IMAGES` row `{ file: 'splash-icon.png', opaque: false, scale: 1 }`; `node scripts/icons.mjs` rewrote all three files; `icon.png` and `adaptive-icon.png` are byte-identical to before (sha1 checked, `git status` unchanged for them). `app.json` gained the `expo-splash-screen` plugin entry after `expo-router`; nothing else in the file changed.
- Visual check of `assets/splash-icon.png`: 1024 by 1024 RGBA, the on-brand (#1F1F1F) bolt centred at scale 1 on a transparent field (the viewer shows it on white).
- `npx expo config --type public --json` resolves the plugin: `['expo-splash-screen', { image: './assets/splash-icon.png', backgroundColor: '#F8CB46', imageWidth: 200, resizeMode: 'contain' }]`; `icon` and `android.adaptiveIcon` resolve as before.
- Gates (last lines):
```
node --test scripts/*.test.mjs   -> # tests 6  # pass 6  # fail 0
npm run build --workspace packages/ui -> exit 0
npm run lint --workspace apps/mobile -> eslint ., exit 0
npm run test --workspace apps/mobile -- --run -> Test Suites: 25 passed, 25 total; Tests: 94 passed, 94 total
npm run build --workspace apps/mobile -> Exported: dist, exit 0
openspec validate --all --strict -> Totals: 20 passed, 0 failed (20 items)
```
- Status: task 3 done (3.1 to 3.3 ticked). Task 4 (acceptance) is the team lead's.
