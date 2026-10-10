import { Product, ProductProps } from '../../src/modules/products/domain/product';

export const PRODUCT_ID = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b';

export class ProductBuilder {
  private props: ProductProps = {
    id: PRODUCT_ID,
    name: 'Aurora Desk Lamp',
    description: 'Dimmable LED desk lamp',
    priceInCents: 12_990_000,
    currency: 'COP',
    imageUrl: '/images/products/aurora-desk-lamp.svg',
    stock: 5,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  with(overrides: Partial<ProductProps>): this {
    this.props = { ...this.props, ...overrides };
    return this;
  }

  withId(id: string): this {
    return this.with({ id });
  }

  withStock(stock: number): this {
    return this.with({ stock });
  }

  withPrice(priceInCents: number): this {
    return this.with({ priceInCents });
  }

  build(): Product {
    return Product.restore(this.props);
  }
}

export const aProduct = (): ProductBuilder => new ProductBuilder();
