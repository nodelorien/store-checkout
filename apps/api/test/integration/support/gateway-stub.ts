import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';

/** Card tokens the stand-in understands; anything else is approved. */
export const TOKENS = {
  approved: 'tok_test_approved',
  declined: 'tok_test_declined',
  /** `PENDING` on the charge, `APPROVED` from the first status read on. */
  slow: 'tok_test_slow_approval',
  /** The gateway refuses the charge with a 422. */
  rejected: 'tok_test_rejected',
} as const;

interface Charge {
  readonly id: string;
  readonly reference: string;
  readonly amountInCents: number;
  readonly token: string;
  reads: number;
}

function statusOf(charge: Charge): { status: string; status_message?: string } {
  if (charge.token === TOKENS.declined) {
    return { status: 'DECLINED', status_message: 'Insufficient funds' };
  }
  if (charge.token === TOKENS.slow && charge.reads === 0) {
    return { status: 'PENDING' };
  }
  return { status: 'APPROVED' };
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>;
}

/**
 * Local HTTP stand-in for the payment gateway, speaking the wire format the adapter and the
 * browser expect. It exists so integration tests, load tests and credential-less local runs
 * never send traffic to the real sandbox. It accepts any card: never type a real one.
 */
export class GatewayStub {
  readonly charges: Charge[] = [];
  /** When set, every request is answered with this HTTP status. */
  failWithStatus: number | undefined;
  /** Artificial latency per request, to resemble a remote gateway under load. */
  delayMs = 0;
  private server: Server | undefined;

  get baseUrl(): string {
    const { port } = this.server?.address() as AddressInfo;
    return `http://127.0.0.1:${port}/v1`;
  }

  async start(port = 0): Promise<void> {
    this.server = createServer((request, response) => {
      this.handle(request, response).catch(() => this.send(response, 500, { error: {} }));
    });
    await new Promise<void>((resolve) => this.server?.listen(port, '127.0.0.1', resolve));
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }

  reset(): void {
    this.charges.length = 0;
    this.failWithStatus = undefined;
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = (request.url ?? '').replace(/^\/v1/, '');
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    if (this.failWithStatus !== undefined) {
      return this.send(response, this.failWithStatus, { error: { type: 'UNAVAILABLE' } });
    }

    // The browser tokenizes cards straight against the gateway, from another origin.
    if (request.method === 'OPTIONS') {
      return this.send(response, 204, undefined);
    }
    if (request.method === 'POST' && path === '/tokens/cards') {
      const card = await readJson(request);
      const number = String(card.number ?? '');
      return this.send(response, 201, {
        status: 'CREATED',
        data: {
          // The sandbox's declining test card maps to the declining token.
          id: number.startsWith('4111') ? TOKENS.declined : TOKENS.approved,
          brand: number.startsWith('5') ? 'MASTERCARD' : 'VISA',
          last_four: number.slice(-4),
          expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        },
      });
    }

    if (request.method === 'GET' && path.startsWith('/merchants/')) {
      return this.send(response, 200, {
        data: {
          presigned_acceptance: {
            acceptance_token: 'acceptance-token-for-tests',
            permalink: 'https://example.com/terms.pdf',
          },
        },
      });
    }

    if (request.method === 'POST' && path === '/transactions') {
      const body = await readJson(request);
      const method = body.payment_method as { token?: string } | undefined;
      const token = String(method?.token ?? '');
      if (token === TOKENS.rejected) {
        return this.send(response, 422, {
          error: { type: 'INPUT_VALIDATION_ERROR', messages: { token: ['is not valid'] } },
        });
      }
      const charge: Charge = {
        id: `gw-${this.charges.length + 1}-${Date.now()}`,
        reference: String(body.reference),
        amountInCents: Number(body.amount_in_cents),
        token,
        reads: 0,
      };
      this.charges.push(charge);
      return this.send(response, 201, { data: { id: charge.id, ...statusOf(charge) } });
    }

    const read = /^\/transactions\/([^/]+)$/.exec(path);
    if (request.method === 'GET' && read) {
      const charge = this.charges.find((entry) => entry.id === decodeURIComponent(read[1]));
      if (!charge) {
        return this.send(response, 404, { error: { type: 'NOT_FOUND_ERROR' } });
      }
      charge.reads += 1;
      return this.send(response, 200, { data: { id: charge.id, ...statusOf(charge) } });
    }

    return this.send(response, 404, { error: { type: 'NOT_FOUND_ERROR' } });
  }

  private send(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, accept',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    response.end(body === undefined ? undefined : JSON.stringify(body));
  }
}
