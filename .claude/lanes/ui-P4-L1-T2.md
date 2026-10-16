# ui-P4-L1 T2 - DOM-free formatInr (task 2)
Status: done
## Doing
Committed `test: formatInr imports nothing; the entry still exports formatInr` (red on the missing `./format`), then `feat: formatInr in a DOM-free module` (format.ts, price.tsx re-export, tasks 2.1-2.3 ticked). Gates green.
## Found
- `src/format.ts` has no imports; `dist/format.js` has no `import` line after the build.
- `price.tsx` imports `formatInr` for `Price` and re-exports it with `export { formatInr } from './format'`; a re-export alone would not give `Price` a local binding. `index.ts` untouched; `@shopperstop/ui` still exports `formatInr`.
- Existing Price tests unchanged; the test commit adds one entry test in `price.test.tsx`.
- `format.test.ts` uses a `// @vitest-environment node` docblock; it reads the source with `readFileSync` to assert no `import`.
## Requests
None.
## Blockers
None.
