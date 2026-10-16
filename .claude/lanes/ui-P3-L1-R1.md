# ui-P3-L1-R1 - Review of Task 1 (Button compact, aria-disabled)
Status: done
## Doing
Reviewed 729619b (test) and 68cd25f (feat): approve, no findings.
## Found
- Brief and spec delta covered: ButtonSize, sizeClass.compact `h-11 px-2 sm:h-8`, aria-disabled classes on base (Button and ButtonLink). Both scenarios have tests.
- No clash: compact replaces the md size string entirely (no sm:h-10 / px-4); cn merges nothing else.
- Tailwind 4 `aria-disabled:` compiles to `[aria-disabled="true"]`; Button passes aria-disabled through rest and sets no `disabled`, so it stays tabbable.
- Test commit touches only button.test.tsx; its assertions (classes absent before) fail without the feat. Feat touches only button.tsx plus the T1 lane log.
- Gates: `npx vitest run src/button.test.tsx` 6/6 pass; `npm run lint --workspace packages/ui` clean.
- Note (not a defect): tests assert class names, not computed height; jsdom has no Tailwind CSS. Acceptable per spec wording.
## Requests
## Blockers
