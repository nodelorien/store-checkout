import { DomainError } from '../../../../shared/errors/domain-error';
import { Result } from '../../../../shared/result/result';
import { Product } from '../../domain/product';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductRepository {
  findAll(): Promise<Result<Product[], DomainError>>;
  /** `err(PRODUCT_NOT_FOUND)` when the id does not exist. */
  findById(id: string): Promise<Result<Product, DomainError>>;
}
