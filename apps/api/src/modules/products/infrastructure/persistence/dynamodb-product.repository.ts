import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../../../shared/config/app-config';
import {
  DYNAMODB_DOCUMENT_CLIENT,
  toPersistenceError,
} from '../../../../shared/dynamodb/dynamodb.client';
import { DomainError, DomainErrors } from '../../../../shared/errors/domain-error';
import { err, ok, Result, tryAsync } from '../../../../shared/result/result';
import { ProductRepository } from '../../application/ports/product-repository.port';
import { Product } from '../../domain/product';

export type ProductItem = Record<string, unknown>;

export function toProductItem(product: Product): ProductItem {
  return { ...product.toProps() };
}

export function toProduct(item: Record<string, unknown>): Product {
  return Product.restore({
    id: String(item.id),
    name: String(item.name),
    description: String(item.description),
    priceInCents: Number(item.priceInCents),
    currency: 'COP',
    imageUrl: String(item.imageUrl),
    stock: Number(item.stock),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
  });
}

@Injectable()
export class DynamoDbProductRepository implements ProductRepository {
  private readonly table: string;

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT) private readonly client: DynamoDBDocumentClient,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.table = config.tables.products;
  }

  /** Scan is acceptable here: the catalogue is a handful of seeded items (data-model.md). */
  findAll(): Promise<Result<Product[], DomainError>> {
    return tryAsync(async () => {
      const products: Product[] = [];
      let startKey: Record<string, unknown> | undefined;
      do {
        const page = await this.client.send(
          new ScanCommand({ TableName: this.table, ExclusiveStartKey: startKey }),
        );
        products.push(...(page.Items ?? []).map(toProduct));
        startKey = page.LastEvaluatedKey;
      } while (startKey);
      return products;
    }, toPersistenceError);
  }

  async findById(id: string): Promise<Result<Product, DomainError>> {
    const output = await tryAsync(
      () => this.client.send(new GetCommand({ TableName: this.table, Key: { id } })),
      toPersistenceError,
    );
    return output.andThen((result) =>
      result.Item ? ok(toProduct(result.Item)) : err(DomainErrors.productNotFound()),
    );
  }
}
