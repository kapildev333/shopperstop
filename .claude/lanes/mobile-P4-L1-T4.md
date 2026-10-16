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

## Red, second cause (4.1)

With `tokens.ts` and `text.tsx` written, the five tests still failed, and not on the assertions: every test reported

```
`render` function has not been called
  > 7 |   expect(screen.getByText('Hello')).toHaveStyle({
```

Cause: `@testing-library/react-native` 14.1.0 `render` is async (`await render(...)`, its `act` is async); the sync call returned before `screen` was set. Fixed in the test file only (`async` tests, `await render`), committed as its own `test:` commit so the history shows the harness red on its own. The implementation written before this was found is in the `feat:` commit that follows.

## Found, deviation

Running `npx jest` from the worktree root uses no jest config and fails to parse JSX; run the app's suite from `apps/mobile` (`npx jest --ci src/ui`) when a single file is needed. `npm run test` has no way to pass a file filter (the script ignores arguments).
