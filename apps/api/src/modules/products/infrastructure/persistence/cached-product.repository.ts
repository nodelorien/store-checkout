import { readThrough } from '../../../../shared/cache/read-through';
import { DomainError } from '../../../../shared/errors/domain-error';
import { Cache } from '../../../../shared/ports/cache.port';
import { Result } from '../../../../shared/result/result';
import { CatalogueInvalidator } from '../../application/ports/catalogue-invalidator.port';
import { ProductRepository } from '../../application/ports/product-repository.port';
import { Product, ProductProps } from '../../domain/product';

export interface CatalogueCacheSettings {
  /** Distinguishes stages that share one Redis; the products table name is unique per stage. */
  readonly namespace: string;
  readonly ttlSeconds: number;
}

/**
 * Caches the full catalogue read in front of another repository. Reads of one product are
 * never cached: the stock check before a charge must see the stored value.
 */
export class CachedProductRepository implements ProductRepository, CatalogueInvalidator {
  private readonly key: string;

  constructor(
    private readonly inner: ProductRepository,
    private readonly cache: Cache,
    private readonly settings: CatalogueCacheSettings,
  ) {
    this.key = `catalogue:${settings.namespace}`;
  }

  findAll(): Promise<Result<Product[], DomainError>> {
    return readThrough<Product[]>({
      cache: this.cache,
      key: this.key,
      ttlSeconds: this.settings.ttlSeconds,
      load: () => this.inner.findAll(),
      encode: (products) => products.map((product) => product.toProps()),
      decode: (stored) =>
        Array.isArray(stored)
          ? stored.map((props: ProductProps) => Product.restore(props))
          : undefined,
    });
  }

  findById(id: string): Promise<Result<Product, DomainError>> {
    return this.inner.findById(id);
  }

  invalidate(): Promise<void> {
    return this.cache.delete(this.key);
  }
}
