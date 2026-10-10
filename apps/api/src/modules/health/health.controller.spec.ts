import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createHttpTestApp } from '../../../test/helpers/test-app';
import { HealthController } from './health.controller';

describe('GET /api/v1/health', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createHttpTestApp({ controllers: [HealthController] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('AC-2: answers 200 with status ok', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toEqual({ data: { status: 'ok' } });
  });
});
