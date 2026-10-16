## ADDED Requirements

### Requirement: Mobile build profiles
`apps/mobile/eas.json` SHALL define exactly two build profiles, `preview` (internal distribution, Android APK) and `production`, and SHALL hold no `submit` section. Neither `eas.json` nor `apps/mobile/app.json` SHALL hold an Expo account (`owner`), an EAS project id (`extra.eas`) or a store credential.

#### Scenario: Two build profiles and no submit
- **WHEN** the release-config check reads `apps/mobile/eas.json`
- **THEN** its `build` keys are exactly `preview` and `production`, `build.preview.distribution` is `internal`, `build.preview.android.buildType` is `apk`, and the file has no `submit` key

#### Scenario: No account in the app config
- **WHEN** the release-config check reads `apps/mobile/app.json`
- **THEN** `expo.owner` and `expo.extra.eas` are absent

### Requirement: Mobile app icon from the brand tokens
The app icon SHALL be a 1024 × 1024 opaque PNG of the brand surface with the mark in on-brand, and the Android adaptive icon a 1024 × 1024 transparent PNG of the on-brand mark inside the safe zone over a `brand` background colour. Both SHALL be produced from the values in `packages/ui/src/tokens.css` by `apps/mobile/scripts/icons.mjs`, and the committed files SHALL equal its output.

#### Scenario: Committed icons match the generator
- **WHEN** the icons check renders the icon and the adaptive icon with the `--brand` and `--on-brand` values of `tokens.css`
- **THEN** the pixels of `apps/mobile/assets/icon.png` and `apps/mobile/assets/adaptive-icon.png` equal the rendered pixels, both are 1024 × 1024, the icon has no alpha channel and its corner pixel is the brand colour, and the centre pixel of each is the on-brand colour, opaque

#### Scenario: App config points at the icons
- **WHEN** the icons check reads `apps/mobile/app.json`
- **THEN** `expo.icon` is `./assets/icon.png`, `expo.android.adaptiveIcon.foregroundImage` is `./assets/adaptive-icon.png`, both files exist, and `expo.android.adaptiveIcon.backgroundColor` equals the `--brand` value of `tokens.css`

### Requirement: Mobile splash screen from the brand tokens
The app SHALL configure its native splash screen through the `expo-splash-screen` config plugin with the on-brand mark from `apps/mobile/assets/splash-icon.png` (1024 × 1024, transparent, produced and checked like the icons) centred on the `brand` background colour.

#### Scenario: Splash uses the brand surface and the mark
- **WHEN** the icons check reads the `expo-splash-screen` entry in `expo.plugins` of `apps/mobile/app.json`
- **THEN** its `image` is `./assets/splash-icon.png`, `backgroundColor` equals the `--brand` value of `tokens.css`, `imageWidth` is 200 and `resizeMode` is `contain`, and the pixels of `splash-icon.png` equal the generator's rendering

### Requirement: Mobile device run notes
`apps/mobile/README.md` SHALL tell a developer how to run the app on a phone with Expo Go against core on the computer's LAN address, how to make an EAS preview build, and how to regenerate the icons.

#### Scenario: Device notes name the commands
- **WHEN** the release-config check reads `apps/mobile/README.md`
- **THEN** it contains `npx expo start --port 5176`, `EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080`, `Expo Go`, `npx eas-cli build --profile preview` and `node scripts/icons.mjs`
