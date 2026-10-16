# mobile-P4-L1-T1 - workspace scaffold (mobile-foundation-accounts, task 1)
Status: done
## Doing
Task 1 done on `lane/mobile-P4-L1-foundation-accounts`: red commit `test:` (scanner test), then the `feat:` commit with the workspace, the lockfile and the boxes 1.1 to 1.5 ticked. Nothing pushed.
## Found
- Red (1.4), `npm run test --workspace apps/mobile -- --run` before the workspace existed:
  ```
  npm error No workspaces found:
  npm error   --workspace=apps/mobile
  ```
  npm exit 1. The committed red test was the first version; its two self-match fixes below were made while it ran green, so they sit in the `feat:` commit (see Found, deviations).
- Jest transform: the first `transformIgnorePatterns` (brief's list) failed on `expo-modules-core` (ESM, "Must use import to load ES Module"). Replaced with jest-expo's pattern plus `lucide-react-native`, `react-native-svg`, `@shopperstop/.*`, `@expo-google-fonts/.*`. Green after that.
- Green (1.4):
  - `npm run build --workspace packages/ui` exit 0.
  - `npm run lint --workspace apps/mobile` exit 0 (with one Node warning, see deviations).
  - `npm run typecheck --workspace apps/mobile` exit 0.
  - `npm run test --workspace apps/mobile -- --run`: `Tests: 2 passed, 2 total`, exit 0.
  - `npm run build --workspace apps/mobile` exit 0; `apps/mobile/dist` holds `index.html`, `_sitemap.html`, `+not-found.html`, `_expo`, `assets`. Static routes (3): `/`, `/_sitemap`, `/+not-found`. Build time (cold, wall): 16.1 s. No `metro.config.js`: the export resolves the hoisted packages without it.
  - `openspec validate mobile-foundation-accounts --strict`: valid.
- `make test-web` exit 0, 36.6 s wall (the export inside it ran with a warm cache, 0.5 s bundle; the cold export above is the figure to use). The mobile lint, typecheck, test and build all ran inside it.
- Lockfile: `npm install` at the root added 1538 packages; no existing package changed version (checked against HEAD's 575 entries). The 3817 deleted lines are npm's reformatting of `package-lock.json` entries, not version changes.
- `git status --short` at the end: the scope files, `package-lock.json`, the test file and `tasks.md` and this log. Nothing else (`dist/` and `node_modules/` are ignored).
- Requests from ui-P4-L1 (Decision 7): item 5 (no scan of node_modules) holds, the scan is over `src` only. Item 2 (exports resolve, `packages/ui/dist` built first) holds; the test imports `@shopperstop/ui/testing` through the export. Items 1, 3, 4 and 6 are for tasks 4 and 6 onward.
## Deviations and choices (for the team lead)
- `@types/node` is not a dependency of `apps/mobile`. `tsconfig.json` names `types: ["jest", "node"]` as the brief says; the `node` types come from the hoisted `@types/node` (22.20.5, a devDependency of `packages/ui`). Decision 2 does not list it, so I did not add it. If the team wants it explicit, it is one dev dependency to add, which is a decision.
- `eslint.config.js` is ESM as the brief names it, and `apps/mobile` has no `"type"` (brief). Node prints `MODULE_TYPELESS_PACKAGE_JSON` on every lint run. The CommonJS form fails the recommended `no-require-imports` rule. Options: rename to `eslint.config.mjs` (one file, no warning) or accept the warning. I kept the brief's name and did not decide it.
- `src/no-literal-colors.test.ts` holds no literal colour text, so the scan does not exempt its own file or `src/ui/tokens.ts` (the brief's "only allowed exception" reads as the one file that may hold colour names; no such file exists yet and tokens.ts re-exports, it holds none). The samples are built from pieces (`'#' + 'fff'`, `'rgba' + '('`, `quote + 'wh' + 'ite' + quote`) because a literal would match the scan. The self-match needed two rewrites while it ran green (the expectation lines and one comment); they are in the `feat:` commit, not in the red one.
- Jest `transformIgnorePatterns` differs from the brief's list (see Found).
- `src/app/_layout.tsx` is a bare `Stack` with no headers and `src/app/index.tsx` a `Text`, as task 1 says; task 10 replaces them.
- `jest.setup.ts` in task 1 holds only the fetch refusal and the secure-store fake clearing; `setToken` and `queryClient.clear()` arrive with task 2 (their modules do not exist yet).
- Versions pinned exactly as Decision 2; `jest` pinned at `30.5.2` (the `30` line's latest, as Decision 2 says the worker pins what npm resolves). No dependency beyond Decision 2 was added.
## Requests
- to platform (via manager): none new; the lockfile change is the mechanical one the brief allows.
## Blockers
None.
