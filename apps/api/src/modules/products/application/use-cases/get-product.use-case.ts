import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/domain-error';
import { fromResult, Result } from '../../../../shared/result/result';
import { PRODUCT_REPOSITORY, ProductRepository } from '../ports/product-repository.port';
import { ProductView, toProductView } from './product.views';

@Injectable()
export class GetProductUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  /** Railway: find by id → view. Errors: PRODUCT_NOT_FOUND, PERSISTENCE_ERROR. */
  execute(id: string): Promise<Result<ProductView, DomainError>> {
    return fromResult(this.products.findById(id)).map(toProductView).toPromise();
  }
}
