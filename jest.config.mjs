/** @type {import('ts-jest').JestConfigWithTsJest} */
const config = {
  preset: 'ts-jest/presets/default-esm', // Use ESM preset
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'], // Look for tests in src and tests directory
  testMatch: [ // Pattern to find test files
    '**/__tests__/**/*.+(ts|tsx|js)', 
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    // Use ts-jest for ESM support
    '^.+\\.m?[tj]sx?$': ['ts-jest', { 
      useESM: true, // Enable ESM support in ts-jest
      tsconfig: 'tsconfig.json' // Specify your tsconfig file
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node', 'mjs'], // Add mjs
  moduleNameMapper: { // Handle ESM module resolution for imports
    '^(\\.{1,2}/.*)\\.js$': '$1', 
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx', '.mts'], // Treat .ts files as ESM
  collectCoverage: true, // Enable coverage collection
  coverageDirectory: "coverage", // Directory for coverage reports
  coverageProvider: "v8", // Use v8 for coverage
  // Optional: Add setup files if needed
  // setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'], 
};

export default config; // Use ESM export default