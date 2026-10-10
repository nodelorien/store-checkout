import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/domain-error';
import { fromResult, Result } from '../../../../shared/result/result';
import { PRODUCT_REPOSITORY, ProductRepository } from '../ports/product-repository.port';
import { ProductStockView, toProductStockView } from './product.views';

@Injectable()
export class GetProductStockUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  /** Railway: find by id → stock view. Errors: PRODUCT_NOT_FOUND, PERSISTENCE_ERROR. */
  execute(id: string): Promise<Result<ProductStockView, DomainError>> {
    return fromResult(this.products.findById(id)).map(toProductStockView).toPromise();
  }
}
