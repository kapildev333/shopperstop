Every task runs in `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L5a` on branch `lane/mobile-P4-L5a-release-config` (LANE-ID `mobile-P4-L5a`, area mobile, change `mobile-release-config`). Run every node, npm, npx and make command after `export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` (the machine's default node is 22.11, below the engines). The worktree has no `node_modules`: run `npm ci` once at the worktree root before the first gate (it does not change `package-lock.json`; if it does, stop and report).

Read first: this change's `specs/mobile-app/spec.md` (the scenarios named below) and `design.md` (Decisions 1 to 6 are binding: exact interfaces, geometry, JSON and README content). The worker logs in `.claude/lanes/mobile-P4-L5a-T<n>.md`, never runs `make db`, `make dev`, `make prod-local` or docker, never pushes, never runs `npm install` or adds a dependency or npm script, never touches `apps/mobile/src/`, `package.json`, `jest.config.js`, `playwright.config.ts` or any file outside its scope (lane L2 owns the shared files and runs in parallel), and stops and reports on any design choice this change does not settle.

Commits per task, by explicit path (`git add <paths>`; never `git add -A` or `.`, another task may be working in the same worktree), as `git -c user.name=kapildev333 -c user.email=47056817+kapildev333@users.noreply.github.com commit`, no trailers: `test: <scenario>` with the failing test (its failure pasted into the log), then `feat: <what>`; tick this file's boxes in the `feat:` commit.

Gates for every task (paste the last lines into the log):

```
export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"
(cd apps/mobile && node --test scripts/*.test.mjs)
npm run build --workspace packages/ui
npm run lint --workspace apps/mobile
npm run test --workspace apps/mobile -- --run
npm run build --workspace apps/mobile
openspec validate --all --strict
```

Order: 1 and 2 in parallel (disjoint files); 3 after 2 and after `expo-splash-screen` 58.0.10 is in `apps/mobile/package.json` and installed on this branch (the manager says when); 4 after 1 to 3.

## 1. Build profiles and device notes

Scope: `apps/mobile/eas.json`, `apps/mobile/README.md`, `apps/mobile/scripts/release-config.test.mjs`.
Scenarios: Two build profiles and no submit; No account in the app config; Device notes name the commands.
Starts from: `apps/mobile/scripts/release-config.test.mjs` (`node:test`, `node:assert/strict`, files read relative to `import.meta.url`): `two build profiles and no submit` (`Object.keys(build)` deep-equals `['preview', 'production']`, `build.preview.distribution === 'internal'`, `build.preview.android.buildType === 'apk'`, no `submit` key), `no account in the app config` (`expo.owner` and `expo.extra?.eas` undefined in `app.json`), `device notes name the commands` (README includes each of the five strings in the scenario). The first and third fail red because the files are absent; the second passes from the start (it guards against `eas build` writing the project id in later).

- [x] 1.1 `test:` the three tests, red on the missing `eas.json` and `README.md`
- [x] 1.2 `eas.json` exactly as design.md Decision 4
- [x] 1.3 `README.md` per design.md Decision 5 (plain prose, no personal details, `<lan-ip>` stays a placeholder)

## 2. App icon and adaptive icon from the tokens

Scope: `apps/mobile/scripts/icons.mjs`, `apps/mobile/scripts/icons.test.mjs`, `apps/mobile/assets/icon.png`, `apps/mobile/assets/adaptive-icon.png`, `apps/mobile/app.json` (`icon` and `android.adaptiveIcon` keys only).
Scenarios: Committed icons match the generator; App config points at the icons.
Starts from: `apps/mobile/scripts/icons.test.mjs`: `committed icons match the generator` (for each `IMAGES` entry: decode `assets/<file>` per design.md Decision 6, assert 1024 × 1024 and colour type 2 for opaque, 6 otherwise, pixels deep-equal `render(entry, brandColors(tokensCss))`; icon pixel (0, 0) is the brand colour and (512, 512) the on-brand colour; adaptive pixel (512, 512) is on-brand with alpha 255 and (0, 0) has alpha 0), `app config points at the icons` (`expo.icon === './assets/icon.png'`, `expo.android.adaptiveIcon.foregroundImage === './assets/adaptive-icon.png'`, both files exist, `backgroundColor === brandColors(tokensCss).brand`). Hex values are never written in the test: they come from `tokens.css`. Red: `icons.mjs` does not exist (commit the test with a minimal `icons.mjs` that exports the four names and throws `not implemented` if the import error is not a clean red; say which in the log).

- [x] 2.1 `test:` the two tests, red
- [x] 2.2 `icons.mjs` per design.md Decisions 1 and 2 (`IMAGES` holds `icon.png` and `adaptive-icon.png` only), run it, commit the two PNGs
- [x] 2.3 `app.json` `icon` and `android.adaptiveIcon` per design.md Decision 3; nothing else in the file changes (`git diff` shows only those lines)

## 3. Splash screen from the tokens

Waits on: task 2, and `expo-splash-screen` 58.0.10 in `apps/mobile/package.json` and `node_modules` (an orchestrator decision and an L2 change, design.md Risks). Without it, `npm run build --workspace apps/mobile` fails on the plugin entry: stop and report instead of adding the package.
Scope: `apps/mobile/scripts/icons.mjs` (`IMAGES` row only), `apps/mobile/scripts/icons.test.mjs`, `apps/mobile/assets/splash-icon.png`, `apps/mobile/app.json` (the `expo-splash-screen` entry in `plugins` only).
Scenario: Splash uses the brand surface and the mark.
Starts from: `apps/mobile/scripts/icons.test.mjs` `splash uses the brand surface and the mark` (the `plugins` entry whose first element is `expo-splash-screen` has `image === './assets/splash-icon.png'`, `backgroundColor === brandColors(tokensCss).brand`, `imageWidth === 200`, `resizeMode === 'contain'`; the file exists; `IMAGES` holds `splash-icon.png` with `opaque: false, scale: 1`, which also brings it under `committed icons match the generator`).

- [x] 3.1 `test:` the splash test, red
- [x] 3.2 `IMAGES` row for `splash-icon.png`, run `node scripts/icons.mjs`, commit the PNG (the two existing PNGs must come out pixel-identical; `git status` shows them unchanged or the test says why)
- [x] 3.3 `app.json` plugin entry per design.md Decision 3; `npm run build --workspace apps/mobile` exits 0

## 4. Acceptance (team lead)

- [x] 4.1 `/opsx:verify mobile-release-config`: every scenario has a passing test (design.md "Scenario to test"), every task ticked, nothing outside design.md "Files" landed besides lane logs; gates re-run
