import { Logger, LogLevel as NestLogLevel } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { APP_CONFIG, AppConfig, LogLevel } from './shared/config/app-config';
import {
  cacheControlMiddleware,
  requestIdMiddleware,
  requestLoggingMiddleware,
} from './shared/http/request-context';
import { createValidationPipe } from './shared/http/validation';

export const API_PREFIX = 'api/v1';
export const DOCS_PATH = 'api/docs';
export const BODY_LIMIT = '10kb';

const NEST_LOG_LEVELS: Record<LogLevel, NestLogLevel[]> = {
  debug: ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'],
  info: ['fatal', 'error', 'warn', 'log'],
  warn: ['fatal', 'error', 'warn'],
  error: ['fatal', 'error'],
};

/**
 * Strict helmet defaults everywhere; the Swagger UI page needs inline scripts/styles, so the
 * CSP is relaxed for the docs path only.
 */
function securityHeaders(): (request: Request, response: Response, next: NextFunction) => void {
  const strict = helmet();
  const docs = helmet({
    contentSecurityPolicy: {
      directives: {
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
      },
    },
  });
  return (request, response, next) =>
    request.path.startsWith(`/${DOCS_PATH}`)
      ? docs(request, response, next)
      : strict(request, response, next);
}

/** Shared application setup used by the local server, the Lambda handler and the tests. */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  const config = app.get<AppConfig>(APP_CONFIG);

  app.useLogger(NEST_LOG_LEVELS[config.logLevel]);
  app.setGlobalPrefix(API_PREFIX);
  if (config.trustProxy) {
    // Behind API Gateway / CloudFront the client address is in X-Forwarded-For (rate limiting).
    app.set('trust proxy', true);
  }

  app.use(requestIdMiddleware);
  app.use(requestLoggingMiddleware(new Logger('HTTP')));
  app.use(securityHeaders());
  app.use(cacheControlMiddleware(API_PREFIX));
  app.useBodyParser('json', { limit: BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: BODY_LIMIT, extended: false });
  app.useGlobalPipes(createValidationPipe());

  if (config.corsOrigins.length > 0) {
    app.enableCors({
      origin: [...config.corsOrigins],
      exposedHeaders: ['X-Request-Id'],
      allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    });
  }

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Store checkout API')
      .setDescription('Products, stock, customers, transactions and deliveries')
      .setVersion('1.0')
      .build(),
  );
  SwaggerModule.setup(DOCS_PATH, app, document);

  return app;
}
