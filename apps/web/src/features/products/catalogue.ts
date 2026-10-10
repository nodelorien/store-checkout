import { CATALOGUE_SORTS, type CatalogueSort, type PageMeta } from '@/shared/api/types';

/** Products per request: a short column on phones, two full rows of four on wide screens. */
export const PAGE_SIZE = { endless: 6, paged: 8 } as const;
export const MAX_SEARCH_LENGTH = 60;

export const SORT_LABELS: Record<CatalogueSort, string> = {
  featured: 'Featured',
  name: 'Name (A–Z)',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
};

export interface CatalogueView {
  page: number;
  search: string;
  sort: CatalogueSort;
}

/** What the address bar says to show. Anything invalid falls back to the default view. */
export function parseCatalogueView(params: URLSearchParams): CatalogueView {
  const page = Number(params.get('page'));
  const sort = params.get('sort') as CatalogueSort;

  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    search: (params.get('q') ?? '').trim().slice(0, MAX_SEARCH_LENGTH),
    sort: CATALOGUE_SORTS.includes(sort) ? sort : 'featured',
  };
}

/** The shortest query string for a view: defaults are left out. */
export function toSearchParams(view: CatalogueView): URLSearchParams {
  const params = new URLSearchParams();
  if (view.search) params.set('q', view.search);
  if (view.sort !== 'featured') params.set('sort', view.sort);
  if (view.page > 1) params.set('page', String(view.page));
  return params;
}

export function hasMorePages(meta: PageMeta | undefined, loadedPages: number): boolean {
  return meta !== undefined && loadedPages < meta.totalPages;
}

export function resultsLabel(total: number, search: string): string {
  const noun = total === 1 ? 'product' : 'products';
  return search ? `${total} ${noun} for “${search}”` : `${total} ${noun}`;
}
