/** Types of the HTTP contract (`docs/components/backend/api.md`). Money is always integer cents. */

export type CardBrand = 'VISA' | 'MASTERCARD';

export const TRANSACTION_STATUSES = ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export interface Product {
  id: string;
  name: string;
  description: string;
  priceInCents: number;
  currency: string;
  imageUrl: string;
  stock: number;
}

export const CATALOGUE_SORTS = ['featured', 'name', 'price-asc', 'price-desc'] as const;
export type CatalogueSort = (typeof CATALOGUE_SORTS)[number];

/** Query of `GET /products`. Without `pageSize` the API returns every match in one page. */
export interface CatalogueQuery {
  page: number;
  pageSize: number;
  search: string;
  sort: CatalogueSort;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ProductsPage {
  items: Product[];
  meta: PageMeta;
}

export interface PaymentConfig {
  publicKey: string;
  tokenizationUrl: string;
  acceptance: { token: string; permalink: string };
  currency: string;
  baseFeeInCents: number;
  deliveryFeeInCents: number;
}

export interface OrderAmounts {
  subtotalInCents: number;
  baseFeeInCents: number;
  deliveryFeeInCents: number;
  totalInCents: number;
}

export interface CreateTransactionBody {
  productId: string;
  quantity: number;
  cardToken: string;
  cardBrand: CardBrand;
  cardLastFour: string;
  installments: number;
  acceptanceToken: string;
  customer: { fullName: string; email: string; phone: string };
  delivery: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    region: string;
    country: 'CO';
    postalCode?: string;
  };
}

export interface CreateTransactionArgs {
  body: CreateTransactionBody;
  idempotencyKey: string;
}

export interface Transaction {
  id: string;
  reference: string;
  status: TransactionStatus;
  statusMessage: string | null;
  product: { id: string; name: string; imageUrl: string };
  quantity: number;
  amounts: OrderAmounts;
  currency: string;
  card: { brand: CardBrand; lastFour: string };
  customerId: string;
  deliveryId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export const DELIVERY_STATUSES = ['PENDING', 'SHIPPED', 'DELIVERED'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface DeliveryAddress {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string;
  country: string;
  postalCode: string | null;
}

export interface Delivery {
  id: string;
  transactionId: string;
  customerId: string;
  productId: string;
  quantity: number;
  address: DeliveryAddress;
  status: DeliveryStatus;
  createdAt: string;
  updatedAt: string;
}

/** `PATCH /deliveries/:id`: any subset of the address; fields not sent are kept. */
export type DeliveryAddressPatch = Partial<
  Pick<DeliveryAddress, 'addressLine1' | 'city' | 'region'> & {
    addressLine2: string;
    postalCode: string;
  }
>;

export function isFinalStatus(status: TransactionStatus): boolean {
  return status !== 'PENDING';
}
