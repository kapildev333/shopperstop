## Context

`apps/mobile` (mobile-foundation-accounts, merged #253) is Expo SDK 58.0.11 with React Native 0.88.0. Its `app.json` has name, slug, scheme, orientation, `userInterfaceStyle`, `web.output` and the `expo-router` plugin, and no icon or splash (L1 design.md Decision 3 left them to L5). There is no `eas.json` and no `apps/mobile/README.md`; the root README's "Mobile app" section (platform-P4-L1) already describes Expo Go on the LAN. The brand values live in `packages/ui/src/tokens.css` (`--brand: #F8CB46`, `--on-brand: #1F1F1F`), from which `@shopperstop/ui/tokens` is generated.

Two Expo 58 facts shape the design, both read from the published packages: `@expo/config-types` 58 has no top-level `splash` key (only `web.splash` for PWAs); the native splash is configured through the `expo-splash-screen` config plugin (`image`, `backgroundColor`, `imageWidth`, `resizeMode`), and that package is not installed (`expo` 58.0.11 does not depend on it). `icon` and `android.adaptiveIcon` remain plain config keys that need no package.

No mobile-app requirement mirrors `web-app` here: the web apps have no icon, splash or build profile requirements.

## Goals / Non-Goals

**Goals:** installable builds are one `eas build --profile preview` away once the owner links an Expo account; icon, adaptive icon and splash come from the brand tokens through a committed, re-runnable script; device run notes beside the app; a check that fails for every scenario.

**Non-Goals:** `eas submit`, credentials, `owner` or `extra.eas.projectId` (D37 ceiling: store submission after the owner's developer accounts exist); version and build numbers; a web favicon (the web export is the e2e target only); dark-mode splash; any file under `src/`, `package.json`, Jest or Playwright config (L2 owns them, D42).

## Decisions

### 1. Images drawn by a dependency-free Node script

`apps/mobile/scripts/icons.mjs` renders the PNGs from geometry and writes them with `node:zlib` (`deflateSync`, `crc32`, Node 22.2 and later; engines require 22.12). Alternatives: a hand-made SVG converted by a tool (needs `sharp` or a browser, a new dependency or a manual step nobody can re-run in CI), or a drawing exported by hand (not reproducible from the tokens). The script reads `--brand` and `--on-brand` out of `tokens.css` with a regex over `--name: value;`, the same simplification as `packages/ui/scripts/gen-tokens.mjs` (ceiling: a commented-out declaration would be read). It does not import `@shopperstop/ui/tokens`, which resolves to `packages/ui/dist` and so needs a ui build first.

Interface (exact; the worker does not choose):

```js
export function brandColors(css)            // -> { brand: '#F8CB46', onBrand: '#1F1F1F' }, the strings as written in tokens.css; throws when either is missing
export const IMAGES                          // [{ file, opaque, scale }], see Decision 2
export function render({ opaque, scale }, colors) // -> { width: 1024, height: 1024, channels: opaque ? 3 : 4, pixels: Buffer } (row-major RGB or RGBA)
export function encodePng(image)             // -> Buffer: signature, IHDR (8-bit, colour type 2 or 6), one IDAT (filter byte 0 on every row, deflateSync), IEND
```

Run directly (`node scripts/icons.mjs` from `apps/mobile`, detected with `import.meta.url === pathToFileURL(process.argv[1]).href` as gen-tokens does), it reads `../../packages/ui/src/tokens.css` relative to the script and writes every `IMAGES` entry into `apps/mobile/assets/<file>`. No npm script (that is `package.json`, L2's file); the README names the command.

### 2. The mark and the three images

The mark is a lightning bolt (quick commerce; a shopping bag drawn from primitives read as a padlock in the trial render). It is the even-odd interior of this polygon in unit coordinates, origin top left:

`(0.58, 0.18) (0.30, 0.56) (0.47, 0.56) (0.42, 0.82) (0.70, 0.44) (0.53, 0.44)`

Rendering at size 1024: each pixel takes 4 × 4 samples at `((i + (a + 0.5) / 4) / 1024, (j + (b + 0.5) / 4) / 1024)`; a sample `(u, v)` is in the mark when `(0.5 + (u - 0.5) / scale, 0.5 + (v - 0.5) / scale)` is in the polygon; coverage `k` is the in-count over 16. Opaque images: each channel `Math.round(brand + (onBrand - brand) * k)`. Transparent images: RGB is on-brand, alpha `Math.round(255 * k)`.

| file | opaque | scale | used by |
|---|---|---|---|
| `icon.png` | yes (RGB, no alpha: iOS rejects alpha in the app icon) | 1 | `expo.icon` (iOS, Android legacy, Expo Go listing) |
| `adaptive-icon.png` | no | 0.8 | `expo.android.adaptiveIcon.foregroundImage`; the mark's farthest point from the centre is 0.33 at scale 1, 0.27 at 0.8, inside Android's safe circle of radius 33/108 ≈ 0.31 |
| `splash-icon.png` | no | 1 | `expo-splash-screen` plugin `image` (task 3) |

The pixel at (512, 512) is inside the mark and (0, 0) is outside it; the checks probe those two.

### 3. `app.json` keys

Task 2 adds, and nothing else changes:

```json
"icon": "./assets/icon.png",
"android": { "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#F8CB46" } }
```

Task 3 appends to `plugins` (after `"expo-router"`):

```json
["expo-splash-screen", { "image": "./assets/splash-icon.png", "backgroundColor": "#F8CB46", "imageWidth": 200, "resizeMode": "contain" }]
```

JSON cannot import, so the hex is written in `app.json` and the checks hold it equal to `tokens.css`; `app.json` is outside `src/`, so the app's `no-literal-colors` test does not scan it. `imageWidth` 200 is the Expo template's value.

### 4. `eas.json`

```json
{
  "cli": { "appVersionSource": "local" },
  "build": {
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": {}
  }
}
```

`appVersionSource: local` keeps the version in `app.json` (Expo's default 1.0.0) and needs no server state. No `env` block: `EXPO_PUBLIC_CORE_URL` is per machine (a LAN address) or per deployment and is never committed; the README says to set it as an EAS environment variable or in the shell for `--local` builds. No `developmentClient` profile: Expo Go covers development (no custom native code).

### 5. README

`apps/mobile/README.md`, sections: "Run on a phone" (start the stack with `make dev`, then `cd apps/mobile && EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080 npx expo start --port 5176`, scan with Expo Go on the same Wi-Fi, `ipconfig getifaddr en0` on macOS, why 5176 and not 8081); "Preview build" (`npx eas-cli login`, then `npx eas-cli build --profile preview --platform android` (or `ios`), `EXPO_PUBLIC_CORE_URL` as an EAS environment variable, the first build links the project and writes `extra.eas.projectId` into `app.json`, which stays out of the repository until the owner decides; a release build needs an `https` core URL because Android blocks cleartext `http` outside Expo Go); "Icons and splash" (`node scripts/icons.mjs` after a brand token change, then commit the PNGs; the check fails until then). `eas-cli` is run through `npx`, never installed (no dependency).

### 6. Checks run with `node --test`

`apps/mobile/scripts/release-config.test.mjs` (eas.json, app.json account keys, README) and `apps/mobile/scripts/icons.test.mjs` (pixels, sizes, app.json icon and splash keys) use `node:test` and `node:assert/strict`. The icons check decodes the committed PNGs itself (parse chunks, concatenate IDAT, `inflateSync`, assert filter byte 0 per row, strip it) and compares pixels with `render`, not bytes, so a different zlib build cannot fail it. Jest's `roots` is `src/`, so Jest never sees them, and they need no Jest or Babel configuration.

Ceiling: until `apps/mobile/package.json`'s `test` script runs them, `make test-web` and CI do not. Request to L2 (through the manager): `"test": "sh -c 'jest --ci && node --test scripts/*.test.mjs' --"`. Until it lands, every task's gates and the manager's verification run `node --test scripts/*.test.mjs` explicitly. `eslint .` already lints `scripts/*.mjs`.

## Risks / Trade-offs

- [`expo-splash-screen` is a new dependency] -> settled by D43 (orchestrator approved `expo-splash-screen` 58.0.10); by the manager's decision the pin landed in this lane, task 3 commit 22122c3 (`apps/mobile/package.json` one line, root `package-lock.json` +15 lines, mechanical), instead of through L2. Listing the plugin without the package breaks `expo export`, so the pin precedes the plugin entry.
- [Release builds cannot reach an `http` core on the LAN] -> Android blocks cleartext traffic outside Expo Go; enabling it needs `expo-build-properties` (another dependency). Ceiling: preview builds need an `https` core URL (a deployed core or a tunnel); the LAN loop is Expo Go. Named in the README.
- [Rendering takes about 1 s per image] -> the icons check renders three 1024 images, about 3 s; acceptable for `node --test`.
- [Icon and splash are not visible in Expo Go or the web export] -> no walk can show them before an EAS build; the manager inspects the PNGs directly and runs `npx expo config --type public` to see the resolved keys.

## Scenario to test

| scenario | test |
|---|---|
| Two build profiles and no submit | `scripts/release-config.test.mjs` `two build profiles and no submit` |
| No account in the app config | `scripts/release-config.test.mjs` `no account in the app config` |
| Device notes name the commands | `scripts/release-config.test.mjs` `device notes name the commands` |
| Committed icons match the generator | `scripts/icons.test.mjs` `committed icons match the generator` |
| App config points at the icons | `scripts/icons.test.mjs` `app config points at the icons` |
| Splash uses the brand surface and the mark | `scripts/icons.test.mjs` `splash uses the brand surface and the mark` |

## Files

`apps/mobile/package.json` (the `expo-splash-screen` pin only, D43) and the root `package-lock.json` (mechanical), `apps/mobile/eas.json`, `apps/mobile/README.md`, `apps/mobile/app.json` (`icon`, `android.adaptiveIcon`, the `expo-splash-screen` plugin entry), `apps/mobile/assets/{icon,adaptive-icon,splash-icon}.png`, `apps/mobile/scripts/{icons.mjs,icons.test.mjs,release-config.test.mjs}`, `openspec/changes/mobile-release-config/`. All in the mobile area.
