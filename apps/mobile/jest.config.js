module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  // Jest resolves the react-native (ESM) entry of lucide-react-native, which it cannot load as CommonJS; use its CJS build.
  moduleNameMapper: {
    '^lucide-react-native$': '<rootDir>/../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|lucide-react-native|react-native-svg|@shopperstop/.*|standard-navigation|react-navigation|@react-navigation/.*))',
  ],
}
