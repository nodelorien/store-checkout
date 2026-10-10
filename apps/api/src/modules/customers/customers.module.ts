import { Module } from '@nestjs/common';
import { CUSTOMER_REPOSITORY } from './application/ports/customer-repository.port';
import { GetCustomerUseCase } from './application/use-cases/get-customer.use-case';
import { UpsertCustomerUseCase } from './application/use-cases/upsert-customer.use-case';
import { CustomersController } from './infrastructure/http/customers.controller';
import { DynamoDbCustomerRepository } from './infrastructure/persistence/dynamodb-customer.repository';

@Module({
  controllers: [CustomersController],
  providers: [
    { provide: CUSTOMER_REPOSITORY, useClass: DynamoDbCustomerRepository },
    UpsertCustomerUseCase,
    GetCustomerUseCase,
  ],
  exports: [CUSTOMER_REPOSITORY, UpsertCustomerUseCase],
})
export class CustomersModule {}
