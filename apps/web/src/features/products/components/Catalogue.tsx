import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGetProductsPageQuery } from '@/shared/api/baseApi';
import type { CatalogueQuery, CatalogueSort } from '@/shared/api/types';
import { visuallyHidden } from '@/shared/ui/atoms/visuallyHidden';
import {
  PAGE_SIZE,
  hasMorePages,
  parseCatalogueView,
  toSearchParams,
  type CatalogueView,
} from '../catalogue';
import { CatalogueToolbar } from './CatalogueToolbar';
import { GridList, ProductItems, SkeletonItems } from './ProductGrid';

type OnPay = (productId: string) => void;
type PageQuery = ReturnType<typeof useGetProductsPageQuery>;

const fresh = { refetchOnMountOrArgChange: true } as const;

function LoadError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <Alert
      severity="error"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      We could not load the products. {message}
    </Alert>
  );
}

function EmptyState({ search, onClear }: { search: string; onClear: () => void }) {
  return (
    <Stack role="status" spacing={1} sx={{ alignItems: 'center', textAlign: 'center', py: 6 }}>
      <Typography variant="h3">
        {search ? `No products match “${search}”` : 'No products available'}
      </Typography>
      {search ? (
        <Button onClick={onClear}>Clear search</Button>
      ) : (
        <Typography color="text.secondary">Please check back soon.</Typography>
      )}
    </Stack>
  );
}

/** One page of an endless list: its cards, or placeholders while it loads. */
function EndlessPage({ query, onPay }: { query: CatalogueQuery; onPay: OnPay }) {
  const page = useGetProductsPageQuery(query, fresh);

  if (page.data) {
    return (
      <ProductItems
        products={page.data.items}
        startIndex={(query.page - 1) * query.pageSize}
        onPay={onPay}
      />
    );
  }
  if (page.error) {
    return (
      <Box component="li" sx={{ gridColumn: '1 / -1' }}>
        <LoadError message={page.error.message} onRetry={() => void page.refetch()} />
      </Box>
    );
  }
  return <SkeletonItems count={query.pageSize} />;
}

/** Asks for the next page when it scrolls into view; the button works without an observer. */
function LoadMore({ onLoad }: { onLoad: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver !== 'function') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoad();
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [onLoad]);

  return (
    <Box ref={ref} sx={{ display: 'flex', justifyContent: 'center' }}>
      <Button variant="outlined" onClick={onLoad}>
        Load more products
      </Button>
    </Box>
  );
}

interface ModeProps {
  view: CatalogueView;
  first: PageQuery;
  onPay: OnPay;
  onPage: (page: number) => void;
}

/** Phones: pages are appended below as the customer scrolls. */
function EndlessCatalogue({ view, first, onPay }: ModeProps) {
  const [pages, setPages] = useState(1);
  const total = first.data?.meta.totalPages ?? 1;
  const loadNext = useCallback(() => setPages((count) => Math.min(count + 1, total)), [total]);

  return (
    <>
      <GridList busy={!first.data}>
        {Array.from({ length: pages }, (_, index) => (
          <EndlessPage
            key={index}
            query={{ ...view, page: index + 1, pageSize: PAGE_SIZE.endless }}
            onPay={onPay}
          />
        ))}
      </GridList>
      {hasMorePages(first.data?.meta, pages) && <LoadMore onLoad={loadNext} />}
    </>
  );
}

/** Wide screens: one page at a time, chosen by number. */
function PagedCatalogue({ view, first, onPay, onPage }: ModeProps) {
  const meta = first.data?.meta;

  // A page past the end (stale link, catalogue shrank): go to the last one that exists.
  useEffect(() => {
    if (meta && view.page > meta.totalPages) onPage(meta.totalPages);
  }, [meta, view.page, onPage]);

  return (
    <>
      <GridList busy={!first.data || first.isFetching}>
        {first.data ? (
          <ProductItems products={first.data.items} onPay={onPay} />
        ) : (
          <SkeletonItems count={PAGE_SIZE.paged} />
        )}
      </GridList>
      {meta && meta.totalPages > 1 && (
        <Box
          component="nav"
          aria-label="Catalogue pages"
          sx={{ display: 'flex', justifyContent: 'center' }}
        >
          <Pagination
            count={meta.totalPages}
            page={Math.min(view.page, meta.totalPages)}
            color="primary"
            shape="rounded"
            onChange={(_event, page) => onPage(page)}
          />
        </Box>
      )}
    </>
  );
}

/**
 * The product catalogue: search, order and the list itself. The view lives in the address bar
 * (`?q=&sort=&page=`), so it survives a reload and can be shared. Wide screens page by number;
 * phones append pages as the customer scrolls.
 */
interface CatalogueProps {
  onPay: OnPay;
  /**
   * The whole-catalogue read the checkout depends on, when it failed: buying would not work, so
   * the list is replaced by the error until a retry succeeds.
   */
  checkoutData?: { failed: boolean; message?: string; retry: () => void };
}

export function Catalogue({ onPay, checkoutData }: CatalogueProps) {
  const theme = useTheme();
  const paged = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const [params, setParams] = useSearchParams();
  const view = parseCatalogueView(params);
  const top = useRef<HTMLDivElement>(null);

  const firstQuery: CatalogueQuery = paged
    ? { ...view, pageSize: PAGE_SIZE.paged }
    : { ...view, page: 1, pageSize: PAGE_SIZE.endless };
  const first = useGetProductsPageQuery(firstQuery, fresh);

  const show = useCallback(
    (next: Partial<CatalogueView>) =>
      setParams((current) => toSearchParams({ ...parseCatalogueView(current), ...next }), {
        replace: next.page === undefined,
      }),
    [setParams],
  );
  const onSearch = useCallback((search: string) => show({ search, page: 1 }), [show]);
  const onSort = useCallback((sort: CatalogueSort) => show({ sort, page: 1 }), [show]);
  const onPage = useCallback(
    (page: number) => {
      show({ page });
      top.current?.scrollIntoView?.({ block: 'start' });
    },
    [show],
  );

  const failed = (!first.data && first.error) || checkoutData?.failed;
  const retry = () => {
    void first.refetch();
    checkoutData?.retry();
  };
  const loading = !first.data && !first.error;
  const empty = first.data?.meta.total === 0;
  const Mode = paged ? PagedCatalogue : EndlessCatalogue;

  return (
    <Stack ref={top} spacing={{ xs: 2.5, md: 3 }} sx={{ scrollMarginTop: 88 }}>
      <CatalogueToolbar
        search={view.search}
        sort={view.sort}
        total={first.data?.meta.total ?? null}
        onSearch={onSearch}
        onSort={onSort}
      />

      {loading && (
        <Box role="status" sx={visuallyHidden}>
          Loading products…
        </Box>
      )}

      {failed ? (
        <LoadError message={first.error?.message ?? checkoutData?.message} onRetry={retry} />
      ) : empty ? (
        <EmptyState search={view.search} onClear={() => onSearch('')} />
      ) : (
        // Re-mounted per search and order so an endless list starts again from its first page.
        <Mode
          key={`${view.search}|${view.sort}`}
          view={view}
          first={first}
          onPay={onPay}
          onPage={onPage}
        />
      )}
    </Stack>
  );
}
