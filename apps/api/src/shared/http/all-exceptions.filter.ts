import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorDetail } from '../errors/domain-error';
import {
  buildErrorEnvelope,
  domainErrorToHttp,
  ErrorCode,
  ErrorEnvelope,
  GENERIC_ERROR_MESSAGE,
} from '../errors/http-error.mapper';
import { redactText } from './redact';
import { getRequestId } from './request-context';
import { DomainErrorException } from './responder';
import { RequestValidationException } from './validation';

const CLIENT_ERRORS: Record<number, { code: ErrorCode; message: string }> = {
  400: { code: 'VALIDATION_ERROR', message: 'The request is not valid' },
  404: { code: 'NOT_FOUND', message: 'Resource not found' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large' },
  429: { code: 'RATE_LIMITED', message: 'Too many requests, try again later' },
};

function statusOf(exception: unknown): number | undefined {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  // Errors raised by express middleware (body parser) carry a numeric `status`.
  const status = (exception as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
}

/** Renders every failure as the `api.md` error envelope. Nothing internal reaches the client. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const requestId = getRequestId(http.getRequest<Request>());
    const { status, body } = this.render(exception, requestId);
    http.getResponse<Response>().status(status).json(body);
  }

  private render(exception: unknown, requestId: string): { status: number; body: ErrorEnvelope } {
    if (exception instanceof DomainErrorException) {
      if (exception.domainError.code === 'PERSISTENCE_ERROR') {
        this.logger.error(
          JSON.stringify({ requestId, error: redactText(exception.domainError.message) }),
        );
      }
      return domainErrorToHttp(exception.domainError, requestId);
    }

    const status = statusOf(exception);
    if (status !== undefined && status >= 400 && status < 500) {
      const known = CLIENT_ERRORS[status] ?? { code: 'BAD_REQUEST', message: 'Request rejected' };
      const details: readonly ErrorDetail[] =
        exception instanceof RequestValidationException ? exception.details : [];
      return { status, body: buildErrorEnvelope(known.code, known.message, details, requestId) };
    }

    const name = exception instanceof Error ? exception.name : typeof exception;
    const message = exception instanceof Error ? exception.message : '';
    this.logger.error(JSON.stringify({ requestId, error: name, message: redactText(message) }));
    return {
      status: 500,
      body: buildErrorEnvelope('INTERNAL_ERROR', GENERIC_ERROR_MESSAGE, [], requestId),
    };
  }
}
