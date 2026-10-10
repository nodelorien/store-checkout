import { Module } from '@nestjs/common';
import { PRODUCT_REPOSITORY } from './application/ports/product-repository.port';
import { GetProductStockUseCase } from './application/use-cases/get-product-stock.use-case';
import { GetProductUseCase } from './application/use-cases/get-product.use-case';
import { ListProductsUseCase } from './application/use-cases/list-products.use-case';
import { ProductsController } from './infrastructure/http/products.controller';
import { DynamoDbProductRepository } from './infrastructure/persistence/dynamodb-product.repository';

@Module({
  controllers: [ProductsController],
  providers: [
    { provide: PRODUCT_REPOSITORY, useClass: DynamoDbProductRepository },
    ListProductsUseCase,
    GetProductUseCase,
    GetProductStockUseCase,
  ],
  exports: [PRODUCT_REPOSITORY],
})
export class ProductsModule {}
