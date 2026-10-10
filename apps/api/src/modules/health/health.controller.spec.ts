import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { configureApp } from '../../bootstrap';

function restoreCorsOrigin(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.CORS_ORIGIN;
  } else {
    process.env.CORS_ORIGIN = value;
  }
}

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}

describe('GET /api/v1/health', () => {
  let app: INestApplication;
  const previousCorsOrigin = process.env.CORS_ORIGIN;

  beforeAll(async () => {
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    app = await createApp();
  });

  afterAll(async () => {
    restoreCorsOrigin(previousCorsOrigin);
    await app.close();
  });

  it('AC-2: answers 200 with status ok', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toEqual({ data: { status: 'ok' } });
  });

  it('sets security headers', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('allows the configured CORS origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('serves the OpenAPI document', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(response.body.info.title).toBe('Store checkout API');
  });
});

describe('CORS disabled (same-origin production setup)', () => {
  it('does not emit CORS headers when no origin is configured', async () => {
    const previousCorsOrigin = process.env.CORS_ORIGIN;
    delete process.env.CORS_ORIGIN;
    const app = await createApp();

    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://evil.example');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
    restoreCorsOrigin(previousCorsOrigin);
  });
});
