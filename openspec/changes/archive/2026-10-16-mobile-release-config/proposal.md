## Why

The customer mobile app (`apps/mobile`, Phase 4, D36 to D40) runs in Expo Go and as a web export, but it has no app icon, no splash screen and no build profiles, so it cannot be built into an installable app, and a reader of `apps/mobile` finds no notes on running it on a phone. This is the release half of mobile-P4-L5 (`mobile-P4-L5a` under D42), parallel with L2 and L4a and touching none of their files.

## What Changes

- `apps/mobile/eas.json`: EAS build profiles `preview` (internal distribution, Android APK, iOS internal) and `production`; no `submit` profile, no credentials, no Expo account or project id (store submission is a D37 ceiling).
- `apps/mobile/scripts/icons.mjs`: a dependency-free Node script that reads `--brand` and `--on-brand` from `packages/ui/src/tokens.css` and writes the PNGs in `apps/mobile/assets/`: `icon.png` (1024, opaque brand surface, on-brand lightning-bolt mark), `adaptive-icon.png` (1024, transparent, the mark inside Android's safe zone) and `splash-icon.png` (1024, transparent, the mark). The PNGs are committed; the script regenerates them.
- `apps/mobile/app.json`: `icon`, `android.adaptiveIcon` (foreground image, brand background) and the `expo-splash-screen` plugin entry (mark image, brand background); nothing else in the file changes.
- `apps/mobile/README.md`: running on a device (Expo Go on the LAN, `EXPO_PUBLIC_CORE_URL`), the EAS preview build (`npx eas-cli`, never installed), regenerating the icons.
- `node --test` checks in `apps/mobile/scripts/` for every scenario.

Out of scope: store submission (`eas submit`), credentials, an Expo account or project id, app version and build numbers, a web favicon, dark-mode icons and splash, native device e2e (D37 ceilings); the root README (platform owns it).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mobile-app`: ADDED requirements for the build profiles, the icon and adaptive icon, the splash screen and the device run notes. The capability is seeded by `mobile-foundation-accounts`; these requirements are additive and touch none of its requirements.

## Impact

- Area: mobile. Files: `apps/mobile/eas.json`, `apps/mobile/assets/*.png`, `apps/mobile/app.json` (icon and splash keys only), `apps/mobile/README.md`, `apps/mobile/scripts/`, this change's folder.
- Cross-area contracts relied on: `packages/ui/src/tokens.css` (`--brand`, `--on-brand`), read as text, the same source `@shopperstop/ui/tokens` is generated from.
- Dependencies: `expo-splash-screen` (Expo SDK 58 module, 58.0.10) is needed by task 3 only: Expo 58 has no top-level `splash` key, the splash is configured through that package's config plugin. It is not in D37's list, so it was a decision for the orchestrator: D43 approved it, and the pin landed in task 3 of this lane by the manager's decision (`apps/mobile/package.json` one line, root `package-lock.json` mechanical). Nothing else is added: the generator uses only `node:zlib` and `node:fs`.
- The checks run with `node --test`; they ride the workspace's `test` script only once `package.json` runs them (a request to L2, design.md Decision 6).
