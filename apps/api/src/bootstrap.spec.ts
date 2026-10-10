import { Body, Controller, Get, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import request from 'supertest';
import { createHttpTestApp } from '../test/helpers/test-app';
import { testConfig } from '../test/helpers/test-config';
import { DomainErrors } from './shared/errors/domain-error';
import { GENERIC_ERROR_MESSAGE } from './shared/errors/http-error.mapper';
import { toResponse } from './shared/http/responder';
import { err, ok } from './shared/result/result';

class InnerDto {
  @IsString()
  email!: string;
}

class ProbeDto {
  @IsInt()
  quantity!: number;

  @ValidateNested()
  @Type(() => InnerDto)
  customer!: InnerDto;
}

@Controller()
class ProbeController {
  @Get('probe/ok')
  ok() {
    return toResponse(ok({ fine: true }));
  }

  @Get('probe/domain-error')
  domainError() {
    return toResponse(err(DomainErrors.outOfStock(0)));
  }

  @Get('probe/persistence-error')
  persistenceError() {
    return toResponse(err(DomainErrors.persistence('table checkout-prod is throttled')));
  }

  @Get('probe/crash')
  crash() {
    throw new Error('connection string postgres://user:pass@host leaked');
  }

  @Get('probe/crash-non-error')
  crashNonError() {
    throw 'plain string';
  }

  @Post('probe/validate')
  validate(@Body() body: ProbeDto) {
    return { data: body };
  }

  @Get(['transactions/probe', 'customers/probe', 'deliveries/probe', 'payment-config'])
  sensitive() {
    return { data: {} };
  }

  @Get('products/probe')
  products() {
    return { data: {} };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('HTTP pipeline (configureApp)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createHttpTestApp({ controllers: [ProbeController] });
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string) => request(app.getHttpServer()).get(`/api/v1/${path}`);

  it('AC-4: generates a request id when none is sent', async () => {
    const response = await get('probe/ok').expect(200);

    expect(response.headers['x-request-id']).toMatch(UUID);
    expect(response.body).toEqual({ data: { fine: true } });
  });

  it('AC-4: echoes a well-formed request id', async () => {
    const response = await get('probe/ok').set('X-Request-Id', 'client-id-12345');

    expect(response.headers['x-request-id']).toBe('client-id-12345');
  });

  it('AC-4: replaces an unsafe request id', async () => {
    const response = await get('probe/ok').set('X-Request-Id', '<script>alert(1)</script>');

    expect(response.headers['x-request-id']).toMatch(UUID);
  });

  it('AC-3: renders a domain error with its status and the request id', async () => {
    const response = await get('probe/domain-error').set('X-Request-Id', 'request-0001');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: 'OUT_OF_STOCK',
        message: 'Only 0 units left',
        details: [],
        requestId: 'request-0001',
      },
    });
  });

  it('AC-3: answers 500 with a generic message for persistence errors', async () => {
    const response = await get('probe/persistence-error').expect(500);

    expect(response.body.error).toMatchObject({
      code: 'PERSISTENCE_ERROR',
      message: GENERIC_ERROR_MESSAGE,
    });
  });

  it('AC-3: answers 500 without internals for unexpected exceptions', async () => {
    const response = await get('probe/crash').expect(500);

    expect(response.body.error).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: GENERIC_ERROR_MESSAGE,
      details: [],
    });
    expect(JSON.stringify(response.body)).not.toContain('postgres');
    await get('probe/crash-non-error').expect(500);
  });

  it('AC-3: answers 404 with the envelope for unknown routes', async () => {
    const response = await get('nope').expect(404);

    expect(response.body.error).toMatchObject({ code: 'NOT_FOUND', details: [] });
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });

  it('AC-3: answers 400 VALIDATION_ERROR with flattened field details', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/probe/validate')
      .send({ quantity: 'two', customer: { email: 5 }, cvc: '123' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        { field: 'quantity', message: 'quantity must be an integer number' },
        { field: 'customer.email', message: 'email must be a string' },
        { field: 'cvc', message: 'property cvc should not exist' },
      ]),
    );
    expect(JSON.stringify(response.body)).not.toContain('123');
  });

  it('AC-3: answers 400 with the envelope for malformed JSON', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/probe/validate')
      .set('Content-Type', 'application/json')
      .send('{"quantity":')
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('AC-9: answers 413 for a body larger than 10 kb', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/probe/validate')
      .send({ quantity: 1, customer: { email: 'x'.repeat(11 * 1024) } })
      .expect(413);

    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('AC-10: marks sensitive resources as no-store', async () => {
    for (const path of ['transactions/probe', 'customers/probe', 'deliveries/probe']) {
      const response = await get(path).expect(200);
      expect(response.headers['cache-control']).toBe('no-store');
    }
    expect((await get('payment-config')).headers['cache-control']).toBe('no-store');
    expect((await get('transactions/unknown/route')).headers['cache-control']).toBe('no-store');
    expect((await get('reports/summary')).headers['cache-control']).toBe('no-store');
  });

  it('AC-10: lets products be revalidated', async () => {
    const response = await get('products/probe').expect(200);

    expect(response.headers['cache-control']).toBe('max-age=0, must-revalidate');
    expect((await get('probe/ok')).headers['cache-control']).toBeUndefined();
  });

  it('AC-11: serves Swagger UI with a CSP that allows its inline assets', async () => {
    const docs = await request(app.getHttpServer()).get('/api/docs').redirects(1).expect(200);
    const api = await get('probe/ok');

    expect(docs.text).toContain('swagger-ui');
    expect(docs.headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
    expect(api.headers['content-security-policy']).toContain("script-src 'self'");
    expect(api.headers['content-security-policy']).not.toContain(
      "script-src 'self' 'unsafe-inline'",
    );
  });

  it('AC-11: serves the OpenAPI document', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(response.body.info.title).toBe('Store checkout API');
  });

  it('sets security headers and hides the framework', async () => {
    const response = await get('probe/ok');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('does not emit CORS headers when no origin is configured (same-origin production)', async () => {
    const response = await get('probe/ok').set('Origin', 'http://evil.example');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('HTTP pipeline options', () => {
  it('allows the configured CORS origin and exposes the request id', async () => {
    const app = await createHttpTestApp(
      { controllers: [ProbeController] },
      testConfig({ corsOrigins: ['http://localhost:5173'], logLevel: 'debug', trustProxy: true }),
    );
    app.useLogger(false);

    const response = await request(app.getHttpServer())
      .get('/api/v1/probe/ok')
      .set('Origin', 'http://localhost:5173');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-expose-headers']).toBe('X-Request-Id');
    await app.close();
  });

  it('AC-8: answers 429 with the envelope after 60 requests in a minute', async () => {
    const app = await createHttpTestApp({ controllers: [ProbeController] });
    const server = app.getHttpServer();

    for (let i = 0; i < 60; i += 1) {
      await request(server).get('/api/v1/probe/ok').expect(200);
    }
    const response = await request(server).get('/api/v1/probe/ok').expect(429);

    expect(response.body.error).toMatchObject({ code: 'RATE_LIMITED', details: [] });
    await app.close();
  });
});
