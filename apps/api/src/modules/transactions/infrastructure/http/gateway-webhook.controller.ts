import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { DataEnvelope, toResponse } from '../../../../shared/http/responder';
import { ApiDataResponse, ApiErrorResponses } from '../../../../shared/http/swagger';
import {
  HandleGatewayEventOutput,
  HandleGatewayEventUseCase,
} from '../../application/use-cases/handle-gateway-event.use-case';

export class GatewayEventAckDto {
  @ApiProperty({ example: true })
  received!: boolean;

  @ApiProperty({ description: 'false when the event was authentic but nothing had to change' })
  handled!: boolean;
}

@ApiTags('webhooks')
@Controller('webhooks')
export class GatewayWebhookController {
  constructor(
    @Inject(HandleGatewayEventUseCase) private readonly handleEvent: HandleGatewayEventUseCase,
  ) {}

  /**
   * The body is the gateway's own format, so it is taken as-is (no whitelist DTO) and validated
   * by the use case; authenticity comes from the checksum.
   */
  @Post('payment-gateway')
  @HttpCode(200)
  @ApiOperation({ summary: 'Payment gateway event (checksum-verified)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['event', 'data', 'signature', 'timestamp'],
      properties: {
        event: { type: 'string', example: 'transaction.updated' },
        data: { type: 'object' },
        signature: {
          type: 'object',
          properties: {
            properties: { type: 'array', items: { type: 'string' } },
            checksum: { type: 'string' },
          },
        },
        timestamp: { type: 'integer' },
      },
    },
  })
  @ApiDataResponse(GatewayEventAckDto, { description: 'Event acknowledged' })
  @ApiErrorResponses(400, 401, 413)
  async receive(@Body() body: unknown): Promise<DataEnvelope<HandleGatewayEventOutput>> {
    return toResponse(await this.handleEvent.execute(body));
  }
}
