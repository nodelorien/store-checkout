import { Module } from '@nestjs/common';
import { DELIVERY_REPOSITORY } from './application/ports/delivery-repository.port';
import { GetDeliveryByTransactionUseCase } from './application/use-cases/get-delivery-by-transaction.use-case';
import { GetDeliveryUseCase } from './application/use-cases/get-delivery.use-case';
import { UpdateDeliveryAddressUseCase } from './application/use-cases/update-delivery-address.use-case';
import { DeliveriesController } from './infrastructure/http/deliveries.controller';
import { DynamoDbDeliveryRepository } from './infrastructure/persistence/dynamodb-delivery.repository';

@Module({
  controllers: [DeliveriesController],
  providers: [
    { provide: DELIVERY_REPOSITORY, useClass: DynamoDbDeliveryRepository },
    GetDeliveryUseCase,
    GetDeliveryByTransactionUseCase,
    UpdateDeliveryAddressUseCase,
  ],
  exports: [DELIVERY_REPOSITORY],
})
export class DeliveriesModule {}
