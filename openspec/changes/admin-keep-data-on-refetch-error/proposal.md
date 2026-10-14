# Proposal

## Why
Every admin page that reads from core renders `query.isPending ? skeleton : query.isError ? alert : data`. In TanStack Query 5 a read that fails while the query already holds data ends with `status: 'error'` and the data still there (`isPending` false, `isError` true). So a failed background refetch (window focus, a remount at `staleTime` 0, an invalidation after a save or an upload) swaps a page that was showing for its "Could not load" alert. On the store, product and new-product pages that unmounts the form and loses what was typed; on `/stock` a failed refetch of the stores list unmounts the whole editor and drops every unsaved quantity. Web fixed the same thing in #135 (`web-keep-data-on-refetch-error`) and asked admin to look.

Reproduced on this branch (6d9f7b3) before designing: 11 new Vitest tests are red on the unfixed code, each because the content is gone (design.md, Scenario → test).

## What Changes
- One rule for the whole panel: a page that holds data keeps showing it, with typed text and unsaved edits, when a later read fails. The alert with "Try again" shows only while the page holds no data for what it asks. Ten branches in nine files change from `isPending`/`isError` first to `data === undefined` first (web's pattern, unchanged).
- New, and where this differs from web (which shows no hint): one non-blocking status message, "Could not refresh. Showing what was loaded last.", above the page while any read on screen holds data and failed last. It is one component, `RefetchNotice` in `src/refetch-notice.tsx`, mounted once in the root layout and derived from the query cache, so no page renders it and a page with two failed reads shows it once. The next good answer removes it.
- A 404 on a refetch of a store or product page (the row was deleted elsewhere) still replaces the page with "Page not found", now also when the page held data; a 403 still goes to the route's error boundary. Neither shows the notice.
- One guard on `/stock`: after a save, the saved quantities are written into the page on screen before it is read again, so a failed reload does not show the old quantities under "Stock saved.".
- One test file, `src/refetch.test.tsx`, 19 tests: 11 red on the unfixed code, 8 pins.

Area: admin. Capability touched: `admin-app` (4 ADDED requirements, 17 scenarios; nothing MODIFIED). Out of scope: retry or backoff (`retry: false` stays), `staleTime` and refetch-on-focus settings, a "Try again" on the notice, keeping the list on screen while a new filter or page of `/products` loads, the Dashboard and Orders pages (placeholders on main; admin-P2-L5 builds them with the same page rule, see design.md "For admin-P2-L5"), `packages/ui`, `apps/web`, Playwright (no e2e added or changed; no existing e2e string changes).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `admin-app`: ADDED "Admin pages keep data when a refetch fails", "Refetch failure notice", "Deleted or forbidden on a refetch", "Saved stock shown when its reload fails". The existing "… table states" requirements ("when the request fails, the alert …") describe a page that holds nothing, which the new requirements keep; they are not modified. "Stock save" ("SHALL show the stock as core now holds it") is met more strongly, not changed.

## Impact
- Files: `apps/admin/src/**` (listed in design.md), this change folder. No new dependency.
- Cross-area contracts relied on, none changed:
  - core (`services/core/openapi.json` through `@shopperstop/ui/api`): the admin reads as they are; error codes `not_found`, `forbidden`.
  - ui: `@shopperstop/ui` `StatusMessage` (`tone="warning"`, `role="status"`, `className`), `ErrorBanner`, `Skeleton` as they are. No ui change.
  - `@tanstack/react-query` 5.104.2, already a dependency: `useQueryClient`, `notifyManager`, the query cache's `subscribe` and `findAll`.

## Requests to other areas
- admin-P2-L5 (same area, through the manager; a decision, see design.md "For admin-P2-L5"): its design, written at the same time, has the same page rule but a notice per view with four wordings and no helper. With both landed, its pages show two notices on a failed poll. Recommended: L5 drops its notice lines on the board, the history and the dashboard, keeps the one inside the order sheet, and relies on `RefetchNotice`. Both lanes may edit `src/routes/_staff/stock.tsx`: whichever lands second rebases.
- ui / Figma (information, not a blocker): the notice is a `StatusMessage tone="warning"` above the page; the `Admin web` page has no frame showing it.
