# ui-P3-L1-R5 - review of Task 5 (ChoiceGroup, Choice, chipClass)
Status: done
## Doing
Verdict: approve. Commits 8d43a83 (test), 3190e17 (feat).
## Found
- Gates (worktree, node 22.23.3): lint clean; typecheck clean; vitest 28 files / 71 tests pass.
- Test-first: 8d43a83 adds only choice-group.test.tsx importing Choice/ChoiceGroup from ./index, which did not exist, so it fails before 3190e17. Order holds.
- Coverage: all four scenarios have a test named after them. Wrap-around is covered both ways (c to a, a to c), all four arrows, doc-order inside list items, both tab-stop cases.
- Scope: chip.tsx extraction is behaviour-identical (same classes, className last); chip.test.tsx untouched; one index.ts line at the stepper anchor; lane log. No creep, no needless abstraction.
- Tokens only (accent, accent-soft, accent-hover, line-strong, surface, ink); pill is h-11 on phone, sm:h-9 from sm, same as Chip, so the 44 px phone tap target holds. Focus ring comes from the global :focus-visible in tokens.css.
- design.md section 4 typo confirmed: the tabIndex line reads `checked || value === undefined`, but Choice's own `value` prop is a required string and never undefined; it must be `group.value === undefined`. The code and spec delta are right. Team lead: fix the design.md text.
- Unmatched group value (value set, no Choice equal): no radio has tabindex 0, so Tab skips the whole group (keyboard-unreachable; mouse and touch still work). This is the documented ceiling in design.md section 4 and is not tested. Accepted, not a blocker: web checkout must pass a value that is undefined or an existing address id (e.g. a deleted default address id would lock keyboard users out). Smallest future fix if wanted: make the first Choice tabbable when no sibling is checked, needs group-side registration.
- Nit, no change required: arrow handling uses closest('[role="radiogroup"]') so a nested group's radios would join the outer list; nesting is not a use case.
## Requests
- to ui-P3-L1 team lead: correct design.md section 4 tabIndex expression to `group.value === undefined`.
## Blockers
none
