# ui-P3-L1-R3 - review of Task 3 (8b48899 test, replaces amended 83c768d; 367b434 feat)
Status: done
## Doing
Verdict: approve, with one test-strengthening request (non-blocking).
## Found
- Order: test commit precedes feat; dialog.test.tsx hunk identical to 83c768d. image-tile hunk out of scope.
- Gates: vitest dialog+sheet 8/8 pass; `npm run lint --workspace @shopperstop/ui` clean.
- Layer list: push in open effect, splice in cleanup with the same closure panel, so indexOf is never -1. StrictMode (push, splice, push) balanced. Unmount without close runs cleanup, splices. Panel element is stable while open (effect deps [open]; no remount on re-render).
- Tab test (dialog.test.tsx "tab stays in the top modal") does not prove the guard: Dialog and Sheet both portal to document.body, and Sheet's handler only acts when activeElement is its own first/last item. With focus inside the Dialog it never acts, so the test passes with or without the guard. Strengthen: with both open, focus the Sheet's last focusable (act(() => el.focus())), then fireEvent.keyDown(document, {key:'Tab'}) and assert the event is not defaultPrevented / focus did not wrap to Sheet's first (Close). Without the guard the Sheet handler wraps and preventDefaults, so this fails red.
- Nit (no action): if a Dialog inside a Sheet is open on the same first render, child effects run first, so the Sheet is pushed last and becomes top (Escape closes the Sheet). Not in the spec scenarios; mention in design if it matters.
## Requests
None.
## Blockers
None.
