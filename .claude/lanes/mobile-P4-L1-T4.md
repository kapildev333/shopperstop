# mobile-P4-L1-T4: Tokens and Text

Task 4 of `openspec/changes/mobile-foundation-accounts/tasks.md`. Scope: `apps/mobile/src/ui/{tokens.ts,text.tsx,text.test.tsx}`, plus the rename of `apps/mobile/eslint.config.js` to `eslint.config.mjs`.

## Red (4.1)

`npm run test --workspace apps/mobile -- --run` with only `src/ui/text.test.tsx` committed:

```
FAIL src/ui/text.test.tsx
  ● Test suite failed to run

    Cannot find module './text' from 'src/ui/text.test.tsx'
...
Test Suites: 1 failed, 1 passed, 2 total
Tests:       2 passed, 2 total
```

The five named tests (`body text by default`, `variant picks the family by weight`, `tone`, `heading is announced`, `tabular numbers`) cannot run until `text.tsx` exists.
