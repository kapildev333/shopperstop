## Context

The scenarios were written by platform-mobile-wiring (archived 2026-10-15) for a tree without `apps/mobile`. #259 and #263 updated `README.md` and `CLAUDE.md` once `apps/mobile` merged, without a spec change. Nothing in `make test`, CI or `scripts/` greps these strings: the only checks are the `check-*.sh` scripts in archived changes, which no target or workflow runs. Files touched: this folder only.

## Goals / Non-Goals

Goals: the living spec matches `README.md` and `CLAUDE.md` on `main`; one script tests the three refreshed scenarios.

Non-goals: editing either document; adding the check to CI.

## Decisions

### 1. Spec follows the tree; no document edit

Every refreshed scenario was written from the text on `main` (d4c87f1), so the work is the delta and its check. `check-readme-mobile.sh` prints `readme mobile check: ok` on `main` and 6 failures on the pre-#259 `README.md` and `CLAUDE.md` (run in a scratch copy with an `apps/mobile` directory), which is its red.

### 2. Negative scenarios instead of deleting the clauses

The Quick start clause "says which of those are not on `main` yet" becomes "does not contain `` not on `main` yet ``", and the CLAUDE.md mobile scenario gains "does not contain `` once `apps/mobile` lands ``", so the stale wording cannot come back unnoticed. Ceiling: a reworded stale sentence ("not yet merged") passes; the reviewer catches that.

### 3. Check stays in the change folder

Same pattern as every archived platform docs change. Ceiling: it does not run in CI, so the README can drift again; promote the archived checks into a `make` target if drift repeats.
