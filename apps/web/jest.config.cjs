/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'jest-fixed-jsdom',
  testEnvironmentOptions: { customExportConditions: [''] },
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: { react: { runtime: 'automatic' } },
          target: 'es2022',
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/shared/config/env$': '<rootDir>/src/test/envMock.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css)$': 'identity-obj-proxy',
    '\\.(svg|png|jpg|jpeg|webp|gif)$': '<rootDir>/src/test/fileMock.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/main.tsx',
    '!src/**/*.d.ts',
    '!src/test/**',
    '!src/shared/config/env.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
};
