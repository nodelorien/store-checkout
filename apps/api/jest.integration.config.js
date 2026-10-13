/**
 * Integration tests: the real application against DynamoDB Local, Redis and a local stand-in
 * for the payment gateway. They need `docker compose up -d dynamodb redis` and are not part of
 * the coverage gate (`jest.config.js`).
 *
 * @type {import('jest').Config}
 */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  roots: ['<rootDir>/test/integration'],
  testRegex: '.*\\.int-spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.json', diagnostics: { ignoreCodes: [151002] } },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30_000,
  // One table set and one Redis per file; files must not interleave on the shared services.
  maxWorkers: 1,
};
