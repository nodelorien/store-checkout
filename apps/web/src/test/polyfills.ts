import { clearImmediate, setImmediate } from 'node:timers';

/**
 * jsdom has no `setImmediate`, but Node's fetch stack (used through the request interception of
 * the mock server) needs it. Expose Node's real implementation to the test environment.
 */
Object.assign(globalThis, { setImmediate, clearImmediate });
