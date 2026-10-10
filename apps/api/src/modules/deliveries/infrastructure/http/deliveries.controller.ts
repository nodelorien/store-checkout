import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { DataEnvelope, toResponse } from '../../../../shared/http/responder';
import { ApiDataResponse, ApiErrorResponses } from '../../../../shared/http/swagger';
import { DeliveryView } from '../../application/use-cases/delivery.views';
import { GetDeliveryByTransactionUseCase } from '../../application/use-cases/get-delivery-by-transaction.use-case';
import { GetDeliveryUseCase } from '../../application/use-cases/get-delivery.use-case';
import { UpdateDeliveryAddressUseCase } from '../../application/use-cases/update-delivery-address.use-case';
import { DeliveryResponseDto, UpdateDeliveryAddressDto } from './dto/delivery.dto';

@ApiTags('deliveries')
@Controller()
export class DeliveriesController {
  constructor(
    @Inject(GetDeliveryUseCase) private readonly getDelivery: GetDeliveryUseCase,
    @Inject(GetDeliveryByTransactionUseCase)
    private readonly getDeliveryByTransaction: GetDeliveryByTransactionUseCase,
    @Inject(UpdateDeliveryAddressUseCase)
    private readonly updateDeliveryAddress: UpdateDeliveryAddressUseCase,
  ) {}

  @Get('deliveries/:id')
  @ApiOperation({ summary: 'Get one delivery' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiDataResponse(DeliveryResponseDto, { description: 'The delivery' })
  @ApiErrorResponses(400, 404)
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<DataEnvelope<DeliveryView>> {
    return toResponse(await this.getDelivery.execute(id));
  }

  @Get('transactions/:id/delivery')
  @ApiOperation({ summary: 'Get the delivery of an approved transaction' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Transaction id' })
  @ApiDataResponse(DeliveryResponseDto, { description: 'The delivery' })
  @ApiErrorResponses(400, 404)
  async getByTransaction(
    @Param('id', ParseUUIDPipe) transactionId: string,
  ): Promise<DataEnvelope<DeliveryView>> {
    return toResponse(await this.getDeliveryByTransaction.execute(transactionId));
  }

  @Patch('deliveries/:id')
  @ApiOperation({ summary: 'Amend the delivery address while the delivery is PENDING' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiDataResponse(DeliveryResponseDto, { description: 'The updated delivery' })
  @ApiErrorResponses(400, 404, 409, 413)
  async updateAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDeliveryAddressDto,
  ): Promise<DataEnvelope<DeliveryView>> {
    return toResponse(await this.updateDeliveryAddress.execute(id, body));
  }
}
