module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  // Jest resolves the react-native (ESM) entry of lucide-react-native, which it cannot load as CommonJS; use its CJS build.
  moduleNameMapper: {
    '^lucide-react-native$': require.resolve('lucide-react-native'),
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // expo-router is transformed inside the first test of each file, which a cold cache (CI, --no-cache) can take past the 5 s default.
  testTimeout: 60_000,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|lucide-react-native|react-native-svg|@shopperstop/.*|standard-navigation|react-navigation|@react-navigation/.*))',
  ],
}
