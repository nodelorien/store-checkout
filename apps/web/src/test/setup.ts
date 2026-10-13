import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { server } from './server';

// The default second is too short for a busy CI runner (the polling tests chain ~30 mocked reads).
// A passing wait returns as soon as it can, so this only delays tests that are going to fail.
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));

afterEach(() => {
  server.resetHandlers();
  window.localStorage.clear();
});

afterAll(() => server.close());
