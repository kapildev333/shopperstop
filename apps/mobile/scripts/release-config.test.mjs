// Release configuration checks: EAS build profiles, no account in app.json,
// and the device run notes. Run with `node --test scripts/*.test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (name) => readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), 'utf8');

test('two build profiles and no submit', () => {
  const eas = JSON.parse(read('eas.json'));
  const build = eas.build;
  assert.deepEqual(Object.keys(build), ['preview', 'production']);
  assert.equal(build.preview.distribution, 'internal');
  assert.equal(build.preview.android.buildType, 'apk');
  assert.equal('submit' in eas, false);
});

test('no account in the app config', () => {
  const { expo } = JSON.parse(read('app.json'));
  assert.equal(expo.owner, undefined);
  assert.equal(expo.extra?.eas, undefined);
});

test('device notes name the commands', () => {
  const readme = read('README.md');
  for (const needle of [
    'npx expo start --port 5176',
    'EXPO_PUBLIC_CORE_URL=http://<lan-ip>:8080',
    'Expo Go',
    'npx eas-cli build --profile preview',
    'node scripts/icons.mjs',
  ]) {
    assert.ok(readme.includes(needle), `README.md must include: ${needle}`);
  }
});
