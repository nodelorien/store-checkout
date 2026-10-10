import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiProperty, ApiResponse, getSchemaPath } from '@nestjs/swagger';

export class ErrorDetailModel {
  @ApiProperty({ example: 'customer.email' })
  field!: string;

  @ApiProperty({ example: 'email must be an email' })
  message!: string;
}

export class ErrorBodyModel {
  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'The request is not valid' })
  message!: string;

  @ApiProperty({ type: [ErrorDetailModel] })
  details!: ErrorDetailModel[];

  @ApiProperty({ example: '0f8fad5b-d9cb-469f-a165-70867728950e' })
  requestId!: string;
}

export class ErrorEnvelopeModel {
  @ApiProperty({ type: ErrorBodyModel })
  error!: ErrorBodyModel;
}

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'VALIDATION_ERROR — the request is not valid (details list the fields)',
  401: 'INVALID_SIGNATURE — the event checksum does not match',
  404: 'Resource not found (*_NOT_FOUND)',
  409: 'Conflict with the current state (OUT_OF_STOCK, DELIVERY_NOT_EDITABLE)',
  413: 'PAYLOAD_TOO_LARGE — body over 10 kb',
  422: 'PAYMENT_GATEWAY_REJECTED — the gateway refused the charge request',
  429: 'RATE_LIMITED — too many requests',
  500: 'PERSISTENCE_ERROR / INTERNAL_ERROR — generic message, no internals',
  502: 'PAYMENT_GATEWAY_UNAVAILABLE — the gateway did not answer',
};

/** Documents a `{ data: Model }` (or `{ data: Model[] }`) success envelope. */
export function ApiDataResponse(
  model: Type<unknown>,
  options: { status?: number; isArray?: boolean; description: string },
): MethodDecorator {
  const ref = { $ref: getSchemaPath(model) };
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: options.status ?? 200,
      description: options.description,
      schema: {
        type: 'object',
        required: ['data'],
        properties: { data: options.isArray ? { type: 'array', items: ref } : ref },
      },
    }),
  );
}

/** Documents the error envelope for each given status (429 and 500 are always possible). */
export function ApiErrorResponses(...statuses: number[]): MethodDecorator {
  const all = [...new Set([...statuses, 429, 500])].sort((a, b) => a - b);
  return applyDecorators(
    ...all.map((status) =>
      ApiResponse({ status, description: ERROR_DESCRIPTIONS[status], type: ErrorEnvelopeModel }),
    ),
  );
}
