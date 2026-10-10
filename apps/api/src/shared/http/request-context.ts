import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

type RequestWithId = Request & { requestId?: string };

export function getRequestId(request: Request): string {
  return (request as RequestWithId).requestId ?? 'unknown';
}

/** Echoes a well-formed caller id or generates one; always sets the response header. */
export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.header(REQUEST_ID_HEADER);
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  (request as RequestWithId).requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

const NO_STORE_PREFIXES = ['transactions', 'customers', 'deliveries', 'payment-config', 'webhooks'];

/** `Cache-Control` policy from `api.md`; applied before routing so error responses get it too. */
export function cacheControlMiddleware(apiPrefix: string) {
  const noStore = NO_STORE_PREFIXES.map((segment) => `/${apiPrefix}/${segment}`);
  const products = `/${apiPrefix}/products`;
  const startsWith = (path: string, prefix: string): boolean =>
    path === prefix || path.startsWith(`${prefix}/`);

  return (request: Request, response: Response, next: NextFunction): void => {
    if (noStore.some((prefix) => startsWith(request.path, prefix))) {
      response.setHeader('Cache-Control', 'no-store');
    } else if (startsWith(request.path, products)) {
      response.setHeader('Cache-Control', 'max-age=0, must-revalidate');
    }
    next();
  };
}

/**
 * One structured line per request: method, path (no query string), status, duration, request id.
 * Bodies and headers are never logged, so card tokens and personal data cannot leak here.
 */
export function requestLoggingMiddleware(logger: Pick<Logger, 'log' | 'warn' | 'error'>) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();
    response.on('finish', () => {
      const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
      const line = JSON.stringify({
        requestId: getRequestId(request),
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs,
      });
      if (response.statusCode >= 500) {
        logger.error(line);
      } else if (response.statusCode >= 400) {
        logger.warn(line);
      } else {
        logger.log(line);
      }
    });
    next();
  };
}
