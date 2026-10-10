import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/domain-error';
import { fromResult, Result } from '../../../../shared/result/result';
import { PRODUCT_REPOSITORY, ProductRepository } from '../ports/product-repository.port';
import { ProductView, toProductView } from './product.views';

@Injectable()
export class ListProductsUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  /** Railway: load all → sort by name → views. Errors: PERSISTENCE_ERROR. */
  execute(): Promise<Result<ProductView[], DomainError>> {
    return fromResult(this.products.findAll())
      .map((products) => [...products].sort((a, b) => a.name.localeCompare(b.name)))
      .map((products) => products.map(toProductView))
      .toPromise();
  }
}
