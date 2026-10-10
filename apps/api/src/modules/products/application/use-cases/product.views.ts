import { Product } from '../../domain/product';

export interface ProductView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priceInCents: number;
  readonly currency: string;
  readonly imageUrl: string;
  readonly stock: number;
}

export interface ProductStockView {
  readonly productId: string;
  readonly stock: number;
  readonly updatedAt: string;
}

export function toProductView(product: Product): ProductView {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    priceInCents: product.priceInCents,
    currency: product.currency,
    imageUrl: product.imageUrl,
    stock: product.stock,
  };
}

export function toProductStockView(product: Product): ProductStockView {
  return { productId: product.id, stock: product.stock, updatedAt: product.updatedAt };
}
