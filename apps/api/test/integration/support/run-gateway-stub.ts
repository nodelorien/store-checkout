import { GatewayStub } from './gateway-stub';

/**
 * Runs the gateway stand-in as a process, for load tests and local runs without the sandbox:
 *   PORT=4010 GATEWAY_STUB_DELAY_MS=150 npx tsx apps/api/test/integration/support/run-gateway-stub.ts
 */
async function main(): Promise<void> {
  const stub = new GatewayStub();
  stub.delayMs = Number(process.env.GATEWAY_STUB_DELAY_MS ?? 0);
  await stub.start(Number(process.env.PORT ?? 4010));
  console.warn(`Gateway stand-in listening at ${stub.baseUrl} (delay ${stub.delayMs} ms)`);
}

void main();
