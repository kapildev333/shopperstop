# ShopperStop mobile app

The customer app (Expo, React Native, Expo Router). This page covers running it on a phone, making an installable preview build, and regenerating the app icons.

## Run on a phone

1. Start the local stack from the repository root: `make dev` (Postgres, core, web and the rest).
2. In a second terminal, start the app against core on your computer's LAN address:

   ```sh
   cd apps/mobile
   EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080 EXPO_PUBLIC_RIDER_URL=http://<lan-ip>:8081 npx expo start --port 5176
   ```

   Replace `<lan-ip>` with your computer's address on the Wi-Fi network. On macOS, `ipconfig getifaddr en0` prints it.
3. Open Expo Go on the phone, on the same Wi-Fi network, and scan the QR code that Expo prints.

The port is 5176 because core's dev origins accept the web export on 5176; Expo's default 8081 is the rider service's port.

## Preview build

A preview build is an installable app (an Android APK, or an iOS internal build) that does not need Expo Go.

1. Log in with the EAS CLI through npx, which fetches the CLI and does not add it to the project: `npx eas-cli login`.
2. Set `EXPO_PUBLIC_CORE_URL` and `EXPO_PUBLIC_RIDER_URL` as EAS environment variables for the project, not in the repository, before the build. Expo inlines it into the bundle at build time, so a value set after the build does not reach the app. A release build needs an `https` core URL, because Android blocks cleartext `http` outside Expo Go; the LAN address works only in Expo Go.
3. Build the preview profile: `npx eas-cli build --profile preview --platform android` (or `--platform ios`).

The first build links the project to an Expo account and writes an `extra.eas.projectId` into `app.json`. Do not commit that change until the owner decides how the project is owned. Store submission is not set up.

## Icons and splash

The icon, adaptive icon and splash are drawn from the brand colours in `packages/ui/src/tokens.css` by `scripts/icons.mjs`. After a change to `--brand` or `--on-brand`, regenerate and commit the PNGs:

```sh
cd apps/mobile
node scripts/icons.mjs
```

The icons check in `scripts/icons.test.mjs` fails until the committed PNGs match the generator. Run the checks with `node --test scripts/*.test.mjs`.
