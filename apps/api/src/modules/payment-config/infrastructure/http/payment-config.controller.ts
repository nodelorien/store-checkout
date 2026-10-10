import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { DataEnvelope, toResponse } from '../../../../shared/http/responder';
import { ApiDataResponse, ApiErrorResponses } from '../../../../shared/http/swagger';
import {
  GetPaymentConfigUseCase,
  PaymentConfigView,
} from '../../application/use-cases/get-payment-config.use-case';

class AcceptanceResponseDto {
  @ApiProperty({ description: 'Single-use token to send back as `acceptanceToken`' })
  token!: string;

  @ApiProperty({ description: 'Link to the terms the buyer must accept', format: 'uri' })
  permalink!: string;
}

export class PaymentConfigResponseDto {
  @ApiProperty({ example: 'pub_…', description: 'Gateway public key (safe to expose)' })
  publicKey!: string;

  @ApiProperty({ format: 'uri', description: 'Where the browser tokenizes the card' })
  tokenizationUrl!: string;

  @ApiProperty({ type: AcceptanceResponseDto })
  acceptance!: AcceptanceResponseDto;

  @ApiProperty({ example: 'COP' })
  currency!: string;

  @ApiProperty({ example: 250000 })
  baseFeeInCents!: number;

  @ApiProperty({ example: 800000 })
  deliveryFeeInCents!: number;
}

@ApiTags('payment-config')
@Controller('payment-config')
export class PaymentConfigController {
  constructor(
    @Inject(GetPaymentConfigUseCase) private readonly getPaymentConfig: GetPaymentConfigUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Public gateway data for the checkout: key, tokenization URL, acceptance, fees',
  })
  @ApiDataResponse(PaymentConfigResponseDto, { description: 'The payment configuration' })
  @ApiErrorResponses(502)
  async get(): Promise<DataEnvelope<PaymentConfigView>> {
    return toResponse(await this.getPaymentConfig.execute());
  }
}
