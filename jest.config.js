/**
 * Jest — screen/button tests and data-flow tests.
 *
 * `expo-sqlite` is swapped for a real SQLite (sql.js, compiled to WebAssembly)
 * so every repository runs its actual SQL. Skia-drawn visuals are replaced
 * with plain views in test/setup.tsx; everything else is the real app code.
 */
module.exports = {
  preset: 'jest-expo',
  resolver: 'react-native-worklets/jest/resolver.js',
  setupFiles: ['<rootDir>/test/setup.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo-sqlite$': '<rootDir>/test/shims/expo-sqlite.ts',
  },
  testMatch: ['<rootDir>/test/**/*.test.ts?(x)'],
};
