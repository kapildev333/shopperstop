# ui-P3-L1-T3b - Reviewer follow-up on R3 finding 1: "tab stays in the top modal" must fail without the layer guard
Status: done
## Doing
Done: the test now focuses the Sheet's last focusable with the Dialog on top and asserts Tab is not prevented and focus does not wrap. Red with the guard removed (Sheet wraps and prevents default), green with it restored. use-modal.ts untouched.
## Found
- Red run (guard removed): "tab stays in the top modal" fails at `expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(true)`, received false. "stacked modals close top first" also fails, as expected without the guard (Escape closes the Sheet first).
- Test-only commit; no code commit in this task.
## Requests
None.
## Blockers
None.
