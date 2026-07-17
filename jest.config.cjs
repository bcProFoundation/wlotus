/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  // ecash-lib ships ESM (+ wasm glue) that Jest must transform
  transformIgnorePatterns: [
    '/node_modules/(?!(ecash-lib|ecash-wallet|chronik-client)/)',
  ],
  testMatch: ['**/tests/**/*.test.ts'],
};
