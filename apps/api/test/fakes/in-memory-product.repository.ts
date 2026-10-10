import { ProductRepository } from '../../src/modules/products/application/ports/product-repository.port';
import { Product } from '../../src/modules/products/domain/product';
import { DomainError, DomainErrors } from '../../src/shared/errors/domain-error';
import { err, ok, Result } from '../../src/shared/result/result';

export class InMemoryProductRepository implements ProductRepository {
  readonly items = new Map<string, Product>();
  failWith: DomainError | undefined;

  constructor(products: Product[] = []) {
    products.forEach((product) => this.items.set(product.id, product));
  }

  async findAll(): Promise<Result<Product[], DomainError>> {
    return this.failWith ? err(this.failWith) : ok([...this.items.values()]);
  }

  async findById(id: string): Promise<Result<Product, DomainError>> {
    if (this.failWith) {
      return err(this.failWith);
    }
    const product = this.items.get(id);
    return product ? ok(product) : err(DomainErrors.productNotFound());
  }

  /** Test helper mirroring the atomic decrement done by the transaction repository. */
  setStock(id: string, stock: number): void {
    const product = this.items.get(id);
    if (product) {
      this.items.set(id, Product.restore({ ...product.toProps(), stock }));
    }
  }

  stockOf(id: string): number | undefined {
    return this.items.get(id)?.stock;
  }
}
