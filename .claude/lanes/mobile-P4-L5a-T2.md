# mobile-P4-L5a-T2 - mobile-release-config task 2: app icon and adaptive icon from the tokens (worker)
Status: test commit (red)
## Log
- Red: `apps/mobile/scripts/icons.mjs` is a stub exporting `IMAGES` (empty), `brandColors`, `render`, `encodePng`; the two stub functions throw `not implemented`. Failures are assertion-level from the stub, not import errors:
```
not ok 1 - committed icons match the generator   (error: 'not implemented', at brandColors)
not ok 2 - app config points at the icons         (error: 'not implemented', at brandColors)
# tests 2  # pass 0  # fail 2
```
- `npm ci` ran once at the worktree root (no node_modules was present); `package-lock.json` unchanged.
