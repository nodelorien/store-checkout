import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/domain-error';
import { fromResult, Result } from '../../../../shared/result/result';
import { CatalogueQuery, CatalogueQueryInput, PageMeta } from '../../domain/catalogue-query';
import { PRODUCT_REPOSITORY, ProductRepository } from '../ports/product-repository.port';
import { ProductView, toProductView } from './product.views';

export interface ProductListView {
  readonly items: ProductView[];
  readonly meta: PageMeta;
}

@Injectable()
export class ListProductsUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  /**
   * Railway: validate query → load all → search, sort, slice → views.
   * Errors: VALIDATION_ERROR, PERSISTENCE_ERROR.
   */
  execute(input: CatalogueQueryInput = {}): Promise<Result<ProductListView, DomainError>> {
    return fromResult(CatalogueQuery.create(input))
      .andThen((query) =>
        fromResult(this.products.findAll()).map((products) => query.apply(products)),
      )
      .map(({ items, meta }) => ({ items: items.map(toProductView), meta }))
      .toPromise();
  }
}
