# mobile-P4-L1-T5: Button and IconButton
Status: done
## Doing
Task 5 done: Button and IconButton green, boxes 5.1 to 5.3 ticked.
## Found
- `IconButton` takes `icon` as a component type (`ComponentType<{ size?, color? }>`, which a Lucide icon satisfies) so the test needs no SVG and no runtime lucide import.
- `Button` variants: `primary`, `secondary`, `danger`, `ghost`, `ghostDanger`; sizes `md`, `lg`, `compact`; `loading`, `disabled`.
## Requests
(none)
## Blockers
(none)

## Red (5.1)

`npx jest --ci src/ui/button` with only `src/ui/button.test.tsx` committed:

```
FAIL src/ui/button.test.tsx
  ● Test suite failed to run

    Cannot find module './button' from 'src/ui/button.test.tsx'
Test Suites: 1 failed, 1 total
Tests:       0 total
```

## Green (5.2, 5.3)

`src/ui/button.tsx`: `Button({ children, variant, size, loading, disabled, onPress })` (variants `primary`, `secondary`, `danger`, `ghost`, `ghostDanger`; sizes `md` 44, `lg` 48, `compact` 44 with padding 8; `loading` shows a small `ActivityIndicator` in the label tone and sets `busy` and `disabled`; primary pressed `accentHover`; inactive opacity 0.5). `IconButton({ label, icon, tone, disabled, onPress })`: 44 × 44 `Pressable`, `accessibilityLabel={label}` (required), icon 20 in `colors[tone]` (default `ink`). Imports only `@shopperstop/ui/tokens` (through `./tokens`) and `./text`.

Deviations, each small:
- `icon` is typed `ComponentType<{ size?: number; color?: string }>` (a Lucide icon satisfies it) rather than importing `LucideIcon`.
- Icon test first used a stub; the lint fix (unused `_props`) went into the test commit. Then, on the manager's instruction, the test uses the real Lucide `X` icon: `test: icon button renders a real Lucide icon` (red: `Must use import to load ES Module ... lucide-react-native.mjs`).
- `chore: jest renders lucide-react-native icons`: `apps/mobile/jest.config.js` gets `moduleNameMapper` `'^lucide-react-native$'` to `<rootDir>/../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js` (Jest takes the `react-native` ESM entry; the CJS build loads under `jest-expo`). For T9's `CircleAlert`: no further config needed; import it from `lucide-react-native` in tests.
- Not built: the Home Account button's 44 px circle with `surface` background (artboard 10). `IconButton` has no background option; task 10 needs one or a wrapper.

Gates (last lines, run in the worktree after the Lucide chore; the icon test passes with the real `X`; 6 of 6 button tests pass; `npm run build --workspace packages/ui`):

```
npm run build --workspace packages/ui                 exit 0
npm run lint --workspace apps/mobile                  exit 0
npm run typecheck --workspace apps/mobile             tsc exit 0
npm run test --workspace apps/mobile -- --run         exit 1: src/ui/states.test.tsx (task 9, not committed yet); button.test.tsx 6 of 6 pass; 41 tests pass in total
npm run build --workspace apps/mobile                 exit 0, Exported: dist
openspec validate mobile-foundation-accounts --strict Change 'mobile-foundation-accounts' is valid
```

`tasks.md`: task 5 boxes 5.1, 5.2, 5.3 ticked. Another worker had uncommitted ticks for task 3 in the same file at commit time; they were not staged.
