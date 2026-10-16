## Why

`apps/mobile` is on `main` and PRs #259 and #263 rewrote `README.md` and `CLAUDE.md` to say so: the README Status names `v0.3.0` and says Phase 4 is in progress on `main`, the Mobile app section links `apps/mobile/README.md`, and the "once `apps/mobile` lands" wording is gone from both files. The living `platform` spec still describes a tree without `apps/mobile`: it demands "`apps/mobile` is not on `main` yet", forbids a link to `apps/mobile`, and asks the Quick start to say what is not on `main` yet. The spec now contradicts the tree.

## What Changes

- `platform`, "Repository documentation matches the tree": the Quick start scenario no longer asks which servers are not on `main` yet (it forbids the phrase instead); "README says how to run the mobile app" reads a tree with `apps/mobile`, names `v0.3.0`, Phase 4 in progress on `main`, and the `[apps/mobile/README.md](apps/mobile/README.md)` link.
- `platform`, "CLAUDE.md and docs/figma.md describe the tree": "CLAUDE.md names the mobile workspace" also forbids `` once `apps/mobile` lands ``.
- `check-readme-mobile.sh` in this folder: the test for the three refreshed scenarios, greps only.

No file outside this folder changes: `README.md` and `CLAUDE.md` on `main` already meet the refreshed scenarios.

Out of scope: the README or CLAUDE.md text itself, `apps/mobile/README.md` (mobile area), the stale "Phases 1 and 2 are on `main`" sentence in CLAUDE.md's intro (no scenario covers it; reported to the manager).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform`: MODIFIED "Repository documentation matches the tree" and "CLAUDE.md and docs/figma.md describe the tree", scenarios only; requirement bodies unchanged.

## Impact

- Area: platform. Files: this change's folder only.
- Cross-area contracts relied on: `apps/mobile/README.md` must exist (mobile area, on `main` since #261); the "Relative links resolve" scenario already covers it.
