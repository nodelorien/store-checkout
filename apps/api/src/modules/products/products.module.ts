import { Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../shared/config/app-config';
import { CACHE, Cache } from '../../shared/ports/cache.port';
import { CATALOGUE_INVALIDATOR } from './application/ports/catalogue-invalidator.port';
import { PRODUCT_REPOSITORY } from './application/ports/product-repository.port';
import { GetProductStockUseCase } from './application/use-cases/get-product-stock.use-case';
import { GetProductUseCase } from './application/use-cases/get-product.use-case';
import { ListProductsUseCase } from './application/use-cases/list-products.use-case';
import { ProductsController } from './infrastructure/http/products.controller';
import { CachedProductRepository } from './infrastructure/persistence/cached-product.repository';
import { DynamoDbProductRepository } from './infrastructure/persistence/dynamodb-product.repository';

@Module({
  controllers: [ProductsController],
  providers: [
    DynamoDbProductRepository,
    {
      provide: CachedProductRepository,
      inject: [DynamoDbProductRepository, CACHE, APP_CONFIG],
      useFactory: (repository: DynamoDbProductRepository, cache: Cache, config: AppConfig) =>
        new CachedProductRepository(repository, cache, {
          namespace: config.tables.products,
          ttlSeconds: config.cache.catalogueTtlSeconds,
        }),
    },
    { provide: PRODUCT_REPOSITORY, useExisting: CachedProductRepository },
    { provide: CATALOGUE_INVALIDATOR, useExisting: CachedProductRepository },
    ListProductsUseCase,
    GetProductUseCase,
    GetProductStockUseCase,
  ],
  exports: [PRODUCT_REPOSITORY, CATALOGUE_INVALIDATOR],
})
export class ProductsModule {}
