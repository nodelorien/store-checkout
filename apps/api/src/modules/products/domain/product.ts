import { DomainError, DomainErrors } from '../../../shared/errors/domain-error';
import { err, ok, Result } from '../../../shared/result/result';
import { Currency, Money } from './money';
import { Quantity } from './quantity';

export interface ProductProps {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priceInCents: number;
  readonly currency: Currency;
  readonly imageUrl: string;
  readonly stock: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Catalogue item. Seeded; stock only changes through the atomic approval write (ADR-0011). */
export class Product {
  private constructor(private readonly props: ProductProps) {}

  /** Rebuilds a product from trusted storage. */
  static restore(props: ProductProps): Product {
    return new Product({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string {
    return this.props.description;
  }
  get priceInCents(): number {
    return this.props.priceInCents;
  }
  get currency(): Currency {
    return this.props.currency;
  }
  get imageUrl(): string {
    return this.props.imageUrl;
  }
  get stock(): number {
    return this.props.stock;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get updatedAt(): string {
    return this.props.updatedAt;
  }

  price(): Result<Money, DomainError> {
    return Money.of(this.props.priceInCents, this.props.currency);
  }

  /** Early stock check (BR-03). The authoritative check is the conditional write on approval. */
  ensureAvailable(quantity: Quantity): Result<Product, DomainError> {
    return this.props.stock >= quantity.value
      ? ok(this)
      : err(DomainErrors.outOfStock(this.props.stock));
  }

  toProps(): ProductProps {
    return { ...this.props };
  }
}
