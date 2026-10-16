# web-P3-L1-T1 - web-rider-tracking task 1: rider client and tracking card (worker)
Status: blocked
## Doing
2026-10-15: commit 1 (red tests, 5abcfd0) landed. Commit 2 (feat, design Decisions 1 to 4) written, not committed: the one test it fails is "rider on the way with a position" (design code as written). Stopped per the brief; worktree is at 5abcfd0 plus this log.
## Found
- Red on commit 1: `npx vitest --run src/orders.test.ts src/order-tracking.test.tsx` shows 8 failed, 15 passed. The eight: orders "last seen wording", "rider read follows the status"; tracking "rider on the way with a position", "rider without a position", "no rider card before a rider", "delivered order names the rider from the rider read", "failed rider read keeps the card", "last seen kept current". Each fails with `lastSeen`/`deliveryOptions`/`deliveryKey is not a function`.
- Typecheck on commit 1: exactly four errors, TS2305 for `deliveryKey`, `Delivery` (tracking test) and `deliveryOptions`, `lastSeen` (orders test). Lint green.
- Feat with design code as written: 22 of 23 pass across the two files. The failure is "rider on the way with a position": the link's accessible name is "Open in Maps(opens in a new tab)", no space. Cause: the JSX `Open in Maps` line ends without a trailing space (JSX trims the line break), and `VisuallyHidden` is a plain span whose leading space " (opens in a new tab)" is trimmed in the name computation. Verified: with `Open in Maps{" "}` on the line before `<VisuallyHidden>` (and the hidden text without its leading space) all 19 tests of `order-tracking.test.tsx` pass. Not committed.
- The design code as written is saved at `/private/tmp/claude-501/-Users-kapilsoni-KapilProjects-ShopperStop/c9f989cb-8b76-4343-90c4-6d61e15963d7/scratchpad/feat-as-designed.patch` (apps/web api.ts, orders.ts, order-parts.tsx, order-tracking.tsx).
## Requests
- to web-P3-L1 (team lead): decide the link text spacing. Proposed: design.md's RiderCard gets `Open in Maps{' '}` and `<VisuallyHidden>(opens in a new tab)</VisuallyHidden>`; the accessible name then reads "Open in Maps (opens in a new tab)" as the scenario says. Also confirm that design.md Decision 3 (JSX) is amended the same way; no other change needed.
## Blockers
- Design code yields the wrong accessible name for the Maps link (see Found). Waiting for the team lead's decision before commit 2.
