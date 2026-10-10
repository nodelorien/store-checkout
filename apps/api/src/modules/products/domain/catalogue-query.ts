import { DomainError, DomainErrors } from '../../../shared/errors/domain-error';
import { err, ok, Result } from '../../../shared/result/result';
import { Product } from './product';

export const PRODUCT_SORTS = ['featured', 'name', 'price-asc', 'price-desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
/** Without `sort` the catalogue keeps the order it has always had (spec 003 AC-1: by name). */
export const DEFAULT_PRODUCT_SORT: ProductSort = 'name';
export const MAX_PAGE_SIZE = 48;
export const MAX_SEARCH_LENGTH = 60;

export interface CatalogueQueryInput {
  readonly page?: number;
  readonly pageSize?: number;
  readonly search?: string;
  readonly sort?: string;
}

export interface PageMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface CataloguePage {
  readonly items: Product[];
  readonly meta: PageMeta;
}

type Comparator = (a: Product, b: Product) => number;

const byId: Comparator = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** Fixed locale so the order does not depend on the host; the id breaks ties. */
const byName: Comparator = (a, b) => a.name.localeCompare(b.name, 'en') || byId(a, b);

/**
 * `featured` is the curated order of the catalogue: the order of the seed, whose ids are sequential.
 * Every comparator ends in a total order, so paging never repeats or skips a product.
 */
const COMPARATORS: Record<ProductSort, Comparator> = {
  featured: (a, b) => a.id.localeCompare(b.id),
  name: byName,
  'price-asc': (a, b) => a.priceInCents - b.priceInCents || byName(a, b),
  'price-desc': (a, b) => b.priceInCents - a.priceInCents || byName(a, b),
};

const isIntegerIn = (value: number, min: number, max: number): boolean =>
  Number.isInteger(value) && value >= min && value <= max;

/**
 * A validated catalogue query: search → sort → slice, all in memory over the full product list
 * (the catalogue is small; see `data-model.md`).
 */
export class CatalogueQuery {
  private constructor(
    readonly page: number,
    /** `undefined` = no pagination: everything that matches, in one page. */
    readonly pageSize: number | undefined,
    /** Trimmed and lower-cased; empty = no filter. */
    readonly search: string,
    readonly sort: ProductSort,
  ) {}

  static create(input: CatalogueQueryInput = {}): Result<CatalogueQuery, DomainError> {
    const page = input.page ?? 1;
    if (!isIntegerIn(page, 1, Number.MAX_SAFE_INTEGER)) {
      return err(DomainErrors.invalidField('page', 'page must be an integer greater than 0'));
    }
    if (input.pageSize !== undefined && !isIntegerIn(input.pageSize, 1, MAX_PAGE_SIZE)) {
      return err(
        DomainErrors.invalidField(
          'pageSize',
          `pageSize must be an integer between 1 and ${MAX_PAGE_SIZE}`,
        ),
      );
    }
    const search = (input.search ?? '').trim();
    if (search.length > MAX_SEARCH_LENGTH) {
      return err(
        DomainErrors.invalidField(
          'search',
          `search must be at most ${MAX_SEARCH_LENGTH} characters`,
        ),
      );
    }
    const sort = input.sort ?? DEFAULT_PRODUCT_SORT;
    if (!(PRODUCT_SORTS as readonly string[]).includes(sort)) {
      return err(
        DomainErrors.invalidField('sort', `sort must be one of ${PRODUCT_SORTS.join(', ')}`),
      );
    }
    return ok(new CatalogueQuery(page, input.pageSize, search.toLowerCase(), sort as ProductSort));
  }

  apply(products: readonly Product[]): CataloguePage {
    const matching = products
      .filter((product) => this.matches(product))
      .sort(COMPARATORS[this.sort]);
    const total = matching.length;

    if (this.pageSize === undefined) {
      return {
        items: matching,
        meta: { page: 1, pageSize: Math.max(1, total), total, totalPages: 1 },
      };
    }
    const start = (this.page - 1) * this.pageSize;
    return {
      items: matching.slice(start, start + this.pageSize),
      meta: {
        page: this.page,
        pageSize: this.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / this.pageSize)),
      },
    };
  }

  private matches(product: Product): boolean {
    return (
      this.search === '' ||
      product.name.toLowerCase().includes(this.search) ||
      product.description.toLowerCase().includes(this.search)
    );
  }
}
